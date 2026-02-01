/**
 * 管理者メトリクス型定義（DAU/WAU/MAU）
 */

// ============================================
// メトリクス粒度
// ============================================

/**
 * メトリクス粒度（集計単位）
 */
export const MetricGranularity = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
} as const;
export type MetricGranularity = (typeof MetricGranularity)[keyof typeof MetricGranularity];

// ============================================
// アクティブユーザーメトリクス
// ============================================

/**
 * アクティブユーザーメトリクス データポイント
 */
export interface ActiveUserMetricDataPoint {
  /** 期間開始日（YYYY-MM-DD形式） */
  date: string;
  /** ユーザー数 */
  count: number;
}

/**
 * アクティブユーザーメトリクス サマリー
 */
export interface ActiveUserMetricSummary {
  /** 期間内平均 */
  average: number;
  /** 最大値 */
  max: number;
  /** 最小値 */
  min: number;
  /** 前期間比（%）- データ不足の場合はnull */
  changeRate: number | null;
}

/**
 * アクティブユーザーメトリクス APIレスポンス
 */
export interface ActiveUserMetricsResponse {
  /** 粒度 */
  granularity: MetricGranularity;
  /** 開始日（ISO 8601形式） */
  startDate: string;
  /** 終了日（ISO 8601形式） */
  endDate: string;
  /** タイムゾーン */
  timezone: string;
  /** データポイント配列 */
  data: ActiveUserMetricDataPoint[];
  /** サマリー */
  summary: ActiveUserMetricSummary;
  /** 取得日時（ISO 8601形式） */
  fetchedAt: string;
}

// ActiveUserMetricsQuery 型は validators/schemas.ts で定義
