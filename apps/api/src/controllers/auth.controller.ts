import type { Request, Response, NextFunction } from 'express';
import { generateTokens, verifyRefreshToken } from '@agentest/auth';
import { prisma } from '@agentest/db';
import { AuthenticationError } from '@agentest/shared';
import { env } from '../config/env.js';

const authConfig = {
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
};

// クッキー設定
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

/**
 * 認証コントローラー
 */
export class AuthController {
  /**
   * 現在のユーザー情報を取得
   */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('認証が必要です');
      }

      res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          avatarUrl: req.user.avatarUrl,
          plan: req.user.plan,
          createdAt: req.user.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * トークンリフレッシュ
   */
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // クッキーまたはボディからリフレッシュトークンを取得
      const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

      if (!refreshToken) {
        throw new AuthenticationError('リフレッシュトークンが必要です');
      }

      // トークンを検証
      const payload = verifyRefreshToken(refreshToken, authConfig);

      // データベースでトークンを確認
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
        throw new AuthenticationError('無効なリフレッシュトークンです');
      }

      // ユーザーを取得
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.deletedAt) {
        throw new AuthenticationError('ユーザーが見つかりません');
      }

      // 古いトークンを無効化
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      // 新しいトークンを生成
      const tokens = generateTokens(
        { sub: user.id, email: user.email },
        authConfig
      );

      // 新しいリフレッシュトークンを保存
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7日
        },
      });

      // クッキーに設定
      res.cookie('access_token', tokens.accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000, // 15分
      });
      res.cookie('refresh_token', tokens.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7日
      });

      res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ログアウト
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refresh_token;

      if (refreshToken) {
        // リフレッシュトークンを無効化
        await prisma.refreshToken.updateMany({
          where: { token: refreshToken },
          data: { revokedAt: new Date() },
        });
      }

      // クッキーをクリア
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });

      res.json({ message: 'ログアウトしました' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * OAuthコールバック処理
   */
  oauthCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('OAuth認証に失敗しました');
      }

      // トークンを生成
      const tokens = generateTokens(
        { sub: req.user.id, email: req.user.email },
        authConfig
      );

      // リフレッシュトークンを保存
      await prisma.refreshToken.create({
        data: {
          userId: req.user.id,
          token: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // クッキーに設定
      res.cookie('access_token', tokens.accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refresh_token', tokens.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // フロントエンドにリダイレクト
      res.redirect(`${env.CORS_ORIGIN}/auth/callback`);
    } catch (error) {
      next(error);
    }
  };
}
