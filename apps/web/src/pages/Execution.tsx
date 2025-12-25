import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Square,
  Play,
} from 'lucide-react';
import { executionsApi } from '../lib/api';

/**
 * 実行ページ
 */
export function ExecutionPage() {
  const { executionId } = useParams<{ executionId: string }>();
  const queryClient = useQueryClient();

  // 実行詳細を取得
  const { data, isLoading } = useQuery({
    queryKey: ['execution', executionId],
    queryFn: () => executionsApi.getById(executionId!),
    enabled: !!executionId,
    refetchInterval: (query) => {
      // 実行中の場合は5秒ごとに更新
      const data = query.state.data;
      return data?.execution?.status === 'IN_PROGRESS' ? 5000 : false;
    },
  });

  // 実行中止
  const abortMutation = useMutation({
    mutationFn: () => executionsApi.abort(executionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
    },
  });

  // 実行完了
  const completeMutation = useMutation({
    mutationFn: () => executionsApi.complete(executionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
    },
  });

  const execution = data?.execution;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">読み込み中...</div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">実行が見つかりません</div>
      </div>
    );
  }

  const statusIcon = {
    IN_PROGRESS: <Clock className="w-5 h-5 text-warning" />,
    COMPLETED: <CheckCircle2 className="w-5 h-5 text-success" />,
    ABORTED: <AlertCircle className="w-5 h-5 text-danger" />,
  };

  const statusLabel = {
    IN_PROGRESS: '実行中',
    COMPLETED: '完了',
    ABORTED: '中断',
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <Link
          to={`/test-suites/${execution.testSuiteId}`}
          className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          テストスイートに戻る
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-background-tertiary flex items-center justify-center">
              <Play className="w-6 h-6 text-foreground-muted" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">テスト実行</h1>
                <span className="flex items-center gap-1 badge">
                  {statusIcon[execution.status]}
                  {statusLabel[execution.status]}
                </span>
              </div>
              <p className="text-foreground-muted">
                開始: {new Date(execution.startedAt).toLocaleString('ja-JP')}
                {execution.completedAt && (
                  <> / 終了: {new Date(execution.completedAt).toLocaleString('ja-JP')}</>
                )}
              </p>
            </div>
          </div>

          {execution.status === 'IN_PROGRESS' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => abortMutation.mutate()}
                disabled={abortMutation.isPending}
                className="btn btn-danger"
              >
                <Square className="w-4 h-4" />
                中止
              </button>
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="btn btn-primary"
              >
                <CheckCircle2 className="w-4 h-4" />
                完了
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 実行サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={CheckCircle2}
          label="成功"
          value={0}
          color="success"
        />
        <SummaryCard
          icon={XCircle}
          label="失敗"
          value={0}
          color="danger"
        />
        <SummaryCard
          icon={AlertCircle}
          label="スキップ"
          value={0}
          color="warning"
        />
        <SummaryCard
          icon={Clock}
          label="未実行"
          value={0}
          color="muted"
        />
      </div>

      {/* テストケース実行状況 */}
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">テストケース</h2>
        </div>
        <div className="p-8 text-center text-foreground-muted">
          実行結果の詳細はWebSocket経由でリアルタイム更新されます
        </div>
      </div>
    </div>
  );
}

/**
 * サマリーカード
 */
function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: 'success' | 'danger' | 'warning' | 'muted';
}) {
  const colorClasses = {
    success: 'bg-success-muted text-success',
    danger: 'bg-danger-muted text-danger',
    warning: 'bg-warning-muted text-warning',
    muted: 'bg-background-tertiary text-foreground-muted',
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-foreground-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
