import type { Request, Response, NextFunction } from 'express';
import { AuthorizationError, ValidationError } from '@agentest/shared';
import { initialSetupSchema } from '@agentest/shared/validators';
import { prisma } from '@agentest/db';
import bcrypt from 'bcryptjs';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'setup-controller' });

/**
 * 初回セットアップコントローラー
 *
 * AdminUserが0件の場合のみ動作し、SUPER_ADMINアカウントを作成する
 */
export class AdminSetupController {
  /**
   * セットアップ状態を取得
   * GET /admin/setup/status
   */
  getStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const count = await prisma.adminUser.count({
        where: { deletedAt: null },
      });

      res.json({ isSetupRequired: count === 0 });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 初回セットアップ（SUPER_ADMIN作成）
   * POST /admin/setup
   */
  setup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // バリデーション（トランザクション前に実施）
      const parsed = initialSetupSchema.safeParse(req.body);
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

      const { email, name, password } = parsed.data;

      // パスワードをハッシュ化（トランザクション前に実施）
      const passwordHash = await bcrypt.hash(password, 12);

      // リクエスト情報を取得（監査ログ用）
      const ipAddress = req.ip ?? null;
      const userAgent = req.headers['user-agent'] ?? null;

      // トランザクションで存在チェック + 作成 + 監査ログを一括実行（レースコンディション防止）
      // Serializable分離レベルで並行リクエストによる複数SUPER_ADMIN作成を確実に防止
      const adminUser = await prisma.$transaction(async (tx) => {
        const existingCount = await tx.adminUser.count({
          where: { deletedAt: null },
        });

        if (existingCount > 0) {
          throw new AuthorizationError('セットアップは既に完了しています');
        }

        // SUPER_ADMINアカウントを作成
        const user = await tx.adminUser.create({
          data: {
            email,
            name,
            role: 'SUPER_ADMIN',
            passwordHash,
          },
        });

        // 監査ログを記録
        await tx.adminAuditLog.create({
          data: {
            adminUserId: user.id,
            action: 'INITIAL_SETUP',
            targetType: 'AdminUser',
            targetId: user.id,
            details: { email, name },
            ipAddress,
            userAgent,
          },
        });

        return user;
      }, {
        isolationLevel: 'Serializable',
      });

      log.info({ adminId: adminUser.id, email }, '初回セットアップが完了しました');

      res.status(201).json({
        admin: {
          email: adminUser.email,
          name: adminUser.name,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
