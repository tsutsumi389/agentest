import type { Request, Response, NextFunction } from 'express';
import { setPasswordSchema, changePasswordSchema } from '@agentest/shared';
import { UserPasswordAuthService } from '../services/user-password-auth.service.js';
import { createValidationError } from '../utils/validation.js';

/**
 * パスワード管理コントローラー
 *
 * 認証済みユーザーが自分のパスワードを管理するためのエンドポイント。
 * パスワードの設定状況確認、初回設定（OAuthユーザー向け）、変更を提供する。
 */
export class UserPasswordController {
  private authService = new UserPasswordAuthService();

  /**
   * パスワード設定状況確認
   * GET /api/users/:userId/password/status
   */
  getPasswordStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      const hasPassword = await this.authService.hasPassword(userId);

      res.json({ hasPassword });
    } catch (error) {
      next(error);
    }
  };

  /**
   * パスワード初回設定（OAuthユーザーがパスワードを追加）
   * POST /api/users/:userId/password
   */
  setPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      const parsed = setPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createValidationError(parsed.error);
      }

      await this.authService.setPassword(userId, parsed.data.password);

      res.status(201).json({ message: 'パスワードを設定しました' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * パスワード変更
   * PUT /api/users/:userId/password
   */
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createValidationError(parsed.error);
      }

      await this.authService.changePassword(
        userId,
        parsed.data.currentPassword,
        parsed.data.newPassword
      );

      res.json({ message: 'パスワードを変更しました' });
    } catch (error) {
      next(error);
    }
  };
}
