/**
 * 日付フォーマットユーティリティ
 */

/**
 * 相対時間をフォーマット（例: 5分前、2日前）
 */
export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'たった今';
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays === 0) return '今日';
  if (diffDays === 1) return '昨日';
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
  return formatDate(isoString);
}

/**
 * 日付をフォーマット（例: 2024年1月15日）
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * 日時をフォーマット（例: 2024年1月15日 12:00）
 */
export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
