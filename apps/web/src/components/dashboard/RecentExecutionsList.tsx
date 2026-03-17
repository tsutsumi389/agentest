import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Play, ArrowRight, Server, Loader2 } from 'lucide-react';
import { usersApi, type RecentExecutionItem } from '../../lib/api';
import { formatRelativeTime, formatDateTime } from '../../lib/date';
import { ProgressBar } from '../ui/ProgressBar';

interface RecentExecutionsListProps {
  /** ユーザーID */
  userId: string;
}

/**
 * 最近のテスト実行結果一覧コンポーネント
 */
export function RecentExecutionsList({ userId }: RecentExecutionsListProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['user-recent-executions', userId],
    queryFn: () => usersApi.getRecentExecutions(userId, { limit: 10 }),
    enabled: !!userId,
  });

  const executions = data?.executions || [];

  // カード本体のコンテンツを状態に応じて決定
  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-foreground-muted mx-auto" />
      </div>
    );
  } else if (isError) {
    content = (
      <div className="p-4">
        <p className="text-sm text-danger">テスト実行結果の取得に失敗しました</p>
      </div>
    );
  } else if (executions.length === 0) {
    content = (
      <div className="p-8 text-center">
        <Play className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
        <p className="text-foreground-muted">まだテスト実行結果がありません</p>
      </div>
    );
  } else {
    content = (
      <div className="divide-y divide-border">
        {executions.map((execution) => (
          <ExecutionItem key={execution.executionId} execution={execution} />
        ))}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">最近のテスト実行</h2>
      </div>
      {content}
    </div>
  );
}

/**
 * 実行アイテム
 */
function ExecutionItem({ execution }: { execution: RecentExecutionItem }) {
  const { judgmentCounts } = execution;
  const total =
    judgmentCounts.PASS + judgmentCounts.FAIL + judgmentCounts.PENDING + judgmentCounts.SKIPPED;

  // 成功率を計算（未判定を除いた完了分に対する割合）
  const completedTotal = judgmentCounts.PASS + judgmentCounts.FAIL + judgmentCounts.SKIPPED;
  const passRate =
    completedTotal > 0 ? Math.round((judgmentCounts.PASS / completedTotal) * 100) : 0;

  return (
    <Link
      to={`/executions/${execution.executionId}`}
      className="block p-4 hover:bg-background-tertiary transition-colors"
    >
      {/* プロジェクト名 / テストスイート名 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-foreground font-medium">{execution.projectName}</span>
        <span className="text-foreground-muted">/</span>
        <span className="text-foreground-muted">{execution.testSuiteName}</span>
        <ArrowRight className="w-4 h-4 text-foreground-subtle ml-auto" />
      </div>

      {/* 環境と時間 */}
      <div className="flex items-center gap-3 text-sm text-foreground-muted mb-3">
        {execution.environment && (
          <span className="flex items-center gap-1">
            <Server className="w-3.5 h-3.5" />
            {execution.environment.name}
          </span>
        )}
        <span title={formatDateTime(execution.createdAt)}>
          {formatRelativeTime(execution.createdAt)}
        </span>
      </div>

      {/* プログレスバー */}
      {total > 0 && (
        <div className="mb-2">
          <ProgressBar
            passed={judgmentCounts.PASS}
            failed={judgmentCounts.FAIL}
            skipped={judgmentCounts.SKIPPED}
            total={total}
            size="sm"
          />
        </div>
      )}

      {/* 結果サマリー */}
      <div className="flex items-center gap-4 text-xs text-foreground-muted">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-success" />
          成功 {judgmentCounts.PASS}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-danger" />
          失敗 {judgmentCounts.FAIL}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-warning" />
          スキップ {judgmentCounts.SKIPPED}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-foreground-subtle" />
          未判定 {judgmentCounts.PENDING}
        </span>
        {completedTotal > 0 && (
          <span className="ml-auto font-medium text-foreground">{passRate}%</span>
        )}
      </div>
    </Link>
  );
}
