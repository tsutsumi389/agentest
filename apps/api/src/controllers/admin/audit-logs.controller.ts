import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, ValidationError } from '@agentest/shared';
import { adminAuditLogSearchSchema } from '@agentest/shared/validators';
import { AdminAuditLogsService } from '../../services/admin/admin-audit-logs.service.js';

/**
 * 管理者監査ログコントローラー
 */
export class AdminAuditLogsController {
  private auditLogsService = new AdminAuditLogsService();

  /**
   * 監査ログ一覧を取得
   * GET /admin/audit-logs
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // requireAdminAuth()ミドルウェアで認証済みだが、TypeScript型安全性のためチェック
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      // クエリパラメータをバリデーション
      const parseResult = adminAuditLogSearchSchema.safeParse(req.query);
      if (!parseResult.success) {
        throw new ValidationError(
          'リクエストパラメータが不正です',
          parseResult.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await this.auditLogsService.findAuditLogs(parseResult.data);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
