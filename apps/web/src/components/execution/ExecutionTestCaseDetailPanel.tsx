import { useMemo } from 'react';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
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
const priorityColors: Record<string, string> = {
  CRITICAL: 'bg-danger text-white',
  HIGH: 'bg-warning text-white',
  MEDIUM: 'bg-accent text-white',
  LOW: 'bg-foreground-muted text-white',
};

/** 優先度のラベル */
const priorityLabels: Record<string, string> = {
  CRITICAL: '緊急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

interface ExecutionTestCaseDetailPanelProps {
  /** 実行時テストケース */
  testCase: ExecutionTestCaseSnapshot;
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
 * テストケース詳細パネル
 * 選択されたテストケースの詳細をフルパネルで表示
 */
export function ExecutionTestCaseDetailPanel({
  testCase,
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
  uploadingEvidenceResultId,
  deletingEvidenceId,
  downloadingEvidenceId,
  onEvidenceUpload,
  onEvidenceDelete,
  onEvidenceDownload,
}: ExecutionTestCaseDetailPanelProps) {
  // 進捗サマリーを計算（一度の走査でまとめて計算）
  const summary = useMemo(() => {
    return expectedResults.reduce(
      (acc, r) => {
        if (r.status === 'PASS') acc.pass++;
        else if (r.status === 'FAIL') acc.fail++;
        else acc.pending++;
        return acc;
      },
      { pass: 0, fail: 0, pending: 0, total: expectedResults.length }
    );
  }, [expectedResults]);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-foreground truncate">
                {testCase.title}
              </h2>
              <span
                className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded ${priorityColors[testCase.priority] || priorityColors.MEDIUM}`}
              >
                {priorityLabels[testCase.priority] || testCase.priority}
              </span>
            </div>
            {testCase.description && (
              <p className="text-sm text-foreground-muted">{testCase.description}</p>
            )}
          </div>

          {/* 進捗サマリー */}
          {summary.total > 0 && (
            <div className="flex items-center gap-3 flex-shrink-0">
              {summary.pass > 0 && (
                <div className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">{summary.pass}</span>
                </div>
              )}
              {summary.fail > 0 && (
                <div className="flex items-center gap-1 text-danger">
                  <XCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{summary.fail}</span>
                </div>
              )}
              {summary.pending > 0 && (
                <div className="flex items-center gap-1 text-foreground-muted">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">{summary.pending}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 前提条件 */}
      {testCase.preconditions.length > 0 && (
        <div className="card p-4">
          <ExecutionPreconditionList
            preconditions={testCase.preconditions}
            results={preconditionResults}
            isEditable={isEditable}
            updatingStatusId={updatingPreconditionStatusId}
            updatingNoteId={updatingPreconditionNoteId}
            onStatusChange={onPreconditionStatusChange}
            onNoteChange={onPreconditionNoteChange}
          />
        </div>
      )}

      {/* ステップ */}
      {testCase.steps.length > 0 && (
        <div className="card p-4">
          <ExecutionStepList
            steps={testCase.steps}
            results={stepResults}
            isEditable={isEditable}
            updatingStatusId={updatingStepStatusId}
            updatingNoteId={updatingStepNoteId}
            onStatusChange={onStepStatusChange}
            onNoteChange={onStepNoteChange}
          />
        </div>
      )}

      {/* 期待結果 */}
      {testCase.expectedResults.length > 0 && (
        <div className="card p-4">
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
