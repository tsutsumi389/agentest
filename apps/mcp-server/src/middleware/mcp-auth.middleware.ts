import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@agentest/db';
import {
  verifyAccessToken,
  type JwtPayload,
  type AuthConfig,
} from '@agentest/auth';
import { AuthenticationError } from '@agentest/shared';
import { env } from '../config/env.js';

/**
 * MCP用の認証設定を作成
 */
function getMcpAuthConfig(): AuthConfig {
  return {
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessExpiry: '15m',
      refreshExpiry: '7d',
    },
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    },
    oauth: {},
  };
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
      req.authType = 'cookie';

      next();
    } catch (error) {
      next(error);
    }
  };
}

