import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, type Prisma } from '@agentest/db';
import { BadRequestError } from '@agentest/shared';
import { hashToken } from '../../utils/pkce.js';
import { AdminAuditLogService } from './admin-audit-log.service.js';
import { logger as baseLogger } from '../../utils/logger.js';

const logger = baseLogger.child({ module: 'admin-password-reset' });

// bcryptのコストファクター
const BCRYPT_ROUNDS = 12;
// パスワードリセットトークンの有効期限（1時間）
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

const auditLogService = new AdminAuditLogService();

/**
 * 管理者パスワードリセットサービス
 *
 * ユーザー側の UserPasswordAuthService.requestPasswordReset / resetPassword パターンを踏襲。
 * メール列挙防止、SHA-256トークンハッシュ、全セッション無効化を実装。
 */
export class AdminPasswordResetService {
  /**
   * パスワードリセット要求
   *
   * セキュリティ対策:
   * - 管理者が存在しない場合もエラーを投げない（メール存在確認防止）
   * - 既存未使用トークンは無効化
   *
   * @returns 生トークン（メール送信用）、管理者が存在しない場合はnull
   */
  async requestPasswordReset(
    email: string
  ): Promise<{ token: string; adminUser: { id: string; name: string } } | null> {
    const adminUser = await prisma.adminUser.findFirst({
      where: { email, deletedAt: null },
    });

    // 管理者が存在しない場合はnullを返す（メール列挙防止）
    if (!adminUser) {
      return null;
    }

    // リセットトークン生成
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    // トランザクションで既存トークン無効化と新規トークン作成をアトミックに実行
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 同一管理者の既存未使用トークンを無効化
      await tx.adminPasswordResetToken.updateMany({
        where: { adminUserId: adminUser.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      // 新しいトークンをDBに保存
      await tx.adminPasswordResetToken.create({
        data: {
          adminUserId: adminUser.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
        },
      });
    });

    // 監査ログ記録
    await auditLogService.log({
      adminUserId: adminUser.id,
      action: 'PASSWORD_RESET_REQUESTED',
      targetType: 'AdminUser',
      targetId: adminUser.id,
    });

    logger.info({ adminUserId: adminUser.id, email }, '管理者パスワードリセットトークン生成');

    return { token: rawToken, adminUser: { id: adminUser.id, name: adminUser.name } };
  }

  /**
   * パスワードリセット実行
   *
   * トークン検証 → パスワード更新 → 全セッション無効化 → アカウントロック解除
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);

    // トークンを検索
    const resetToken = await prisma.adminPasswordResetToken.findFirst({
      where: { tokenHash },
      include: { adminUser: true },
    });

    // トークンが存在しない
    if (!resetToken) {
      throw new BadRequestError('無効なパスワードリセットトークンです');
    }

    // トークンが使用済み
    if (resetToken.usedAt) {
      throw new BadRequestError('このパスワードリセットトークンは既に使用されています');
    }

    // トークンが期限切れ
    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestError('パスワードリセットトークンの有効期限が切れています');
    }

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // トランザクションで実行
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // トークンを使用済みにする
      await tx.adminPasswordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });

      // パスワード更新 + ロック解除 + 失敗回数リセット
      await tx.adminUser.update({
        where: { id: resetToken.adminUserId },
        data: {
          passwordHash,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });

      // 全セッションを無効化
      await tx.adminSession.updateMany({
        where: {
          adminUserId: resetToken.adminUserId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    });

    // 監査ログ記録
    await auditLogService.log({
      adminUserId: resetToken.adminUserId,
      action: 'PASSWORD_RESET_COMPLETED',
      targetType: 'AdminUser',
      targetId: resetToken.adminUserId,
    });

    logger.info({ adminUserId: resetToken.adminUserId }, '管理者パスワードリセット完了');
  }
}
