import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticationError, ValidationError } from '@agentest/shared';
import { AdminTotpService } from '../../services/admin/admin-totp.service.js';
import { extractClientInfo } from '../../middleware/session.middleware.js';

// TOTPコードのバリデーション（6桁の数字）
const totpCodeSchema = z.object({
  code: z.string().length(6, 'TOTPコードは6桁で入力してください').regex(/^\d{6}$/, 'TOTPコードは数字のみで入力してください'),
});

// TOTP無効化のバリデーション
const disableTotpSchema = z.object({
  password: z.string().min(1, 'パスワードを入力してください'),
});

/**
 * Zodパース結果からValidationErrorを生成するヘルパー
 */
function createValidationError(error: z.ZodError): ValidationError {
  const fieldErrors = error.flatten().fieldErrors;
  const details: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(fieldErrors)) {
    if (value) {
      details[key] = value;
    }
  }
  return new ValidationError('入力内容に誤りがあります', details);
}

/**
 * 管理者TOTP（2要素認証）コントローラー
 */
export class AdminTotpController {
  private totpService = new AdminTotpService();

  /**
   * TOTPセットアップ開始
   * POST /admin/auth/2fa/setup
   *
   * 新しい秘密鍵を生成し、QRコードを返却
   */
  setup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      const clientInfo = extractClientInfo(req);

      const result = await this.totpService.setupTotp(
        req.adminUser.id,
        req.adminUser.email,
        clientInfo.ipAddress,
        clientInfo.userAgent
      );

      res.json({
        secret: result.secret,
        qrCodeDataUrl: result.qrCodeDataUrl,
        otpauthUrl: result.otpauthUrl,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * TOTP有効化
   * POST /admin/auth/2fa/enable
   *
   * ユーザーが入力したコードを検証し、有効化
   */
  enable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      // バリデーション
      const parsed = totpCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createValidationError(parsed.error);
      }

      const { code } = parsed.data;
      const clientInfo = extractClientInfo(req);

      await this.totpService.enableTotp(
        req.adminUser.id,
        code,
        clientInfo.ipAddress,
        clientInfo.userAgent
      );

      res.json({
        message: '2要素認証が有効になりました',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * TOTP検証（ログイン時の2FA）
   * POST /admin/auth/2fa/verify
   *
   * ログイン後の2要素認証検証
   */
  verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      // バリデーション
      const parsed = totpCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createValidationError(parsed.error);
      }

      const { code } = parsed.data;
      const clientInfo = extractClientInfo(req);

      await this.totpService.verifyTotp(
        req.adminUser.id,
        code,
        clientInfo.ipAddress,
        clientInfo.userAgent
      );

      res.json({
        message: '2要素認証に成功しました',
        verified: true,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * TOTP無効化
   * POST /admin/auth/2fa/disable
   *
   * パスワード確認後、2要素認証を無効化
   */
  disable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      // バリデーション
      const parsed = disableTotpSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createValidationError(parsed.error);
      }

      const { password } = parsed.data;
      const clientInfo = extractClientInfo(req);

      await this.totpService.disableTotp(
        req.adminUser.id,
        password,
        clientInfo.ipAddress,
        clientInfo.userAgent
      );

      res.json({
        message: '2要素認証が無効になりました',
      });
    } catch (error) {
      next(error);
    }
  };
}
