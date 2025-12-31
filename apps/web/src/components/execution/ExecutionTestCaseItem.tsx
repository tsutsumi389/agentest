import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type {
  ExecutionTestCaseSnapshot,
  ExecutionPreconditionResult,
  ExecutionStepResult,
  ExecutionExpectedResult,
  PreconditionResultStatus,
  StepResultStatus,
  ExpectedResultStatus,
} from '../../lib/api';
import { ExecutionPreconditionList } from './ExecutionPreconditionList';
import { ExecutionStepList } from './ExecutionStepList';
import { ExecutionExpectedResultList } from './ExecutionExpectedResultList';

/** 優先度バッジの色 */
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-danger text-white',
  HIGH: 'bg-warning text-white',
  MEDIUM: 'bg-accent text-white',
  LOW: 'bg-foreground-muted text-white',
};

/** 優先度のラベル */
const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: '緊急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

interface ExecutionTestCaseItemProps {
  /** 実行時テストケース */
  testCase: ExecutionTestCaseSnapshot;
  /** テストケースインデックス（表示用） */
  index: number;
  /** 前提条件結果一覧（このテストケースに紐づくもの） */
  preconditionResults: ExecutionPreconditionResult[];
  /** ステップ結果一覧（このテストケースに紐づくもの） */
  stepResults: ExecutionStepResult[];
  /** 期待結果一覧（このテストケースに紐づくもの） */
  expectedResults: ExecutionExpectedResult[];
  /** 編集可能か */
  isEditable: boolean;
  /** 更新中の前提条件結果ID（ステータス） */
  updatingPreconditionStatusId: string | null;
  /** 更新中の前提条件結果ID（ノート） */
  updatingPreconditionNoteId: string | null;
  /** 更新中のステップ結果ID（ステータス） */
  updatingStepStatusId: string | null;
  /** 更新中のステップ結果ID（ノート） */
  updatingStepNoteId: string | null;
  /** 更新中の期待結果ID（ステータス） */
  updatingExpectedStatusId: string | null;
  /** 更新中の期待結果ID（ノート） */
  updatingExpectedNoteId: string | null;
  /** 前提条件ステータス変更ハンドラ */
  onPreconditionStatusChange: (resultId: string, status: PreconditionResultStatus) => void;
  /** 前提条件ノート変更ハンドラ */
  onPreconditionNoteChange: (resultId: string, note: string | null) => void;
  /** ステップステータス変更ハンドラ */
  onStepStatusChange: (resultId: string, status: StepResultStatus) => void;
  /** ステップノート変更ハンドラ */
  onStepNoteChange: (resultId: string, note: string | null) => void;
  /** 期待結果ステータス変更ハンドラ */
  onExpectedStatusChange: (resultId: string, status: ExpectedResultStatus) => void;
  /** 期待結果ノート変更ハンドラ */
  onExpectedNoteChange: (resultId: string, note: string | null) => void;
  /** デフォルトで展開するか */
  defaultExpanded?: boolean;
  /** アップロード中の期待結果ID */
  uploadingEvidenceResultId: string | null;
  /** 削除中のエビデンスID */
  deletingEvidenceId: string | null;
  /** ダウンロード中のエビデンスID */
  downloadingEvidenceId: string | null;
  /** エビデンスアップロードハンドラ */
  onEvidenceUpload: (expectedResultId: string, file: File, description?: string) => void;
  /** エビデンス削除ハンドラ */
  onEvidenceDelete: (evidenceId: string) => void;
  /** エビデンスダウンロードハンドラ */
  onEvidenceDownload: (evidenceId: string) => void;
}

/**
 * 実行テストケースアイテム（アコーディオン）
 */
