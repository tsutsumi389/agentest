import { useState, useEffect, useCallback } from 'react';
import { Loader2, Copy, Check, X, Plus, Clock, Shield, User, Mail } from 'lucide-react';
import { organizationsApi, ApiError, type OrganizationInvitation } from '../../lib/api';
import { toast } from '../../stores/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { InviteMemberModal } from './InviteMemberModal';
import { formatDate } from '../../lib/date';
import { getInvitationUrl } from '../../lib/url';

interface InvitationListProps {
  /** 組織ID */
  organizationId: string;
  /** 現在のユーザーのロール */
  currentRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
}

/**
 * ロールの表示名
 */
const ROLE_LABELS: Record<'ADMIN' | 'MEMBER', string> = {
  ADMIN: '管理者',
  MEMBER: 'メンバー',
};

/**
 * 有効期限の状態を判定
 */
function getExpirationStatus(expiresAt: string): 'expired' | 'expiring-soon' | 'valid' {
  const expiration = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiration.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs <= 0) {
    return 'expired';
  } else if (diffHours <= 24) {
    return 'expiring-soon';
  }
  return 'valid';
}

/**
 * 招待一覧コンポーネント
 */
export function InvitationList({ organizationId, currentRole }: InvitationListProps) {
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // モーダル状態
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // 取消確認ダイアログ状態
  const [cancelDialog, setCancelDialog] = useState<{
    invitationId: string;
    email: string;
  } | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);

  // コピー状態（招待IDごとに管理）
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 招待一覧を取得
  const fetchInvitations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await organizationsApi.getInvitations(organizationId);
      // 有効期限が近いものを先頭に、その後作成日順でソート
      const sorted = response.invitations.sort((a, b) => {
        const statusA = getExpirationStatus(a.expiresAt);
        const statusB = getExpirationStatus(b.expiresAt);
        // 期限切れを先頭に
        if (statusA === 'expired' && statusB !== 'expired') return -1;
        if (statusA !== 'expired' && statusB === 'expired') return 1;
        // 期限間近を次に
        if (statusA === 'expiring-soon' && statusB === 'valid') return -1;
        if (statusA === 'valid' && statusB === 'expiring-soon') return 1;
        // 同じステータスなら作成日の新しい順
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setInvitations(sorted);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('招待一覧の取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // 招待を取消
  const handleCancelInvitation = async () => {
    if (!cancelDialog) return;

    setIsCanceling(true);

    try {
      await organizationsApi.cancelInvitation(organizationId, cancelDialog.invitationId);
      setInvitations((prev) => prev.filter((inv) => inv.id !== cancelDialog.invitationId));
      toast.success('招待を取り消しました');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('招待の取り消しに失敗しました');
      }
    } finally {
      setIsCanceling(false);
      setCancelDialog(null);
    }
  };

  // コピー状態のリセット（クリーンアップ付き）
  useEffect(() => {
    if (copiedId) {
      const timer = setTimeout(() => {
        setCopiedId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedId]);

  // 招待リンクをコピー
  const handleCopyLink = async (invitation: OrganizationInvitation) => {
    const url = getInvitationUrl(invitation.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invitation.id);
      toast.success('招待リンクをコピーしました');
    } catch {
      toast.error('コピーに失敗しました');
    }
  };

  // 招待成功時のコールバック
  const handleInviteSuccess = (invitation: OrganizationInvitation) => {
    setInvitations((prev) => [invitation, ...prev]);
  };

  // OWNER/ADMINのみ招待可能
  const canInvite = currentRole === 'OWNER' || currentRole === 'ADMIN';

  if (isLoading) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">招待管理</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">招待管理</h2>
        <div className="text-center py-8">
          <p className="text-danger mb-4">{error}</p>
          <button className="btn btn-primary" onClick={fetchInvitations}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">招待管理</h2>
        {canInvite && (
          <button
            className="btn btn-primary"
            onClick={() => setIsInviteModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            メンバーを招待
          </button>
        )}
      </div>

      {invitations.length === 0 ? (
        <div className="text-center py-8">
          <Mail className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
          <p className="text-foreground-muted mb-4">
            保留中の招待はありません
          </p>
          {canInvite && (
            <button
              className="btn btn-secondary"
              onClick={() => setIsInviteModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              メンバーを招待
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {invitations.map((invitation) => {
            const expirationStatus = getExpirationStatus(invitation.expiresAt);
            const isExpired = expirationStatus === 'expired';

            return (
              <div
                key={invitation.id}
                className={`flex items-center justify-between p-3 rounded-lg border bg-background-secondary transition-colors ${
                  isExpired ? 'border-danger/30 opacity-60' : 'border-border hover:bg-background-tertiary'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* メールアイコン */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isExpired ? 'bg-danger-subtle' : 'bg-accent-subtle'
                  }`}>
                    <Mail className={`w-5 h-5 ${isExpired ? 'text-danger' : 'text-accent'}`} />
                  </div>

                  {/* 招待情報 */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {invitation.email}
                      </span>
                      {isExpired && (
                        <span className="badge badge-danger text-xs">期限切れ</span>
                      )}
                      {expirationStatus === 'expiring-soon' && (
                        <span className="badge badge-warning text-xs">まもなく期限切れ</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-foreground-muted">
                      <span className="flex items-center gap-1">
                        {invitation.role === 'ADMIN' ? (
                          <Shield className="w-3 h-3" />
                        ) : (
                          <User className="w-3 h-3" />
                        )}
                        {ROLE_LABELS[invitation.role]}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(invitation.expiresAt)}まで
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* リンクコピーボタン */}
                  {!isExpired && (
                    <button
                      onClick={() => handleCopyLink(invitation)}
                      className="p-2 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
                      aria-label="招待リンクをコピー"
                      title="招待リンクをコピー"
                    >
                      {copiedId === invitation.id ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {/* 取消ボタン */}
                  {canInvite && (
                    <button
                      onClick={() => setCancelDialog({
                        invitationId: invitation.id,
                        email: invitation.email,
                      })}
                      className="p-2 text-foreground-muted hover:text-danger hover:bg-danger-subtle rounded transition-colors"
                      aria-label="招待を取り消す"
                      title="招待を取り消す"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 招待者情報を表示するヘルパーテキスト */}
      {invitations.length > 0 && (
        <p className="text-xs text-foreground-subtle mt-4">
          招待は7日間有効です。期限が切れた招待は自動的に無効になります。
        </p>
      )}

      {/* 招待モーダル */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        organizationId={organizationId}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={handleInviteSuccess}
      />

      {/* 取消確認ダイアログ */}
      {cancelDialog && (
        <ConfirmDialog
          isOpen={true}
          title="招待を取り消す"
          message={`${cancelDialog.email} への招待を取り消しますか？この操作は取り消せません。`}
          confirmLabel="取り消す"
          onConfirm={handleCancelInvitation}
          onCancel={() => setCancelDialog(null)}
          isLoading={isCanceling}
          isDanger={true}
        />
      )}
    </div>
  );
}
