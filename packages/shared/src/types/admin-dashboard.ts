/**
 * 管理者ダッシュボード型定義
 */

// ============================================
// ユーザー統計
// ============================================

/**
 * ユーザー統計情報
 */
export interface AdminDashboardUserStats {
  /** 総ユーザー数 */
  total: number;
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
  /** 取得日時（ISO 8601形式） */
  fetchedAt: string;
}
