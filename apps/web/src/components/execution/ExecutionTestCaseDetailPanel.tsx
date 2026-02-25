import { useMemo } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, XCircle, Clock, PictureInPicture2, ChevronLeft } from 'lucide-react';
import type {
  ExecutionTestCaseSnapshot,
  ExecutionPreconditionResult,
  ExecutionStepResult,
  ExecutionExpectedResult,
  PreconditionResultStatus,
  StepResultStatus,
  ExpectedResultStatus,
} from '../../lib/api';
import { MarkdownPreview } from '../common/markdown';
import { ExecutionPreconditionList } from './ExecutionPreconditionList';
import { ExecutionStepList } from './ExecutionStepList';
import { ExecutionExpectedResultList } from './ExecutionExpectedResultList';
import { priorityColors, priorityLabels } from './constants';

interface ExecutionTestCaseDetailPanelProps {
  /** テストスイートID（戻るリンク用） */
  testSuiteId: string;
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
  /** PiPがサポートされているか */
  isPipSupported?: boolean;
  /** PiPがアクティブか */
  isPipActive?: boolean;
  /** PiP開始ハンドラ */
  onOpenPip?: () => void;
}

/**
 * テストケース詳細パネル
 * 選択されたテストケースの詳細をフルパネルで表示
 */
export function ExecutionTestCaseDetailPanel({
  testSuiteId,
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
  isPipSupported = false,
  isPipActive = false,
  onOpenPip,
}: ExecutionTestCaseDetailPanelProps) {
  // 進捗サマリーを計算（一度の走査でまとめて計算）
  const summary = useMemo(() => {
    return expectedResults.reduce(
      (acc, r) => {
        if (r.status === 'PASS') acc.pass++;
        else if (r.status === 'FAIL') acc.fail++;
        // PENDING, SKIPPED を未完了としてカウント
        else if (r.status === 'PENDING' || r.status === 'SKIPPED') {
          acc.pending++;
        }
        return acc;
      },
      { pass: 0, fail: 0, pending: 0, total: expectedResults.length }
    );
  }, [expectedResults]);

  return (
    <div className="space-y-6">
      {/* テストスイートに戻るリンク */}
      <Link
        to={`/test-suites/${testSuiteId}?tab=executions`}
        className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4" />
        テストスイートに戻る
      </Link>

      {/* ヘッダー */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded ${priorityColors[testCase.priority] || priorityColors.MEDIUM}`}
              >
                {priorityLabels[testCase.priority] || testCase.priority}
              </span>
              <h2 className="text-xl font-bold text-foreground truncate" title={testCase.title}>
                {testCase.title}
              </h2>
            </div>
            {testCase.description && (
              <MarkdownPreview content={testCase.description} className="text-sm text-foreground-muted" />
            )}
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            {/* 進捗サマリー */}
            {summary.total > 0 && (
              <div className="flex items-center gap-3">
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

            {/* PiPボタン */}
            {isPipSupported && onOpenPip && (
              <button
                onClick={onOpenPip}
                disabled={isPipActive}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded border border-border hover:bg-background-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={isPipActive ? 'PiPウィンドウは既に開いています' : 'Picture-in-Pictureで開く'}
                aria-label={isPipActive ? 'PiPウィンドウは既に開いています' : 'Picture-in-Pictureで開く'}
              >
                <PictureInPicture2 className="w-4 h-4" />
                <span className="hidden sm:inline">PiP</span>
              </button>
            )}
          </div>
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
