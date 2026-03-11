import type { Request, Response, NextFunction } from 'express';
import { AdminRoleType } from '@agentest/db';
import { AuthenticationError, AuthorizationError } from '@agentest/shared';
import { AdminSessionService } from '../services/admin/admin-session.service.js';
import { adminAuthConfig } from '../config/auth.js';
import { isAdminTotpVerified } from '../lib/redis-store.js';

/**
 * 管理者認証ミドルウェアのオプション
 */
interface AdminAuthOptions {
  /** 必要な管理者ロールの配列。空の場合は認証のみ。 */
  roles?: AdminRoleType[];
  /** TOTP検証チェックをスキップする（2FA検証エンドポイント用） */
  skipTotpCheck?: boolean;
}

/**
 * ロールベース認可ミドルウェア
 *
 * クッキーからセッショントークンを取得し、有効なセッションであれば
 * req.adminUserとreq.adminSessionを設定。
 * さらに指定されたロール権限を持っているかチェック。
 * TOTP有効ユーザーの場合、TOTP検証済みフラグもチェック。
 *
 * @param options - 認証オプション
 */
export function requireAdminRole(options: AdminAuthOptions = {}) {
  const { roles = [], skipTotpCheck = false } = options;

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

      // TOTP検証チェック（2FAバイパス対策）
      if (!skipTotpCheck && session.adminUser.totpEnabled) {
        const verified = await isAdminTotpVerified(session.id);
        if (!verified) {
          throw new AuthenticationError('2要素認証の検証が必要です');
        }
      }

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
 * 認証のみのミドルウェア（ロールチェックなし、TOTP検証必須）
 */
export function requireAdminAuth() {
  return requireAdminRole();
}

/**
 * 認証のみのミドルウェア（TOTP検証スキップ）
 *
 * TOTP検証前にアクセスが必要なエンドポイント用。
 * セキュリティ上の理由から使用箇所を限定すること。
 *
 * 使用エンドポイント:
 * - POST /admin/auth/logout（TOTP検証前でもログアウト可能）
 * - POST /admin/auth/2fa/verify（TOTP検証そのもの）
 * - GET /admin/auth/me（読み取り専用、リロード時の認証状態確認）
 */
export function requireAdminAuthSkipTotp() {
  return requireAdminRole({ skipTotpCheck: true });
}
