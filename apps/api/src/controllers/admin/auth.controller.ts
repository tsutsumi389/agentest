import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticationError, ValidationError } from '@agentest/shared';
import { env } from '../../config/env.js';
import { AdminAuthService } from '../../services/admin/admin-auth.service.js';
import { AdminSessionService } from '../../services/admin/admin-session.service.js';
import { extractClientInfo } from '../../middleware/session.middleware.js';

// Express 型拡張
declare global {
  namespace Express {
    interface Request {
      adminUser?: {
        id: string;
        email: string;
        name: string;
        role: string;
        totpEnabled: boolean;
      };
      adminSession?: {
        id: string;
        token: string;
        createdAt: Date;
        expiresAt: Date;
      };
    }
  }
}

// 管理者セッションのクッキー名
const ADMIN_SESSION_COOKIE = 'admin_session';

// 管理者クッキー設定
const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/admin',
};

// ログインリクエストのバリデーション
const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(1, 'パスワードを入力してください'),
});

/**
 * 管理者認証ミドルウェア
 *
 * クッキーからセッショントークンを取得し、
 * 有効なセッションであればreq.adminUserとreq.adminSessionを設定
 */
export function requireAdminAuth() {
  const sessionService = new AdminSessionService();

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.cookies?.[ADMIN_SESSION_COOKIE];

      if (!token) {
        throw new AuthenticationError('認証が必要です');
      }

      const session = await sessionService.validateSession(token);

      if (!session) {
        throw new AuthenticationError('セッションが無効または期限切れです');
      }

      // リクエストに管理者情報を設定
      req.adminUser = session.adminUser;
      req.adminSession = {
        id: session.id,
        token: session.token,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      };

      // 最終活動時刻を更新（非同期で実行）
      sessionService.updateActivity(session.id).catch(() => {
        // エラーは無視
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * 管理者認証コントローラー
 */
export class AdminAuthController {
  private authService = new AdminAuthService();

  /**
   * ログイン
   * POST /admin/auth/login
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // バリデーション
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        const details: Record<string, string[]> = {};
        for (const [key, value] of Object.entries(fieldErrors)) {
          if (value) {
            details[key] = value;
          }
        }
        throw new ValidationError('入力内容に誤りがあります', details);
      }

      const { email, password } = parsed.data;
      const clientInfo = extractClientInfo(req);

      // ログイン処理
      const result = await this.authService.login({
        email,
        password,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      });

      // セッショントークンをクッキーに設定
      res.cookie(ADMIN_SESSION_COOKIE, result.session.token, {
        ...ADMIN_COOKIE_OPTIONS,
        expires: result.session.expiresAt,
      });

      res.json({
        admin: result.admin,
        expiresAt: result.session.expiresAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ログアウト
   * POST /admin/auth/logout
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.adminUser || !req.adminSession) {
        throw new AuthenticationError('認証が必要です');
      }

      const clientInfo = extractClientInfo(req);

      // セッションを無効化
      await this.authService.logout(
        req.adminSession.token,
        req.adminUser.id,
        clientInfo.ipAddress,
        clientInfo.userAgent
      );

      // クッキーをクリア
      res.clearCookie(ADMIN_SESSION_COOKIE, {
        path: '/admin',
      });

      res.json({ message: 'ログアウトしました' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 現在の管理者情報を取得
   * GET /admin/auth/me
   */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      res.json({
        admin: req.adminUser,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * セッション延長
   * POST /admin/auth/refresh
   */
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.adminUser || !req.adminSession) {
        throw new AuthenticationError('認証が必要です');
      }

      const clientInfo = extractClientInfo(req);

      // セッションを延長
      const newExpiresAt = await this.authService.refreshSession(
        req.adminSession.token,
        req.adminUser.id,
        req.adminSession.id,
        req.adminSession.createdAt,
        clientInfo.ipAddress,
        clientInfo.userAgent
      );

      if (!newExpiresAt) {
        throw new AuthenticationError('セッションの延長可能期限を超えています。再度ログインしてください');
      }

      // 新しい有効期限でクッキーを更新
      res.cookie(ADMIN_SESSION_COOKIE, req.adminSession.token, {
        ...ADMIN_COOKIE_OPTIONS,
        expires: newExpiresAt,
      });

      res.json({
        expiresAt: newExpiresAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}
