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
      // "personal" または "null" を null に変換（個人プロジェクトのみフィルタ）
      if (val === 'personal' || val === 'null') return null;
      // 空文字列は undefined として扱う（フィルタなし）
      if (val === '') return undefined;
      return val;
    }),
  includeDeleted: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const getRecentExecutionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
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
   * @query limit 取得件数（デフォルト: 50、最大: 100）
   * @query offset 取得開始位置（デフォルト: 0）
   */
  getUserProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      // 自分のプロジェクトのみ取得可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分のプロジェクト一覧のみ取得できます');
      }

      const query = getUserProjectsQuerySchema.parse(req.query);
      const filterOptions = {
        q: query.q,
        organizationId: query.organizationId,
        includeDeleted: query.includeDeleted,
      };

      // プロジェクト一覧と総数を並行取得
      const [projects, total] = await Promise.all([
        this.userService.getProjects(userId, {
          ...filterOptions,
          limit: query.limit,
          offset: query.offset,
        }),
        this.userService.countProjects(userId, filterOptions),
      ]);

      res.json({
        projects,
        pagination: {
          total,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + projects.length < total,
        },
      });
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

  /**
   * 最近のテスト実行結果取得
   * GET /api/users/:userId/recent-executions
   */
  getRecentExecutions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      // 自分の実行結果のみ取得可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分のテスト実行結果のみ取得できます');
      }

      const query = getRecentExecutionsQuerySchema.parse(req.query);
      const executions = await this.userService.getRecentExecutions(userId, query.limit);

      res.json({ executions });
    } catch (error) {
      next(error);
    }
  };
}
