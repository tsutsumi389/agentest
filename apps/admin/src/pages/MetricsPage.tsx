import { useState, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Users, Calendar, Building2, PieChart } from 'lucide-react';
import type { MetricGranularity, PlanDistributionView } from '@agentest/shared/types';
import { useAdminMetrics } from '../hooks/useAdminMetrics';
import { useAdminPlanDistribution } from '../hooks/useAdminPlanDistribution';
import { LineChart, type LineChartDataPoint } from '../components/ui/LineChart';
import { DonutChart, type DonutSegment } from '../components/ui/DonutChart';

/** 粒度選択オプション */
const GRANULARITY_OPTIONS: { value: MetricGranularity; label: string }[] = [
  { value: 'day', label: '日次' },
  { value: 'week', label: '週次' },
  { value: 'month', label: '月次' },
];

/** 期間プリセット */
interface DatePreset {
  label: string;
  days?: number;
  type?: 'thisMonth' | 'lastMonth' | 'custom';
}

const DATE_PRESETS: DatePreset[] = [
  { label: '過去7日', days: 7 },
  { label: '過去30日', days: 30 },
  { label: '過去90日', days: 90 },
  { label: '今月', type: 'thisMonth' },
  { label: '先月', type: 'lastMonth' },
];

/** タブ種別 */
type MetricsTab = 'active-users' | 'plan-distribution';

/** プラン分布カラー */
const PLAN_COLORS = {
  free: '#6e7681',       // グレー
  pro: '#58a6ff',        // ブルー
  team: '#3fb950',       // グリーン
  enterprise: '#a371f7', // パープル
};

/** ビュー選択オプション */
const VIEW_OPTIONS: { value: PlanDistributionView; label: string }[] = [
  { value: 'combined', label: '統合' },
  { value: 'users', label: 'ユーザー' },
  { value: 'organizations', label: '組織' },
];

/**
 * プリセットから日付範囲を計算
 */
