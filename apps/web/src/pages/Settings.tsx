import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { User, Bell, Shield, Key, Loader2, Monitor, Smartphone, Tablet, X, AlertTriangle, Github, Link2, Unlink, Plus, Copy, Check, Trash2, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';
import { ApiError, sessionsApi, accountsApi, apiTokensApi, type Session, type Account, type ApiToken, type CreatedApiToken } from '../lib/api';

type SettingsTab = 'profile' | 'notifications' | 'security' | 'api-tokens';

/**
 * 設定ページ
 */
export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    tabParam && ['profile', 'notifications', 'security', 'api-tokens'].includes(tabParam)
      ? tabParam
      : 'profile'
  );

  // OAuth連携結果のハンドリング
  useEffect(() => {
    const link = searchParams.get('link');
    const message = searchParams.get('message');

    if (link === 'success') {
      toast.success('OAuth連携を追加しました');
      // パラメータをクリア
      searchParams.delete('link');
      searchParams.delete('message');
      setSearchParams(searchParams, { replace: true });
    } else if (link === 'error') {
      toast.error(message || 'OAuth連携に失敗しました');
      // パラメータをクリア
      searchParams.delete('link');
      searchParams.delete('message');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // タブを変更するとURLパラメータも更新
  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    searchParams.set('tab', tab);
    setSearchParams(searchParams, { replace: true });
  };

  const tabs = [
    { id: 'profile' as const, label: 'プロフィール', icon: User },
    { id: 'notifications' as const, label: '通知', icon: Bell },
    { id: 'security' as const, label: 'セキュリティ', icon: Shield },
    { id: 'api-tokens' as const, label: 'APIトークン', icon: Key },
  ];

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">設定</h1>
        <p className="text-foreground-muted mt-1">
          アカウントとアプリケーションの設定
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* タブナビゲーション */}
        <nav className="lg:w-48 flex-shrink-0">
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded transition-colors
                    ${activeTab === tab.id
                      ? 'bg-accent-subtle text-accent'
                      : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                    }
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* コンテンツ */}
        <div className="flex-1">
          {activeTab === 'profile' && <ProfileSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'api-tokens' && <ApiTokenSettings />}
        </div>
      </div>
    </div>
  );
}

/**
 * プロフィール設定
 */
function ProfileSettings() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // ユーザー情報が変更されたら入力値をリセット
  useEffect(() => {
    setName(user?.name || '');
    setValidationError(null);
  }, [user?.name]);

  const hasChanges = name !== user?.name;

  // 入力値を元に戻す
  const handleCancel = () => {
    setName(user?.name || '');
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // バリデーション
    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('表示名を入力してください');
      return;
    }
    if (trimmedName.length > 100) {
      setValidationError('表示名は100文字以内で入力してください');
      return;
    }

    setIsSaving(true);
    try {
      await updateUser({ name: trimmedName });
      toast.success('プロフィールを更新しました');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.name) {
          setValidationError(error.details.name[0]);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('プロフィールの更新に失敗しました');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">プロフィール</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4 mb-6">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center">
              <span className="text-2xl font-medium text-accent">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-medium text-foreground">{user?.name}</p>
            <p className="text-sm text-foreground-muted">{user?.email}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            表示名
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setValidationError(null);
            }}
            className={`input max-w-md ${validationError ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
            disabled={isSaving}
          />
          {validationError && (
            <p className="text-xs text-danger mt-1">{validationError}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            メールアドレス
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="input max-w-md bg-background-tertiary"
          />
          <p className="text-xs text-foreground-subtle mt-1">
            メールアドレスはOAuthプロバイダーから取得されています
          </p>
        </div>

        <div className="pt-4 flex gap-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSaving || !hasChanges}
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? '保存中...' : '保存'}
          </button>
          {hasChanges && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
              disabled={isSaving}
            >
              キャンセル
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/**
 * 通知設定
 */
function NotificationSettings() {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">通知設定</h2>
      <p className="text-foreground-muted">
        通知設定は近日公開予定です。
      </p>
    </div>
  );
}

/**
 * User-Agentからデバイス情報を解析
 */
function parseUserAgent(userAgent: string | null): {
  deviceType: 'desktop' | 'tablet' | 'mobile';
  browser: string;
  os: string;
} {
  if (!userAgent) {
    return { deviceType: 'desktop', browser: '不明', os: '不明' };
  }

  // デバイスタイプ判定
  let deviceType: 'desktop' | 'tablet' | 'mobile' = 'desktop';
  if (/tablet|ipad/i.test(userAgent)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|android.*mobile/i.test(userAgent)) {
    deviceType = 'mobile';
  }

  // ブラウザ判定
  let browser = '不明';
  if (/edg/i.test(userAgent)) {
    browser = 'Edge';
  } else if (/chrome/i.test(userAgent)) {
    browser = 'Chrome';
  } else if (/firefox/i.test(userAgent)) {
    browser = 'Firefox';
  } else if (/safari/i.test(userAgent)) {
    browser = 'Safari';
  }

  // OS判定
  let os = '不明';
  if (/windows/i.test(userAgent)) {
    os = 'Windows';
  } else if (/mac os/i.test(userAgent)) {
    os = 'macOS';
  } else if (/linux/i.test(userAgent)) {
    os = 'Linux';
  } else if (/android/i.test(userAgent)) {
    os = 'Android';
  } else if (/iphone|ipad/i.test(userAgent)) {
    os = 'iOS';
  }

  return { deviceType, browser, os };
}

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
 * デバイスアイコンを取得
 */
function DeviceIcon({ deviceType }: { deviceType: 'desktop' | 'tablet' | 'mobile' }) {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className="w-5 h-5" />;
    case 'tablet':
      return <Tablet className="w-5 h-5" />;
    default:
      return <Monitor className="w-5 h-5" />;
  }
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
    <div className="fixed inset-0 z-modal flex items-center justify-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      {/* ダイアログ */}
      <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-warning-subtle flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
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
 * セッションアイテム
 */
function SessionItem({
  session,
  onRevoke,
  isRevoking,
}: {
  session: Session;
  onRevoke: (sessionId: string) => void;
  isRevoking: boolean;
}) {
  const { deviceType, browser, os } = parseUserAgent(session.userAgent);

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border ${
        session.isCurrent
          ? 'border-accent bg-accent-subtle'
          : 'border-border bg-background-secondary'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          session.isCurrent ? 'bg-accent text-white' : 'bg-background-tertiary text-foreground-muted'
        }`}>
          <DeviceIcon deviceType={deviceType} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              {browser} on {os}
            </span>
            {session.isCurrent && (
              <span className="badge badge-accent text-xs">現在のセッション</span>
            )}
          </div>
          <div className="text-sm text-foreground-muted mt-0.5">
            <span>{session.ipAddress || '不明なIP'}</span>
            <span className="mx-2">•</span>
            <span>最終アクティブ: {formatRelativeTime(session.lastActiveAt)}</span>
          </div>
        </div>
      </div>
      {!session.isCurrent && (
        <button
          className="btn btn-ghost btn-sm text-danger hover:bg-danger-subtle"
          onClick={() => onRevoke(session.id)}
          disabled={isRevoking}
        >
          {isRevoking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'ログアウト'
          )}
        </button>
      )}
    </div>
  );
}

