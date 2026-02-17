/**
 * 管理者向け全体監査ログ型定義
 */

// ============================================
// カテゴリ定義
// ============================================

/**
 * 監査ログカテゴリ
 */
export type AdminAuditLogCategory =
  | 'AUTH'
  | 'USER'
  | 'ORGANIZATION'
  | 'MEMBER'
  | 'PROJECT'
  | 'API_TOKEN';

/**
 * カテゴリ一覧（フィルター用）
 */
export const ADMIN_AUDIT_LOG_CATEGORIES: AdminAuditLogCategory[] = [
  'AUTH',
  'USER',
  'ORGANIZATION',
  'MEMBER',
  'PROJECT',
  'API_TOKEN',
];

// ============================================
// 検索パラメータ
// ============================================

/**
 * ソート項目
 */
export type AdminAuditLogSortBy = 'createdAt';

/**
 * 監査ログ検索パラメータ
 */
export interface AdminAuditLogSearchParams {
  /** 検索クエリ（アクション名で部分一致） */
  q?: string;
  /** カテゴリフィルタ（カンマ区切り） */
  category?: AdminAuditLogCategory[];
  /** 組織IDでフィルタ */
  organizationId?: string;
  /** ユーザーIDでフィルタ */
  userId?: string;
  /** 開始日時 */
  startDate?: string;
  /** 終了日時 */
  endDate?: string;
  /** ページ番号（1始まり） */
  page?: number;
  /** 1ページあたり件数（最大100） */
  limit?: number;
  /** ソート項目 */
  sortBy?: AdminAuditLogSortBy;
  /** ソート順 */
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// レスポンス
// ============================================

/**
 * 監査ログユーザー情報
 */
export interface AdminAuditLogUser {
  /** ユーザーID */
  id: string;
  /** 表示名 */
  name: string;
  /** メールアドレス */
  email: string;
  /** アバターURL */
  avatarUrl: string | null;
}

/**
 * 監査ログ組織情報
 */
export interface AdminAuditLogOrganization {
  /** 組織ID */
  id: string;
  /** 組織名 */
  name: string;
}

/**
 * 監査ログエントリ
 */
export interface AdminAuditLogEntry {
  /** ログID */
  id: string;
  /** カテゴリ */
  category: AdminAuditLogCategory;
  /** アクション */
  action: string;
  /** 対象タイプ */
  targetType: string | null;
  /** 対象ID */
  targetId: string | null;
  /** 詳細情報（JSON） */
  details: Record<string, unknown> | null;
  /** IPアドレス */
  ipAddress: string | null;
  /** ユーザーエージェント */
  userAgent: string | null;
  /** 作成日時 */
  createdAt: string;
  /** 組織情報 */
  organization: AdminAuditLogOrganization | null;
  /** ユーザー情報 */
  user: AdminAuditLogUser | null;
}

/**
 * ページネーション情報
 */
export interface AdminAuditLogPagination {
  /** 現在のページ番号 */
  page: number;
  /** 1ページあたりの件数 */
  limit: number;
  /** 総件数 */
  total: number;
  /** 総ページ数 */
  totalPages: number;
}

/**
 * 監査ログ一覧レスポンス
 */
export interface AdminAuditLogListResponse {
  /** 監査ログ一覧 */
  auditLogs: AdminAuditLogEntry[];
  /** ページネーション情報 */
  pagination: AdminAuditLogPagination;
}

// ============================================
// フィルター選択肢（フロントエンド用）
// ============================================

/**
 * 組織選択肢
 */
export interface AdminAuditLogOrganizationOption {
  id: string;
  name: string;
}

/**
 * ユーザー選択肢
 */
export interface AdminAuditLogUserOption {
  id: string;
  name: string;
  email: string;
}

/**
 * フィルター選択肢レスポンス
 */
export interface AdminAuditLogFilterOptionsResponse {
  organizations: AdminAuditLogOrganizationOption[];
  users: AdminAuditLogUserOption[];
}
