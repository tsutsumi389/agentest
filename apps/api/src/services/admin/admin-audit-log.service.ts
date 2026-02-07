import { prisma, type Prisma } from '@agentest/db';
import { logger as baseLogger } from '../../utils/logger.js';

const logger = baseLogger.child({ module: 'admin-audit-log' });

/**
 * 監査ログ作成用の型
 */
export interface AdminAuditLogInput {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 管理者監査ログサービス
 *
 * 管理者の操作履歴を記録する
 */
export class AdminAuditLogService {
  /**
   * 監査ログを記録
   *
   * ログ記録の失敗はメイン処理に影響を与えないようエラーを握りつぶす
   */
  async log(input: AdminAuditLogInput): Promise<void> {
    // バリデーション: actionは必須かつ空文字でない
    if (!input.action || input.action.trim() === '') {
      logger.warn({ data: input }, '管理者監査ログ: actionが空のため記録をスキップ');
      return;
    }

    try {
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: input.adminUserId,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          details: input.details as Prisma.JsonObject | undefined,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });
    } catch (error) {
      // ログ記録の失敗は警告としてログ出力し、呼び出し元に伝播させない
      logger.error({ err: error }, '管理者監査ログの記録に失敗');
    }
  }
}
