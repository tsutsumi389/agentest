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
