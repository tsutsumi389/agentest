import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, MoreVertical, UserMinus, Shield, User, Crown, X, AlertTriangle } from 'lucide-react';
import { organizationsApi, ApiError, type OrganizationMember } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';

interface MemberListProps {
  /** 組織ID */
  organizationId: string;
  /** 現在のユーザーのロール */
  currentRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
}

/**
 * ロールの表示名
 */
const ROLE_LABELS: Record<string, string> = {
  OWNER: 'オーナー',
  ADMIN: '管理者',
  MEMBER: 'メンバー',
};

/**
 * ロールのアイコン
 */
function RoleIcon({ role, className }: { role: string; className?: string }) {
  switch (role) {
    case 'OWNER':
      return <Crown className={className} />;
    case 'ADMIN':
      return <Shield className={className} />;
    default:
      return <User className={className} />;
  }
}

/**
 * 日付フォーマット
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
  isDanger = true,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  isDanger?: boolean;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // ESCキーでモーダルを閉じる + フォーカストラップ
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // フォーカスをダイアログに移動
    cancelButtonRef.current?.focus();

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      {/* ダイアログ */}
      <div
        ref={modalRef}
        className="relative bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4 p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            isDanger ? 'bg-danger-subtle' : 'bg-warning-subtle'
          }`}>
            <AlertTriangle className={`w-5 h-5 ${isDanger ? 'text-danger' : 'text-warning'}`} />
          </div>
          <div className="flex-1">
            <h3 id="confirm-dialog-title" className="text-lg font-semibold text-foreground">
              {title}
            </h3>
            <p className="text-sm text-foreground-muted mt-1">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 text-foreground-subtle hover:text-foreground"
            disabled={isLoading}
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            ref={cancelButtonRef}
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            キャンセル
          </button>
          <button
            className={isDanger ? 'btn btn-danger' : 'btn btn-primary'}
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
 * ロール変更ドロップダウン
 */
function RoleDropdown({
  member,
  currentRole,
  currentUserId,
  onRoleChange,
  onRemove,
  isUpdating,
}: {
  member: OrganizationMember;
  currentRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
  currentUserId?: string;
  onRoleChange: (userId: string, newRole: 'ADMIN' | 'MEMBER') => void;
  onRemove: (userId: string) => void;
  isUpdating: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // オーナーはロール変更・削除できない
  const isOwner = member.role === 'OWNER';
  // 自分自身は変更できない
  const isSelf = member.userId === currentUserId;
  // ADMINはオーナーの操作はできない（自分の変更もできない）
  const canManage = currentRole === 'OWNER' || (currentRole === 'ADMIN' && !isOwner && !isSelf);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ESCキーで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!canManage) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
        disabled={isUpdating}
        aria-label="メンバー操作メニュー"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {isUpdating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MoreVertical className="w-4 h-4" />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-lg shadow-lg py-1 z-dropdown"
          role="menu"
        >
          {/* ロール変更オプション */}
          {member.role !== 'ADMIN' && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
              onClick={() => {
                onRoleChange(member.userId, 'ADMIN');
                setIsOpen(false);
              }}
              role="menuitem"
            >
              <Shield className="w-4 h-4" />
              管理者に変更
            </button>
          )}
          {member.role !== 'MEMBER' && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
              onClick={() => {
                onRoleChange(member.userId, 'MEMBER');
                setIsOpen(false);
              }}
              role="menuitem"
            >
              <User className="w-4 h-4" />
              メンバーに変更
            </button>
          )}

          {/* 区切り線 */}
          <div className="border-t border-border my-1" />

          {/* メンバー削除 */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-subtle transition-colors"
            onClick={() => {
              onRemove(member.userId);
              setIsOpen(false);
            }}
            role="menuitem"
          >
            <UserMinus className="w-4 h-4" />
            メンバーを削除
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * メンバー一覧コンポーネント
 */
export function MemberList({ organizationId, currentRole }: MemberListProps) {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // 確認ダイアログ状態
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'remove' | 'role-change';
    userId: string;
    userName: string;
    newRole?: 'ADMIN' | 'MEMBER';
  } | null>(null);

  // メンバー一覧を取得
  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await organizationsApi.getMembers(organizationId);
      // オーナーを先頭に、次にADMIN、最後にMEMBERでソート
      const sortedMembers = response.members.sort((a, b) => {
        const roleOrder = { OWNER: 0, ADMIN: 1, MEMBER: 2 };
        return roleOrder[a.role] - roleOrder[b.role];
      });
      setMembers(sortedMembers);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('メンバー一覧の取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // ロール変更のリクエスト
  const requestRoleChange = (userId: string, newRole: 'ADMIN' | 'MEMBER') => {
    const member = members.find((m) => m.userId === userId);
    if (!member) return;

    setConfirmDialog({
      type: 'role-change',
      userId,
      userName: member.user.name,
      newRole,
    });
  };

  // メンバー削除のリクエスト
  const requestRemove = (userId: string) => {
    const member = members.find((m) => m.userId === userId);
    if (!member) return;

    setConfirmDialog({
      type: 'remove',
      userId,
      userName: member.user.name,
    });
  };

  // ロール変更を実行
  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'MEMBER') => {
    setUpdatingUserId(userId);

    try {
      const response = await organizationsApi.updateMemberRole(organizationId, userId, newRole);
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === userId ? { ...m, role: response.member.role } : m
        ).sort((a, b) => {
          const roleOrder = { OWNER: 0, ADMIN: 1, MEMBER: 2 };
          return roleOrder[a.role] - roleOrder[b.role];
        })
      );
      toast.success('ロールを変更しました');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('ロールの変更に失敗しました');
      }
    } finally {
      setUpdatingUserId(null);
      setConfirmDialog(null);
    }
  };

  // メンバー削除を実行
  const handleRemove = async (userId: string) => {
    setUpdatingUserId(userId);

    try {
      await organizationsApi.removeMember(organizationId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast.success('メンバーを削除しました');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('メンバーの削除に失敗しました');
      }
    } finally {
      setUpdatingUserId(null);
      setConfirmDialog(null);
    }
  };

  // 確認ダイアログで確定
  const handleConfirm = () => {
    if (!confirmDialog) return;

    if (confirmDialog.type === 'remove') {
      handleRemove(confirmDialog.userId);
    } else if (confirmDialog.type === 'role-change' && confirmDialog.newRole) {
      handleRoleChange(confirmDialog.userId, confirmDialog.newRole);
    }
  };

  if (isLoading) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">メンバー管理</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">メンバー管理</h2>
        <div className="text-center py-8">
          <p className="text-danger mb-4">{error}</p>
          <button className="btn btn-primary" onClick={fetchMembers}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">メンバー管理</h2>
        <span className="text-sm text-foreground-muted">
          {members.length}人のメンバー
        </span>
      </div>

      {members.length === 0 ? (
        <p className="text-center text-foreground-muted py-8">
          メンバーがいません
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* アバター */}
                {member.user.avatarUrl ? (
                  <img
                    src={member.user.avatarUrl}
                    alt={member.user.name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent-subtle flex items-center justify-center">
                    <span className="text-sm font-medium text-accent">
                      {member.user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}

                {/* ユーザー情報 */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {member.user.name}
                    </span>
                    {member.userId === user?.id && (
                      <span className="badge badge-accent text-xs">あなた</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground-muted truncate">
                    {member.user.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* ロールバッジ */}
                <div className="flex items-center gap-1.5">
                  <RoleIcon
                    role={member.role}
                    className={`w-4 h-4 ${
                      member.role === 'OWNER'
                        ? 'text-warning'
                        : member.role === 'ADMIN'
                        ? 'text-accent'
                        : 'text-foreground-muted'
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      member.role === 'OWNER'
                        ? 'text-warning'
                        : member.role === 'ADMIN'
                        ? 'text-accent'
                        : 'text-foreground-muted'
                    }`}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>

                {/* 参加日（デスクトップのみ） */}
                <span className="hidden md:block text-sm text-foreground-subtle min-w-[100px] text-right">
                  {formatDate(member.joinedAt)}
                </span>

                {/* アクションメニュー */}
                <RoleDropdown
                  member={member}
                  currentRole={currentRole}
                  currentUserId={user?.id}
                  onRoleChange={requestRoleChange}
                  onRemove={requestRemove}
                  isUpdating={updatingUserId === member.userId}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialog !== null}
        title={
          confirmDialog?.type === 'remove'
            ? 'メンバーを削除'
            : 'ロールを変更'
        }
        message={
          confirmDialog?.type === 'remove'
            ? `${confirmDialog.userName} を組織から削除しますか？この操作は取り消せません。`
            : `${confirmDialog?.userName} のロールを${
                confirmDialog?.newRole === 'ADMIN' ? '管理者' : 'メンバー'
              }に変更しますか？`
        }
        confirmLabel={confirmDialog?.type === 'remove' ? '削除する' : '変更する'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmDialog(null)}
        isLoading={updatingUserId !== null}
        isDanger={confirmDialog?.type === 'remove'}
      />
    </div>
  );
}
