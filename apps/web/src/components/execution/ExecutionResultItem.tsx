import type { StatusConfig, StatusOption } from '../../lib/execution-status';
import { StatusButton } from './StatusButton';
import { InlineNoteEditor } from './InlineNoteEditor';

interface ExecutionResultItemProps<T extends string> {
  /** インデックス番号（1始まり） */
  index: number;
  /** 内容テキスト */
  content: string;
  /** 現在のステータス値 */
  status: T;
  /** 現在のステータス設定 */
  statusConfig: StatusConfig;
  /** ノート内容 */
  note: string | null;
  /** ステータス選択肢一覧 */
  statusOptions: StatusOption<T>[];
  /** 編集可能か */
  isEditable: boolean;
  /** ステータス更新中フラグ */
  isStatusUpdating: boolean;
  /** ノート更新中フラグ */
  isNoteUpdating: boolean;
  /** ステータス変更時のハンドラ */
  onStatusChange: (status: T) => void;
  /** ノート変更時のハンドラ */
  onNoteChange: (note: string | null) => void;
}

/**
 * 実行結果アイテム（汎用）
 * 前提条件・ステップ・期待結果の共通表示コンポーネント
 */
export function ExecutionResultItem<T extends string>({
  index,
  content,
  status,
  statusConfig,
  note,
  statusOptions,
  isEditable,
  isStatusUpdating,
  isNoteUpdating,
  onStatusChange,
  onNoteChange,
}: ExecutionResultItemProps<T>) {
  return (
    <div className="flex gap-3 py-3 border-b border-border last:border-b-0">
      {/* インデックス番号バッジ */}
      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-background-tertiary text-foreground-muted text-xs font-medium">
        {index}
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* 上段: 内容テキスト + ステータスボタン */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-foreground flex-1">{content}</p>
          <div className="flex-shrink-0">
            <StatusButton
              value={status}
              config={statusConfig}
              options={statusOptions}
              onChange={onStatusChange}
              isEditable={isEditable}
              isUpdating={isStatusUpdating}
              ariaLabel={`項目${index}のステータスを変更`}
            />
          </div>
        </div>

        {/* 下段: ノートエディタ */}
        <InlineNoteEditor
          value={note}
          onChange={onNoteChange}
          isEditable={isEditable}
          isUpdating={isNoteUpdating}
          placeholder={`項目${index}のノートを入力...`}
        />
      </div>
    </div>
  );
}
