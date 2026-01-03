import type { OAuthClient } from '@agentest/db';
import { OAuthRepository, type IOAuthRepository } from '../repositories/oauth.repository.js';
import {
  generateAuthorizationCode,
  generateAccessToken,
  generateClientId,
  hashToken,
  verifyCodeChallenge,
} from '../utils/pkce.js';
import {
  type ClientRegistrationInput,
  type AuthorizeRequestInput,
  type TokenRequestInput,
  validateRedirectUri,
  parseAndValidateScopes,
  SUPPORTED_SCOPES,
} from '../validators/oauth.validator.js';
import { env } from '../config/env.js';

// 認可コード有効期限: 10分
const AUTHORIZATION_CODE_EXPIRES_IN = 10 * 60 * 1000;

// アクセストークン有効期限: 1時間
const ACCESS_TOKEN_EXPIRES_IN = 60 * 60 * 1000;

/**
 * OAuth エラー
 */
export class OAuthError extends Error {
  constructor(
    public error: string,
    public errorDescription: string,
    public statusCode: number = 400
  ) {
    super(errorDescription);
    this.name = 'OAuthError';
  }
}

/**
 * OAuth サービス
 */
export class OAuthService {
  constructor(private repository: IOAuthRepository = new OAuthRepository()) {}

  // ============================================
  // Authorization Server Metadata
  // ============================================

