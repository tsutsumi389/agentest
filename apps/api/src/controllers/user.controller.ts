import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserService } from '../services/user.service.js';
import { AuthorizationError } from '@agentest/shared';

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

/**
 * ユーザーコントローラー
 */
export class UserController {
  private userService = new UserService();

  /**
   * ユーザー詳細取得
   */
  getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      const user = await this.userService.findById(userId);

      res.json({ user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ユーザープロフィール更新
   */
  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      // 自分のプロフィールのみ更新可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分のプロフィールのみ更新できます');
      }

      const data = updateUserSchema.parse(req.body);
      const user = await this.userService.update(userId, data);

      res.json({ user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ユーザー削除（論理削除）
   */
  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      // 自分のアカウントのみ削除可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分のアカウントのみ削除できます');
      }

      await this.userService.softDelete(userId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * ユーザーの組織一覧取得
   */
  getUserOrganizations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      // 自分の組織のみ取得可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分の組織一覧のみ取得できます');
      }

      const organizations = await this.userService.getOrganizations(userId);

      res.json({ organizations });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ユーザーのプロジェクト一覧取得
   */
  getUserProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      // 自分のプロジェクトのみ取得可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分のプロジェクト一覧のみ取得できます');
      }

      const projects = await this.userService.getProjects(userId);

      res.json({ projects });
    } catch (error) {
      next(error);
    }
  };
}
