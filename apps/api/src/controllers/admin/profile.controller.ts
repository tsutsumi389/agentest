import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticationError, ValidationError, changePasswordSchema } from '@agentest/shared';
import { AdminAuthService } from '../../services/admin/admin-auth.service.js';
import { extractClientInfo } from '../../middleware/session.middleware.js';

// プロフィール更新のバリデーション
const updateProfileSchema = z.object({
  name: z.string().min(1, '名前を入力してください').max(100, '名前は100文字以内で入力してください').trim(),
});

/**
 * Zodスキーマでバリデーションし、失敗時はValidationErrorをスロー
 */
function parseBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    const details: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(fieldErrors)) {
      if (value) {
        details[key] = value;
      }
    }
    throw new ValidationError('入力内容に誤りがあります', details);
  }
  return parsed.data;
}

/**
 * 管理者プロフィールコントローラー
 */
export class AdminProfileController {
  private authService = new AdminAuthService();

  /**
   * プロフィール更新（名前変更）
   * PATCH /admin/auth/profile
   */
  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      const { name } = parseBody(updateProfileSchema, req.body);
      const clientInfo = extractClientInfo(req);

      const admin = await this.authService.updateProfile(
        req.adminUser.id,
        name,
        clientInfo.ipAddress,
        clientInfo.userAgent
      );

      res.json({ admin });
    } catch (error) {
      next(error);
    }
  };

  /**
   * パスワード変更
   * PUT /admin/auth/password
   */
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      const { currentPassword, newPassword } = parseBody(changePasswordSchema, req.body);
      const clientInfo = extractClientInfo(req);

      await this.authService.changePassword(
        req.adminUser.id,
        currentPassword,
        newPassword,
        clientInfo.ipAddress,
        clientInfo.userAgent,
        req.adminSession?.id
      );

      res.json({ message: 'パスワードを変更しました' });
    } catch (error) {
      next(error);
    }
  };
}
