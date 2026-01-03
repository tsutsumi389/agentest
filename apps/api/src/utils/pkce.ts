import crypto from 'crypto';

/**
 * PKCEユーティリティ
 * OAuth 2.1 PKCE (Proof Key for Code Exchange) の検証を行う
 */

/**
 * code_verifierからS256でcode_challengeを計算
 */
export function computeCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return base64UrlEncode(hash);
}

/**
 * code_verifierとcode_challengeを検証
 * S256方式: BASE64URL(SHA256(code_verifier)) == code_challenge
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string = 'S256'
): boolean {
  if (method !== 'S256') {
    // OAuth 2.1ではS256のみサポート (plain は非推奨)
    return false;
  }

  const computed = computeCodeChallenge(codeVerifier);
  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(codeChallenge)
  );
}

/**
 * Base64URL エンコード (RFC 4648)
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * セキュアなランダム文字列を生成 (認可コード用)
 */
export function generateAuthorizationCode(): string {
  return base64UrlEncode(crypto.randomBytes(32));
}

/**
 * セキュアなランダム文字列を生成 (アクセストークン用)
 */
export function generateAccessToken(): string {
  return base64UrlEncode(crypto.randomBytes(32));
}

/**
 * セキュアなランダム文字列を生成 (リフレッシュトークン用)
 */
export function generateRefreshToken(): string {
  return base64UrlEncode(crypto.randomBytes(32));
}

/**
 * トークンのハッシュを計算 (DB保存用)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * クライアントIDを生成
 */
export function generateClientId(): string {
  return crypto.randomUUID();
}
