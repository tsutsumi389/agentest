import { useState } from 'react';
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
  Ban,
} from 'lucide-react';
import {
  executionsApi,
  type ExecutionWithDetails,
  type PreconditionResultStatus,
  type StepResultStatus,
  type ExpectedResultStatus,
} from '../lib/api';
import { toast } from '../stores/toast';
import { ExecutionPreconditionList } from '../components/execution/ExecutionPreconditionList';
import { ExecutionTestCaseList } from '../components/execution/ExecutionTestCaseList';

/**
 * 実行ページ
 */
export function ExecutionPage() {
  const { executionId } = useParams<{ executionId: string }>();
  const queryClient = useQueryClient();

  // 更新中の結果IDを管理
  const [updatingPreconditionStatusId, setUpdatingPreconditionStatusId] = useState<string | null>(null);
  const [updatingPreconditionNoteId, setUpdatingPreconditionNoteId] = useState<string | null>(null);
  const [updatingStepStatusId, setUpdatingStepStatusId] = useState<string | null>(null);
  const [updatingStepNoteId, setUpdatingStepNoteId] = useState<string | null>(null);
  const [updatingExpectedStatusId, setUpdatingExpectedStatusId] = useState<string | null>(null);
  const [updatingExpectedNoteId, setUpdatingExpectedNoteId] = useState<string | null>(null);

  // 実行詳細を取得（スナップショット、全結果データ含む）
  const { data, isLoading } = useQuery({
    queryKey: ['execution', executionId, 'details'],
    queryFn: () => executionsApi.getByIdWithDetails(executionId!),
    enabled: !!executionId,
    refetchInterval: (query) => {
      // 実行中の場合は10秒ごとに更新
      const data = query.state.data;
      return data?.execution?.status === 'IN_PROGRESS' ? 10000 : false;
    },
  });

  // 実行中止
  const abortMutation = useMutation({
    mutationFn: () => executionsApi.abort(executionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
      toast.success('実行を中止しました');
    },
    onError: () => {
      toast.error('実行の中止に失敗しました');
    },
  });

  // 実行完了
  const completeMutation = useMutation({
    mutationFn: () => executionsApi.complete(executionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
      toast.success('実行を完了しました');
    },
    onError: () => {
      toast.error('実行の完了に失敗しました');
    },
  });

  // 前提条件結果更新（楽観的更新）
  const updatePreconditionMutation = useMutation({
    mutationFn: ({ resultId, status, note }: { resultId: string; status?: PreconditionResultStatus; note?: string | null }) =>
      executionsApi.updatePreconditionResult(executionId!, resultId, {
        status: status!,
        note: note ?? undefined,
      }),
    onMutate: async ({ resultId, status, note }) => {
      // 楽観的更新
      await queryClient.cancelQueries({ queryKey: ['execution', executionId, 'details'] });
      const previousData = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', executionId, 'details']);

      if (previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], {
          execution: {
            ...previousData.execution,
            preconditionResults: previousData.execution.preconditionResults.map((r) =>
              r.id === resultId
                ? { ...r, status: status ?? r.status, note: note !== undefined ? note : r.note }
                : r
            ),
          },
        });
      }

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      // ロールバック
      if (context?.previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], context.previousData);
      }
      toast.error('前提条件の更新に失敗しました');
    },
    onSettled: () => {
      setUpdatingPreconditionStatusId(null);
      setUpdatingPreconditionNoteId(null);
    },
  });

  // ステップ結果更新（楽観的更新）
  const updateStepMutation = useMutation({
    mutationFn: ({ resultId, status, note }: { resultId: string; status?: StepResultStatus; note?: string | null }) =>
      executionsApi.updateStepResult(executionId!, resultId, {
        status: status!,
        note: note ?? undefined,
      }),
    onMutate: async ({ resultId, status, note }) => {
      await queryClient.cancelQueries({ queryKey: ['execution', executionId, 'details'] });
      const previousData = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', executionId, 'details']);

      if (previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], {
          execution: {
            ...previousData.execution,
            stepResults: previousData.execution.stepResults.map((r) =>
              r.id === resultId
                ? { ...r, status: status ?? r.status, note: note !== undefined ? note : r.note }
                : r
            ),
          },
        });
      }

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], context.previousData);
      }
      toast.error('ステップの更新に失敗しました');
    },
    onSettled: () => {
      setUpdatingStepStatusId(null);
      setUpdatingStepNoteId(null);
    },
  });

  // 期待結果更新（楽観的更新）
  const updateExpectedMutation = useMutation({
    mutationFn: ({ resultId, status, note }: { resultId: string; status?: ExpectedResultStatus; note?: string | null }) =>
      executionsApi.updateExpectedResult(executionId!, resultId, {
        status: status!,
        note: note ?? undefined,
      }),
    onMutate: async ({ resultId, status, note }) => {
      await queryClient.cancelQueries({ queryKey: ['execution', executionId, 'details'] });
      const previousData = queryClient.getQueryData<{ execution: ExecutionWithDetails }>(['execution', executionId, 'details']);

      if (previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], {
          execution: {
            ...previousData.execution,
            expectedResults: previousData.execution.expectedResults.map((r) =>
              r.id === resultId
                ? { ...r, status: status ?? r.status, note: note !== undefined ? note : r.note }
                : r
            ),
          },
        });
      }

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['execution', executionId, 'details'], context.previousData);
      }
      toast.error('期待結果の更新に失敗しました');
    },
    onSettled: () => {
      setUpdatingExpectedStatusId(null);
      setUpdatingExpectedNoteId(null);
    },
  });

  // ハンドラー
  const handlePreconditionStatusChange = (resultId: string, status: PreconditionResultStatus) => {
    const current = execution?.preconditionResults.find((r) => r.id === resultId);
    if (!current) return;
    setUpdatingPreconditionStatusId(resultId);
    updatePreconditionMutation.mutate({ resultId, status, note: current.note });
  };

  const handlePreconditionNoteChange = (resultId: string, note: string | null) => {
    const current = execution?.preconditionResults.find((r) => r.id === resultId);
    if (!current) return;
    setUpdatingPreconditionNoteId(resultId);
    updatePreconditionMutation.mutate({ resultId, status: current.status, note });
  };

  const handleStepStatusChange = (resultId: string, status: StepResultStatus) => {
    const current = execution?.stepResults.find((r) => r.id === resultId);
    if (!current) return;
    setUpdatingStepStatusId(resultId);
    updateStepMutation.mutate({ resultId, status, note: current.note });
  };

  const handleStepNoteChange = (resultId: string, note: string | null) => {
    const current = execution?.stepResults.find((r) => r.id === resultId);
    if (!current) return;
    setUpdatingStepNoteId(resultId);
    updateStepMutation.mutate({ resultId, status: current.status, note });
  };

  const handleExpectedStatusChange = (resultId: string, status: ExpectedResultStatus) => {
    const current = execution?.expectedResults.find((r) => r.id === resultId);
    if (!current) return;
    setUpdatingExpectedStatusId(resultId);
    updateExpectedMutation.mutate({ resultId, status, note: current.note });
  };

  const handleExpectedNoteChange = (resultId: string, note: string | null) => {
    const current = execution?.expectedResults.find((r) => r.id === resultId);
    if (!current) return;
    setUpdatingExpectedNoteId(resultId);
    updateExpectedMutation.mutate({ resultId, status: current.status, note });
  };

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

  // 編集可否判定
  const isEditable = execution.status === 'IN_PROGRESS';

  // スナップショットデータ
  const snapshot = execution.snapshot.snapshotData;

  // スイートレベル前提条件（snapshotTestCaseId = null）
  const suitePreconditionResults = execution.preconditionResults.filter(
    (r) => r.snapshotTestCaseId === null
  );

  // サマリー計算（期待結果から集計）
  const passCount = execution.expectedResults.filter((r) => r.status === 'PASS').length;
  const failCount = execution.expectedResults.filter((r) => r.status === 'FAIL').length;
  const skippedCount = execution.expectedResults.filter(
    (r) => r.status === 'SKIPPED' || r.status === 'NOT_EXECUTABLE'
  ).length;
  const pendingCount = execution.expectedResults.filter((r) => r.status === 'PENDING').length;

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
                <h1 className="text-2xl font-bold text-foreground">{snapshot.testSuite.name}</h1>
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
                {execution.environment && (
                  <> / 環境: {execution.environment.name}</>
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
          value={passCount}
          color="success"
        />
        <SummaryCard
          icon={XCircle}
          label="失敗"
          value={failCount}
          color="danger"
        />
        <SummaryCard
          icon={Ban}
          label="スキップ"
          value={skippedCount}
          color="warning"
        />
        <SummaryCard
          icon={Clock}
          label="未実行"
          value={pendingCount}
          color="muted"
        />
      </div>

      {/* スイートレベル前提条件 */}
      {snapshot.preconditions.length > 0 && (
        <div className="card p-4">
          <ExecutionPreconditionList
            preconditions={snapshot.preconditions}
            results={suitePreconditionResults}
            isEditable={isEditable}
            updatingStatusId={updatingPreconditionStatusId}
            updatingNoteId={updatingPreconditionNoteId}
            onStatusChange={handlePreconditionStatusChange}
            onNoteChange={handlePreconditionNoteChange}
            title="スイート前提条件"
          />
        </div>
      )}

      {/* テストケース一覧 */}
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">テストケース</h2>
        </div>
        <div className="p-4">
          <ExecutionTestCaseList
            testCases={snapshot.testCases}
            allPreconditionResults={execution.preconditionResults}
            allStepResults={execution.stepResults}
            allExpectedResults={execution.expectedResults}
            isEditable={isEditable}
            updatingPreconditionStatusId={updatingPreconditionStatusId}
            updatingPreconditionNoteId={updatingPreconditionNoteId}
            updatingStepStatusId={updatingStepStatusId}
            updatingStepNoteId={updatingStepNoteId}
            updatingExpectedStatusId={updatingExpectedStatusId}
            updatingExpectedNoteId={updatingExpectedNoteId}
            onPreconditionStatusChange={handlePreconditionStatusChange}
            onPreconditionNoteChange={handlePreconditionNoteChange}
            onStepStatusChange={handleStepStatusChange}
            onStepNoteChange={handleStepNoteChange}
            onExpectedStatusChange={handleExpectedStatusChange}
            onExpectedNoteChange={handleExpectedNoteChange}
          />
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
  // ガイドライン準拠: subtle背景を使用
  const colorClasses = {
    success: 'bg-success-subtle text-success',
    danger: 'bg-danger-subtle text-danger',
    warning: 'bg-warning-subtle text-warning',
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
