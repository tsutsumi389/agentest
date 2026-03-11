/**
 * URL関連のユーティリティ関数
 */

/**
 * 招待リンクを生成する
 * @param token 招待トークン
 * @returns 招待URL
 */
export function getInvitationUrl(token: string): string {
  return `${window.location.origin}/invitations/${encodeURIComponent(token)}`;
}

/**
 * リダイレクト先が安全な内部パスかどうかを検証する
 * オープンリダイレクト攻撃を防止するため、/で始まり//で始まらないパスのみ許可する
 * @param url 検証対象のURL
 * @returns 安全な内部パスの場合true
 */
export function isSafeRedirect(url: string): boolean {
  // /で始まり、//や/\で始まらないパスのみ許可（バックスラッシュによるバイパス防止）
  return url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
}

/**
 * リダイレクト先を安全な値に正規化する
 * 外部URLや不正なパスの場合はフォールバック先を返す
 * @param url 検証対象のURL（nullの場合はフォールバック）
 * @param fallback フォールバック先（デフォルト: '/dashboard'）
 * @returns 安全なリダイレクト先
 */
export function getSafeRedirect(url: string | null, fallback = '/dashboard'): string {
  if (!url) return fallback;
  return isSafeRedirect(url) ? url : fallback;
}