  getAuthorizationServerMetadata() {
    const baseUrl = env.API_BASE_URL;
    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      revocation_endpoint: `${baseUrl}/oauth/revoke`,
      introspection_endpoint: `${baseUrl}/oauth/introspect`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: SUPPORTED_SCOPES,
    };
  }

  // ============================================
  // 動的クライアント登録 (RFC 7591)
  // ============================================

  async registerClient(input: ClientRegistrationInput): Promise<{
    client_id: string;
    client_id_issued_at: number;
    client_name: string;
    redirect_uris: string[];
    grant_types: string[];
    response_types: string[];
    token_endpoint_auth_method: string;
    scope?: string;
  }> {
    // redirect_urisの検証 (localhost/127.0.0.1のみ許可)
    for (const uri of input.redirect_uris) {
      if (!validateRedirectUri(uri)) {
        throw new OAuthError(
          'invalid_redirect_uri',
          'redirect_uri must be localhost or 127.0.0.1',
          400
        );
      }
    }

    // MCP Inspector対応: /oauth/callback と /oauth/callback/debug の両方を登録
    // MCP Inspectorはガイド付きフローと接続時で異なるパスを使用するため
    const expandedRedirectUris = new Set(input.redirect_uris);
    for (const uri of input.redirect_uris) {
      try {
        const url = new URL(uri);
        // /oauth/callback/debug が登録された場合、/oauth/callback も追加
        if (url.pathname === '/oauth/callback/debug') {
          url.pathname = '/oauth/callback';
          expandedRedirectUris.add(url.toString());
        }
        // /oauth/callback が登録された場合、/oauth/callback/debug も追加
        if (url.pathname === '/oauth/callback') {
          url.pathname = '/oauth/callback/debug';
          expandedRedirectUris.add(url.toString());
        }
      } catch {
        // URLパースエラーは無視
      }
    }
    const finalRedirectUris = Array.from(expandedRedirectUris);

    // スコープのパースと検証
    const scopes = parseAndValidateScopes(input.scope);

    // クライアントID生成
    const clientId = generateClientId();

    // クライアント作成
    const client = await this.repository.createClient({
      clientId,
      clientName: input.client_name,
      redirectUris: finalRedirectUris,
      grantTypes: input.grant_types,
      responseTypes: input.response_types,
      tokenEndpointAuthMethod: input.token_endpoint_auth_method,
      scopes,
      clientUri: input.client_uri,
      logoUri: input.logo_uri,
      softwareId: input.software_id,
      softwareVersion: input.software_version,
    });

    return {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.clientIdIssuedAt.getTime() / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: client.grantTypes,
      response_types: client.responseTypes,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      ...(scopes.length > 0 && { scope: scopes.join(' ') }),
    };
  }

  // ============================================
  // 認可リクエスト検証
  // ============================================

  async validateAuthorizeRequest(input: AuthorizeRequestInput): Promise<{
    client: OAuthClient;
    scopes: string[];
    redirectUri: string;
  }> {
    // クライアント検証
    const client = await this.repository.findClientByClientId(input.client_id);
    if (!client) {
      throw new OAuthError('invalid_client', 'Client not found', 401);
    }

    // redirect_uri検証 (登録済みURIとの照合)
    if (!client.redirectUris.includes(input.redirect_uri)) {
      throw new OAuthError(
        'invalid_redirect_uri',
        'redirect_uri does not match registered URIs',
        400
      );
    }

    // PKCE検証 (S256必須)
    if (input.code_challenge_method !== 'S256') {
      throw new OAuthError(
        'invalid_request',
        'code_challenge_method must be S256',
        400
      );
    }

    // スコープの検証
    const scopes = parseAndValidateScopes(input.scope);

    return {
      client,
      scopes,
      redirectUri: input.redirect_uri,
    };
  }

  // ============================================
  // 認可コード発行
  // ============================================

  async issueAuthorizationCode(params: {
    clientId: string;
    userId: string;
    redirectUri: string;
    scopes: string[];
    codeChallenge: string;
    codeChallengeMethod: string;
    resource: string;
  }): Promise<string> {
    const code = generateAuthorizationCode();
    const expiresAt = new Date(Date.now() + AUTHORIZATION_CODE_EXPIRES_IN);

    await this.repository.createAuthorizationCode({
      code,
      clientId: params.clientId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      scopes: params.scopes,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod,
      resource: params.resource,
      expiresAt,
    });

    return code;
  }

  // ============================================
  // トークン発行
  // ============================================

  async exchangeCodeForToken(input: TokenRequestInput): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    scope?: string;
  }> {
    // 認可コード検証
    const authCode = await this.repository.findAuthorizationCodeByCode(input.code);
    if (!authCode) {
      throw new OAuthError('invalid_grant', 'Authorization code not found', 400);
    }

    // 有効期限検証
    if (authCode.expiresAt < new Date()) {
      throw new OAuthError('invalid_grant', 'Authorization code expired', 400);
    }

    // 使用済み検証 (RFC 6749 Section 4.1.2)
    // 認可コードが再利用された場合、セキュリティ侵害の可能性があるため
    // このコードで発行された全てのトークンを無効化する
    if (authCode.usedAt) {
      await this.repository.revokeAllAccessTokensByUserId(authCode.userId, authCode.clientId);
      throw new OAuthError('invalid_grant', 'Authorization code already used', 400);
    }

    // クライアントID検証
    if (authCode.clientId !== input.client_id) {
      throw new OAuthError('invalid_grant', 'Client ID mismatch', 400);
    }

    // redirect_uri検証
    if (authCode.redirectUri !== input.redirect_uri) {
      throw new OAuthError('invalid_grant', 'redirect_uri mismatch', 400);
    }

    // PKCE検証
    if (!verifyCodeChallenge(input.code_verifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
      throw new OAuthError('invalid_grant', 'code_verifier verification failed', 400);
    }

    // resource検証 (RFC 8707)
    if (input.resource && input.resource !== authCode.resource) {
      throw new OAuthError('invalid_target', 'resource mismatch', 400);
    }

    // 認可コードを使用済みにマーク
    await this.repository.markAuthorizationCodeAsUsed(input.code);

    // アクセストークン発行
    const accessToken = generateAccessToken();
    const tokenHash = hashToken(accessToken);
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRES_IN);

    await this.repository.createAccessToken({
      tokenHash,
      clientId: authCode.clientId,
      userId: authCode.userId,
      scopes: authCode.scopes,
      audience: authCode.resource,
      expiresAt,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor(ACCESS_TOKEN_EXPIRES_IN / 1000),
      ...(authCode.scopes.length > 0 && { scope: authCode.scopes.join(' ') }),
    };
  }

  // ============================================
  // トークンイントロスペクション (RFC 7662)
  // ============================================

  async introspectToken(token: string): Promise<{
    active: boolean;
    client_id?: string;
    sub?: string;
    scope?: string;
    aud?: string;
    exp?: number;
    iat?: number;
  }> {
    const tokenHash = hashToken(token);
    const accessToken = await this.repository.findAccessTokenByHash(tokenHash);

    // トークンが見つからない or 失効済み or 有効期限切れ
    if (!accessToken || accessToken.revokedAt || accessToken.expiresAt < new Date()) {
      return { active: false };
    }

    return {
      active: true,
      client_id: accessToken.clientId,
      sub: accessToken.userId,
      scope: accessToken.scopes.join(' '),
      aud: accessToken.audience,
      exp: Math.floor(accessToken.expiresAt.getTime() / 1000),
      iat: Math.floor(accessToken.createdAt.getTime() / 1000),
    };
  }

  // ============================================
  // トークン失効 (RFC 7009)
  // ============================================

  async revokeToken(token: string, clientId?: string): Promise<void> {
    const tokenHash = hashToken(token);
    const accessToken = await this.repository.findAccessTokenByHash(tokenHash);

    if (!accessToken) {
      // RFC 7009: トークンが見つからなくても成功レスポンスを返す
      return;
    }

    // クライアントIDが指定されている場合は一致確認
    if (clientId && accessToken.clientId !== clientId) {
      // RFC 7009: クライアントが一致しない場合は何もしない
      return;
    }

    await this.repository.revokeAccessToken(tokenHash);
  }

  // ============================================
  // ユーティリティ
  // ============================================

  /**
   * トークンからユーザーIDを取得（MCPサーバー向け）
   */
  async validateAccessToken(token: string, expectedAudience?: string): Promise<{
    userId: string;
    scopes: string[];
  } | null> {
    const result = await this.introspectToken(token);

    if (!result.active || !result.sub) {
      return null;
    }

    // Audience検証
    if (expectedAudience && result.aud !== expectedAudience) {
      return null;
    }

    return {
      userId: result.sub,
      scopes: result.scope ? result.scope.split(' ') : [],
    };
  }
}

// デフォルトインスタンス
export const oauthService = new OAuthService();
