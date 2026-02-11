import { encrypt, decrypt } from '../utils/crypto.js';
import { env } from '../config/env.js';

/**
 * TOTP シークレット暗号化ユーティリティ
 *
 * totpSecretをDBに保存する前にAES-256-GCMで暗号化し、
 * DB漏洩時に全ユーザーの2FAがバイパスされるリスクを軽減する。
 *
 * 内部的には既存の crypto.ts の encrypt/decrypt を使用し、
 * env.TOTP_ENCRYPTION_KEY を暗号化キーとして利用する。
 */

/**
 * TOTPシークレットを暗号化する
 * @param secret 平文のTOTPシークレット（Base32文字列）
 * @returns 暗号化された文字列（enc:v1:iv:authTag:ciphertext 形式）
 */
export function encryptTotpSecret(secret: string): string {
  return encrypt(secret, env.TOTP_ENCRYPTION_KEY);
}

/**
 * 暗号化されたTOTPシークレットを復号する
 * @param encryptedSecret 暗号化されたTOTPシークレット
 * @returns 平文のTOTPシークレット（Base32文字列）
 */
export function decryptTotpSecret(encryptedSecret: string): string {
  return decrypt(encryptedSecret, env.TOTP_ENCRYPTION_KEY);
}
