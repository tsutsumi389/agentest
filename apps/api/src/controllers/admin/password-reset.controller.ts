import type { Request, Response, NextFunction } from 'express';
import { passwordResetRequestSchema, passwordResetSchema } from '@agentest/shared';
import { ValidationError } from '@agentest/shared';
import { AdminPasswordResetService } from '../../services/admin/admin-password-reset.service.js';
import { emailService } from '../../services/email.service.js';
import { env } from '../../config/env.js';
import { logger as baseLogger } from '../../utils/logger.js';

const logger = baseLogger.child({ module: 'admin-password-reset-controller' });

/**
 * 管理者パスワードリセットコントローラー
 */
export class AdminPasswordResetController {
  private resetService = new AdminPasswordResetService();

  /**
   * パスワードリセット要求
   * POST /admin/auth/password-reset/request
   *
   * メール存在に関わらず同じレスポンスを返す（メール列挙防止）
   */
  requestReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // バリデーション
      const parsed = passwordResetRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        const details: Record<string, string[]> = {};
        for (const [key, value] of Object.entries(fieldErrors)) {
          if (value) {
            details[key] = value;
          }
        }
        throw new ValidationError('入力内容に誤りがあります', details);
      }

      const { email } = parsed.data;

      // リセットトークン生成
      const result = await this.resetService.requestPasswordReset(email);

      // 管理者が存在する場合のみメール送信
      if (result) {
        const resetUrl = `${env.ADMIN_FRONTEND_URL}/reset-password/${result.token}`;
        const emailContent = emailService.generatePasswordResetEmail({
          name: result.adminUser.name,
          resetUrl,
          expiresInMinutes: 60,
        });

        try {
          await emailService.send({
            to: email,
            ...emailContent,
          });
        } catch (error) {
          // メール送信失敗はログ出力のみ（ユーザーには成功レスポンスを返す）
          logger.error({ err: error, email }, '管理者パスワードリセットメール送信エラー');
        }
      }

      // 成功/失敗に関わらず同じレスポンス
      res.json({
        message: 'メールアドレスが登録されている場合、パスワードリセット用のメールを送信しました',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * パスワードリセット実行
   * POST /admin/auth/password-reset/reset
   */
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // バリデーション
      const parsed = passwordResetSchema.safeParse(req.body);
      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        const details: Record<string, string[]> = {};
        for (const [key, value] of Object.entries(fieldErrors)) {
          if (value) {
            details[key] = value;
          }
        }
        throw new ValidationError('入力内容に誤りがあります', details);
      }

      const { token, password } = parsed.data;

      await this.resetService.resetPassword(token, password);

      res.json({
        message: 'パスワードが正常にリセットされました。新しいパスワードでログインしてください',
      });
    } catch (error) {
      next(error);
    }
  };
}
