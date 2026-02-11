import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticationError } from '@agentest/shared';
import { UserTotpService } from '../services/user-totp.service.js';
import { extractClientInfo } from '../middleware/session.middleware.js';
import { createValidationError } from '../utils/validation.js';

// TOTPコードのバリデーション（6桁の数字）
const totpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'TOTPコードは6桁の数字で入力してください'),
});

// TOTP無効化のバリデーション
const disableTotpSchema = z.object({
  password: z.string().min(1, 'パスワードを入力してください'),
});

/**
 * ユーザーTOTP（2要素認証）コントローラー
 */
export class UserTotpController {
  private totpService = new UserTotpService();

  /**
   * TOTPセットアップ開始
   * POST /api/auth/2fa/setup
   *
   * 新しい秘密鍵を生成し、QRコードを返却
   */
  setup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('認証が必要です');
      }

      const clientInfo = extractClientInfo(req);

      const result = await this.totpService.setupTotp(
        req.user.id,
        req.user.email,
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
   * POST /api/auth/2fa/enable
   *
   * ユーザーが入力したコードを検証し、有効化
   */
  enable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
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
        req.user.id,
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
   * POST /api/auth/2fa/verify
   *
   * ログイン後の2要素認証検証
   */
  verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
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
        req.user.id,
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
   * POST /api/auth/2fa/disable
   *
   * パスワード確認後、2要素認証を無効化
   */
  disable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
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
        req.user.id,
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

  /**
   * TOTPステータス取得
   * GET /api/auth/2fa/status
   *
   * 2要素認証の有効/無効状態を返却
   */
  status = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('認証が必要です');
      }

      res.json({
        totpEnabled: req.user.totpEnabled,
      });
    } catch (error) {
      next(error);
    }
  };
}
