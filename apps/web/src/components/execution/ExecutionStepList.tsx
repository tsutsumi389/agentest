import { ListChecks } from 'lucide-react';
import type {
  ExecutionTestCaseStepSnapshot,
  ExecutionStepResult,
  StepResultStatus,
} from '../../lib/api';
import {
  stepResultStatusOptions,
  getStepStatusConfig,
} from '../../lib/execution-status';
import { ExecutionResultItem } from './ExecutionResultItem';

interface ExecutionStepListProps {
  /** 実行時ステップ一覧 */
  steps: ExecutionTestCaseStepSnapshot[];
  /** ステップ結果一覧 */
  results: ExecutionStepResult[];
  /** 編集可能か */
  isEditable: boolean;
  /** 更新中の結果ID（ステータス） */
  updatingStatusId: string | null;
  /** 更新中の結果ID（ノート） */
  updatingNoteId: string | null;
  /** ステータス変更ハンドラ */
  onStatusChange: (resultId: string, status: StepResultStatus) => void;
  /** ノート変更ハンドラ */
  onNoteChange: (resultId: string, note: string | null) => void;
}

/**
 * 実行ステップリスト
 * スナップショットのステップと結果データをマッピングして表示
 */
export function ExecutionStepList({
  steps,
  results,
  isEditable,
  updatingStatusId,
  updatingNoteId,
  onStatusChange,
  onNoteChange,
}: ExecutionStepListProps) {
  // ステップがない場合は何も表示しない
  if (steps.length === 0) {
    return null;
  }

  // 正規化テーブルIDから結果をマップ
  const resultMap = new Map(
    results.map((r) => [r.executionStepId, r])
  );

  return (
    <div className="space-y-2">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2 text-sm font-medium text-foreground-muted">
        <ListChecks className="w-4 h-4" />
        手順
      </div>

      {/* ステップリスト */}
      <div className="pl-1">
        {steps.map((step, index) => {
          const result = resultMap.get(step.id);

          // 結果が見つからない場合（データ不整合）
          if (!result) {
            console.error(`Step result not found for snapshot ID: ${step.id}`);
            return (
              <div key={step.id} className="flex gap-3 py-3 border-b border-border last:border-b-0">
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-background-tertiary text-foreground-muted text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{step.content}</p>
                  <p className="text-xs text-danger mt-1">---</p>
                </div>
              </div>
            );
          }

          const statusConfig = getStepStatusConfig(result.status);

          return (
            <ExecutionResultItem
              key={result.id}
              index={index + 1}
              content={step.content}
              status={result.status}
              statusConfig={statusConfig}
              note={result.note}
              statusOptions={stepResultStatusOptions}
              isEditable={isEditable}
              isStatusUpdating={updatingStatusId === result.id}
              isNoteUpdating={updatingNoteId === result.id}
              onStatusChange={(status) => onStatusChange(result.id, status)}
              onNoteChange={(note) => onNoteChange(result.id, note)}
              executor={{
                user: result.executedByUser ?? null,
                agentName: result.executedByAgentName ?? null,
                executedAt: result.executedAt,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
