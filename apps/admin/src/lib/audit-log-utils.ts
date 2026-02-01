import type { AdminAuditLogCategory } from '@agentest/shared/types';

/**
 * カテゴリの日本語ラベル
 */
export const CATEGORY_LABELS: Record<AdminAuditLogCategory, string> = {
  AUTH: '認証',
  USER: 'ユーザー',
  ORGANIZATION: '組織',
  MEMBER: 'メンバー',
  PROJECT: 'プロジェクト',
  API_TOKEN: 'APIトークン',
  BILLING: '課金',
};
