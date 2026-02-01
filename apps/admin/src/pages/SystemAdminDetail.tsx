import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, Shield, ShieldCheck, ShieldX, Monitor, History, Unlock, KeyRound, Trash2 } from 'lucide-react';
import { useSystemAdmin, useDeleteSystemAdmin, useUnlockSystemAdmin, useReset2FASystemAdmin } from '../hooks/useSystemAdmins';
import { SystemAdminRoleBadge } from '../components/system-admins';
import { formatDate, formatRelativeTime } from '../lib/date-utils';
import { useAdminAuthStore } from '../stores/admin-auth.store';

/**
 * システム管理者詳細ページ
 */
export function SystemAdminDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentAdmin = useAdminAuthStore((state) => state.admin);

  // SUPER_ADMIN権限チェック
  const isSuperAdmin = currentAdmin?.role === 'SUPER_ADMIN';

  // データ取得
  const { data, isLoading, error } = useSystemAdmin(id || '');

  // ミューテーション
  const deleteMutation = useDeleteSystemAdmin();
  const unlockMutation = useUnlockSystemAdmin();
  const reset2FAMutation = useReset2FASystemAdmin();

  // 削除処理
  const handleDelete = async () => {
    if (!data?.adminUser) return;
    if (!confirm(`"${data.adminUser.name}" を削除しますか？`)) return;
    try {
      await deleteMutation.mutateAsync(data.adminUser.id);
      navigate('/system-admins');
    } catch {
      // エラーはミューテーションフックで処理
    }
  };

  // ロック解除処理
  const handleUnlock = async () => {
    if (!data?.adminUser) return;
    if (!confirm(`"${data.adminUser.name}" のロックを解除しますか？`)) return;
    try {
      await unlockMutation.mutateAsync(data.adminUser.id);
    } catch {
      // エラーはミューテーションフックで処理
    }
  };

  // 2FAリセット処理
  const handleReset2FA = async () => {
    if (!data?.adminUser) return;
    if (!confirm(`"${data.adminUser.name}" の2FA設定をリセットしますか？`)) return;
    try {
      await reset2FAMutation.mutateAsync(data.adminUser.id);
    } catch {
      // エラーはミューテーションフックで処理
    }
  };

  // SUPER_ADMIN権限がない場合はアクセス拒否
  if (!isSuperAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <Shield className="w-12 h-12 mx-auto text-foreground-muted mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">
            アクセス権限がありません
          </h1>
          <p className="text-foreground-muted">
            このページはSUPER_ADMIN権限が必要です。
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-foreground-muted py-12">
          読み込み中...
        </div>
      </div>
    );
  }

  if (error || !data?.adminUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            管理者が見つかりません
          </h1>
          <Link to="/system-admins" className="text-accent hover:underline">
            一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  const admin = data.adminUser;
  const isLocked = admin.lockedUntil && new Date(admin.lockedUntil) > new Date();
  const isSelf = admin.id === currentAdmin?.id;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/system-admins"
              className="p-2 text-foreground-muted hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent-muted flex items-center justify-center">
                <span className="text-xl font-semibold text-accent">
                  {admin.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{admin.name}</h1>
                  <SystemAdminRoleBadge role={admin.role} />
                  {admin.totpEnabled ? (
                    <span title="2FA有効">
                      <ShieldCheck className="w-5 h-5 text-success" aria-label="2FA有効" />
                    </span>
                  ) : (
                    <span title="2FA無効">
                      <ShieldX className="w-5 h-5 text-foreground-muted" aria-label="2FA無効" />
                    </span>
                  )}
                </div>
                <p className="text-foreground-muted">{admin.email}</p>
              </div>
            </div>
          </div>

          {/* 操作ボタン */}
          {!admin.deletedAt && !isSelf && (
            <div className="flex items-center gap-2">
              {isLocked && (
                <button
                  onClick={handleUnlock}
                  disabled={unlockMutation.isPending}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  ロック解除
                </button>
              )}
              {admin.totpEnabled && (
                <button
                  onClick={handleReset2FA}
                  disabled={reset2FAMutation.isPending}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  2FAリセット
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="btn btn-error flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                削除
              </button>
            </div>
          )}
        </div>

        {/* ステータス表示 */}
        {(admin.deletedAt || isLocked) && (
          <div className={`p-4 rounded-lg ${admin.deletedAt ? 'bg-error/10 border border-error/30' : 'bg-warning/10 border border-warning/30'}`}>
            {admin.deletedAt ? (
              <p className="text-error">
                このアカウントは {formatDate(admin.deletedAt)} に削除されました。
              </p>
            ) : isLocked ? (
              <p className="text-warning">
                このアカウントは {formatDate(admin.lockedUntil!)} までロックされています。
                ログイン失敗回数: {admin.failedAttempts}回
              </p>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 基本情報 */}
          <div className="bg-background-secondary border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">基本情報</h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-foreground-muted">メールアドレス</dt>
                <dd className="text-foreground">{admin.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-foreground-muted">登録日</dt>
                <dd className="text-foreground">{formatDate(admin.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-sm text-foreground-muted">更新日</dt>
                <dd className="text-foreground">{formatDate(admin.updatedAt)}</dd>
              </div>
            </dl>
          </div>

          {/* アクティビティ */}
          <div className="bg-background-secondary border border-border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-5 h-5 text-foreground-muted" />
              <h2 className="text-lg font-semibold text-foreground">アクティビティ</h2>
            </div>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-foreground-muted">最終ログイン</dt>
                <dd className="text-foreground">
                  {admin.activity.lastLoginAt
                    ? formatRelativeTime(admin.activity.lastLoginAt)
                    : 'なし'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-foreground-muted">アクティブセッション数</dt>
                <dd className="text-foreground">{admin.activity.activeSessionCount}</dd>
              </div>
            </dl>

            {/* 現在のセッション一覧 */}
            {admin.activity.currentSessions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-foreground-muted mb-3">
                  現在のセッション
                </h3>
                <div className="space-y-2">
                  {admin.activity.currentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-3 bg-background border border-border rounded-lg text-sm"
                    >
                      <div className="text-foreground truncate" title={session.userAgent || ''}>
                        {session.userAgent?.substring(0, 50) || '不明なブラウザ'}...
                      </div>
                      <div className="text-foreground-muted mt-1">
                        {session.ipAddress || '不明なIP'} · {formatRelativeTime(session.lastActiveAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 監査ログ */}
        <div className="bg-background-secondary border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-foreground-muted" />
            <h2 className="text-lg font-semibold text-foreground">最近の操作履歴</h2>
          </div>
          {admin.recentAuditLogs.length === 0 ? (
            <p className="text-foreground-muted">操作履歴はありません</p>
          ) : (
            <div className="space-y-2">
              {admin.recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-background border border-border rounded-lg"
                >
                  <div>
                    <span className="text-foreground font-medium">{log.action}</span>
                    {log.targetType && (
                      <span className="text-foreground-muted ml-2">
                        {log.targetType}
                        {log.targetId && `: ${log.targetId.substring(0, 8)}...`}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-foreground-muted">
                    {log.ipAddress && <span className="mr-2">{log.ipAddress}</span>}
                    {formatRelativeTime(log.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
