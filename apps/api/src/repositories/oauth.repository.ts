import { prisma, type PrismaClient, type OAuthClient, type OAuthAuthorizationCode, type OAuthAccessToken } from '@agentest/db';

/**
 * OAuth Repository インターフェース
 */
export interface IOAuthRepository {
  // クライアント
  createClient(data: CreateClientInput): Promise<OAuthClient>;
  findClientByClientId(clientId: string): Promise<OAuthClient | null>;

  // 認可コード
  createAuthorizationCode(data: CreateAuthorizationCodeInput): Promise<OAuthAuthorizationCode>;
  findAuthorizationCodeByCode(code: string): Promise<OAuthAuthorizationCode | null>;
  markAuthorizationCodeAsUsed(code: string): Promise<void>;

  // アクセストークン
  createAccessToken(data: CreateAccessTokenInput): Promise<OAuthAccessToken>;
  findAccessTokenByHash(tokenHash: string): Promise<OAuthAccessToken | null>;
  revokeAccessToken(tokenHash: string): Promise<void>;
  revokeAllAccessTokensByUserId(userId: string, clientId?: string): Promise<void>;
}

export interface CreateClientInput {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: string;
  scopes?: string[];
  clientUri?: string;
  logoUri?: string;
  softwareId?: string;
  softwareVersion?: string;
}

export interface CreateAuthorizationCodeInput {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  expiresAt: Date;
}

export interface CreateAccessTokenInput {
  tokenHash: string;
  clientId: string;
  userId: string;
  scopes: string[];
  audience: string;
  expiresAt: Date;
}

/**
 * OAuth Repository 実装
 */
export class OAuthRepository implements IOAuthRepository {
  constructor(private db: PrismaClient = prisma) {}

  // ============================================
  // クライアント操作
  // ============================================

  async createClient(data: CreateClientInput): Promise<OAuthClient> {
    return this.db.oAuthClient.create({
      data: {
        clientId: data.clientId,
        clientName: data.clientName,
        redirectUris: data.redirectUris,
        grantTypes: data.grantTypes ?? ['authorization_code'],
        responseTypes: data.responseTypes ?? ['code'],
        tokenEndpointAuthMethod: data.tokenEndpointAuthMethod ?? 'none',
        scopes: data.scopes ?? [],
        clientUri: data.clientUri,
        logoUri: data.logoUri,
        softwareId: data.softwareId,
        softwareVersion: data.softwareVersion,
      },
    });
  }

  async findClientByClientId(clientId: string): Promise<OAuthClient | null> {
    return this.db.oAuthClient.findUnique({
      where: { clientId, isActive: true },
    });
  }

  // ============================================
  // 認可コード操作
  // ============================================

  async createAuthorizationCode(data: CreateAuthorizationCodeInput): Promise<OAuthAuthorizationCode> {
    return this.db.oAuthAuthorizationCode.create({
      data: {
        code: data.code,
        clientId: data.clientId,
        userId: data.userId,
        redirectUri: data.redirectUri,
        scopes: data.scopes,
        codeChallenge: data.codeChallenge,
        codeChallengeMethod: data.codeChallengeMethod,
        resource: data.resource,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findAuthorizationCodeByCode(code: string): Promise<OAuthAuthorizationCode | null> {
    return this.db.oAuthAuthorizationCode.findUnique({
      where: { code },
      include: {
        client: true,
        user: true,
      },
    });
  }

  async markAuthorizationCodeAsUsed(code: string): Promise<void> {
    await this.db.oAuthAuthorizationCode.update({
      where: { code },
      data: { usedAt: new Date() },
    });
  }

  // ============================================
  // アクセストークン操作
  // ============================================

  async createAccessToken(data: CreateAccessTokenInput): Promise<OAuthAccessToken> {
    return this.db.oAuthAccessToken.create({
      data: {
        tokenHash: data.tokenHash,
        clientId: data.clientId,
        userId: data.userId,
        scopes: data.scopes,
        audience: data.audience,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findAccessTokenByHash(tokenHash: string): Promise<OAuthAccessToken | null> {
    return this.db.oAuthAccessToken.findUnique({
      where: { tokenHash },
      include: {
        client: true,
        user: true,
      },
    });
  }

  async revokeAccessToken(tokenHash: string): Promise<void> {
    await this.db.oAuthAccessToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllAccessTokensByUserId(userId: string, clientId?: string): Promise<void> {
    await this.db.oAuthAccessToken.updateMany({
      where: {
        userId,
        ...(clientId && { clientId }),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }
}

// デフォルトインスタンス
export const oauthRepository = new OAuthRepository();
