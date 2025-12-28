import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserService } from '../services/user.service.js';
import { AccountService } from '../services/account.service.js';
import { AuthorizationError } from '@agentest/shared';

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

const getUserOrganizationsQuerySchema = z.object({
  includeDeleted: z.coerce.boolean().optional().default(false),
});

const getUserProjectsQuerySchema = z.object({
  q: z.string().optional(),
  organizationId: z
    .string()
    .optional()
    .transform((val) => {
      // "null" 文字列を null に変換（個人プロジェクトのみフィルタ）
      if (val === 'null') return null;
      // 空文字列は undefined として扱う（フィルタなし）
      if (val === '') return undefined;
      return val;
    }),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

/**
 * ユーザーコントローラー
 */
export class UserController {
  private userService = new UserService();
  private accountService = new AccountService();

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

      const query = getUserOrganizationsQuerySchema.parse(req.query);
      const organizations = await this.userService.getOrganizations(userId, {
        includeDeleted: query.includeDeleted,
      });

      res.json({ organizations });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ユーザーのプロジェクト一覧取得
   * @query q 名前部分一致検索
   * @query organizationId 組織フィルタ（"null"で個人プロジェクトのみ）
   * @query includeDeleted 削除済みプロジェクトも含めるか
   */
  getUserProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      // 自分のプロジェクトのみ取得可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分のプロジェクト一覧のみ取得できます');
      }

      const query = getUserProjectsQuerySchema.parse(req.query);
      const projects = await this.userService.getProjects(userId, {
        q: query.q,
        organizationId: query.organizationId,
        includeDeleted: query.includeDeleted,
      });

      res.json({ projects });
    } catch (error) {
      next(error);
    }
  };

  /**
   * OAuth連携一覧取得
   * GET /api/users/:userId/accounts
   */
  getAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      // 自分の連携のみ取得可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分のOAuth連携のみ取得できます');
      }

      const accounts = await this.accountService.getAccounts(userId);

      res.json({ data: accounts });
    } catch (error) {
      next(error);
    }
  };

  /**
   * OAuth連携解除
   * DELETE /api/users/:userId/accounts/:provider
   */
  unlinkAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, provider } = req.params;

      // 自分の連携のみ解除可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分のOAuth連携のみ解除できます');
      }

      const result = await this.accountService.unlinkAccount(userId, provider);

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  };
}
