import crypto from 'crypto';

/**
 * AES-256-GCM によるトークン暗号化ユーティリティ
 *
 * 形式: iv:authTag:ciphertext （Base64エンコード、コロン区切り）
 * - IV: 12バイトのランダム値（毎回生成）
 * - AuthTag: 16バイト（GCMの改ざん検知）
 * - キー: 環境変数の文字列をSHA-256でハッシュして32バイトに正規化
 */

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = 'aes-256-gcm';

/**
 * 暗号化キーをSHA-256で32バイトに正規化
 */
function deriveKey(key: string): Buffer {
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * 平文を AES-256-GCM で暗号化する
 * @returns iv:authTag:ciphertext 形式の暗号文（各パートはBase64エンコード）
 */
export function encrypt(plaintext: string, key: string): string {
  const derivedKey = deriveKey(key);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * AES-256-GCM で暗号化されたテキストを復号する
 * @param ciphertext iv:authTag:ciphertext 形式の暗号文
 */
export function decrypt(ciphertext: string, key: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('不正な暗号文形式です');
  }

  const [ivBase64, authTagBase64, encryptedBase64] = parts;
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error('不正なIV長です');
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('不正なAuthTag長です');
  }

  const derivedKey = deriveKey(key);

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * トークンを暗号化する（null/undefinedはそのまま返す）
 */
export function encryptToken(token: string | null | undefined, key: string): string | null {
  if (token == null) {
    return null;
  }
  return encrypt(token, key);
}

/**
 * トークンが暗号化形式（iv:authTag:ciphertext）かどうかを判定する
 */
function isEncryptedFormat(token: string): boolean {
  const parts = token.split(':');
  if (parts.length !== 3) return false;
  // IVが12バイト（Base64で16文字）、AuthTagが16バイト（Base64で24文字）
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

/**
 * トークンを復号する（null/undefinedはそのまま返す）
 * 暗号化されていない平文トークンはそのまま返す（マイグレーション互換性）
 */
export function decryptToken(token: string | null | undefined, key: string): string | null {
  if (token == null) {
    return null;
  }
  // 暗号化形式でない場合は平文として返す（既存データの後方互換性）
  if (!isEncryptedFormat(token)) {
    return token;
  }
  return decrypt(token, key);
}
