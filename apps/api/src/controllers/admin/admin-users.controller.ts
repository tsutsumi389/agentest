import type { Request, Response, NextFunction } from 'express';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  AuthorizationError,
} from '@agentest/shared';
import {
  systemAdminSearchSchema,
  systemAdminInviteSchema,
  systemAdminUpdateSchema,
  acceptInvitationSchema,
  uuidSchema,
} from '@agentest/shared/validators';
import { SystemAdminService } from '../../services/admin/system-admin.service.js';

/**
 * システム管理者アカウント管理コントローラー
 */
export class AdminAdminUsersController {
  private service = new SystemAdminService();

  /**
   * SUPER_ADMIN権限チェック
   */
  private requireSuperAdmin(req: Request): void {
    if (!req.adminUser) {
      throw new AuthenticationError('認証が必要です');
    }
    if (req.adminUser.role !== 'SUPER_ADMIN') {
      throw new AuthorizationError('SUPER_ADMIN権限が必要です');
    }
  }

  /**
   * システム管理者一覧を取得
   * GET /admin/admin-users
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireSuperAdmin(req);

      // クエリパラメータをバリデーション
      const parseResult = systemAdminSearchSchema.safeParse(req.query);
      if (!parseResult.success) {
        throw new ValidationError(
          'リクエストパラメータが不正です',
          parseResult.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await this.service.findAdminUsers(parseResult.data);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * システム管理者詳細を取得
   * GET /admin/admin-users/:id
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireSuperAdmin(req);

      // パスパラメータをバリデーション
      const parseResult = uuidSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        throw new ValidationError('無効な管理者IDです', {
          id: ['有効なUUID形式で指定してください'],
        });
      }

      const result = await this.service.findAdminUserById(parseResult.data);

      if (!result) {
        throw new NotFoundError('管理者が見つかりません');
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * システム管理者を招待（作成）
   * POST /admin/admin-users
   */
  invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireSuperAdmin(req);

      // リクエストボディをバリデーション
      const parseResult = systemAdminInviteSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          'リクエストボディが不正です',
          parseResult.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await this.service.inviteAdminUser(parseResult.data, req.adminUser!.id);

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * システム管理者を更新
   * PATCH /admin/admin-users/:id
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireSuperAdmin(req);

      // パスパラメータをバリデーション
      const idParseResult = uuidSchema.safeParse(req.params.id);
      if (!idParseResult.success) {
        throw new ValidationError('無効な管理者IDです', {
          id: ['有効なUUID形式で指定してください'],
        });
      }

      // リクエストボディをバリデーション
      const bodyParseResult = systemAdminUpdateSchema.safeParse(req.body);
      if (!bodyParseResult.success) {
        throw new ValidationError(
          'リクエストボディが不正です',
          bodyParseResult.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await this.service.updateAdminUser(
        idParseResult.data,
        bodyParseResult.data,
        req.adminUser!.id
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * システム管理者を削除
   * DELETE /admin/admin-users/:id
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireSuperAdmin(req);

      // パスパラメータをバリデーション
      const parseResult = uuidSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        throw new ValidationError('無効な管理者IDです', {
          id: ['有効なUUID形式で指定してください'],
        });
      }

      const result = await this.service.deleteAdminUser(parseResult.data, req.adminUser!.id);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * アカウントロックを解除
   * POST /admin/admin-users/:id/unlock
   */
  unlock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireSuperAdmin(req);

      // パスパラメータをバリデーション
      const parseResult = uuidSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        throw new ValidationError('無効な管理者IDです', {
          id: ['有効なUUID形式で指定してください'],
        });
      }

      const result = await this.service.unlockAdminUser(parseResult.data, req.adminUser!.id);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * 2FAをリセット
   * POST /admin/admin-users/:id/reset-2fa
   */
  reset2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireSuperAdmin(req);

      // パスパラメータをバリデーション
      const parseResult = uuidSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        throw new ValidationError('無効な管理者IDです', {
          id: ['有効なUUID形式で指定してください'],
        });
      }

      const result = await this.service.reset2FA(parseResult.data, req.adminUser!.id);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * 招待情報を取得（認証不要）
   * GET /admin/invitations/:token
   */
  getInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token;

      if (!token || typeof token !== 'string') {
        throw new ValidationError('無効なトークンです', { token: ['トークンを指定してください'] });
      }

      const result = await this.service.getInvitation(token);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * 招待を受諾してパスワードを設定（認証不要）
   * POST /admin/invitations/:token/accept
   */
  acceptInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token;

      if (!token || typeof token !== 'string') {
        throw new ValidationError('無効なトークンです', { token: ['トークンを指定してください'] });
      }

      // リクエストボディをバリデーション
      const parseResult = acceptInvitationSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          'リクエストボディが不正です',
          parseResult.error.flatten().fieldErrors as Record<string, string[]>
        );
      }

      const result = await this.service.acceptInvitation(token, parseResult.data.password);

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };
}
