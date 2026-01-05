/**
 * アプリケーション共通の定数定義
 */

/**
 * テストケース優先度バッジの色
 */
export const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-danger text-white',
  HIGH: 'bg-warning text-white',
  MEDIUM: 'bg-accent text-white',
  LOW: 'bg-foreground-muted text-white',
};

/**
 * テストケース優先度のラベル
 */
export const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: '緊急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

/**
 * テストケースステータスバッジの色
 */
export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-foreground-muted/20 text-foreground-muted',
  ACTIVE: 'bg-success/20 text-success',
  ARCHIVED: 'bg-warning/20 text-warning',
};

/**
 * テストケースステータスのラベル
 */
export const STATUS_LABELS: Record<string, string> = {
  DRAFT: '下書き',
  ACTIVE: 'アクティブ',
  ARCHIVED: 'アーカイブ',
};
