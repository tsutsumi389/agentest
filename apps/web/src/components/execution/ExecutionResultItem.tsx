import type { StatusConfig, StatusOption } from '../../lib/execution-status';
import { MarkdownPreview } from '../common/markdown';
import { StatusButton } from './StatusButton';
import { InlineNoteEditor } from './InlineNoteEditor';

/**
 * 実施者情報の型
 */
export interface ExecutorInfo {
  /** 実施したユーザー */
  user: { id: string; name: string; avatarUrl: string | null } | null;
  /** 実施したAIエージェント名 */
  agentName: string | null;
  /** 実施日時 */
  executedAt: string | null;
}

/**
 * 日時を簡易フォーマットで表示
 * 例: 2025-01-15 10:30
 */
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

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
  /** 実施者情報（オプション） */
  executor?: ExecutorInfo;
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
  executor,
}: ExecutionResultItemProps<T>) {
  // 実施者表示名を取得（エージェント名優先、次にユーザー名）
  const executorName = executor?.agentName || executor?.user?.name;
  // 実施日時
  const executedAt = executor?.executedAt;

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
          <div className="text-sm text-foreground flex-1">
            <MarkdownPreview content={content} />
          </div>
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

        {/* 実施者情報（ステータスが設定されている場合のみ表示） */}
        {executorName && executedAt && (
          <div className="text-xs text-foreground-muted">
            {executorName} / {formatDateTime(executedAt)}
          </div>
        )}

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
