import { useState, useEffect, useCallback } from 'react';
import { Key, Loader2, X, AlertTriangle, Plus, Copy, Check, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from '../../stores/toast';
import { ApiError, apiTokensApi, type ApiToken, type CreatedApiToken } from '../../lib/api';

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

/**
 * 新規作成されたトークン表示
 */
function NewTokenDisplay({
  token,
  onClose,
}: {
  token: CreatedApiToken;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token.rawToken);
      setCopied(true);
      toast.success('トークンをコピーしました');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('コピーに失敗しました');
    }
  };

  return (
    <div className="mb-4 p-4 bg-success-subtle border border-success rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-success" />
          <span className="font-medium text-success">トークンが作成されました</span>
        </div>
        <button
          onClick={onClose}
          className="text-foreground-muted hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-sm text-foreground-muted mb-3">
        このトークンは一度だけ表示されます。安全な場所に保存してください。
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 font-mono text-sm bg-background p-2 rounded border border-border overflow-hidden">
          {showToken ? token.rawToken : '••••••••••••••••••••••••••••••••'}
        </div>
        <button
          onClick={() => setShowToken(!showToken)}
          className="btn btn-ghost btn-sm"
          title={showToken ? 'トークンを隠す' : 'トークンを表示'}
        >
          {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button
          onClick={handleCopy}
          className="btn btn-ghost btn-sm"
          title="コピー"
        >
          {copied ? (
            <Check className="w-4 h-4 text-success" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * トークンアイテム
 */
function TokenItem({
  token,
  onRevoke,
  isRevoking,
  isRevoked,
}: {
  token: ApiToken;
  onRevoke?: () => void;
  isRevoking?: boolean;
  isRevoked?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${
      isRevoked ? 'border-border bg-background-tertiary' : 'border-border bg-background-secondary'
    }`}>
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isRevoked ? 'bg-background text-foreground-subtle' : 'bg-accent-subtle text-accent'
        }`}>
          <Key className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{token.name}</span>
            {isRevoked && (
              <span className="badge badge-ghost text-xs">失効済み</span>
            )}
          </div>
          <div className="text-sm text-foreground-muted mt-0.5 flex items-center gap-2">
            <code className="text-xs bg-background-tertiary px-1.5 py-0.5 rounded">
              {token.tokenPrefix}...
            </code>
            <span>•</span>
            <span>作成: {new Date(token.createdAt).toLocaleDateString('ja-JP')}</span>
            {token.lastUsedAt && (
              <>
                <span>•</span>
                <span>最終使用: {formatRelativeTime(token.lastUsedAt)}</span>
              </>
            )}
            {!isRevoked && token.expiresAt && (
              <>
                <span>•</span>
                <span className={new Date(token.expiresAt) < new Date() ? 'text-danger' : ''}>
                  有効期限: {new Date(token.expiresAt).toLocaleDateString('ja-JP')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      {!isRevoked && onRevoke && (
        <button
          className="btn btn-ghost btn-sm text-danger hover:bg-danger-subtle"
          onClick={onRevoke}
          disabled={isRevoking}
        >
          {isRevoking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}

/**
 * トークン作成モーダル
 */
function CreateTokenModal({
  onClose,
  onCreate,
  isCreating,
}: {
  onClose: () => void;
  onCreate: (name: string, expiresInDays?: number) => void;
  isCreating: boolean;
}) {
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<string>('90');
  const [noExpiry, setNoExpiry] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), noExpiry ? undefined : parseInt(expiresInDays, 10));
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* モーダル */}
      <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">新しいAPIトークンを作成</h3>
          <button
            onClick={onClose}
            className="text-foreground-subtle hover:text-foreground"
            disabled={isCreating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              トークン名 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: CI/CD Pipeline"
              className="input w-full"
              disabled={isCreating}
              autoFocus
            />
            <p className="text-xs text-foreground-subtle mt-1">
              このトークンの用途を識別するための名前
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              有効期限
            </label>
            <div className="flex items-center gap-4">
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="input flex-1"
                disabled={isCreating || noExpiry}
              >
                <option value="30">30日</option>
                <option value="60">60日</option>
                <option value="90">90日</option>
                <option value="180">180日</option>
                <option value="365">1年</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-foreground-muted">
                <input
                  type="checkbox"
                  checked={noExpiry}
                  onChange={(e) => setNoExpiry(e.target.checked)}
                  disabled={isCreating}
                  className="rounded border-border"
                />
                無期限
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isCreating}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isCreating || !name.trim()}
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              作成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * APIトークン設定
 */
export function ApiTokenSettings() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<CreatedApiToken | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ tokenId: string; tokenName: string } | null>(null);

  // トークン一覧を取得
  const fetchTokens = useCallback(async () => {
    try {
      const response = await apiTokensApi.list();
      setTokens(response.tokens);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('APIトークン一覧の取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // トークンを作成
  const handleCreateToken = async (name: string, expiresInDays?: number) => {
    setIsCreating(true);
    try {
      const response = await apiTokensApi.create({ name, expiresInDays });
      setNewlyCreatedToken(response.token);
      setShowCreateModal(false);
      // 一覧を再取得
      fetchTokens();
      toast.success('APIトークンを作成しました');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('APIトークンの作成に失敗しました');
      }
    } finally {
      setIsCreating(false);
    }
  };

  // トークンを失効
  const handleRevokeToken = async (tokenId: string) => {
    setRevokingTokenId(tokenId);
    try {
      await apiTokensApi.revoke(tokenId);
      toast.success('APIトークンを失効しました');
      setTokens((prev) => prev.map((t) =>
        t.id === tokenId ? { ...t, revokedAt: new Date().toISOString() } : t
      ));
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('APIトークンの失効に失敗しました');
      }
    } finally {
      setRevokingTokenId(null);
      setConfirmDialog(null);
    }
  };

  // アクティブなトークン（失効していない）
  const activeTokens = tokens.filter((t) => !t.revokedAt);
  // 失効済みトークン
  const revokedTokens = tokens.filter((t) => t.revokedAt);

  return (
    <div className="space-y-6">
      {/* トークン作成セクション */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">APIトークン</h2>
            <p className="text-sm text-foreground-muted mt-1">
              MCPサーバーやCI/CDパイプラインからアクセスするためのAPIトークンを管理します。
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4" />
            新しいトークンを生成
          </button>
        </div>

        {/* 新規作成されたトークン表示 */}
        {newlyCreatedToken && (
          <NewTokenDisplay
            token={newlyCreatedToken}
            onClose={() => setNewlyCreatedToken(null)}
          />
        )}

        {/* トークン一覧 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
          </div>
        ) : activeTokens.length === 0 ? (
          <p className="text-center text-foreground-muted py-8">
            アクティブなAPIトークンがありません
          </p>
        ) : (
          <div className="space-y-3">
            {activeTokens.map((token) => (
              <TokenItem
                key={token.id}
                token={token}
                onRevoke={() => setConfirmDialog({ tokenId: token.id, tokenName: token.name })}
                isRevoking={revokingTokenId === token.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* 失効済みトークン */}
      {revokedTokens.length > 0 && (
        <div className="card p-6">
          <h3 className="text-sm font-medium text-foreground-muted mb-4">失効済みトークン</h3>
          <div className="space-y-3 opacity-60">
            {revokedTokens.map((token) => (
              <TokenItem
                key={token.id}
                token={token}
                isRevoked
              />
            ))}
          </div>
        </div>
      )}

      {/* 作成モーダル */}
      {showCreateModal && (
        <CreateTokenModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateToken}
          isCreating={isCreating}
        />
      )}

      {/* 失効確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialog !== null}
        title="APIトークンを失効"
        message={`"${confirmDialog?.tokenName}" を失効します。このトークンを使用しているアプリケーションは認証できなくなります。`}
        confirmLabel="失効する"
        onConfirm={() => confirmDialog && handleRevokeToken(confirmDialog.tokenId)}
        onCancel={() => setConfirmDialog(null)}
        isLoading={revokingTokenId !== null}
      />
    </div>
  );
}
