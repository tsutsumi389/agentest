import { useState, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Users, Calendar } from 'lucide-react';
import type { MetricGranularity } from '@agentest/shared/types';
import { useAdminMetrics } from '../hooks/useAdminMetrics';
import { LineChart, type LineChartDataPoint } from '../components/ui/LineChart';

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
 * DAU/WAU/MAUの時系列推移を表示
 */
export function MetricsPage() {
  // 状態
  const [granularity, setGranularity] = useState<MetricGranularity>('day');
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>(DATE_PRESETS[1]); // 過去30日

  // 日付範囲を計算
  const dateRange = useMemo(() => calculateDateRange(selectedPreset), [selectedPreset]);

  // APIフック
  const { data, isLoading, isError, refetch, isFetching } = useAdminMetrics({
    granularity,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    timezone: 'Asia/Tokyo',
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
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
