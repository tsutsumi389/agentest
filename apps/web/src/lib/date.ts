/**
 * 日付フォーマットユーティリティ
 */

/**
 * 日付を日本語形式でフォーマット（年月日）
 * 例: 2024年1月15日
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * 日付を日本語形式でフォーマット（年月日 時分）
 * 例: 2024年1月15日 14:30
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 日付をコンパクトな形式でフォーマット（年-月-日 時:分）
 * 例: 2024-01-15 14:30
 * 主に実施者情報など、省スペースで表示したい場合に使用
 */
export function formatDateTimeCompact(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 2つの日時の差分を経過時間としてフォーマット
 * 例: 1時間23分45秒、5分30秒
 */
export function formatDuration(startDateString: string, endDateString: string): string {
  const start = new Date(startDateString);
  const end = new Date(endDateString);
  const diffMs = end.getTime() - start.getTime();

  if (diffMs < 0 || Number.isNaN(diffMs)) return '---';

  const diffSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;

  if (hours > 0) {
    return `${hours}時間${minutes}分${seconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * 相対的な時間表示
 * 例: 3分前、2時間前、1日前
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'たった今';
  } else if (diffMin < 60) {
    return `${diffMin}分前`;
  } else if (diffHour < 24) {
    return `${diffHour}時間前`;
  } else if (diffDay < 7) {
    return `${diffDay}日前`;
  } else {
    return formatDate(dateString);
  }
}

/**
 * 相対的な時間表示（null対応版）
 * nullまたはundefinedの場合は'--'を返す
 * 例: 3分前、2時間前、1日前、--
 */
export function formatRelativeTimeOrDefault(
  date: Date | string | null | undefined,
  defaultValue = '--'
): string {
  if (!date) return defaultValue;
  const dateString = typeof date === 'string' ? date : date.toISOString();
  return formatRelativeTime(dateString);
}
