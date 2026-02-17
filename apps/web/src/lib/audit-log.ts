import {
  Shield,
  User,
  Building2,
  Users,
  FolderKanban,
  Key,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

// 共有ユーティリティを再エクスポート
export { generateTimestamp } from '@agentest/shared';

/**
 * 監査ログのカテゴリ定義
 */
export const AUDIT_LOG_CATEGORIES = {
  AUTH: { label: '認証', icon: Shield, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  USER: { label: 'ユーザー', icon: User, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  ORGANIZATION: { label: '組織', icon: Building2, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  MEMBER: { label: 'メンバー', icon: Users, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  PROJECT: { label: 'プロジェクト', icon: FolderKanban, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  API_TOKEN: { label: 'APIトークン', icon: Key, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
} as const;

export type AuditLogCategoryKey = keyof typeof AUDIT_LOG_CATEGORIES;

/**
 * カテゴリ情報の型
 */
export interface AuditLogCategoryInfo {
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

/**
 * 不明なカテゴリ用のデフォルト情報
 */
export const UNKNOWN_CATEGORY_INFO: AuditLogCategoryInfo = {
  label: '不明',
  icon: HelpCircle,
  color: 'text-foreground-muted',
  bgColor: 'bg-background-tertiary',
};

/**
 * カテゴリキーかどうかを判定する型ガード
 */
export function isAuditLogCategoryKey(key: string): key is AuditLogCategoryKey {
  return key in AUDIT_LOG_CATEGORIES;
}

/**
 * カテゴリ情報を取得
 */
export function getAuditLogCategoryInfo(category: string): AuditLogCategoryInfo {
  if (isAuditLogCategoryKey(category)) {
    return AUDIT_LOG_CATEGORIES[category];
  }
  return { ...UNKNOWN_CATEGORY_INFO, label: category };
}

/**
 * 詳細表示から除外するフィールド
 */
export const EXCLUDED_DETAIL_FIELDS = new Set([
  'id',
  'userId',
  'organizationId',
  'createdAt',
  'updatedAt',
]);

/**
 * 既知のフィールドラベルマッピング
 */
export const KNOWN_FIELD_LABELS: Record<string, string> = {
  email: 'メールアドレス',
  name: '名前',
  role: 'ロール',
  oldRole: '変更前ロール',
  newRole: '変更後ロール',
  targetName: '対象名',
  reason: '理由',
  description: '説明',
  ipAddress: 'IPアドレス',
  provider: 'プロバイダー',
  tokenName: 'トークン名',
};

/**
 * 値を表示用文字列に変換
 */
export function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value || '-';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(formatDetailValue).join(', ') || '-';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
