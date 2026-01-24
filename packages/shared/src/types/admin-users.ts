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
export type AdminUserSortBy = 'createdAt' | 'name' | 'email' | 'plan';

/**
 * ユーザー検索パラメータ
 */
export interface AdminUserSearchParams {
  /** 検索クエリ（メール・名前で部分一致） */
  q?: string;
  /** プランフィルタ（カンマ区切り） */
  plan?: ('FREE' | 'PRO')[];
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
  /** プラン */
  plan: 'FREE' | 'PRO';
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
