import crypto from 'crypto';

/**
 * AES-256-GCM によるトークン暗号化ユーティリティ
 *
 * 形式: enc:v1:iv:authTag:ciphertext （Base64エンコード、コロン区切り）
 * - プレフィックス: enc:v1:（バージョニング・将来のキーローテーション対応）
 * - IV: 12バイトのランダム値（毎回生成）
 * - AuthTag: 16バイト（GCMの改ざん検知）
 * - キー: 環境変数の文字列をHKDFで32バイトに導出
 */

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTED_PREFIX = 'enc:v1:';
const HKDF_SALT = 'agentest-token-encryption-salt';
const HKDF_INFO = 'aes-256-gcm-key';

// 導出済みキーのキャッシュ（同一キーの再計算を避ける）
let cachedKey: { raw: string; derived: Buffer } | null = null;

/**
 * 暗号化キーをHKDFで32バイトに導出（キャッシュ付き）
 */
function deriveKey(key: string): Buffer {
  if (cachedKey && cachedKey.raw === key) {
    return cachedKey.derived;
  }
  const derived = Buffer.from(crypto.hkdfSync('sha256', key, HKDF_SALT, HKDF_INFO, 32));
  cachedKey = { raw: key, derived };
  return derived;
}

/**
 * 平文を AES-256-GCM で暗号化する
 * @returns enc:v1:iv:authTag:ciphertext 形式の暗号文（各パートはBase64エンコード）
 */
export function encrypt(plaintext: string, key: string): string {
  const derivedKey = deriveKey(key);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  const authTag = cipher.getAuthTag();

  return (
    ENCRYPTED_PREFIX +
    [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
  );
}

/**
 * AES-256-GCM で暗号化されたテキストを復号する
 * @param ciphertext enc:v1:iv:authTag:ciphertext 形式の暗号文
 */
export function decrypt(ciphertext: string, key: string): string {
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('不正な暗号文形式です: プレフィックスが一致しません');
  }

  const payload = ciphertext.slice(ENCRYPTED_PREFIX.length);
  const parts = payload.split(':');
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

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

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
 * トークンが暗号化形式（enc:v1:...）かどうかを判定する
 */
function isEncryptedFormat(token: string): boolean {
  return token.startsWith(ENCRYPTED_PREFIX);
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
