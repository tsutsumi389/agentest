import { Link } from 'react-router';
import { Building2, Users, Settings, Crown, Shield, User, RotateCcw } from 'lucide-react';
import { DELETION_GRACE_PERIOD_DAYS } from '@agentest/shared';
import type { Organization } from '../../lib/api';

/**
 * 削除済み組織の残り日数を計算
 */
function getRemainingDays(deletedAt: string): number {
  const deletionDate = new Date(deletedAt);
  const permanentDeletionDate = new Date(deletionDate);
  permanentDeletionDate.setDate(permanentDeletionDate.getDate() + DELETION_GRACE_PERIOD_DAYS);

  const now = new Date();
  const remainingMs = permanentDeletionDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
}

interface OrganizationCardProps {
  organization: Organization;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  onSelect?: () => void;
  onRestore?: () => void;
  isRestoring?: boolean;
}

/**
 * ロールに応じたアイコンを返す
 */
function getRoleIcon(role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  switch (role) {
    case 'OWNER':
      return Crown;
    case 'ADMIN':
      return Shield;
    case 'MEMBER':
      return User;
  }
}

/**
 * ロールに応じたラベルを返す
 */
function getRoleLabel(role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  switch (role) {
    case 'OWNER':
      return 'オーナー';
    case 'ADMIN':
      return '管理者';
    case 'MEMBER':
      return 'メンバー';
  }
}

/**
 * 組織カード
 * 組織一覧で各組織を表示するカード
 */
export function OrganizationCard({
  organization,
  role,
  onSelect,
  onRestore,
  isRestoring,
}: OrganizationCardProps) {
  const RoleIcon = getRoleIcon(role);
  const isDeleted = !!organization.deletedAt;
  const remainingDays = isDeleted ? getRemainingDays(organization.deletedAt!) : null;

  return (
    <div
      className={`bg-background-secondary border border-border rounded-lg p-4 transition-colors ${
        isDeleted ? 'opacity-60' : 'hover:border-accent'
      }`}
    >
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-foreground-muted" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{organization.name}</h3>
          </div>
        </div>

        {/* ロールバッジと削除予定バッジ */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-background-tertiary text-foreground-secondary">
            <RoleIcon className="w-3 h-3" aria-hidden="true" />
            <span>{getRoleLabel(role)}</span>
          </div>
          {isDeleted && remainingDays !== null && (
            <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-danger/10 text-danger">
              <span>削除予定 {remainingDays === 0 ? '本日中' : `あと${remainingDays}日`}</span>
            </div>
          )}
        </div>
      </div>

      {/* 説明 */}
      {organization.description && (
        <p className="text-sm text-foreground-secondary mb-3 line-clamp-2">
          {organization.description}
        </p>
      )}

      {/* フッター */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-sm text-foreground-muted">
          <Users className="w-4 h-4" aria-hidden="true" />
          <span>{organization._count?.members ?? 0} メンバー</span>
        </div>

        <div className="flex items-center gap-2">
          {isDeleted ? (
            // 削除済み組織の場合は復元ボタンを表示（OWNERのみ）
            role === 'OWNER' &&
            onRestore && (
              <button
                onClick={onRestore}
                disabled={isRestoring}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-success hover:bg-success/10 rounded transition-colors disabled:opacity-50"
                aria-label={`${organization.name}を復元`}
              >
                <RotateCcw
                  className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {isRestoring ? '復元中...' : '復元'}
              </button>
            )
          ) : (
            <>
              {/* 設定リンク（OWNER/ADMINのみ） */}
              {(role === 'OWNER' || role === 'ADMIN') && (
                <Link
                  to={`/organizations/${organization.id}/settings`}
                  className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
                  aria-label="組織設定"
                >
                  <Settings className="w-4 h-4" aria-hidden="true" />
                </Link>
              )}

              {/* 選択ボタン */}
              <button
                onClick={onSelect}
                className="px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-subtle rounded transition-colors"
              >
                選択
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
