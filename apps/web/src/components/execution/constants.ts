/**
 * 実行コンポーネント共通定数
 */

/** 優先度バッジの色 */
export const priorityColors: Record<string, string> = {
  CRITICAL: 'bg-danger text-white',
  HIGH: 'bg-warning text-white',
  MEDIUM: 'bg-accent text-white',
  LOW: 'bg-foreground-muted text-white',
};

/** 優先度のラベル */
export const priorityLabels: Record<string, string> = {
  CRITICAL: '緊急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};
