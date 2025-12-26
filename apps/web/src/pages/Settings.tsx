import { useState, useEffect, useCallback } from 'react';
import { User, Bell, Shield, Key, Loader2, Monitor, Smartphone, Tablet, X, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';
import { ApiError, sessionsApi, type Session } from '../lib/api';

type SettingsTab = 'profile' | 'notifications' | 'security' | 'api-tokens';

/**
 * 設定ページ
 */
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

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
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded transition-colors
                    ${activeTab === tab.id
                      ? 'bg-accent-muted text-accent'
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
            <div className="w-16 h-16 rounded-full bg-accent-muted flex items-center justify-center">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      {/* ダイアログ */}
      <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-warning-muted flex items-center justify-center">
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
          ? 'border-accent bg-accent-muted/30'
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
          className="btn btn-ghost btn-sm text-danger hover:bg-danger-muted"
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

/**
 * セキュリティ設定
 */
function SecuritySettings() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'single' | 'all';
    sessionId?: string;
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
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

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

  // 確認ダイアログを開く
  const openConfirmDialog = (type: 'single' | 'all', sessionId?: string) => {
    setConfirmDialog({ type, sessionId });
  };

  // 確認ダイアログを閉じる
  const closeConfirmDialog = () => {
    setConfirmDialog(null);
  };

  // 確認ダイアログで確定
  const handleConfirm = () => {
    if (confirmDialog?.type === 'single' && confirmDialog.sessionId) {
      handleRevokeSession(confirmDialog.sessionId);
    } else if (confirmDialog?.type === 'all') {
      handleRevokeAllSessions();
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-6">
      {/* 接続済みアカウント */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">接続済みアカウント</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-background-tertiary rounded">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-background flex items-center justify-center">
                <span className="text-xs font-medium">GH</span>
              </div>
              <span className="text-foreground">GitHub</span>
            </div>
            <span className="badge badge-success">接続済み</span>
          </div>
        </div>
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
              onClick={() => openConfirmDialog('all')}
              disabled={isRevokingAll}
            >
              {isRevokingAll && <Loader2 className="w-4 h-4 animate-spin" />}
              他のすべてのセッションを終了
            </button>
          )}
        </div>

        {isLoading ? (
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
                  onRevoke={(id) => openConfirmDialog('single', id)}
                  isRevoking={revokingSessionId === session.id}
                />
              ))}
          </div>
        )}
      </div>

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialog !== null}
        title={confirmDialog?.type === 'all' ? '他のすべてのセッションを終了' : 'セッションを終了'}
        message={
          confirmDialog?.type === 'all'
            ? '現在のセッション以外のすべてのセッションを終了します。他のデバイスからは再度ログインが必要になります。'
            : 'このセッションを終了します。該当デバイスからは再度ログインが必要になります。'
        }
        confirmLabel="終了する"
        onConfirm={handleConfirm}
        onCancel={closeConfirmDialog}
        isLoading={confirmDialog?.type === 'all' ? isRevokingAll : revokingSessionId !== null}
      />
    </div>
  );
}

/**
 * APIトークン設定
 */
function ApiTokenSettings() {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">APIトークン</h2>
      <p className="text-foreground-muted mb-4">
        MCPサーバーやCI/CDパイプラインからアクセスするためのAPIトークンを管理します。
      </p>
      <button className="btn btn-primary">
        <Key className="w-4 h-4" />
        新しいトークンを生成
      </button>
    </div>
  );
}
