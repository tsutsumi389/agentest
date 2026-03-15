import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, ValidationError, NotFoundError } from '@agentest/shared';
import { adminUserSearchSchema, uuidSchema } from '@agentest/shared/validators';
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

  /**
   * ユーザー詳細を取得
   * GET /admin/users/:id
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
        throw new ValidationError('無効なユーザーIDです', {
          id: ['有効なUUID形式で指定してください'],
        });
      }

      const result = await this.usersService.findUserById(parseResult.data);

      if (!result) {
        throw new NotFoundError('ユーザーが見つかりません');
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
