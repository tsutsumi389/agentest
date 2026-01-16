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
  Calendar,
  Timer,
  Server,
  Circle,
  MinusCircle,
  ListChecks,
  ClipboardCheck,
  Slash,
  Target,
} from 'lucide-react';
import type {
  ExecutionWithDetails,
  ExecutionTestSuite,
  ExecutionPreconditionResult,
  PreconditionResultStatus,
} from '../../lib/api';
import { MarkdownPreview } from '../common/markdown';
import { ExecutionPreconditionList } from './ExecutionPreconditionList';
import { ProgressBar } from '../ui/ProgressBar';
import { formatDateTime, formatDuration } from '../../lib/date';

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
  color: 'success' | 'danger' | 'warning' | 'muted' | 'accent';
}) {
  const colorClasses = {
    success: 'bg-success-subtle text-success',
    danger: 'bg-danger-subtle text-danger',
    warning: 'bg-warning-subtle text-warning',
    muted: 'bg-background-tertiary text-foreground-muted',
    accent: 'bg-accent-subtle text-accent',
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
 * メタデータカード
 * 開始日時、終了日時/経過時間、環境を表示
 */
function MetadataCard({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-foreground-muted" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-foreground-muted mb-1">{label}</p>
          <p className="text-sm font-medium text-foreground truncate">{value}</p>
          {subValue && (
            <p className="text-xs text-foreground-muted mt-0.5">{subValue}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 期待結果の強調表示サマリーコンポーネント
 * 成功/失敗を視覚的に強調し、プログレスバーと成功率を表示
 */
function ExpectedResultsHighlightSummary({
  pass,
  fail,
  skipped,
  notExecutable,
  pending,
}: {
  pass: number;
  fail: number;
  skipped: number;
  notExecutable: number;
  pending: number;
}) {
  const total = pass + fail + skipped + notExecutable + pending;
  const executed = pass + fail;
  // 成功率は実行済み（成功+失敗）に対する成功の割合。未実行時はnull
  const passRate = executed > 0 ? Math.round((pass / executed) * 100) : null;

  return (
    <div className="card p-4 space-y-4">
      {/* ヘッダー: ラベル + 成功率 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-foreground-muted" />
          <span className="text-sm font-medium text-foreground-muted">期待結果</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-lg font-bold ${
              passRate === null
                ? 'text-foreground-muted'
                : passRate >= 80
                  ? 'text-success'
                  : passRate >= 50
                    ? 'text-warning'
                    : 'text-danger'
            }`}
          >
            {passRate !== null ? `${passRate}%` : '-'}
          </span>
          <span className="text-xs text-foreground-muted">成功率</span>
        </div>
      </div>

      {/* プログレスバー */}
      <div className="space-y-1">
        <ProgressBar
          passed={pass}
          failed={fail}
          skipped={skipped}
          notExecutable={notExecutable}
          total={total}
          size="lg"
        />
        <div className="text-xs text-foreground-muted text-right">
          {executed} / {total} 実行済み
        </div>
      </div>

      {/* ステータスカードグリッド: 成功/失敗を強調 */}
      <div className="space-y-3">
        {/* 成功/失敗 - 強調表示（2列） */}
        <div className="grid grid-cols-2 gap-3">
          {/* 成功 */}
          <div className="card p-3 bg-success-subtle border border-success/30">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <div>
                <p className="text-xl font-bold text-success">{pass}</p>
                <p className="text-xs text-success/80">成功</p>
              </div>
            </div>
          </div>

          {/* 失敗 */}
          <div className="card p-3 bg-danger-subtle border border-danger/30">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-danger" />
              <div>
                <p className="text-xl font-bold text-danger">{fail}</p>
                <p className="text-xs text-danger/80">失敗</p>
              </div>
            </div>
          </div>
        </div>

        {/* その他のステータス（3列） */}
        <div className="grid grid-cols-3 gap-3">
          {/* スキップ */}
          <div className="card p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-warning-subtle flex items-center justify-center">
                <Ban className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{skipped}</p>
                <p className="text-xs text-foreground-muted">スキップ</p>
              </div>
            </div>
          </div>

          {/* 実行不可 */}
          <div className="card p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent-subtle flex items-center justify-center">
                <Slash className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{notExecutable}</p>
                <p className="text-xs text-foreground-muted">実行不可</p>
              </div>
            </div>
          </div>

          {/* 未実行 */}
          <div className="card p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-background-tertiary flex items-center justify-center">
                <Clock className="w-4 h-4 text-foreground-muted" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{pending}</p>
                <p className="text-xs text-foreground-muted">未実行</p>
              </div>
            </div>
          </div>
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
  // サマリー計算（前提条件・手順・期待結果を一度の走査でまとめて計算）
  const { preconditionSummary, stepSummary, expectedSummary } = useMemo(() => {
    // 前提条件サマリー
    const preconditionSummary = execution.preconditionResults.reduce(
      (acc, r) => {
        if (r.status === 'MET') acc.met++;
        else if (r.status === 'NOT_MET') acc.notMet++;
        else if (r.status === 'UNCHECKED') acc.unchecked++;
        return acc;
      },
      { met: 0, notMet: 0, unchecked: 0 }
    );

    // 手順サマリー
    const stepSummary = execution.stepResults.reduce(
      (acc, r) => {
        if (r.status === 'DONE') acc.done++;
        else if (r.status === 'SKIPPED') acc.skipped++;
        else if (r.status === 'PENDING') acc.pending++;
        return acc;
      },
      { done: 0, skipped: 0, pending: 0 }
    );

    // 期待結果サマリー（SKIPPEDとNOT_EXECUTABLEを分離）
    const expectedSummary = execution.expectedResults.reduce(
      (acc, r) => {
        if (r.status === 'PASS') acc.pass++;
        else if (r.status === 'FAIL') acc.fail++;
        else if (r.status === 'SKIPPED') acc.skipped++;
        else if (r.status === 'NOT_EXECUTABLE') acc.notExecutable++;
        else if (r.status === 'PENDING') acc.pending++;
        return acc;
      },
      { pass: 0, fail: 0, skipped: 0, notExecutable: 0, pending: 0 }
    );

    return { preconditionSummary, stepSummary, expectedSummary };
  }, [execution.preconditionResults, execution.stepResults, execution.expectedResults]);

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

      {/* メタデータカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetadataCard
          icon={Calendar}
          label="開始日時"
          value={formatDateTime(execution.startedAt)}
        />
        <MetadataCard
          icon={Timer}
          label={execution.completedAt ? '終了日時' : '経過時間'}
          value={
            execution.completedAt
              ? formatDateTime(execution.completedAt)
              : '実行中...'
          }
          subValue={
            execution.completedAt
              ? formatDuration(execution.startedAt, execution.completedAt)
              : undefined
          }
        />
        <MetadataCard
          icon={Server}
          label="実行環境"
          value={execution.environment?.name ?? '未設定'}
        />
      </div>

      {/* 期待結果サマリー（強調表示） */}
      <ExpectedResultsHighlightSummary
        pass={expectedSummary.pass}
        fail={expectedSummary.fail}
        skipped={expectedSummary.skipped}
        notExecutable={expectedSummary.notExecutable}
        pending={expectedSummary.pending}
      />

      {/* 前提条件サマリー */}
      {execution.preconditionResults.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground-muted mb-3">
            <ClipboardCheck className="w-4 h-4" />
            前提条件
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard
              icon={CheckCircle2}
              label="満たす"
              value={preconditionSummary.met}
              color="success"
            />
            <SummaryCard
              icon={XCircle}
              label="満たさない"
              value={preconditionSummary.notMet}
              color="danger"
            />
            <SummaryCard
              icon={Circle}
              label="未確認"
              value={preconditionSummary.unchecked}
              color="muted"
            />
          </div>
        </div>
      )}

      {/* 手順サマリー */}
      {execution.stepResults.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground-muted mb-3">
            <ListChecks className="w-4 h-4" />
            手順
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard
              icon={CheckCircle2}
              label="完了"
              value={stepSummary.done}
              color="success"
            />
            <SummaryCard
              icon={MinusCircle}
              label="スキップ"
              value={stepSummary.skipped}
              color="warning"
            />
            <SummaryCard
              icon={Circle}
              label="未実行"
              value={stepSummary.pending}
              color="muted"
            />
          </div>
        </div>
      )}

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
    </div>
  );
}
