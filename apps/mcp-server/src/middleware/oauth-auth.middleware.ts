import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@agentest/db';
import { env } from '../config/env.js';
import { tokenIntrospectionService } from '../services/token-introspection.service.js';
import { mcpApiKeyAuthenticate, hasApiKeyHeader } from './api-key-auth.middleware.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'oauth-auth' });

// 後方互換性のため再エクスポート
export { SUPPORTED_SCOPES } from '../config/scopes.js';

/**
 * MCP OAuth 2.1 Bearer Token認証ミドルウェア
 *
 * RFC 9728 (OAuth 2.0 Protected Resource Metadata) に準拠
 * 1. Authorization: Bearer <token> ヘッダーからトークンを抽出
 * 2. Authorization Serverのイントロスペクションエンドポイントでトークンを検証
 * 3. Audience (resource) がMCPサーバーURLと一致するか確認
 * 4. 有効なトークンの場合、req.user にユーザー情報を設定
 */
export function mcpOAuthAuthenticate() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // Authorizationヘッダーがない場合は401を返す
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendUnauthorized(res, 'Bearer token required');
      return;
    }

    const token = authHeader.slice(7); // 'Bearer ' を除去

    try {
      // トークンを検証 (Audience = MCPサーバーURL)
      const result = await tokenIntrospectionService.validateToken(token, env.MCP_SERVER_URL);

      if (!result.valid || !result.userId) {
        sendUnauthorized(res, 'Invalid or expired token');
        return;
      }

      // ユーザー情報を取得
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
      });

      if (!user) {
        sendUnauthorized(res, 'User not found');
        return;
      }

      // req.user にユーザー情報とスコープを設定
      req.user = user;
      req.oauthScopes = result.scopes;
      req.authType = 'oauth';

      next();
    } catch (error) {
      logger.error({ err: error }, 'OAuth authentication error');
      sendUnauthorized(res, 'Authentication failed');
    }
  };
}

/**
 * 401 Unauthorized レスポンスを送信
 * WWW-Authenticate ヘッダーにProtected Resource Metadataの場所を含める
 */
function sendUnauthorized(res: Response, message: string): void {
  res.setHeader(
    'WWW-Authenticate',
    `Bearer resource_metadata="${env.MCP_SERVER_URL}/.well-known/oauth-protected-resource"`
  );
  res.status(401).json({
    jsonrpc: '2.0',
    error: {
      code: -32001,
      message: 'Unauthorized',
      data: { reason: message },
    },
    id: null,
  });
}

/**
 * スコープ検証ミドルウェア
 * 指定されたスコープがトークンに含まれているか確認
 */
export function requireScope(...requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tokenScopes: string[] = req.oauthScopes || [];

    // 必要なスコープがすべて含まれているか確認
    const hasAllScopes = requiredScopes.every((scope) => tokenScopes.includes(scope));

    if (!hasAllScopes) {
      res.status(403).json({
        jsonrpc: '2.0',
        error: {
          code: -32003,
          message: 'Forbidden',
          data: {
            reason: 'Insufficient scope',
            required: requiredScopes,
            granted: tokenScopes,
          },
        },
        id: null,
      });
      return;
    }

    next();
  };
}

/**
 * ハイブリッド認証ミドルウェア
 * 複数の認証方式をサポートし、以下の優先順位で認証を試みる:
 * 1. OAuth Bearer Token（Authorization: Bearer xxx）
 * 2. APIキー（X-API-Key: agentest_xxx）
 * 3. Cookie JWT（フォールバック認証）
 *
 * @param fallbackAuth - Bearer Token / APIキーがない場合に使用するフォールバック認証ミドルウェア
 */
export function mcpHybridAuthenticate(
  fallbackAuth?: (req: Request, res: Response, next: NextFunction) => void | Promise<void>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // 1. Bearer トークンがある場合はOAuth認証を使用
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return mcpOAuthAuthenticate()(req, res, next);
    }

    // 2. X-API-Key ヘッダーがある場合はAPIキー認証を使用
    if (hasApiKeyHeader(req)) {
      return mcpApiKeyAuthenticate()(req, res, next);
    }

    // 3. フォールバック認証（Cookie JWT）が指定されていればそれを使用
    if (fallbackAuth) {
      return fallbackAuth(req, res, next);
    }

    // フォールバックがなければ401を返す
    sendUnauthorized(res, 'Bearer token or API key required');
  };
}
