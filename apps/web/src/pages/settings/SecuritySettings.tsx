import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Monitor, Smartphone, Tablet, X, AlertTriangle, Github, Link2, Unlink } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useConfigStore } from '../../stores/config';
import { toast } from '../../stores/toast';
import { ApiError, sessionsApi, accountsApi, passwordApi, type Session, type Account } from '../../lib/api';
import { PasswordStrengthChecklist, PASSWORD_CHECKS } from '../../components/PasswordStrengthChecklist';
import { TwoFactorSettings } from '../../components/settings/TwoFactorSettings';
import { GoogleIcon } from '../../components/ui/GoogleIcon';

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

// セッション一覧の初期表示件数
const INITIAL_SESSION_DISPLAY_COUNT = 5;

/**
 * セキュリティ設定
 */
export function SecuritySettings() {
  const { user } = useAuthStore();
  const { auth: { providers: enabledProviders }, isOAuthEnabled } = useConfigStore();

  // 有効なプロバイダーのみフィルタリング
  const availableProviders = OAUTH_PROVIDERS.filter(
    (p) => enabledProviders[p.id]
  );
  const showOAuthSection = isOAuthEnabled();
  const [showAllSessions, setShowAllSessions] = useState(false);
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

  // パスワード管理の状態
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<'set' | 'change' | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // パスワード設定状況を取得
  const fetchPasswordStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await passwordApi.getStatus(user.id);
      setHasPassword(response.hasPassword);
    } catch {
      // パスワード状況の取得に失敗してもページ表示は続行
    }
  }, [user?.id]);

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
    fetchPasswordStatus();
  }, [fetchSessions, fetchAccounts, fetchPasswordStatus]);

  // 個別セッションを終了
  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      await sessionsApi.revoke(sessionId);
      toast.success('セッションを終了しました');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      // 削除後のセッション数が表示上限以下ならば展開状態をリセット
      if (sessions.length - 1 <= INITIAL_SESSION_DISPLAY_COUNT) {
        setShowAllSessions(false);
      }
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
      setShowAllSessions(false);
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

  // パスワードモーダルを開く
  const openPasswordModal = (type: 'set' | 'change') => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError(null);
    setShowPasswordModal(type);
  };

  // パスワードモーダルを閉じる
  const closePasswordModal = () => {
    setShowPasswordModal(null);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError(null);
  };

  // パスワード設定/変更を送信
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    // パスワード一致チェック
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('パスワードが一致しません');
      return;
    }

    if (!user?.id) return;
    setIsSubmittingPassword(true);

    try {
      if (showPasswordModal === 'set') {
        await passwordApi.setPassword(user.id, { password: passwordForm.newPassword });
        toast.success('パスワードを設定しました');
      } else {
        await passwordApi.changePassword(user.id, {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        });
        toast.success('パスワードを変更しました');
      }
      closePasswordModal();
      // ステータスを再取得
      await fetchPasswordStatus();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('パスワードの更新に失敗しました');
      }
    } finally {
      setIsSubmittingPassword(false);
    }
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

  // 現在のセッションを先頭にソートし、表示件数を制限
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : 0)),
    [sessions]
  );
  const displayedSessions = showAllSessions
    ? sortedSessions
    : sortedSessions.slice(0, INITIAL_SESSION_DISPLAY_COUNT);
  const hiddenSessionCount = sessions.length - INITIAL_SESSION_DISPLAY_COUNT;

  return (
    <div className="space-y-6">
      {/* パスワード管理 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">パスワード</h2>
            <p className="text-sm text-foreground-muted mt-1">
              {hasPassword
                ? 'パスワードが設定されています'
                : 'パスワードが設定されていません'}
            </p>
          </div>
          {hasPassword === false && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => openPasswordModal('set')}
            >
              パスワードを設定
            </button>
          )}
          {hasPassword === true && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => openPasswordModal('change')}
            >
              パスワードを変更
            </button>
          )}
        </div>
      </div>

      {/* 二要素認証 */}
      <TwoFactorSettings />

      {/* パスワード設定/変更モーダル */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-modal flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closePasswordModal} />
          <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {showPasswordModal === 'set' ? 'パスワードを設定する' : 'パスワードを変更する'}
              </h3>
              <button onClick={closePasswordModal} disabled={isSubmittingPassword}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {showPasswordModal === 'change' && (
                <div>
                  <label htmlFor="current-password" className="block text-sm font-medium text-foreground mb-1">
                    現在のパスワード
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    className="input w-full"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                    }
                    required
                  />
                </div>
              )}

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-1">
                  新しいパスワード
                </label>
                <input
                  id="new-password"
                  type="password"
                  className="input w-full"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  required
                />
                <div className="mt-2">
                  <PasswordStrengthChecklist password={passwordForm.newPassword} />
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-1">
                  パスワード（確認）
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  className="input w-full"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  required
                />
              </div>

              {passwordError && (
                <p className="text-sm text-danger">{passwordError}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closePasswordModal}
                  disabled={isSubmittingPassword}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    isSubmittingPassword ||
                    !passwordForm.newPassword ||
                    !passwordForm.confirmPassword ||
                    !PASSWORD_CHECKS.every((check) => check.test(passwordForm.newPassword))
                  }
                >
                  {isSubmittingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                  {showPasswordModal === 'set' ? '設定する' : '変更する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 接続済みアカウント（有効なOAuthプロバイダーがある場合のみ表示） */}
      {showOAuthSection && (
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
            {availableProviders.map((provider) => {
              const linked = isProviderLinked(provider.id);
              const account = accounts.find((a) => a.provider === provider.id);
              const isUnlinking = unlinkingProvider === provider.id;
              const canUnlink = accounts.length > 1 || hasPassword === true;

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

        {accounts.length === 1 && !hasPassword && (
          <p className="text-xs text-foreground-subtle mt-4">
            ※ 最低1つのOAuth連携が必要です。連携を解除するには別のプロバイダーを先に連携するか、パスワードを設定してください。
          </p>
        )}
      </div>
      )}

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
            {displayedSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                onRevoke={(id) => openConfirmDialog('session', { sessionId: id })}
                isRevoking={revokingSessionId === session.id}
              />
            ))}
            {!showAllSessions && hiddenSessionCount > 0 && (
              <button
                className="btn btn-ghost btn-sm w-full mt-3"
                onClick={() => setShowAllSessions(true)}
              >
                他 {hiddenSessionCount} 件のセッションを表示
              </button>
            )}
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
