import type { Request, Response, NextFunction } from 'express';
import { AdminRoleType } from '@agentest/db';
import { AuthenticationError, AuthorizationError } from '@agentest/shared';
import { AdminSessionService } from '../services/admin/admin-session.service.js';
import { adminAuthConfig } from '../config/auth.js';

/**
 * ロールベース認可ミドルウェア
 *
 * クッキーからセッショントークンを取得し、有効なセッションであれば
 * req.adminUserとreq.adminSessionを設定。
 * さらに指定されたロール権限を持っているかチェック。
 *
 * @param roles - 必要な管理者ロールの配列。空の場合は認証のみ。
 *                SUPER_ADMINは全権限を持つ。
 */
export function requireAdminRole(roles: AdminRoleType[] = []) {
  // ミドルウェア生成時に1回だけインスタンス化（リクエストごとではない）
  const sessionService = new AdminSessionService();

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.cookies?.[adminAuthConfig.sessionCookie];

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
        token, // クッキーから取得した生トークン（DBにはハッシュのみ保存されている）
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      };

      // ロール権限チェック
      if (roles.length > 0) {
        const userRole = session.adminUser.role as AdminRoleType;

        // SUPER_ADMINは全権限を持つ
        if (userRole !== AdminRoleType.SUPER_ADMIN && !roles.includes(userRole)) {
          throw new AuthorizationError('この操作を行う権限がありません');
        }
      }

      // 最終活動時刻を更新（非同期で実行、リクエストをブロックしない）
      sessionService.updateActivity(session.id).catch(() => {
        // エラーは無視（ログ記録のみでリクエスト処理に影響を与えない）
      });

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * 認証のみのミドルウェア（ロールチェックなし）
 *
 * クッキーからセッショントークンを取得し、有効なセッションであれば
 * req.adminUserとreq.adminSessionを設定。
 * ロールチェックは行わない。
 */
export function requireAdminAuth() {
  return requireAdminRole([]);
}
