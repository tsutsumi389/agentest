import { useMemo } from 'react';
import { Link } from 'react-router';
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Square,
  Play,
  Ban,
  Loader2,
} from 'lucide-react';
import type {
  ExecutionWithDetails,
  ExecutionTestSuite,
  ExecutionPreconditionResult,
  PreconditionResultStatus,
} from '../../lib/api';
import { MarkdownPreview } from '../common/markdown';
import { ExecutionPreconditionList } from './ExecutionPreconditionList';

interface ExecutionOverviewPanelProps {
  /** 実行詳細 */
  execution: ExecutionWithDetails;
  /** 実行時テストスイート */
  executionTestSuite: ExecutionTestSuite | null;
  /** スイートレベル前提条件結果 */
  suitePreconditionResults: ExecutionPreconditionResult[];
  /** 編集可能か */
  isEditable: boolean;
  /** 中止ハンドラ */
  onAbort: () => void;
  /** 完了ハンドラ */
  onComplete: () => void;
  /** 中止処理中 */
  isAborting: boolean;
  /** 完了処理中 */
  isCompleting: boolean;
  /** 前提条件ステータス変更ハンドラ */
  onPreconditionStatusChange: (resultId: string, status: PreconditionResultStatus) => void;
  /** 前提条件ノート変更ハンドラ */
  onPreconditionNoteChange: (resultId: string, note: string | null) => void;
  /** 更新中の前提条件ID（ステータス） */
  updatingPreconditionStatusId: string | null;
  /** 更新中の前提条件ID（ノート） */
  updatingPreconditionNoteId: string | null;
}

/** ステータスアイコンマップ */
const statusIcon = {
  IN_PROGRESS: <Clock className="w-5 h-5 text-warning" />,
  COMPLETED: <CheckCircle2 className="w-5 h-5 text-success" />,
  ABORTED: <AlertCircle className="w-5 h-5 text-danger" />,
};

/** ステータスラベルマップ */
const statusLabel = {
  IN_PROGRESS: '実行中',
  COMPLETED: '完了',
  ABORTED: '中断',
};

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

/**
 * 実行概要パネル
 * テストケース未選択時に表示するサマリーパネル
 */
export function ExecutionOverviewPanel({
  execution,
  executionTestSuite,
  suitePreconditionResults,
  isEditable,
  onAbort,
  onComplete,
  isAborting,
  isCompleting,
  onPreconditionStatusChange,
  onPreconditionNoteChange,
  updatingPreconditionStatusId,
  updatingPreconditionNoteId,
}: ExecutionOverviewPanelProps) {
  // サマリー計算（期待結果から集計、一度の走査でまとめて計算）
  const summary = useMemo(() => {
    return execution.expectedResults.reduce(
      (acc, r) => {
        if (r.status === 'PASS') acc.pass++;
        else if (r.status === 'FAIL') acc.fail++;
        else if (r.status === 'SKIPPED' || r.status === 'NOT_EXECUTABLE') acc.skipped++;
        else if (r.status === 'PENDING') acc.pending++;
        return acc;
      },
      { pass: 0, fail: 0, skipped: 0, pending: 0 }
    );
  }, [execution.expectedResults]);

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
                <h1 className="text-2xl font-bold text-foreground">
                  {executionTestSuite?.name ?? 'テスト実行'}
                </h1>
                <span
                  className="flex items-center gap-1 badge"
                  aria-label={`ステータス: ${statusLabel[execution.status]}`}
                >
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
              {executionTestSuite?.description && (
                <MarkdownPreview content={executionTestSuite.description} className="text-foreground-muted text-sm mt-2" />
              )}
            </div>
          </div>

          {execution.status === 'IN_PROGRESS' && (
            <div className="flex items-center gap-2">
              <button
                onClick={onAbort}
                disabled={isAborting || isCompleting}
                className="btn btn-danger"
              >
                {isAborting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {isAborting ? '中止中...' : '中止'}
              </button>
              <button
                onClick={onComplete}
                disabled={isCompleting || isAborting}
                className="btn btn-primary"
              >
                {isCompleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {isCompleting ? '完了中...' : '完了'}
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
          value={summary.pass}
          color="success"
        />
        <SummaryCard
          icon={XCircle}
          label="失敗"
          value={summary.fail}
          color="danger"
        />
        <SummaryCard
          icon={Ban}
          label="スキップ"
          value={summary.skipped}
          color="warning"
        />
        <SummaryCard
          icon={Clock}
          label="未実行"
          value={summary.pending}
          color="muted"
        />
      </div>

      {/* スイートレベル前提条件 */}
      {executionTestSuite && executionTestSuite.preconditions.length > 0 && (
        <div className="card p-4">
          <ExecutionPreconditionList
            preconditions={executionTestSuite.preconditions}
            results={suitePreconditionResults}
            isEditable={isEditable}
            updatingStatusId={updatingPreconditionStatusId}
            updatingNoteId={updatingPreconditionNoteId}
            onStatusChange={onPreconditionStatusChange}
            onNoteChange={onPreconditionNoteChange}
            title="スイート前提条件"
          />
        </div>
      )}

      {/* テストケース一覧へのガイド */}
      <div className="card p-6 text-center">
        <p className="text-foreground-muted">
          サイドバーからテストケースを選択して詳細を表示
        </p>
      </div>
    </div>
  );
}
