import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, ValidationError } from '@agentest/shared';
import { adminUserSearchSchema } from '@agentest/shared/validators';
import { AdminUsersService } from '../../services/admin/admin-users.service.js';

/**
 * 管理者ユーザー一覧コントローラー
 */
export class AdminUsersController {
  private usersService = new AdminUsersService();

  /**
   * ユーザー一覧を取得
   * GET /admin/users
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // requireAdminAuth()ミドルウェアで認証済みだが、TypeScript型安全性のためチェック
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      // クエリパラメータをバリデーション
      const parseResult = adminUserSearchSchema.safeParse(req.query);
      if (!parseResult.success) {
        throw new ValidationError(
          'リクエストパラメータが不正です',
          parseResult.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await this.usersService.findUsers(parseResult.data);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