// サポートするOAuthプロバイダー
const OAUTH_PROVIDERS = [
  { id: 'github' as const, name: 'GitHub', icon: Github },
  { id: 'google' as const, name: 'Google', icon: GoogleIcon },
];

// Googleアイコンコンポーネント
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

/**
 * セキュリティ設定
 */
function SecuritySettings() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'session' | 'all-sessions' | 'unlink';
    sessionId?: string;
    provider?: string;
  } | null>(null);

  // セッション一覧を取得
  const fetchSessions = useCallback(async () => {
    try {
      const response = await sessionsApi.list();
      setSessions(response.data);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('セッション一覧の取得に失敗しました');
      }
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  // OAuth連携一覧を取得
  const fetchAccounts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await accountsApi.list(user.id);
      setAccounts(response.data);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('OAuth連携一覧の取得に失敗しました');
      }
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSessions();
    fetchAccounts();
  }, [fetchSessions, fetchAccounts]);

  // 個別セッションを終了
  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      await sessionsApi.revoke(sessionId);
      toast.success('セッションを終了しました');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('セッションの終了に失敗しました');
      }
    } finally {
      setRevokingSessionId(null);
      setConfirmDialog(null);
    }
  };

  // 他の全セッションを終了
  const handleRevokeAllSessions = async () => {
    setIsRevokingAll(true);
    try {
      const response = await sessionsApi.revokeOthers();
      const count = response.data.revokedCount;
      toast.success(`${count}件のセッションを終了しました`);
      setSessions((prev) => prev.filter((s) => s.isCurrent));
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('セッションの終了に失敗しました');
      }
    } finally {
      setIsRevokingAll(false);
      setConfirmDialog(null);
    }
  };

  // OAuth連携を解除
  const handleUnlinkAccount = async (provider: string) => {
    if (!user?.id) return;
    setUnlinkingProvider(provider);
    try {
      await accountsApi.unlink(user.id, provider);
      toast.success(`${provider}との連携を解除しました`);
      setAccounts((prev) => prev.filter((a) => a.provider !== provider));
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('連携解除に失敗しました');
      }
    } finally {
      setUnlinkingProvider(null);
      setConfirmDialog(null);
    }
  };

  // OAuth連携を追加
  const handleLinkAccount = (provider: 'github' | 'google') => {
    // 現在のページのURLを維持するため、API経由でリダイレクト
    window.location.href = accountsApi.getLinkUrl(provider);
  };

  // 確認ダイアログを開く
  const openConfirmDialog = (
    type: 'session' | 'all-sessions' | 'unlink',
    options?: { sessionId?: string; provider?: string }
  ) => {
    setConfirmDialog({ type, ...options });
  };

  // 確認ダイアログを閉じる
  const closeConfirmDialog = () => {
    setConfirmDialog(null);
  };

  // 確認ダイアログで確定
  const handleConfirm = () => {
    if (confirmDialog?.type === 'session' && confirmDialog.sessionId) {
      handleRevokeSession(confirmDialog.sessionId);
    } else if (confirmDialog?.type === 'all-sessions') {
      handleRevokeAllSessions();
    } else if (confirmDialog?.type === 'unlink' && confirmDialog.provider) {
      handleUnlinkAccount(confirmDialog.provider);
    }
  };

  // プロバイダーが連携済みかどうかを判定
  const isProviderLinked = (providerId: string) => {
    return accounts.some((a) => a.provider === providerId);
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-6">
      {/* 接続済みアカウント */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">接続済みアカウント</h2>
            <p className="text-sm text-foreground-muted mt-1">
              OAuthプロバイダーとの連携を管理します
            </p>
          </div>
        </div>

        {isLoadingAccounts ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
          </div>
        ) : (
          <div className="space-y-2">
            {OAUTH_PROVIDERS.map((provider) => {
              const linked = isProviderLinked(provider.id);
              const account = accounts.find((a) => a.provider === provider.id);
              const isUnlinking = unlinkingProvider === provider.id;
              const canUnlink = accounts.length > 1;

              return (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-3 bg-background-tertiary rounded"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-background flex items-center justify-center">
                      <provider.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-foreground font-medium">{provider.name}</span>
                      {linked && account && (
                        <p className="text-xs text-foreground-muted">
                          連携日: {new Date(account.createdAt).toLocaleDateString('ja-JP')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {linked ? (
                      <>
                        <span className="badge badge-success">接続済み</span>
                        {canUnlink && (
                          <button
                            className="btn btn-ghost btn-sm text-danger hover:bg-danger-subtle"
                            onClick={() => openConfirmDialog('unlink', { provider: provider.id })}
                            disabled={isUnlinking}
                            title="連携を解除"
                          >
                            {isUnlinking ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Unlink className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleLinkAccount(provider.id)}
                      >
                        <Link2 className="w-4 h-4" />
                        連携する
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {accounts.length === 1 && (
          <p className="text-xs text-foreground-subtle mt-4">
            ※ 最低1つのOAuth連携が必要です。連携を解除するには別のプロバイダーを先に連携してください。
          </p>
        )}
      </div>

      {/* セッション管理 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">アクティブなセッション</h2>
            <p className="text-sm text-foreground-muted mt-1">
              現在ログインしているデバイスの一覧です
            </p>
          </div>
          {otherSessionsCount > 0 && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => openConfirmDialog('all-sessions')}
              disabled={isRevokingAll}
            >
              {isRevokingAll && <Loader2 className="w-4 h-4 animate-spin" />}
              他のすべてのセッションを終了
            </button>
          )}
        </div>

        {isLoadingSessions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-center text-foreground-muted py-8">
            アクティブなセッションがありません
          </p>
        ) : (
          <div className="space-y-3">
            {/* 現在のセッションを先頭に表示 */}
            {sessions
              .sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : 0))
              .map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  onRevoke={(id) => openConfirmDialog('session', { sessionId: id })}
                  isRevoking={revokingSessionId === session.id}
                />
              ))}
          </div>
        )}
      </div>

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialog !== null}
        title={
          confirmDialog?.type === 'all-sessions'
            ? '他のすべてのセッションを終了'
            : confirmDialog?.type === 'unlink'
            ? 'OAuth連携を解除'
            : 'セッションを終了'
        }
        message={
          confirmDialog?.type === 'all-sessions'
            ? '現在のセッション以外のすべてのセッションを終了します。他のデバイスからは再度ログインが必要になります。'
            : confirmDialog?.type === 'unlink'
            ? `${confirmDialog.provider}との連携を解除します。この操作は取り消せません。`
            : 'このセッションを終了します。該当デバイスからは再度ログインが必要になります。'
        }
        confirmLabel={confirmDialog?.type === 'unlink' ? '解除する' : '終了する'}
        onConfirm={handleConfirm}
        onCancel={closeConfirmDialog}
        isLoading={
          confirmDialog?.type === 'all-sessions'
            ? isRevokingAll
            : confirmDialog?.type === 'unlink'
            ? unlinkingProvider !== null
            : revokingSessionId !== null
        }
      />
    </div>
  );
}

/**
 * APIトークン設定
 */
function ApiTokenSettings() {
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
            {token.expiresAt && (
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
