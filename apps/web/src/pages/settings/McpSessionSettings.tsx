import { useState, useEffect, useCallback } from 'react';
import { Bot, Loader2, X, AlertTriangle } from 'lucide-react';
import { toast } from '../../stores/toast';
import { ApiError, agentSessionsApi, type AgentSessionItem, type AgentSessionStatus } from '../../lib/api';

/**
 * 相対時間をフォーマット
 */
function formatRelativeTime(date: string): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'たった今';
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 30) return `${diffDays}日前`;
  return target.toLocaleDateString('ja-JP');
}

/**
 * 確認ダイアログ
 */
function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isLoading,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !isLoading) onCancel();
      }}
    >
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        role="presentation"
      />
      {/* ダイアログ */}
      <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-warning-subtle flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1">
            <h3 id="confirm-dialog-title" className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-foreground-muted mt-1">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 text-foreground-subtle hover:text-foreground"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            キャンセル
          </button>
          <button
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// MCPセッション一覧の初期表示件数
const INITIAL_MCP_SESSION_DISPLAY_COUNT = 10;

/**
 * MCPセッションステータスのバッジ設定
 */
const STATUS_BADGE_CONFIG: Record<AgentSessionStatus, { className: string; label: string }> = {
  ACTIVE: { className: 'badge badge-success', label: 'アクティブ' },
  IDLE: { className: 'badge badge-warning', label: 'アイドル' },
  ENDED: { className: 'badge text-foreground-muted bg-background-tertiary', label: '終了' },
  TIMEOUT: { className: 'badge badge-danger', label: 'タイムアウト' },
};

/**
 * MCPセッションアイテム
 */
function McpSessionItem({
  session,
  onEnd,
  isEnding,
}: {
  session: AgentSessionItem;
  onEnd: (sessionId: string) => void;
  isEnding: boolean;
}) {
  const badgeConfig = STATUS_BADGE_CONFIG[session.status];
  const isActive = session.status === 'ACTIVE' || session.status === 'IDLE';

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-background-secondary">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-background-tertiary text-foreground-muted">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              {session.clientName || session.clientId}
            </span>
            <span className={badgeConfig.className}>
              {badgeConfig.label}
            </span>
          </div>
          <div className="text-sm text-foreground-muted mt-0.5">
            {session.projectName && (
              <>
                <span>{session.projectName}</span>
                <span className="mx-2">&middot;</span>
              </>
            )}
            {session.source === 'oauth' && (
              <>
                <span>OAuth</span>
                <span className="mx-2">&middot;</span>
              </>
            )}
            <span>開始: {formatRelativeTime(session.startedAt)}</span>
            {session.source === 'agent' && (
              <>
                <span className="mx-2">&middot;</span>
                <span>最終通信: {formatRelativeTime(session.lastHeartbeat)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      {isActive && (
        <button
          className="btn btn-ghost btn-sm text-danger hover:bg-danger-subtle"
          onClick={() => onEnd(session.id)}
          disabled={isEnding}
          aria-label={`${session.clientName || session.clientId} のセッションを終了`}
        >
          {isEnding ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            '終了'
          )}
        </button>
      )}
    </div>
  );
}

/**
 * MCPセッション設定
 */
export function McpSessionSettings() {
  const [sessions, setSessions] = useState<AgentSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [endingSessionId, setEndingSessionId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ sessionId: string; clientName: string; source: 'agent' | 'oauth' } | null>(null);
  const [includeEnded, setIncludeEnded] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const status = includeEnded ? 'ACTIVE,IDLE,ENDED,TIMEOUT' : 'ACTIVE,IDLE';
      const response = await agentSessionsApi.list({ status, limit: 100 });
      setSessions(response.data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '予期しないエラーが発生しました';
      toast.error(`セッションの取得に失敗しました: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [includeEnded]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleEndSession = async (sessionId: string, source?: 'agent' | 'oauth') => {
    try {
      setEndingSessionId(sessionId);
      await agentSessionsApi.end(sessionId, source);

      // ローカルステート更新: ステータスをENDEDに変更
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, status: 'ENDED' as AgentSessionStatus, endedAt: new Date().toISOString() }
            : s
        )
      );
      toast.success('セッションを終了しました');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '予期しないエラーが発生しました';
      toast.error(`セッションの終了に失敗しました: ${message}`);
      // 失敗時はリフェッチ
      fetchSessions();
    } finally {
      setEndingSessionId(null);
      setConfirmDialog(null);
    }
  };

  const displayedSessions = showAllSessions
    ? sessions
    : sessions.slice(0, INITIAL_MCP_SESSION_DISPLAY_COUNT);
  const hiddenSessionCount = sessions.length - INITIAL_MCP_SESSION_DISPLAY_COUNT;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">MCPセッション</h2>
            <p className="text-sm text-foreground-muted mt-1">
              所属プロジェクトのMCPセッション（AI Agent接続）を確認・管理できます
            </p>
          </div>
        </div>

        {/* 終了済み表示トグル */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm text-foreground-muted">
            <input
              type="checkbox"
              checked={includeEnded}
              onChange={(e) => setIncludeEnded(e.target.checked)}
              className="rounded border-border"
            />
            終了済み・タイムアウトのセッションも表示
          </label>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-foreground-muted">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>MCPセッションがありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedSessions.map((session) => (
              <McpSessionItem
                key={session.id}
                session={session}
                onEnd={(id) => setConfirmDialog({
                  sessionId: id,
                  clientName: session.clientName || session.clientId,
                  source: session.source,
                })}
                isEnding={endingSessionId === session.id}
              />
            ))}

            {/* 展開ボタン */}
            {hiddenSessionCount > 0 && !showAllSessions && (
              <button
                className="w-full py-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
                onClick={() => setShowAllSessions(true)}
              >
                他 {hiddenSessionCount} 件のセッションを表示
              </button>
            )}
            {showAllSessions && sessions.length > INITIAL_MCP_SESSION_DISPLAY_COUNT && (
              <button
                className="w-full py-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
                onClick={() => setShowAllSessions(false)}
              >
                折りたたむ
              </button>
            )}
          </div>
        )}
      </div>

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialog !== null}
        title="MCPセッションを終了"
        message={`${confirmDialog?.clientName || ''} のセッションを終了しますか？実行中の処理が中断される可能性があります。`}
        confirmLabel="終了する"
        onConfirm={() => confirmDialog && handleEndSession(confirmDialog.sessionId, confirmDialog.source)}
        onCancel={() => setConfirmDialog(null)}
        isLoading={endingSessionId !== null}
      />
    </div>
  );
}
