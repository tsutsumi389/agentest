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

/**
 * 優先度の選択オプション
 */
export const PRIORITY_OPTIONS = [
  { value: 'CRITICAL', label: '緊急' },
  { value: 'HIGH', label: '高' },
  { value: 'MEDIUM', label: '中' },
  { value: 'LOW', label: '低' },
] as const;

/**
 * ステータストグルオプション（下書き/アクティブ）
 */
export const STATUS_TOGGLE_OPTIONS = [
  { value: 'DRAFT', label: '下書き' },
  { value: 'ACTIVE', label: 'アクティブ' },
] as const;

/**
 * レビューターゲットフィールドのラベル
 */
export const TARGET_FIELD_LABELS: Record<string, string> = {
  TITLE: '全体',
  DESCRIPTION: '説明',
  PRECONDITION: '前提条件',
  STEP: 'ステップ',
  EXPECTED_RESULT: '期待結果',
};

/**
 * レビュー評価オプションの型
 */
export interface VerdictOption {
  value: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENT_ONLY';
  label: string;
  description: string;
  iconName: 'CheckCircle' | 'AlertTriangle' | 'MessageSquare';
  className: string;
}

/**
 * レビュー評価オプション
 * 承認、要修正、コメントのみの3種類
 */
export const VERDICT_OPTIONS: VerdictOption[] = [
  {
    value: 'APPROVED',
    label: '承認',
    description: 'このテストスイートを承認します',
    iconName: 'CheckCircle',
    className: 'border-success text-success bg-success-subtle',
  },
  {
    value: 'CHANGES_REQUESTED',
    label: '要修正',
    description: '修正が必要な箇所があります',
    iconName: 'AlertTriangle',
    className: 'border-warning text-warning bg-warning-subtle',
  },
  {
    value: 'COMMENT_ONLY',
    label: 'コメントのみ',
    description: '承認・修正依頼なしでコメントを残します',
    iconName: 'MessageSquare',
    className: 'border-foreground-muted text-foreground-muted bg-background-tertiary',
  },
];
