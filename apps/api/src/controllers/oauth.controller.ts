import type { Request, Response, NextFunction } from 'express';
import { OAuthService, OAuthError } from '../services/oauth.service.js';
import {
  clientRegistrationSchema,
  authorizeRequestSchema,
  tokenRequestSchema,
  introspectionRequestSchema,
  revokeRequestSchema,
} from '../validators/oauth.validator.js';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

/**
 * OAuth コントローラー
 */
export class OAuthController {
  constructor(private service: OAuthService = new OAuthService()) {}

  // ============================================
  // Authorization Server Metadata
  // GET /.well-known/oauth-authorization-server
  // ============================================

  getMetadata = (_req: Request, res: Response): void => {
    const metadata = this.service.getAuthorizationServerMetadata();
    res.json(metadata);
  };

  // ============================================
  // 動的クライアント登録
  // POST /oauth/register
  // ============================================

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = clientRegistrationSchema.parse(req.body);
      const result = await this.service.registerClient(input);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'invalid_client_metadata',
          error_description: error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', '),
        });
        return;
      }
      if (error instanceof OAuthError) {
        res.status(error.statusCode).json({
          error: error.error,
          error_description: error.errorDescription,
        });
        return;
      }
      next(error);
    }
  };

  // ============================================
  // 認可エンドポイント
  // GET /oauth/authorize
  // ============================================

  authorize = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = authorizeRequestSchema.parse(req.query);

      // リクエスト検証
      const { client, scopes, redirectUri } = await this.service.validateAuthorizeRequest(input);

      // ユーザーが未認証の場合はログインページへリダイレクト
      if (!req.user) {
        // 元のリクエストパラメータを保持してログインページへ
        const loginUrl = new URL('/login', env.FRONTEND_URL);
        const returnUrl = new URL(req.originalUrl, env.API_BASE_URL);
        loginUrl.searchParams.set('redirect', returnUrl.toString());
        res.redirect(loginUrl.toString());
        return;
      }

      // 同意画面へリダイレクト（フロントエンド実装）
      // フロントエンドで同意後に /oauth/authorize/consent へPOSTする
      const consentUrl = new URL('/oauth/consent', env.FRONTEND_URL);
      consentUrl.searchParams.set('client_id', input.client_id);
      consentUrl.searchParams.set('client_name', client.clientName);
      consentUrl.searchParams.set('scope', scopes.join(' '));
      consentUrl.searchParams.set('redirect_uri', redirectUri);
      consentUrl.searchParams.set('state', input.state);
      consentUrl.searchParams.set('code_challenge', input.code_challenge);
      consentUrl.searchParams.set('code_challenge_method', input.code_challenge_method);
      consentUrl.searchParams.set('resource', input.resource);

      res.redirect(consentUrl.toString());
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', '),
        });
        return;
      }
      if (error instanceof OAuthError) {
        // クライアントエラーの場合はredirect_uriにリダイレクトせず直接エラーを返す
        res.status(error.statusCode).json({
          error: error.error,
          error_description: error.errorDescription,
        });
        return;
      }
      next(error);
    }
  };

  // ============================================
  // 同意承認エンドポイント
  // POST /oauth/authorize/consent
  // ============================================

  consent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'unauthorized',
          error_description: 'User not authenticated',
        });
        return;
      }

      const {
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        resource,
        approved,
      } = req.body;

      // 拒否された場合
      if (!approved) {
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('error', 'access_denied');
        redirectUrl.searchParams.set('error_description', 'User denied access');
        redirectUrl.searchParams.set('state', state);
        // JSONでリダイレクトURLを返す（フロントエンドがリダイレクトを処理）
        res.json({ redirect_url: redirectUrl.toString() });
        return;
      }

      // 認可コード発行
      const code = await this.service.issueAuthorizationCode({
        clientId: client_id,
        userId: req.user.id,
        redirectUri: redirect_uri,
        scopes: scope ? scope.split(' ') : [],
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
        resource,
      });

      // redirect_uriにコードを付けてJSONで返す（フロントエンドがリダイレクトを処理）
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', code);
      redirectUrl.searchParams.set('state', state);
      res.json({ redirect_url: redirectUrl.toString() });
    } catch (error) {
      if (error instanceof OAuthError) {
        // エラー時はredirect_uriにエラーを返す（JSONでリダイレクトURLを返す）
        const { redirect_uri, state } = req.body;
        if (redirect_uri) {
          const redirectUrl = new URL(redirect_uri);
          redirectUrl.searchParams.set('error', error.error);
          redirectUrl.searchParams.set('error_description', error.errorDescription);
          if (state) redirectUrl.searchParams.set('state', state);
          res.json({ redirect_url: redirectUrl.toString() });
          return;
        }
        res.status(error.statusCode).json({
          error: error.error,
          error_description: error.errorDescription,
        });
        return;
      }
      next(error);
    }
  };

  // ============================================
  // トークンエンドポイント
  // POST /oauth/token
  // ============================================

  token = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = tokenRequestSchema.parse(req.body);
      const result = await this.service.exchangeCodeForToken(input);

      // Cache-Control ヘッダー (RFC 6749)
      res.set('Cache-Control', 'no-store');
      res.set('Pragma', 'no-cache');

      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', '),
        });
        return;
      }
      if (error instanceof OAuthError) {
        res.status(error.statusCode).json({
          error: error.error,
          error_description: error.errorDescription,
        });
        return;
      }
      next(error);
    }
  };

  // ============================================
  // イントロスペクションエンドポイント
  // POST /oauth/introspect
  // ============================================

  introspect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = introspectionRequestSchema.parse(req.body);
      const result = await this.service.introspectToken(input.token);
      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', '),
        });
        return;
      }
      next(error);
    }
  };

  // ============================================
  // トークン失効エンドポイント
  // POST /oauth/revoke
  // ============================================

  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = revokeRequestSchema.parse(req.body);
      await this.service.revokeToken(input.token, input.client_id);

      // RFC 7009: 成功時は200 OKを返す
      res.status(200).send();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', '),
        });
        return;
      }
      next(error);
    }
  };
}

// デフォルトインスタンス
export const oauthController = new OAuthController();
