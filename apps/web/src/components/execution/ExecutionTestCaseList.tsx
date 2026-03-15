import { FileText } from 'lucide-react';
import type {
  ExecutionTestCaseSnapshot,
  ExecutionPreconditionResult,
  ExecutionStepResult,
  ExecutionExpectedResult,
  PreconditionResultStatus,
  StepResultStatus,
  ExpectedResultStatus,
} from '../../lib/api';
import { ExecutionTestCaseItem } from './ExecutionTestCaseItem';

interface ExecutionTestCaseListProps {
  /** 実行時テストケース一覧 */
  testCases: ExecutionTestCaseSnapshot[];
  /** 全前提条件結果一覧 */
  allPreconditionResults: ExecutionPreconditionResult[];
  /** 全ステップ結果一覧 */
  allStepResults: ExecutionStepResult[];
  /** 全期待結果一覧 */
  allExpectedResults: ExecutionExpectedResult[];
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
 * 実行テストケースリスト
 * テストケース一覧を表示し、各テストケースに紐づく結果データをフィルタリングして渡す
 */
export function ExecutionTestCaseList({
  testCases,
  allPreconditionResults,
  allStepResults,
  allExpectedResults,
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
}: ExecutionTestCaseListProps) {
  // テストケースがない場合
  if (testCases.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
        <p className="text-sm text-foreground-muted">テストケースがありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {testCases.map((testCase, index) => {
        // このテストケースに紐づく結果をフィルタリング
        const preconditionResults = allPreconditionResults.filter(
          (r) => r.executionTestCaseId === testCase.id
        );
        const stepResults = allStepResults.filter((r) => r.executionTestCaseId === testCase.id);
        const expectedResults = allExpectedResults.filter(
          (r) => r.executionTestCaseId === testCase.id
        );

        return (
          <ExecutionTestCaseItem
            key={testCase.id}
            testCase={testCase}
            index={index + 1}
            preconditionResults={preconditionResults}
            stepResults={stepResults}
            expectedResults={expectedResults}
            isEditable={isEditable}
            updatingPreconditionStatusId={updatingPreconditionStatusId}
            updatingPreconditionNoteId={updatingPreconditionNoteId}
            updatingStepStatusId={updatingStepStatusId}
            updatingStepNoteId={updatingStepNoteId}
            updatingExpectedStatusId={updatingExpectedStatusId}
            updatingExpectedNoteId={updatingExpectedNoteId}
            onPreconditionStatusChange={onPreconditionStatusChange}
            onPreconditionNoteChange={onPreconditionNoteChange}
            onStepStatusChange={onStepStatusChange}
            onStepNoteChange={onStepNoteChange}
            onExpectedStatusChange={onExpectedStatusChange}
            onExpectedNoteChange={onExpectedNoteChange}
            uploadingEvidenceResultId={uploadingEvidenceResultId}
            deletingEvidenceId={deletingEvidenceId}
            downloadingEvidenceId={downloadingEvidenceId}
            onEvidenceUpload={onEvidenceUpload}
            onEvidenceDelete={onEvidenceDelete}
            onEvidenceDownload={onEvidenceDownload}
          />
        );
      })}
    </div>
  );
}
