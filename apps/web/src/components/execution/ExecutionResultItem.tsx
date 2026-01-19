import { Bot } from 'lucide-react';
import type { StatusConfig, StatusOption } from '../../lib/execution-status';
import { formatDateTimeCompact } from '../../lib/date';
import { MarkdownPreview } from '../common/markdown';
import { StatusButton } from './StatusButton';
import { InlineNoteEditor } from './InlineNoteEditor';

/**
 * 実施者情報の型
 */
export interface ExecutorInfo {
  /** 実施したユーザー */
  user: { id: string; name: string; avatarUrl: string | null } | null;
  /** 実施したAIエージェント名（MCPツール経由での実施時に設定される） */
  agentName: string | null;
  /** 実施日時 */
  executedAt: string | null;
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
  const executedAt = executor?.executedAt;

  // アバター表示用のヘルパー
  // 注: AuthorAvatarコンポーネントは「agentSessionがあればBotアイコン」という挙動だが、
  // ここでは「ユーザーがいればエージェント経由でもユーザーアバター」という異なる要件のため独自実装
  const renderAvatar = () => {
    // ユーザーがいる場合はユーザーアバター
    if (executor?.user) {
      if (executor.user.avatarUrl) {
        return (
          <img
            src={executor.user.avatarUrl}
            alt={executor.user.name}
            className="w-5 h-5 rounded-full flex-shrink-0"
          />
        );
      }
      // アバター画像がない場合（イニシャル表示）
      return (
        <div className="w-5 h-5 rounded-full bg-foreground-muted/20 flex items-center justify-center flex-shrink-0 text-xs font-medium text-foreground-muted">
          {executor.user.name?.[0]?.toUpperCase() || '?'}
        </div>
      );
    }
    // エージェントのみの場合はBotアイコン
    if (executor?.agentName) {
      return (
        <div
          className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0"
          role="img"
          aria-label={`AIエージェント: ${executor.agentName}`}
        >
          <Bot className="w-3 h-3 text-accent" aria-hidden="true" />
        </div>
      );
    }
    return null;
  };

  // 表示名を取得
  // ユーザーがいる場合: ユーザー名 (エージェント経由の場合は「ユーザー名 (エージェント名経由)」)
  // ユーザーがいない場合: エージェント名のみ
  const getDisplayName = () => {
    if (executor?.user) {
      if (executor.agentName) {
        return `${executor.user.name} (${executor.agentName}経由)`;
      }
      return executor.user.name;
    }
    if (executor?.agentName) {
      return executor.agentName;
    }
    return null;
  };

  const displayName = getDisplayName();

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
        {displayName && executedAt && (
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <div className="flex items-center gap-1.5">
              {renderAvatar()}
              <span>{displayName}</span>
            </div>
            <span>{formatDateTimeCompact(executedAt)}</span>
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
