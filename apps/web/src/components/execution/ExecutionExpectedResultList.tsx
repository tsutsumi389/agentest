import { Target } from 'lucide-react';
import type {
  ExecutionExpectedResult,
  ExpectedResultStatus,
  TestCaseExpectedResult,
} from '../../lib/api';
import {
  expectedResultStatusOptions,
  getExpectedStatusConfig,
} from '../../lib/execution-status';
import { ExecutionResultItem } from './ExecutionResultItem';
import { ExecutionEvidenceList } from './ExecutionEvidenceList';
import { ExecutionEvidenceUpload } from './ExecutionEvidenceUpload';

interface ExecutionExpectedResultListProps {
  /** スナップショットの期待結果一覧 */
  expectedResults: TestCaseExpectedResult[];
  /** 期待結果一覧 */
  results: ExecutionExpectedResult[];
  /** 編集可能か */
  isEditable: boolean;
  /** 更新中の結果ID（ステータス） */
  updatingStatusId: string | null;
  /** 更新中の結果ID（ノート） */
  updatingNoteId: string | null;
  /** ステータス変更ハンドラ */
  onStatusChange: (resultId: string, status: ExpectedResultStatus) => void;
  /** ノート変更ハンドラ */
  onNoteChange: (resultId: string, note: string | null) => void;
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
 * 実行期待結果リスト
 * スナップショットの期待結果と結果データをマッピングして表示
 */
export function ExecutionExpectedResultList({
  expectedResults,
  results,
  isEditable,
  updatingStatusId,
  updatingNoteId,
  onStatusChange,
  onNoteChange,
  uploadingEvidenceResultId,
  deletingEvidenceId,
  downloadingEvidenceId,
  onEvidenceUpload,
  onEvidenceDelete,
  onEvidenceDownload,
}: ExecutionExpectedResultListProps) {
  // 期待結果がない場合は何も表示しない
  if (expectedResults.length === 0) {
    return null;
  }

  // スナップショットIDから結果をマップ
  const resultMap = new Map(
    results.map((r) => [r.snapshotExpectedResultId, r])
  );

  return (
    <div className="space-y-2">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2 text-sm font-medium text-foreground-muted">
        <Target className="w-4 h-4" />
        期待結果
      </div>

      {/* 期待結果リスト */}
      <div className="pl-1">
        {expectedResults.map((expectedResult, index) => {
          const result = resultMap.get(expectedResult.id);

          // 結果が見つからない場合（データ不整合）
          if (!result) {
            console.error(`Expected result not found for snapshot ID: ${expectedResult.id}`);
            return (
              <div key={expectedResult.id} className="flex gap-3 py-3 border-b border-border last:border-b-0">
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-background-tertiary text-foreground-muted text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{expectedResult.content}</p>
                  <p className="text-xs text-danger mt-1">---</p>
                </div>
              </div>
            );
          }

          const statusConfig = getExpectedStatusConfig(result.status);
          const isUploading = uploadingEvidenceResultId === result.id;

          return (
            <div key={result.id} className="py-3 border-b border-border last:border-b-0">
              <ExecutionResultItem
                index={index + 1}
                content={expectedResult.content}
                status={result.status}
                statusConfig={statusConfig}
                note={result.note}
                statusOptions={expectedResultStatusOptions}
                isEditable={isEditable}
                isStatusUpdating={updatingStatusId === result.id}
                isNoteUpdating={updatingNoteId === result.id}
                onStatusChange={(status) => onStatusChange(result.id, status)}
                onNoteChange={(note) => onNoteChange(result.id, note)}
              />

              {/* エビデンス一覧 */}
              <div className="ml-9">
                <ExecutionEvidenceList
                  evidences={result.evidences}
                  isEditable={isEditable}
                  deletingId={deletingEvidenceId}
                  downloadingId={downloadingEvidenceId}
                  onDelete={onEvidenceDelete}
                  onDownload={onEvidenceDownload}
                />

                {/* エビデンスアップロード（編集可能時のみ） */}
                {isEditable && (
                  <ExecutionEvidenceUpload
                    currentCount={result.evidences.length}
                    isUploading={isUploading}
                    onUpload={(file, description) => onEvidenceUpload(result.id, file, description)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
