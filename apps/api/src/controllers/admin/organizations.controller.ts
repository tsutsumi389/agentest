import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, ValidationError } from '@agentest/shared';
import { adminOrganizationSearchSchema } from '@agentest/shared/validators';
import { AdminOrganizationsService } from '../../services/admin/admin-organizations.service.js';

/**
 * 管理者組織一覧コントローラー
 */
export class AdminOrganizationsController {
  private organizationsService = new AdminOrganizationsService();

  /**
   * 組織一覧を取得
   * GET /admin/organizations
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // requireAdminAuth()ミドルウェアで認証済みだが、TypeScript型安全性のためチェック
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      // クエリパラメータをバリデーション
      const parseResult = adminOrganizationSearchSchema.safeParse(req.query);
      if (!parseResult.success) {
        throw new ValidationError(
          'リクエストパラメータが不正です',
          parseResult.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await this.organizationsService.findOrganizations(parseResult.data);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
