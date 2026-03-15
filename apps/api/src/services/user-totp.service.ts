import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { AuthenticationError, ValidationError } from '@agentest/shared';
import { UserRepository } from '../repositories/user.repository.js';
import { AuditLogService } from './audit-log.service.js';
import { encryptTotpSecret, decryptTotpSecret } from '../lib/totp-crypto.js';
import {
  setUserTotpSetupSecret,
  getUserTotpSetupSecret,
  deleteUserTotpSetupSecret,
  markUserTotpCodeUsed,
  isUserTotpCodeUsed,
} from '../lib/redis-store.js';

// アプリケーション名（QRコードに表示される）
const APP_NAME = 'Agentest';
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
 * ユーザーTOTP（2要素認証）サービス
 *
 * Google Authenticatorなどの認証アプリと連携し、
 * ユーザーのセキュリティを強化する。
 *
 * admin実装との主な違い:
 * - totpSecretをAES-256-GCMで暗号化してDBに保存
 * - AuditLogService（カテゴリ AUTH）で監査ログを記録
 * - ユーザー向けRedis関数（setUserTotpSetupSecret等）を使用
 */
export class UserTotpService {
  private userRepo = new UserRepository();
  private auditLogService = new AuditLogService();

  /**
   * TOTPセットアップを開始
   *
   * 新しい秘密鍵を生成し、QRコードを返却。
   * 秘密鍵はRedisに一時保存（5分間有効）
   */
  async setupTotp(
    userId: string,
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
    const saved = await setUserTotpSetupSecret(userId, secret, SETUP_SECRET_TTL);
    if (!saved) {
      throw new Error('TOTPセットアップの一時保存に失敗しました');
    }

    // 監査ログを記録
    await this.auditLogService.log({
      userId,
      category: 'AUTH',
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
   * ユーザーが入力したコードを検証し、正しければ暗号化してDBに保存
   */
  async enableTotp(
    userId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // 既に2FAが有効な場合はエラー
    const existingSecret = await this.userRepo.getTotpSecret(userId);
    if (existingSecret) {
      throw new ValidationError('2要素認証は既に有効です');
    }

    // Redisから一時秘密鍵を取得
    const tempSecret = await getUserTotpSetupSecret(userId);
    if (!tempSecret) {
      throw new ValidationError(
        'TOTPセットアップの有効期限が切れました。再度セットアップしてください'
      );
    }

    // TOTPコードを検証
    const isValid = verifySync({ secret: tempSecret, token: code }).valid;

    if (!isValid) {
      await this.auditLogService.log({
        userId,
        category: 'AUTH',
        action: 'TOTP_ENABLE_FAILED',
        details: { reason: 'invalid_code' },
        ipAddress,
        userAgent,
      });
      throw new ValidationError('TOTPコードが正しくありません');
    }

    // 秘密鍵を暗号化してDBに保存
    let encryptedSecret: string;
    try {
      encryptedSecret = encryptTotpSecret(tempSecret);
    } catch {
      await this.auditLogService.log({
        userId,
        category: 'AUTH',
        action: 'TOTP_ENABLE_FAILED',
        details: { reason: 'encryption_failed' },
        ipAddress,
        userAgent,
      });
      throw new Error('2要素認証の有効化に失敗しました');
    }
    await this.userRepo.enableTotp(userId, encryptedSecret);

    // Redisの一時データを削除
    await deleteUserTotpSetupSecret(userId);

    // 監査ログを記録
    await this.auditLogService.log({
      userId,
      category: 'AUTH',
      action: 'TOTP_ENABLED',
      ipAddress,
      userAgent,
    });
  }

  /**
   * ログイン時のTOTP検証
   *
   * DB上の暗号化秘密鍵を復号してからコードを検証する。
   * リプレイ攻撃対策として使用済みコードを記録する。
   */
  async verifyTotp(
    userId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    // リプレイ攻撃対策: 使用済みコードかチェック
    const alreadyUsed = await isUserTotpCodeUsed(userId, code);
    if (alreadyUsed) {
      await this.auditLogService.log({
        userId,
        category: 'AUTH',
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'code_already_used' },
        ipAddress,
        userAgent,
      });
      throw new AuthenticationError('TOTPコードは既に使用されています');
    }

    // DBから暗号化秘密鍵を取得
    const encryptedSecret = await this.userRepo.getTotpSecret(userId);
    if (!encryptedSecret) {
      await this.auditLogService.log({
        userId,
        category: 'AUTH',
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'totp_not_enabled' },
        ipAddress,
        userAgent,
      });
      throw new AuthenticationError('2要素認証が設定されていません');
    }

    // 暗号化秘密鍵を復号
    let secret: string;
    try {
      secret = decryptTotpSecret(encryptedSecret);
    } catch {
      await this.auditLogService.log({
        userId,
        category: 'AUTH',
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'decryption_failed' },
        ipAddress,
        userAgent,
      });
      throw new AuthenticationError('2要素認証の検証に失敗しました');
    }

    // TOTPコードを検証
    const isValid = verifySync({ secret, token: code }).valid;

    if (!isValid) {
      await this.auditLogService.log({
        userId,
        category: 'AUTH',
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'invalid_code' },
        ipAddress,
        userAgent,
      });
      throw new AuthenticationError('TOTPコードが正しくありません');
    }

    // コードを使用済みとしてマーク（リプレイ攻撃対策）
    await markUserTotpCodeUsed(userId, code, USED_CODE_TTL);

    // 監査ログを記録
    await this.auditLogService.log({
      userId,
      category: 'AUTH',
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
   */
  async disableTotp(
    userId: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // ユーザー情報をパスワード付きで取得
    const user = await this.userRepo.findByIdWithPassword(userId);
    if (!user) {
      throw new AuthenticationError('ユーザーが見つかりません');
    }

    // パスワード検証（OAuthユーザーはパスワード未設定の可能性あり）
    if (!user.passwordHash) {
      throw new AuthenticationError('パスワードが設定されていません');
    }
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.auditLogService.log({
        userId,
        category: 'AUTH',
        action: 'TOTP_DISABLE_FAILED',
        details: { reason: 'invalid_password' },
        ipAddress,
        userAgent,
      });
      throw new AuthenticationError('パスワードが正しくありません');
    }

    // TOTPを無効化
    await this.userRepo.disableTotp(userId);

    // 監査ログを記録
    await this.auditLogService.log({
      userId,
      category: 'AUTH',
      action: 'TOTP_DISABLED',
      ipAddress,
      userAgent,
    });
  }
}
