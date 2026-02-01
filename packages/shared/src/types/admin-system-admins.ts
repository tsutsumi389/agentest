/**
 * 管理者向けシステム管理者一覧型定義
 */

// ============================================
// 共通型
// ============================================

/**
 * システム管理者ロール
 */
export type SystemAdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';

/**
 * システム管理者ステータスフィルタ
 */
export type SystemAdminStatus = 'active' | 'deleted' | 'locked' | 'all';

/**
 * ソート項目
 */
export type SystemAdminSortBy = 'createdAt' | 'name' | 'email' | 'role' | 'lastLoginAt';

// ============================================
// 検索パラメータ
// ============================================

/**
 * システム管理者検索パラメータ
 */
export interface SystemAdminSearchParams {
  /** 検索クエリ（メール・名前で部分一致、最大100文字） */
  q?: string;
  /** ロールフィルタ（カンマ区切り） */
  role?: SystemAdminRole[];
  /** ステータスフィルタ */
  status?: SystemAdminStatus;
  /** 2FA有効状態でフィルタ */
  totpEnabled?: boolean;
  /** 登録日From（ISO 8601形式） */
  createdFrom?: string;
  /** 登録日To（ISO 8601形式） */
  createdTo?: string;
  /** ページ番号（1始まり） */
  page?: number;
  /** 1ページあたり件数（max: 100） */
  limit?: number;
  /** ソート項目 */
  sortBy?: SystemAdminSortBy;
  /** ソート順 */
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// レスポンス
// ============================================

/**
 * システム管理者アクティビティ情報（一覧用）
 */
export interface SystemAdminListActivity {
  /** 最終ログイン日時 */
  lastLoginAt: string | null;
  /** アクティブセッション数 */
  activeSessionCount: number;
}

/**
 * システム管理者一覧項目
 */
export interface SystemAdminListItem {
  /** 管理者ID */
  id: string;
  /** メールアドレス */
  email: string;
  /** 表示名 */
  name: string;
  /** ロール */
  role: SystemAdminRole;
  /** 2FA有効状態 */
  totpEnabled: boolean;
  /** ログイン失敗回数 */
  failedAttempts: number;
  /** ロック解除日時 */
  lockedUntil: string | null;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
  /** 削除日時 */
  deletedAt: string | null;
  /** アクティビティ情報 */
  activity: SystemAdminListActivity;
}

/**
 * ページネーション情報
 */
export interface SystemAdminPagination {
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
 * システム管理者一覧レスポンス
 */
export interface SystemAdminListResponse {
  /** システム管理者一覧 */
  adminUsers: SystemAdminListItem[];
  /** ページネーション情報 */
  pagination: SystemAdminPagination;
}

// ============================================
// 詳細
// ============================================

/**
 * 現在のセッション情報
 */
export interface SystemAdminCurrentSession {
  /** セッションID */
  id: string;
  /** IPアドレス */
  ipAddress: string | null;
  /** ユーザーエージェント */
  userAgent: string | null;
  /** 最終活動日時 */
  lastActiveAt: string;
  /** 作成日時 */
  createdAt: string;
}

/**
 * システム管理者アクティビティ情報（詳細用）
 */
export interface SystemAdminDetailActivity {
  /** 最終ログイン日時 */
  lastLoginAt: string | null;
  /** アクティブセッション数 */
  activeSessionCount: number;
  /** 現在のセッション一覧 */
  currentSessions: SystemAdminCurrentSession[];
}

/**
 * システム管理者監査ログエントリ
 */
export interface SystemAdminAuditLogEntry {
  /** ログID */
  id: string;
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
 * システム管理者詳細情報
 */
export interface SystemAdminDetail {
  /** 管理者ID */
  id: string;
  /** メールアドレス */
  email: string;
  /** 表示名 */
  name: string;
  /** ロール */
  role: SystemAdminRole;
  /** 2FA有効状態 */
  totpEnabled: boolean;
  /** ログイン失敗回数 */
  failedAttempts: number;
  /** ロック解除日時 */
  lockedUntil: string | null;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
  /** 削除日時 */
  deletedAt: string | null;
  /** アクティビティ情報 */
  activity: SystemAdminDetailActivity;
  /** 最近の監査ログ */
  recentAuditLogs: SystemAdminAuditLogEntry[];
}

/**
 * システム管理者詳細レスポンス
 */
export interface SystemAdminDetailResponse {
  /** システム管理者詳細 */
  adminUser: SystemAdminDetail;
}

// ============================================
// 作成・更新
// ============================================

/**
 * システム管理者招待リクエスト
 */
export interface SystemAdminInviteRequest {
  /** メールアドレス（最大255文字） */
  email: string;
  /** 表示名（最大100文字） */
  name: string;
  /** ロール */
  role: SystemAdminRole;
}

/**
 * システム管理者招待レスポンス
 */
export interface SystemAdminInviteResponse {
  /** 作成されたシステム管理者 */
  adminUser: {
    id: string;
    email: string;
    name: string;
    role: SystemAdminRole;
    totpEnabled: boolean;
    createdAt: string;
  };
  /** 招待メール送信済み */
  invitationSent: boolean;
}

/**
 * システム管理者更新リクエスト
 */
export interface SystemAdminUpdateRequest {
  /** 表示名（最大100文字） */
  name?: string;
  /** ロール */
  role?: SystemAdminRole;
}

/**
 * システム管理者更新レスポンス
 */
export interface SystemAdminUpdateResponse {
  /** 更新されたシステム管理者 */
  adminUser: {
    id: string;
    email: string;
    name: string;
    role: SystemAdminRole;
    totpEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * システム管理者削除レスポンス
 */
export interface SystemAdminDeleteResponse {
  /** メッセージ */
  message: string;
  /** 削除日時 */
  deletedAt: string;
}

/**
 * アカウントロック解除レスポンス
 */
export interface SystemAdminUnlockResponse {
  /** メッセージ */
  message: string;
}

/**
 * 2FAリセットレスポンス
 */
export interface SystemAdminReset2FAResponse {
  /** メッセージ */
  message: string;
}