export function ExecutionTestCaseItem({
  testCase,
  index,
  preconditionResults,
  stepResults,
  expectedResults,
  isEditable,
  updatingPreconditionStatusId,
  updatingPreconditionNoteId,
  updatingStepStatusId,
  updatingStepNoteId,
  updatingExpectedStatusId,
  updatingExpectedNoteId,
  onPreconditionStatusChange,
  onPreconditionNoteChange,
  onStepStatusChange,
  onStepNoteChange,
  onExpectedStatusChange,
  onExpectedNoteChange,
  defaultExpanded = false,
  uploadingEvidenceResultId,
  deletingEvidenceId,
  downloadingEvidenceId,
  onEvidenceUpload,
  onEvidenceDelete,
  onEvidenceDownload,
}: ExecutionTestCaseItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 進捗サマリーを計算
  const passCount = expectedResults.filter((r) => r.status === 'PASS').length;
  const failCount = expectedResults.filter((r) => r.status === 'FAIL').length;
  const pendingCount = expectedResults.filter(
    (r) => r.status === 'PENDING' || r.status === 'SKIPPED' || r.status === 'NOT_EXECUTABLE'
  ).length;
  const totalCount = expectedResults.length;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* ヘッダー */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-background-secondary hover:bg-background-tertiary transition-colors text-left"
        aria-expanded={isExpanded}
      >
        {/* インデックス */}
        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded bg-background-tertiary text-foreground-muted text-xs font-medium">
          {index}
        </span>

        {/* タイトル */}
        <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
          {testCase.title}
        </span>

        {/* 優先度バッジ */}
        <span
          className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[testCase.priority] || PRIORITY_COLORS.MEDIUM}`}
        >
          {PRIORITY_LABELS[testCase.priority] || testCase.priority}
        </span>

        {/* 進捗サマリー */}
        {totalCount > 0 && (
          <div className="flex-shrink-0 flex items-center gap-2 text-xs">
            {passCount > 0 && (
              <span className="text-success">{passCount} PASS</span>
            )}
            {failCount > 0 && (
              <span className="text-danger">{failCount} FAIL</span>
            )}
            {pendingCount > 0 && (
              <span className="text-foreground-muted">{pendingCount} 未</span>
            )}
          </div>
        )}

        {/* 展開/折りたたみアイコン */}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-foreground-muted flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-foreground-muted flex-shrink-0" />
        )}
      </button>

      {/* コンテンツ */}
      {isExpanded && (
        <div className="px-4 py-4 space-y-6 bg-background">
          {/* 説明 */}
          {testCase.description && (
            <p className="text-sm text-foreground-muted">{testCase.description}</p>
          )}

          {/* 前提条件 */}
          <ExecutionPreconditionList
            preconditions={testCase.preconditions}
            results={preconditionResults}
            isEditable={isEditable}
            updatingStatusId={updatingPreconditionStatusId}
            updatingNoteId={updatingPreconditionNoteId}
            onStatusChange={onPreconditionStatusChange}
            onNoteChange={onPreconditionNoteChange}
          />

          {/* ステップ */}
          <ExecutionStepList
            steps={testCase.steps}
            results={stepResults}
            isEditable={isEditable}
            updatingStatusId={updatingStepStatusId}
            updatingNoteId={updatingStepNoteId}
            onStatusChange={onStepStatusChange}
            onNoteChange={onStepNoteChange}
          />

          {/* 期待結果 */}
          <ExecutionExpectedResultList
            expectedResults={testCase.expectedResults}
            results={expectedResults}
            isEditable={isEditable}
            updatingStatusId={updatingExpectedStatusId}
            updatingNoteId={updatingExpectedNoteId}
            onStatusChange={onExpectedStatusChange}
            onNoteChange={onExpectedNoteChange}
            uploadingEvidenceResultId={uploadingEvidenceResultId}
            deletingEvidenceId={deletingEvidenceId}
            downloadingEvidenceId={downloadingEvidenceId}
            onEvidenceUpload={onEvidenceUpload}
            onEvidenceDelete={onEvidenceDelete}
            onEvidenceDownload={onEvidenceDownload}
          />
        </div>
      )}
    </div>
  );
}
