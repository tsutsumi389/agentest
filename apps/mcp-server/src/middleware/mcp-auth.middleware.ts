import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@agentest/db';
import {
  verifyAccessToken,
  createAuthConfig,
  type JwtPayload,
} from '@agentest/auth';
import { AuthenticationError } from '@agentest/shared';
import { env } from '../config/env.js';

/**
 * MCP用の認証設定を作成
 */
function getMcpAuthConfig() {
  return createAuthConfig({
    JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
    NODE_ENV: env.NODE_ENV,
  } as NodeJS.ProcessEnv);
}

/**
 * Cookieからアクセストークンを抽出
 */
function extractTokenFromCookie(req: Request): string | null {
  return req.cookies?.access_token || null;
}

/**
 * MCP認証ミドルウェア
 *
 * Cookieからaccess_tokenを抽出し、JWTを検証
 * 検証成功時はreq.user, req.tokenを設定
 */
export function mcpAuthenticate() {
  const config = getMcpAuthConfig();

  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Cookieからトークン抽出
      const token = extractTokenFromCookie(req);

      if (!token) {
        throw new AuthenticationError('認証トークンがありません');
      }

      // JWT検証
      let payload: JwtPayload;
      try {
        payload = verifyAccessToken(token, config);
      } catch (error) {
        if (error instanceof AuthenticationError) {
          throw error;
        }
        throw new AuthenticationError('無効なトークンです');
      }

      // ユーザー情報を取得
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.deletedAt) {
        throw new AuthenticationError('ユーザーが見つかりません');
      }

      // リクエストにユーザー情報を設定
      req.user = user;
      req.token = payload;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * MCP認証（オプショナル）
 * トークンがなくても処理を継続するが、あれば検証する
 */
export function mcpOptionalAuth() {
  const config = getMcpAuthConfig();

  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = extractTokenFromCookie(req);

      if (!token) {
        return next();
      }

      try {
        const payload = verifyAccessToken(token, config);
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
        });

        if (user && !user.deletedAt) {
          req.user = user;
          req.token = payload;
        }
      } catch {
        // トークン検証失敗時は無視して続行
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
