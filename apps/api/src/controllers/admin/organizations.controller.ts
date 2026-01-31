import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, ValidationError, NotFoundError } from '@agentest/shared';
import { adminOrganizationSearchSchema, uuidSchema } from '@agentest/shared/validators';
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

  /**
   * 組織詳細を取得
   * GET /admin/organizations/:id
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // requireAdminAuth()ミドルウェアで認証済みだが、TypeScript型安全性のためチェック
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      // パスパラメータをバリデーション
      const parseResult = uuidSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        throw new ValidationError(
          '無効な組織IDです',
          { id: ['有効なUUID形式で指定してください'] }
        );
      }

      const result = await this.organizationsService.findOrganizationById(parseResult.data);

      if (!result) {
        throw new NotFoundError('組織が見つかりません');
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
