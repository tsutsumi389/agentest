/**
 * 管理者向けユーザー一覧型定義
 */

// ============================================
// 検索パラメータ
// ============================================

/**
 * ユーザーステータスフィルタ
 */
export type AdminUserStatus = 'active' | 'deleted' | 'all';

/**
 * ソート項目
 */
export type AdminUserSortBy = 'createdAt' | 'name' | 'email';

/**
 * ユーザー検索パラメータ
 */
export interface AdminUserSearchParams {
  /** 検索クエリ（メール・名前で部分一致） */
  q?: string;
  /** ステータスフィルタ */
  status?: AdminUserStatus;
  /** 登録日From */
  createdFrom?: string;
  /** 登録日To */
  createdTo?: string;
  /** ページ番号（1始まり） */
  page?: number;
  /** 1ページあたり件数 */
  limit?: number;
  /** ソート項目 */
  sortBy?: AdminUserSortBy;
  /** ソート順 */
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// レスポンス
// ============================================

/**
 * ユーザー統計情報
 */
export interface AdminUserStats {
  /** 所属組織数 */
  organizationCount: number;
  /** 所有プロジェクト数 */
  projectCount: number;
  /** 最終アクティブ日時 */
  lastActiveAt: string | null;
}

/**
 * ユーザー一覧項目
 */
export interface AdminUserListItem {
  /** ユーザーID */
  id: string;
  /** メールアドレス */
  email: string;
  /** 表示名 */
  name: string;
  /** アバターURL */
  avatarUrl: string | null;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
  /** 削除日時 */
  deletedAt: string | null;
  /** 統計情報 */
  stats: AdminUserStats;
}

/**
 * ページネーション情報
 */
export interface AdminUserPagination {
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
 * ユーザー一覧レスポンス
 */
export interface AdminUserListResponse {
  /** ユーザー一覧 */
  users: AdminUserListItem[];
  /** ページネーション情報 */
  pagination: AdminUserPagination;
}

// ============================================
// ユーザー詳細
// ============================================

/**
 * 所属組織情報
 */
export interface AdminUserOrganization {
  /** 組織ID */
  id: string;
  /** 組織名 */
  name: string;
  /** 役割 */
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  /** 参加日時 */
  joinedAt: string;
}

/**
 * OAuth連携プロバイダー情報
 */
export interface AdminUserOAuthProvider {
  /** プロバイダー名 */
  provider: string;
  /** 連携日時 */
  createdAt: string;
}

/**
 * 監査ログエントリ
 */
export interface AdminUserAuditLogEntry {
  /** ログID */
  id: string;
  /** カテゴリ */
  category: string;
  /** アクション */
  action: string;
  /** 対象タイプ */
  targetType: string | null;
  /** 対象ID */
  targetId: string | null;
  /** IPアドレス */
  ipAddress: string | null;
  /** 作成日時 */
  createdAt: string;
}

/**
 * ユーザー詳細情報
 */
export interface AdminUserDetail {
  /** ユーザーID */
  id: string;
  /** メールアドレス */
  email: string;
  /** 表示名 */
  name: string;
  /** アバターURL */
  avatarUrl: string | null;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
  /** 削除日時 */
  deletedAt: string | null;
  /** アクティビティ情報 */
  activity: {
    /** 最終アクティブ日時 */
    lastActiveAt: string | null;
    /** アクティブセッション数 */
    activeSessionCount: number;
  };
  /** 統計情報 */
  stats: {
    /** 所属組織数 */
    organizationCount: number;
    /** 参加プロジェクト数 */
    projectCount: number;
    /** テストスイート作成数 */
    testSuiteCount: number;
    /** テスト実行数 */
    executionCount: number;
  };
  /** 所属組織一覧 */
  organizations: AdminUserOrganization[];
  /** OAuth連携プロバイダー一覧 */
  oauthProviders: AdminUserOAuthProvider[];
  /** 最近の監査ログ */
  recentAuditLogs: AdminUserAuditLogEntry[];
}

/**
 * ユーザー詳細レスポンス
 */
export interface AdminUserDetailResponse {
  /** ユーザー詳細 */
  user: AdminUserDetail;
}
