import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { AuthenticationError, ValidationError } from '@agentest/shared';
import { AdminUserRepository } from '../../repositories/admin-user.repository.js';
import { AdminAuditLogService } from './admin-audit-log.service.js';
import {
  setTotpSetupSecret,
  getTotpSetupSecret,
  deleteTotpSetupSecret,
  markTotpCodeUsed,
  isTotpCodeUsed,
} from '../../lib/redis-store.js';

// アプリケーション名（QRコードに表示される）
const APP_NAME = 'Agentest Admin';
// セットアップ秘密鍵の有効期限（秒）
const SETUP_SECRET_TTL = 300; // 5分
// 使用済みコードの記録期間（秒）
const USED_CODE_TTL = 90;

/**
 * TOTPセットアップ結果
 */
export interface TotpSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
}

/**
 * 管理者TOTP（2要素認証）サービス
 *
 * Google Authenticatorなどの認証アプリと連携し、
 * 管理者のセキュリティを強化
 */
export class AdminTotpService {
  private userRepo = new AdminUserRepository();
  private auditLogService = new AdminAuditLogService();

  /**
   * TOTPセットアップを開始
   *
   * 新しい秘密鍵を生成し、QRコードを返却
   * 秘密鍵はRedisに一時保存（5分間有効）
   *
   * @param adminUserId 管理者ユーザーID
   * @param email 管理者のメールアドレス（QRコードに表示）
   * @param ipAddress クライアントIPアドレス
   * @param userAgent クライアントユーザーエージェント
   */
  async setupTotp(
    adminUserId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<TotpSetupResult> {
    // 新しい秘密鍵を生成
    const secret = generateSecret();

    // otpauth:// URL を生成
    const otpauthUrl = generateURI({
      issuer: APP_NAME,
      label: email,
      secret,
    });

    // QRコードを生成（Data URL形式）
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Redisに一時保存
    const saved = await setTotpSetupSecret(adminUserId, secret, SETUP_SECRET_TTL);
    if (!saved) {
      throw new Error('TOTPセットアップの一時保存に失敗しました');
    }

    // 監査ログを記録
    await this.auditLogService.log({
      adminUserId,
      action: 'TOTP_SETUP_INITIATED',
      ipAddress,
      userAgent,
    });

    return {
      secret,
      qrCodeDataUrl,
      otpauthUrl,
    };
  }

  /**
   * TOTPを有効化
   *
   * ユーザーが入力したコードを検証し、正しければDBに秘密鍵を保存
   *
   * @param adminUserId 管理者ユーザーID
   * @param code ユーザーが入力したTOTPコード
   * @param ipAddress クライアントIPアドレス
   * @param userAgent クライアントユーザーエージェント
   */
  async enableTotp(
    adminUserId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // 既に2FAが有効な場合はエラー
    const existingSecret = await this.userRepo.getTotpSecret(adminUserId);
    if (existingSecret) {
      throw new ValidationError('2要素認証は既に有効です');
    }

    // Redisから一時秘密鍵を取得
    const tempSecret = await getTotpSetupSecret(adminUserId);
    if (!tempSecret) {
      throw new ValidationError(
        'TOTPセットアップの有効期限が切れました。再度セットアップしてください'
      );
    }

    // TOTPコードを検証（前後1ステップの時間許容幅）
    const isValid = verifySync({ secret: tempSecret, token: code }).valid;

    if (!isValid) {
      await this.auditLogService.log({
        adminUserId,
        action: 'TOTP_ENABLE_FAILED',
        details: { reason: 'invalid_code' },
        ipAddress,
        userAgent,
      });
      throw new ValidationError('TOTPコードが正しくありません');
    }

    // DBに秘密鍵を保存
    await this.userRepo.enableTotp(adminUserId, tempSecret);

    // Redisの一時データを削除
    await deleteTotpSetupSecret(adminUserId);

    // 監査ログを記録
    await this.auditLogService.log({
      adminUserId,
      action: 'TOTP_ENABLED',
      ipAddress,
      userAgent,
    });
  }

  /**
   * ログイン時のTOTP検証
   *
   * @param adminUserId 管理者ユーザーID
   * @param code ユーザーが入力したTOTPコード
   * @param ipAddress クライアントIPアドレス
   * @param userAgent クライアントユーザーエージェント
   * @returns 検証成功の場合true
   */
  async verifyTotp(
    adminUserId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    // リプレイ攻撃対策: 使用済みコードかチェック
    const alreadyUsed = await isTotpCodeUsed(adminUserId, code);
    if (alreadyUsed) {
      await this.auditLogService.log({
        adminUserId,
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'code_already_used' },
        ipAddress,
        userAgent,
      });
      throw new AuthenticationError('TOTPコードは既に使用されています');
    }

    // DBから秘密鍵を取得
    const secret = await this.userRepo.getTotpSecret(adminUserId);
    if (!secret) {
      await this.auditLogService.log({
        adminUserId,
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'totp_not_enabled' },
        ipAddress,
        userAgent,
      });
      throw new AuthenticationError('2要素認証が設定されていません');
    }

    // TOTPコードを検証（前後1ステップの時間許容幅）
    const isValid = verifySync({ secret, token: code }).valid;

    if (!isValid) {
      await this.auditLogService.log({
        adminUserId,
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'invalid_code' },
        ipAddress,
        userAgent,
      });
      throw new AuthenticationError('TOTPコードが正しくありません');
    }

    // コードを使用済みとしてマーク（リプレイ攻撃対策）
    await markTotpCodeUsed(adminUserId, code, USED_CODE_TTL);

    // 監査ログを記録
    await this.auditLogService.log({
      adminUserId,
      action: 'TOTP_VERIFY_SUCCESS',
      ipAddress,
      userAgent,
    });

    return true;
  }

  /**
   * TOTPを無効化
   *
   * パスワード確認必須
   *
   * @param adminUserId 管理者ユーザーID
   * @param password 現在のパスワード
   * @param ipAddress クライアントIPアドレス
   * @param userAgent クライアントユーザーエージェント
   */
  async disableTotp(
    adminUserId: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // ユーザー情報をパスワード付きで取得（1クエリで完結）
    const user = await this.userRepo.findByIdWithPassword(adminUserId);
    if (!user) {
      throw new AuthenticationError('ユーザーが見つかりません');
    }

    // パスワード検証
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.auditLogService.log({
        adminUserId,
        action: 'TOTP_DISABLE_FAILED',
        details: { reason: 'invalid_password' },
        ipAddress,
        userAgent,
      });
      throw new AuthenticationError('パスワードが正しくありません');
    }

    // TOTPを無効化
    await this.userRepo.disableTotp(adminUserId);

    // 監査ログを記録
    await this.auditLogService.log({
      adminUserId,
      action: 'TOTP_DISABLED',
      ipAddress,
      userAgent,
    });
  }
}
