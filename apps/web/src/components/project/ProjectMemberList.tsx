import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, MoreVertical, UserMinus, Shield, Pencil, Eye, UserPlus } from 'lucide-react';
import { projectsApi, ApiError, type ProjectMember, type Project } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../stores/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { formatDate } from '../../lib/date';
import { AddProjectMemberModal } from './AddProjectMemberModal';

/** ロールの型定義 */
type MemberRole = 'ADMIN' | 'WRITE' | 'READ';

interface ProjectMemberListProps {
  /** プロジェクト */
  project: Project;
  /** 現在のユーザーのロール（オーナーの場合は 'OWNER'） */
  currentRole?: 'OWNER' | MemberRole;
}

/**
 * ロールの表示名
 */
const ROLE_LABELS: Record<MemberRole, string> = {
  ADMIN: '管理者',
  WRITE: '編集者',
  READ: '閲覧者',
};

/**
 * ロールのアイコン
 */
function RoleIcon({ role, className }: { role: MemberRole; className?: string }) {
  switch (role) {
    case 'ADMIN':
      return <Shield className={className} />;
    case 'WRITE':
      return <Pencil className={className} />;
    default:
      return <Eye className={className} />;
  }
}

/** ロールの優先順位（ソート用） */
const ROLE_ORDER: Record<MemberRole, number> = {
  ADMIN: 0,
  WRITE: 1,
  READ: 2,
};

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
  member: ProjectMember;
  currentRole?: 'OWNER' | MemberRole;
  currentUserId?: string;
  onRoleChange: (userId: string, newRole: MemberRole) => void;
  onRemove: (userId: string) => void;
  isUpdating: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 自分自身は変更できない
  const isSelf = member.userId === currentUserId;
  // ADMIN以上のみ操作可能
  const canManage = currentRole === 'OWNER' || currentRole === 'ADMIN';
  // 表示するかどうか
  const shouldRender = !isSelf && canManage;

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!isOpen || !shouldRender) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, shouldRender]);

  // ESCキーで閉じる
  useEffect(() => {
    if (!isOpen || !shouldRender) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, shouldRender]);

  // レンダリング不要な場合は何も表示しない
  if (!shouldRender) {
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
          {member.role !== 'WRITE' && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
              onClick={() => {
                onRoleChange(member.userId, 'WRITE');
                setIsOpen(false);
              }}
              role="menuitem"
            >
              <Pencil className="w-4 h-4" />
              編集者に変更
            </button>
          )}
          {member.role !== 'READ' && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
              onClick={() => {
                onRoleChange(member.userId, 'READ');
                setIsOpen(false);
              }}
              role="menuitem"
            >
              <Eye className="w-4 h-4" />
              閲覧者に変更
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
 * プロジェクトメンバー一覧コンポーネント
 */
export function ProjectMemberList({ project, currentRole }: ProjectMemberListProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 確認ダイアログ状態
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'remove' | 'role-change';
    userId: string;
    userName: string;
    newRole?: MemberRole;
  } | null>(null);

  // メンバー一覧を取得
  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await projectsApi.getMembers(project.id);
      // ADMINを先頭に、次にWRITE、最後にREADでソート
      const sortedMembers = response.members.sort((a, b) => {
        return ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
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
  }, [project.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // ロール変更のリクエスト
  const requestRoleChange = (userId: string, newRole: MemberRole) => {
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
  const handleRoleChange = async (userId: string, newRole: MemberRole) => {
    setUpdatingUserId(userId);

    try {
      const response = await projectsApi.updateMemberRole(project.id, userId, newRole);
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === userId ? { ...m, role: response.member.role } : m
        ).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
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
      await projectsApi.removeMember(project.id, userId);
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

  // メンバー追加後のコールバック
  const handleMemberAdded = (member: ProjectMember) => {
    setMembers((prev) => [...prev, member].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]));
  };

  // 管理権限があるか
  const canManageMembers = currentRole === 'OWNER' || currentRole === 'ADMIN';

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
        <div>
          <h2 className="text-lg font-semibold text-foreground">メンバー管理</h2>
          <p className="text-sm text-foreground-muted mt-1">
            {members.length}人のメンバー
          </p>
        </div>
        {canManageMembers && (
          <button
            className="btn btn-primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            <UserPlus className="w-4 h-4" />
            メンバーを追加
          </button>
        )}
      </div>

      {/* オーナー表示 */}
      {project.owner && (
        <div className="mb-4 p-3 rounded-lg border border-border bg-background-secondary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {project.owner.avatarUrl ? (
                <img
                  src={project.owner.avatarUrl}
                  alt={project.owner.name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-warning-subtle flex items-center justify-center">
                  <span className="text-sm font-medium text-warning">
                    {project.owner.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">
                    {project.owner.name}
                  </span>
                  {project.owner.id === user?.id && (
                    <span className="badge badge-accent text-xs">あなた</span>
                  )}
                </div>
                <p className="text-sm text-foreground-muted">オーナー</p>
              </div>
            </div>
            <span className="text-sm font-medium text-warning">オーナー</span>
          </div>
        </div>
      )}

      {/* メンバー一覧 */}
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
                      member.role === 'ADMIN'
                        ? 'text-accent'
                        : member.role === 'WRITE'
                        ? 'text-success'
                        : 'text-foreground-muted'
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      member.role === 'ADMIN'
                        ? 'text-accent'
                        : member.role === 'WRITE'
                        ? 'text-success'
                        : 'text-foreground-muted'
                    }`}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>

                {/* 追加日（デスクトップのみ） */}
                <span className="hidden md:block text-sm text-foreground-subtle min-w-[100px] text-right">
                  {formatDate(member.addedAt)}
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
      {confirmDialog && (
        <ConfirmDialog
          isOpen={true}
          title={confirmDialog.type === 'remove' ? 'メンバーを削除' : 'ロールを変更'}
          message={
            confirmDialog.type === 'remove'
              ? `${confirmDialog.userName} をプロジェクトから削除しますか？この操作は取り消せません。`
              : `${confirmDialog.userName} のロールを${
                  ROLE_LABELS[confirmDialog.newRole!]
                }に変更しますか？`
          }
          confirmLabel={confirmDialog.type === 'remove' ? '削除する' : '変更する'}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmDialog(null)}
          isLoading={updatingUserId !== null}
          isDanger={confirmDialog.type === 'remove'}
        />
      )}

      {/* メンバー追加モーダル */}
      <AddProjectMemberModal
        isOpen={isAddModalOpen}
        projectId={project.id}
        onClose={() => setIsAddModalOpen(false)}
        onMemberAdded={handleMemberAdded}
      />
    </div>
  );
}
