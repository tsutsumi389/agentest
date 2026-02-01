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
  /** 検索クエリ（名前で部分一致） */
  q?: string;
  /** プランフィルタ（カンマ区切り） */
  plan?: ('NONE' | 'TEAM' | 'ENTERPRISE')[];
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
  /** 説明 */
  description: string | null;
  /** アバターURL */
  avatarUrl: string | null;
  /** プラン */
  plan: 'NONE' | 'TEAM' | 'ENTERPRISE';
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

// ============================================
// 組織詳細
// ============================================

/**
 * 組織メンバー情報
 */
export interface AdminOrganizationMember {
  /** メンバーシップID */
  id: string;
  /** ユーザーID */
  userId: string;
  /** 表示名 */
  name: string;
  /** メールアドレス */
  email: string;
  /** アバターURL */
  avatarUrl: string | null;
  /** 組織内役割 */
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  /** 参加日時 */
  joinedAt: string;
}

/**
 * 組織プロジェクト情報
 */
export interface AdminOrganizationProject {
  /** プロジェクトID */
  id: string;
  /** プロジェクト名 */
  name: string;
  /** 説明 */
  description: string | null;
  /** メンバー数 */
  memberCount: number;
  /** テストスイート数 */
  testSuiteCount: number;
  /** 作成日時 */
  createdAt: string;
}

/**
 * 組織サブスクリプション情報
 */
export interface AdminOrganizationSubscription {
  /** プラン */
  plan: 'FREE' | 'PRO' | 'NONE' | 'TEAM' | 'ENTERPRISE';
  /** ステータス */
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
  /** 請求サイクル */
  billingCycle: 'MONTHLY' | 'YEARLY';
  /** 現在の請求期間開始日 */
  currentPeriodStart: string;
  /** 現在の請求期間終了日 */
  currentPeriodEnd: string;
  /** 期間終了時にキャンセル予定か */
  cancelAtPeriodEnd: boolean;
}

/**
 * 組織監査ログエントリ
 */
export interface AdminOrganizationAuditLogEntry {
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
  /** 実行ユーザー情報 */
  user: { id: string; name: string; email: string } | null;
  /** IPアドレス */
  ipAddress: string | null;
  /** 作成日時 */
  createdAt: string;
}

/**
 * 組織詳細統計
 */
export interface AdminOrganizationDetailStats {
  /** メンバー数 */
  memberCount: number;
  /** プロジェクト数 */
  projectCount: number;
  /** テストスイート数 */
  testSuiteCount: number;
  /** テスト実行数 */
  executionCount: number;
}

/**
 * 組織詳細
 */
export interface AdminOrganizationDetail {
  /** 組織ID */
  id: string;
  /** 組織名 */
  name: string;
  /** 説明 */
  description: string | null;
  /** アバターURL */
  avatarUrl: string | null;
  /** プラン */
  plan: 'NONE' | 'TEAM' | 'ENTERPRISE';
  /** 請求先メールアドレス */
  billingEmail: string | null;
  /** 決済顧客ID */
  paymentCustomerId: string | null;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
  /** 削除日時 */
  deletedAt: string | null;
  /** 統計情報 */
  stats: AdminOrganizationDetailStats;
  /** メンバー一覧（最新20件） */
  members: AdminOrganizationMember[];
  /** プロジェクト一覧（最新10件） */
  projects: AdminOrganizationProject[];
  /** サブスクリプション情報 */
  subscription: AdminOrganizationSubscription | null;
  /** 監査ログ（最新10件） */
  recentAuditLogs: AdminOrganizationAuditLogEntry[];
}

/**
 * 組織詳細レスポンス
 */
export interface AdminOrganizationDetailResponse {
  /** 組織詳細 */
  organization: AdminOrganizationDetail;
}
