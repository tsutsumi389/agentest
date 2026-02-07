import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@agentest/db';
import { apiKeyAuthService } from '../services/api-key-auth.service.js';
import { env } from '../config/env.js';
import { SUPPORTED_SCOPES } from '../config/scopes.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'api-key-auth' });

/**
 * X-API-Key ヘッダー名
 */
const API_KEY_HEADER = 'x-api-key';

/**
 * APIキー認証ミドルウェア
 * X-API-Keyヘッダーからトークンを抽出し、検証を行う
 */
export function mcpApiKeyAuthenticate() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers[API_KEY_HEADER] as string | undefined;

    // X-API-Keyヘッダーがない場合は401を返す
    if (!apiKey) {
      sendUnauthorized(res, 'API key required');
      return;
    }

    try {
      // APIキーを検証
      const result = await apiKeyAuthService.validateToken(apiKey);

      if (!result.valid || !result.userId) {
        sendUnauthorized(res, 'Invalid or expired API key');
        return;
      }

      // ユーザー情報を取得
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
      });

      if (!user || user.deletedAt) {
        sendUnauthorized(res, 'User not found or deleted');
        return;
      }

      // req.user にユーザー情報を設定
      req.user = user;
      // APIキーのスコープを設定（'*'はフルアクセスとして扱う）
      req.oauthScopes = result.scopes?.includes('*')
        ? [...SUPPORTED_SCOPES]
        : result.scopes;
      // 認証タイプを設定
      req.authType = 'api-key';

      next();
    } catch (error) {
      logger.error({ err: error }, 'API key authentication error');
      sendUnauthorized(res, 'Authentication failed');
    }
  };
}

/**
 * 401 Unauthorized レスポンスを送信
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
 * リクエストにX-API-Keyヘッダーが存在するかチェック
 */
export function hasApiKeyHeader(req: Request): boolean {
  return !!req.headers[API_KEY_HEADER];
}
