/**
 * 管理者ダッシュボード型定義
 */

// ============================================
// システムヘルスステータス
// ============================================

/**
 * システムコンポーネントのヘルスステータス
 */
export interface SystemHealthStatus {
  /** ステータス */
  status: 'healthy' | 'unhealthy' | 'not_configured';
  /** レイテンシ（ミリ秒） */
  latency?: number;
  /** エラーメッセージ */
  error?: string;
}

/**
 * システムヘルス情報
 */
export interface AdminDashboardSystemHealth {
  /** API */
  api: SystemHealthStatus;
  /** データベース */
  database: SystemHealthStatus;
  /** Redis */
  redis: SystemHealthStatus;
  /** MinIO（オブジェクトストレージ） */
  minio: SystemHealthStatus;
}

// ============================================
// ユーザー統計
// ============================================

/**
 * ユーザー統計情報
 */
export interface AdminDashboardUserStats {
  /** 総ユーザー数 */
  total: number;
  /** プラン別ユーザー数 */
  byPlan: {
    free: number;
    pro: number;
  };
  /** 当月新規ユーザー数 */
  newThisMonth: number;
  /** アクティブユーザー数（30日以内にログイン） */
  activeUsers: number;
}

// ============================================
// 組織統計
// ============================================

/**
 * 組織統計情報
 */
export interface AdminDashboardOrgStats {
  /** 総組織数 */
  total: number;
  /** プラン別組織数 */
  byPlan: {
    team: number;
    enterprise: number;
  };
  /** 当月新規組織数 */
  newThisMonth: number;
  /** アクティブ組織数（30日以内にアクティビティあり） */
  activeOrgs: number;
}

// ============================================
// テスト実行統計
// ============================================

/**
 * テスト実行統計情報
 */
export interface AdminDashboardExecutionStats {
  /** 当月の総実行数 */
  totalThisMonth: number;
  /** 成功数 */
  passCount: number;
  /** 失敗数 */
  failCount: number;
  /** 成功率（%） */
  passRate: number;
}

// ============================================
// 収益統計
// ============================================

/**
 * 収益統計情報
 */
export interface AdminDashboardRevenueStats {
  /** 月間経常収益（円） */
  mrr: number;
  /** 請求書ステータス別件数 */
  invoices: {
    paid: number;
    pending: number;
    failed: number;
  };
}

// ============================================
// ダッシュボード統合レスポンス
// ============================================

/**
 * 管理者ダッシュボード統計情報
 */
export interface AdminDashboardStats {
  /** ユーザー統計 */
  users: AdminDashboardUserStats;
  /** 組織統計 */
  organizations: AdminDashboardOrgStats;
  /** テスト実行統計 */
  executions: AdminDashboardExecutionStats;
  /** 収益統計 */
  revenue: AdminDashboardRevenueStats;
  /** システムヘルス */
  systemHealth: AdminDashboardSystemHealth;
  /** 取得日時（ISO 8601形式） */
  fetchedAt: string;
}
