import { ClipboardCheck } from 'lucide-react';
import type {
  ExecutionPreconditionResult,
  PreconditionResultStatus,
} from '../../lib/api';
import {
  preconditionResultStatusOptions,
  getPreconditionStatusConfig,
} from '../../lib/execution-status';
import { ExecutionResultItem } from './ExecutionResultItem';

/** スナップショットの前提条件型 */
interface SnapshotPrecondition {
  id: string;
  content: string;
  orderKey: string;
}

interface ExecutionPreconditionListProps {
  /** スナップショットの前提条件一覧 */
  preconditions: SnapshotPrecondition[];
  /** 前提条件結果一覧 */
  results: ExecutionPreconditionResult[];
  /** 編集可能か */
  isEditable: boolean;
  /** 更新中の結果ID（ステータス） */
  updatingStatusId: string | null;
  /** 更新中の結果ID（ノート） */
  updatingNoteId: string | null;
  /** ステータス変更ハンドラ */
  onStatusChange: (resultId: string, status: PreconditionResultStatus) => void;
  /** ノート変更ハンドラ */
  onNoteChange: (resultId: string, note: string | null) => void;
  /** セクションタイトル */
  title?: string;
}

/**
 * 実行前提条件リスト
 * スナップショットの前提条件と結果データをマッピングして表示
 */
export function ExecutionPreconditionList({
  preconditions,
  results,
  isEditable,
  updatingStatusId,
  updatingNoteId,
  onStatusChange,
  onNoteChange,
  title = '前提条件',
}: ExecutionPreconditionListProps) {
  // 前提条件がない場合は何も表示しない
  if (preconditions.length === 0) {
    return null;
  }

  // スナップショットIDから結果をマップ
  const resultMap = new Map(
    results.map((r) => [r.snapshotPreconditionId, r])
  );

  return (
    <div className="space-y-2">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2 text-sm font-medium text-foreground-muted">
        <ClipboardCheck className="w-4 h-4" />
        {title}
      </div>

      {/* 前提条件リスト */}
      <div className="pl-1">
        {preconditions.map((precondition, index) => {
          const result = resultMap.get(precondition.id);

          // 結果が見つからない場合（データ不整合）
          if (!result) {
            console.error(`Precondition result not found for snapshot ID: ${precondition.id}`);
            return (
              <div key={precondition.id} className="flex gap-3 py-3 border-b border-border last:border-b-0">
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-background-tertiary text-foreground-muted text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{precondition.content}</p>
                  <p className="text-xs text-danger mt-1">---</p>
                </div>
              </div>
            );
          }

          const statusConfig = getPreconditionStatusConfig(result.status);

          return (
            <ExecutionResultItem
              key={result.id}
              index={index + 1}
              content={precondition.content}
              status={result.status}
              statusConfig={statusConfig}
              note={result.note}
              statusOptions={preconditionResultStatusOptions}
              isEditable={isEditable}
              isStatusUpdating={updatingStatusId === result.id}
              isNoteUpdating={updatingNoteId === result.id}
              onStatusChange={(status) => onStatusChange(result.id, status)}
              onNoteChange={(note) => onNoteChange(result.id, note)}
            />
          );
        })}
      </div>
    </div>
  );
}
