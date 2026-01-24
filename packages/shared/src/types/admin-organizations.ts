/**
 * 管理者向け組織一覧型定義
 */

// ============================================
// 検索パラメータ
// ============================================

/**
 * 組織ステータスフィルタ
 */
export type AdminOrganizationStatus = 'active' | 'deleted' | 'all';

/**
 * ソート項目
 */
export type AdminOrganizationSortBy = 'createdAt' | 'name' | 'plan';

/**
 * 組織検索パラメータ
 * 注: Zodスキーマ（adminOrganizationSearchSchema）から推論される型（AdminOrganizationSearch）は
 * transform処理を含むため、このインターフェースとは微妙に異なる。
 * サービス層ではこのインターフェースを使用し、コントローラー層でZodバリデーション後の型を受け取る。
 */
export interface AdminOrganizationSearchParams {
  /** 検索クエリ（名前・スラグで部分一致） */
  q?: string;
  /** プランフィルタ（カンマ区切り） */
  plan?: ('TEAM' | 'ENTERPRISE')[];
  /** ステータスフィルタ */
  status?: AdminOrganizationStatus;
  /** 登録日From */
  createdFrom?: string;
  /** 登録日To */
  createdTo?: string;
  /** ページ番号（1始まり） */
  page?: number;
  /** 1ページあたり件数 */
  limit?: number;
  /** ソート項目 */
  sortBy?: AdminOrganizationSortBy;
  /** ソート順 */
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// レスポンス
// ============================================

/**
 * 組織統計情報
 */
export interface AdminOrganizationStats {
  /** メンバー数 */
  memberCount: number;
  /** プロジェクト数 */
  projectCount: number;
}

/**
 * 組織オーナー情報
 */
export interface AdminOrganizationOwner {
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
 * 組織一覧項目
 */
export interface AdminOrganizationListItem {
  /** 組織ID */
  id: string;
  /** 組織名 */
  name: string;
  /** スラグ */
  slug: string;
  /** 説明 */
  description: string | null;
  /** アバターURL */
  avatarUrl: string | null;
  /** プラン */
  plan: 'TEAM' | 'ENTERPRISE';
  /** 請求先メールアドレス */
  billingEmail: string | null;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
  /** 削除日時 */
  deletedAt: string | null;
  /** 統計情報 */
  stats: AdminOrganizationStats;
  /** オーナー情報 */
  owner: AdminOrganizationOwner | null;
}

/**
 * ページネーション情報
 */
export interface AdminOrganizationPagination {
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
 * 組織一覧レスポンス
 */
export interface AdminOrganizationListResponse {
  /** 組織一覧 */
  organizations: AdminOrganizationListItem[];
  /** ページネーション情報 */
  pagination: AdminOrganizationPagination;
}