function calculateDateRange(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = new Date(now);
  let startDate: Date;

  if (preset.days) {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - preset.days + 1);
  } else if (preset.type === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (preset.type === 'lastMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate.setDate(0); // 先月末日
  } else {
    // デフォルト: 過去30日
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 29);
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

/**
 * メトリクスページ
 * DAU/WAU/MAUの時系列推移、プラン分布を表示
 */
export function MetricsPage() {
  // タブ状態
  const [activeTab, setActiveTab] = useState<MetricsTab>('active-users');

  // アクティブユーザー用の状態
  const [granularity, setGranularity] = useState<MetricGranularity>('day');
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>(DATE_PRESETS[1]); // 過去30日

  // プラン分布用の状態
  const [planGranularity, setPlanGranularity] = useState<MetricGranularity>('day');
  const [planPreset, setPlanPreset] = useState<DatePreset>(DATE_PRESETS[1]); // 過去30日
  const [planView, setPlanView] = useState<PlanDistributionView>('combined');

  // 日付範囲を計算
  const dateRange = useMemo(() => calculateDateRange(selectedPreset), [selectedPreset]);
  const planDateRange = useMemo(() => calculateDateRange(planPreset), [planPreset]);

  // APIフック（アクティブユーザー）
  const { data, isLoading, isError, refetch, isFetching } = useAdminMetrics({
    granularity,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    timezone: 'Asia/Tokyo',
  });

  // APIフック（プラン分布）
  const {
    data: planData,
    isLoading: planLoading,
    isError: planError,
    refetch: planRefetch,
    isFetching: planFetching,
  } = useAdminPlanDistribution({
    granularity: planGranularity,
    startDate: planDateRange.startDate,
    endDate: planDateRange.endDate,
    timezone: 'Asia/Tokyo',
    view: planView,
    includeMembers: true,
  });

  // グラフデータを変換
  const chartData: LineChartDataPoint[] = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map((d) => ({
      label: formatDateLabel(d.date, granularity),
      value: d.count,
    }));
  }, [data, granularity]);

  // 最終更新時刻をフォーマット
  const formatFetchedAt = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 変化率のアイコンと色を取得
  const getChangeRateDisplay = (rate: number | null) => {
    if (rate === null) return { icon: Minus, color: 'text-foreground-muted', text: '-' };
    if (rate > 0) return { icon: TrendingUp, color: 'text-success', text: `+${rate.toFixed(1)}%` };
    if (rate < 0) return { icon: TrendingDown, color: 'text-error', text: `${rate.toFixed(1)}%` };
    return { icon: Minus, color: 'text-foreground-muted', text: '0%' };
  };

  const changeRateDisplay = data?.summary ? getChangeRateDisplay(data.summary.changeRate) : null;

  // プラン分布のドーナツチャートデータを生成
  const userDonutSegments: DonutSegment[] = useMemo(() => {
    if (!planData?.current?.users) return [];
    const { byPlan } = planData.current.users;
    return [
      { id: 'free', label: 'FREE', value: byPlan.free.count, color: PLAN_COLORS.free },
      { id: 'pro', label: 'PRO', value: byPlan.pro.count, color: PLAN_COLORS.pro },
    ];
  }, [planData]);

  const orgDonutSegments: DonutSegment[] = useMemo(() => {
    if (!planData?.current?.organizations) return [];
    const { byPlan } = planData.current.organizations;
    return [
      { id: 'team', label: 'TEAM', value: byPlan.team.count, color: PLAN_COLORS.team },
      { id: 'enterprise', label: 'ENTERPRISE', value: byPlan.enterprise.count, color: PLAN_COLORS.enterprise },
    ];
  }, [planData]);

  // プラン分布の時系列チャートデータを生成
  const planTimeSeriesData = useMemo<{
    users: { free: LineChartDataPoint[]; pro: LineChartDataPoint[] };
    organizations: { team: LineChartDataPoint[]; enterprise: LineChartDataPoint[] };
  }>(() => {
    const users: { free: LineChartDataPoint[]; pro: LineChartDataPoint[] } = {
      free: [],
      pro: [],
    };
    const organizations: { team: LineChartDataPoint[]; enterprise: LineChartDataPoint[] } = {
      team: [],
      enterprise: [],
    };

    if (!planData?.data) return { users, organizations };

    planData.data.forEach((d) => {
      const label = formatDateLabel(d.date, planGranularity);
      if (d.users) {
        users.free.push({ label, value: d.users.free });
        users.pro.push({ label, value: d.users.pro });
      }
      if (d.organizations) {
        organizations.team.push({ label, value: d.organizations.team });
        organizations.enterprise.push({ label, value: d.organizations.enterprise });
      }
    });

    return { users, organizations };
  }, [planData, planGranularity]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* タブバー */}
        <div className="border-b border-border">
          <nav className="flex gap-4" aria-label="メトリクスタブ">
            <button
              onClick={() => setActiveTab('active-users')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'active-users'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              <Users className="w-4 h-4 inline-block mr-2" />
              アクティブユーザー
            </button>
            <button
              onClick={() => setActiveTab('plan-distribution')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'plan-distribution'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              <PieChart className="w-4 h-4 inline-block mr-2" />
              プラン分布
            </button>
          </nav>
        </div>

        {/* アクティブユーザータブ */}
        {activeTab === 'active-users' && (
          <>
        {/* タイトル */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">アクティブユーザー推移</h1>
            <p className="text-foreground-muted mt-1">
              DAU（日次）/ WAU（週次）/ MAU（月次）の推移
            </p>
          </div>
          <div className="flex items-center gap-4">
            {data?.fetchedAt && (
              <span className="text-sm text-foreground-muted">
                最終更新: {formatFetchedAt(data.fetchedAt)}
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn btn-secondary flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              更新
            </button>
          </div>
        </div>

        {/* コントロールパネル */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-background-secondary rounded-lg border border-border">
          {/* 粒度選択 */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-foreground-muted" />
            <span className="text-sm text-foreground-muted">粒度:</span>
            <div className="flex gap-1" role="group" aria-label="粒度選択">
              {GRANULARITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setGranularity(option.value)}
                  aria-pressed={granularity === option.value}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    granularity === option.value
                      ? 'bg-accent text-white'
                      : 'bg-background-tertiary text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 期間プリセット */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground-muted">期間:</span>
            <div className="flex gap-1" role="group" aria-label="期間選択">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setSelectedPreset(preset)}
                  aria-pressed={selectedPreset.label === preset.label}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    selectedPreset.label === preset.label
                      ? 'bg-accent text-white'
                      : 'bg-background-tertiary text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* サマリーカード */}
        {data?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 平均 */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-foreground-muted">平均</span>
                <Users className="w-4 h-4 text-accent" />
              </div>
              <div className="stat-value">{data.summary.average.toLocaleString()}</div>
            </div>

            {/* 最大 */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-foreground-muted">最大</span>
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
              <div className="stat-value">{data.summary.max.toLocaleString()}</div>
            </div>

            {/* 最小 */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-foreground-muted">最小</span>
                <TrendingDown className="w-4 h-4 text-error" />
              </div>
              <div className="stat-value">{data.summary.min.toLocaleString()}</div>
            </div>

            {/* 前期間比 */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-foreground-muted">前期間比</span>
                {changeRateDisplay && (
                  <changeRateDisplay.icon className={`w-4 h-4 ${changeRateDisplay.color}`} />
                )}
              </div>
              <div className={`stat-value ${changeRateDisplay?.color}`}>
                {changeRateDisplay?.text}
              </div>
            </div>
          </div>
        )}

        {/* グラフ */}
        <div className="bg-background-secondary rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {granularity === 'day' && 'DAU（日次アクティブユーザー）'}
            {granularity === 'week' && 'WAU（週次アクティブユーザー）'}
            {granularity === 'month' && 'MAU（月次アクティブユーザー）'}
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center h-[300px] text-foreground-muted">
              読み込み中...
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center h-[300px] text-error">
              データの取得に失敗しました
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-foreground-muted">
              データがありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <LineChart
                data={chartData}
                width={Math.max(600, chartData.length * 30)}
                height={300}
                strokeColor="#58a6ff"
                fillColor="rgba(88, 166, 255, 0.1)"
                xLabelInterval={calculateXLabelInterval(chartData.length)}
                yTickCount={5}
                showTooltip={true}
              />
            </div>
          )}
        </div>

        {/* データテーブル */}
        {data?.data && data.data.length > 0 && (
          <div className="bg-background-secondary rounded-lg border border-border">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">詳細データ</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground-muted">
                      日付
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-foreground-muted">
                      ユーザー数
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((d) => (
                    <tr
                      key={d.date}
                      className="border-b border-border last:border-b-0 hover:bg-background-tertiary transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-foreground">
                        {formatDateLabel(d.date, granularity)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground text-right font-mono">
                        {d.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </>
        )}

        {/* プラン分布タブ */}
        {activeTab === 'plan-distribution' && (
          <>
            {/* タイトル */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">プラン別ユーザー分布</h1>
                <p className="text-foreground-muted mt-1">
                  FREE / PRO / TEAM / ENTERPRISE のプラン分布
                </p>
              </div>
              <div className="flex items-center gap-4">
                {planData?.fetchedAt && (
                  <span className="text-sm text-foreground-muted">
                    最終更新: {formatFetchedAt(planData.fetchedAt)}
                  </span>
                )}
                <button
                  onClick={() => planRefetch()}
                  disabled={planFetching}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${planFetching ? 'animate-spin' : ''}`} />
                  更新
                </button>
              </div>
            </div>

            {/* コントロールパネル */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-background-secondary rounded-lg border border-border">
              {/* ビュー選択 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-muted">表示:</span>
                <div className="flex gap-1" role="group" aria-label="ビュー選択">
                  {VIEW_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPlanView(option.value)}
                      aria-pressed={planView === option.value}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        planView === option.value
                          ? 'bg-accent text-white'
                          : 'bg-background-tertiary text-foreground-muted hover:text-foreground'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 粒度選択 */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-foreground-muted" />
                <span className="text-sm text-foreground-muted">粒度:</span>
                <div className="flex gap-1" role="group" aria-label="粒度選択">
                  {GRANULARITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPlanGranularity(option.value)}
                      aria-pressed={planGranularity === option.value}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        planGranularity === option.value
                          ? 'bg-accent text-white'
                          : 'bg-background-tertiary text-foreground-muted hover:text-foreground'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 期間プリセット */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-muted">期間:</span>
                <div className="flex gap-1" role="group" aria-label="期間選択">
                  {DATE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setPlanPreset(preset)}
                      aria-pressed={planPreset.label === preset.label}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        planPreset.label === preset.label
                          ? 'bg-accent text-white'
                          : 'bg-background-tertiary text-foreground-muted hover:text-foreground'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 現在の分布（ドーナツチャート） */}
            {planLoading ? (
              <div className="flex items-center justify-center h-[200px] text-foreground-muted">
                読み込み中...
              </div>
            ) : planError ? (
              <div className="flex items-center justify-center h-[200px] text-error">
                データの取得に失敗しました
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ユーザープラン分布 */}
                  {(planView === 'users' || planView === 'combined') && planData?.current?.users && (
                    <div className="bg-background-secondary rounded-lg border border-border p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-accent" />
                        <h2 className="text-lg font-semibold text-foreground">ユーザープラン</h2>
                      </div>
                      <div className="flex items-center gap-8">
                        <DonutChart
                          segments={userDonutSegments}
                          size={140}
                          thickness={0.25}
                          centerContent={
                            <div className="text-center">
                              <div className="text-2xl font-bold text-foreground">
                                {planData.current.users.total.toLocaleString()}
                              </div>
                              <div className="text-xs text-foreground-muted">総ユーザー</div>
                            </div>
                          }
                        />
                        <div className="flex-1 space-y-3">
                          {/* FREE */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS.free }} />
                              <span className="text-sm text-foreground">FREE</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-mono text-foreground">
                                {planData.current.users.byPlan.free.count.toLocaleString()}
                              </span>
                              <span className="text-xs text-foreground-muted ml-2">
                                ({planData.current.users.byPlan.free.percentage}%)
                              </span>
                            </div>
                          </div>
                          {/* PRO */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS.pro }} />
                              <span className="text-sm text-foreground">PRO</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-mono text-foreground">
                                {planData.current.users.byPlan.pro.count.toLocaleString()}
                              </span>
                              <span className="text-xs text-foreground-muted ml-2">
                                ({planData.current.users.byPlan.pro.percentage}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* アクティブ数 */}
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="text-xs text-foreground-muted mb-2">30日以内アクティブ</div>
                        <div className="flex gap-4">
                          <div>
                            <span className="text-sm text-foreground">FREE: </span>
                            <span className="text-sm font-mono text-foreground">
                              {planData.current.users.byPlan.free.activeCount?.toLocaleString() ?? '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm text-foreground">PRO: </span>
                            <span className="text-sm font-mono text-foreground">
                              {planData.current.users.byPlan.pro.activeCount?.toLocaleString() ?? '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 組織プラン分布 */}
                  {(planView === 'organizations' || planView === 'combined') && planData?.current?.organizations && (
                    <div className="bg-background-secondary rounded-lg border border-border p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Building2 className="w-5 h-5 text-success" />
                        <h2 className="text-lg font-semibold text-foreground">組織プラン</h2>
                      </div>
                      <div className="flex items-center gap-8">
                        <DonutChart
                          segments={orgDonutSegments}
                          size={140}
                          thickness={0.25}
                          centerContent={
                            <div className="text-center">
                              <div className="text-2xl font-bold text-foreground">
                                {planData.current.organizations.total.toLocaleString()}
                              </div>
                              <div className="text-xs text-foreground-muted">総組織</div>
                            </div>
                          }
                        />
                        <div className="flex-1 space-y-3">
                          {/* TEAM */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS.team }} />
                              <span className="text-sm text-foreground">TEAM</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-mono text-foreground">
                                {planData.current.organizations.byPlan.team.count.toLocaleString()}
                              </span>
                              <span className="text-xs text-foreground-muted ml-2">
                                ({planData.current.organizations.byPlan.team.percentage}%)
                              </span>
                            </div>
                          </div>
                          {/* ENTERPRISE */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS.enterprise }} />
                              <span className="text-sm text-foreground">ENTERPRISE</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-mono text-foreground">
                                {planData.current.organizations.byPlan.enterprise.count.toLocaleString()}
                              </span>
                              <span className="text-xs text-foreground-muted ml-2">
                                ({planData.current.organizations.byPlan.enterprise.percentage}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* メンバー数・アクティブ数 */}
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-foreground-muted mb-1">総メンバー数</div>
                            <div className="text-lg font-mono text-foreground">
                              {planData.current.organizations.totalMembers.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-foreground-muted mb-1">30日以内アクティブ組織</div>
                            <div className="flex gap-2 text-sm">
                              <span>TEAM: {planData.current.organizations.byPlan.team.activeCount ?? '-'}</span>
                              <span>ENT: {planData.current.organizations.byPlan.enterprise.activeCount ?? '-'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 時系列推移グラフ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ユーザープラン時系列 */}
                  {(planView === 'users' || planView === 'combined') && planTimeSeriesData.users.free.length > 0 && (
                    <div className="bg-background-secondary rounded-lg border border-border p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-accent" />
                        <h2 className="text-lg font-semibold text-foreground">ユーザープラン推移</h2>
                      </div>
                      <div className="space-y-4">
                        {/* FREEプラン */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS.free }} />
                            <span className="text-sm text-foreground-muted">FREE</span>
                          </div>
                          <div className="overflow-x-auto">
                            <LineChart
                              data={planTimeSeriesData.users.free}
                              width={Math.max(400, planTimeSeriesData.users.free.length * 25)}
                              height={120}
                              strokeColor={PLAN_COLORS.free}
                              fillColor="rgba(110, 118, 129, 0.1)"
                              xLabelInterval={calculateXLabelInterval(planTimeSeriesData.users.free.length)}
                              yTickCount={3}
                              showTooltip={true}
                            />
                          </div>
                        </div>
                        {/* PROプラン */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS.pro }} />
                            <span className="text-sm text-foreground-muted">PRO</span>
                          </div>
                          <div className="overflow-x-auto">
                            <LineChart
                              data={planTimeSeriesData.users.pro}
                              width={Math.max(400, planTimeSeriesData.users.pro.length * 25)}
                              height={120}
                              strokeColor={PLAN_COLORS.pro}
                              fillColor="rgba(88, 166, 255, 0.1)"
                              xLabelInterval={calculateXLabelInterval(planTimeSeriesData.users.pro.length)}
                              yTickCount={3}
                              showTooltip={true}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 組織プラン時系列 */}
                  {(planView === 'organizations' || planView === 'combined') && planTimeSeriesData.organizations.team.length > 0 && (
                    <div className="bg-background-secondary rounded-lg border border-border p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Building2 className="w-5 h-5 text-success" />
                        <h2 className="text-lg font-semibold text-foreground">組織プラン推移</h2>
                      </div>
                      <div className="space-y-4">
                        {/* TEAMプラン */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS.team }} />
                            <span className="text-sm text-foreground-muted">TEAM</span>
                          </div>
                          <div className="overflow-x-auto">
                            <LineChart
                              data={planTimeSeriesData.organizations.team}
                              width={Math.max(400, planTimeSeriesData.organizations.team.length * 25)}
                              height={120}
                              strokeColor={PLAN_COLORS.team}
                              fillColor="rgba(63, 185, 80, 0.1)"
                              xLabelInterval={calculateXLabelInterval(planTimeSeriesData.organizations.team.length)}
                              yTickCount={3}
                              showTooltip={true}
                            />
                          </div>
                        </div>
                        {/* ENTERPRISEプラン */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS.enterprise }} />
                            <span className="text-sm text-foreground-muted">ENTERPRISE</span>
                          </div>
                          <div className="overflow-x-auto">
                            <LineChart
                              data={planTimeSeriesData.organizations.enterprise}
                              width={Math.max(400, planTimeSeriesData.organizations.enterprise.length * 25)}
                              height={120}
                              strokeColor={PLAN_COLORS.enterprise}
                              fillColor="rgba(163, 113, 247, 0.1)"
                              xLabelInterval={calculateXLabelInterval(planTimeSeriesData.organizations.enterprise.length)}
                              yTickCount={3}
                              showTooltip={true}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 統合サマリーカード（combined viewの場合） */}
                {planView === 'combined' && planData?.current?.combined && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="stat-card">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-foreground-muted">FREE</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS.free }} />
                      </div>
                      <div className="stat-value">{planData.current.combined.byPlan.free.count.toLocaleString()}</div>
                      <div className="text-xs text-foreground-muted">{planData.current.combined.byPlan.free.percentage}%</div>
                    </div>
                    <div className="stat-card">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-foreground-muted">PRO</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS.pro }} />
                      </div>
                      <div className="stat-value">{planData.current.combined.byPlan.pro.count.toLocaleString()}</div>
                      <div className="text-xs text-foreground-muted">{planData.current.combined.byPlan.pro.percentage}%</div>
                    </div>
                    <div className="stat-card">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-foreground-muted">TEAM</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS.team }} />
                      </div>
                      <div className="stat-value">{planData.current.combined.byPlan.team.count.toLocaleString()}</div>
                      <div className="text-xs text-foreground-muted">{planData.current.combined.byPlan.team.percentage}%</div>
                    </div>
                    <div className="stat-card">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-foreground-muted">ENTERPRISE</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS.enterprise }} />
                      </div>
                      <div className="stat-value">{planData.current.combined.byPlan.enterprise.count.toLocaleString()}</div>
                      <div className="text-xs text-foreground-muted">{planData.current.combined.byPlan.enterprise.percentage}%</div>
                    </div>
                  </div>
                )}

                {/* 時系列データテーブル */}
                {planData?.data && planData.data.length > 0 && (
                  <div className="bg-background-secondary rounded-lg border border-border">
                    <div className="p-4 border-b border-border">
                      <h2 className="text-lg font-semibold text-foreground">時系列データ</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left px-4 py-3 text-sm font-medium text-foreground-muted">日付</th>
                            {(planView === 'users' || planView === 'combined') && (
                              <>
                                <th className="text-right px-4 py-3 text-sm font-medium text-foreground-muted">FREE</th>
                                <th className="text-right px-4 py-3 text-sm font-medium text-foreground-muted">PRO</th>
                              </>
                            )}
                            {(planView === 'organizations' || planView === 'combined') && (
                              <>
                                <th className="text-right px-4 py-3 text-sm font-medium text-foreground-muted">TEAM</th>
                                <th className="text-right px-4 py-3 text-sm font-medium text-foreground-muted">ENTERPRISE</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {planData.data.map((d) => (
                            <tr
                              key={d.date}
                              className="border-b border-border last:border-b-0 hover:bg-background-tertiary transition-colors"
                            >
                              <td className="px-4 py-3 text-sm text-foreground">
                                {formatDateLabel(d.date, planGranularity)}
                              </td>
                              {(planView === 'users' || planView === 'combined') && d.users && (
                                <>
                                  <td className="px-4 py-3 text-sm text-foreground text-right font-mono">
                                    {d.users.free.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-foreground text-right font-mono">
                                    {d.users.pro.toLocaleString()}
                                  </td>
                                </>
                              )}
                              {(planView === 'organizations' || planView === 'combined') && d.organizations && (
                                <>
                                  <td className="px-4 py-3 text-sm text-foreground text-right font-mono">
                                    {d.organizations.team.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-foreground text-right font-mono">
                                    {d.organizations.enterprise.toLocaleString()}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 日付ラベルをフォーマット
 */
function formatDateLabel(dateString: string, granularity: MetricGranularity): string {
  const date = new Date(dateString);

  switch (granularity) {
    case 'day':
      return `${date.getMonth() + 1}/${date.getDate()}`;
    case 'week':
      return `${date.getMonth() + 1}/${date.getDate()}週`;
    case 'month':
      return `${date.getFullYear()}/${date.getMonth() + 1}`;
    default:
      return dateString;
  }
}

/**
 * X軸ラベルの表示間隔を計算
 */
function calculateXLabelInterval(dataLength: number): number {
  if (dataLength <= 10) return 1;
  if (dataLength <= 30) return 5;
  if (dataLength <= 90) return 10;
  return 15;
}
