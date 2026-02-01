/**
 * 管理者メトリクス型定義（DAU/WAU/MAU、プラン分布）
 */

// ============================================
// メトリクス粒度
// ============================================

/**
 * メトリクス粒度（集計単位）
 * @note Prisma enum (MetricGranularity) は大文字（DAY, WEEK, MONTH）。
 *       API入出力は小文字で行い、サービス層で変換する。
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

// ============================================
// プラン分布メトリクス
// ============================================

/**
 * プラン分布ビュー
 */
export const PlanDistributionView = {
  COMBINED: 'combined',
  USERS: 'users',
  ORGANIZATIONS: 'organizations',
} as const;
export type PlanDistributionView = (typeof PlanDistributionView)[keyof typeof PlanDistributionView];

/**
 * プランセグメント
 */
export interface PlanSegment {
  /** 件数 */
  count: number;
  /** 割合（%） */
  percentage: number;
  /** メンバー数（組織プランの場合のみ） */
  members?: number;
  /** アクティブ数（30日以内にアクティブなユーザー数） */
  activeCount?: number;
}

/**
 * プラン分布 時系列データポイント
 */
export interface PlanDistributionDataPoint {
  /** 日付（YYYY-MM-DD形式） */
  date: string;
  /** ユーザープラン分布（view=users or combined の場合） */
  users?: {
    free: number;
    pro: number;
  };
  /** 組織プラン分布（view=organizations or combined の場合） */
  organizations?: {
    team: number;
    enterprise: number;
    teamMembers: number;
    enterpriseMembers: number;
  };
}

/**
 * ユーザープラン分布サマリー
 */
export interface UserPlanDistributionSummary {
  /** 総ユーザー数 */
  total: number;
  /** プラン別詳細 */
  byPlan: {
    free: PlanSegment;
    pro: PlanSegment;
  };
}

/**
 * 組織プラン分布サマリー
 */
export interface OrganizationPlanDistributionSummary {
  /** 総組織数 */
  total: number;
  /** 総メンバー数 */
  totalMembers: number;
  /** プラン別詳細 */
  byPlan: {
    team: PlanSegment;
    enterprise: PlanSegment;
  };
}

/**
 * 統合プラン分布サマリー
 */
export interface CombinedPlanDistributionSummary {
  /** 総数（ユーザー + 組織メンバー） */
  total: number;
  /** プラン別詳細 */
  byPlan: {
    free: PlanSegment;
    pro: PlanSegment;
    team: PlanSegment;
    enterprise: PlanSegment;
  };
}

/**
 * 現在時点のプラン分布サマリー
 */
export interface PlanDistributionCurrent {
  /** ユーザープラン分布（view=users or combined の場合） */
  users?: UserPlanDistributionSummary;
  /** 組織プラン分布（view=organizations or combined の場合） */
  organizations?: OrganizationPlanDistributionSummary;
  /** 統合分布（view=combined の場合） */
  combined?: CombinedPlanDistributionSummary;
}

/**
 * プラン分布メトリクス APIレスポンス
 */
export interface PlanDistributionResponse {
  /** 粒度 */
  granularity: MetricGranularity;
  /** 開始日（ISO 8601形式） */
  startDate: string;
  /** 終了日（ISO 8601形式） */
  endDate: string;
  /** タイムゾーン */
  timezone: string;
  /** ビュー */
  view: PlanDistributionView;
  /** 時系列データポイント配列 */
  data: PlanDistributionDataPoint[];
  /** 最新時点のサマリー */
  current: PlanDistributionCurrent;
  /** 取得日時（ISO 8601形式） */
  fetchedAt: string;
}

// PlanDistributionQuery 型は validators/schemas.ts で定義
