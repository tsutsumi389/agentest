import { encrypt, decrypt } from '../utils/crypto.js';

/**
 * TOTP シークレット暗号化ユーティリティ
 *
 * totpSecretをDBに保存する前にAES-256-GCMで暗号化し、
 * DB漏洩時に全ユーザーの2FAがバイパスされるリスクを軽減する。
 *
 * 内部的には既存の crypto.ts の encrypt/decrypt を使用し、
 * TOTP_ENCRYPTION_KEY 環境変数を暗号化キーとして利用する。
 */

// 暗号化キーの最低長（HKDF導出の入力エントロピーを保証）
const MIN_KEY_LENGTH = 32;

/**
 * 環境変数から暗号化キーを取得する
 * @throws TOTP_ENCRYPTION_KEY が未設定または短すぎる場合
 */
function getEncryptionKey(): string {
  const key = process.env.TOTP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('TOTP_ENCRYPTION_KEY が設定されていません');
  }
  if (key.length < MIN_KEY_LENGTH) {
    throw new Error('TOTP_ENCRYPTION_KEY は最低32文字必要です');
  }
  return key;
}

/**
 * TOTPシークレットを暗号化する
 * @param secret 平文のTOTPシークレット（Base32文字列）
 * @returns 暗号化された文字列（enc:v1:iv:authTag:ciphertext 形式）
 */
export function encryptTotpSecret(secret: string): string {
  const key = getEncryptionKey();
  return encrypt(secret, key);
}

/**
 * 暗号化されたTOTPシークレットを復号する
 * @param encryptedSecret 暗号化されたTOTPシークレット
 * @returns 平文のTOTPシークレット（Base32文字列）
 */
export function decryptTotpSecret(encryptedSecret: string): string {
  const key = getEncryptionKey();
  return decrypt(encryptedSecret, key);
}
