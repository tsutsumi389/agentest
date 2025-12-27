import { Link } from 'react-router';
import { Building2, Users, Settings, Crown, Shield, User } from 'lucide-react';
import type { Organization } from '../../lib/api';

interface OrganizationCardProps {
  organization: Organization;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  onSelect?: () => void;
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
export function OrganizationCard({ organization, role, onSelect }: OrganizationCardProps) {
  const RoleIcon = getRoleIcon(role);

  return (
    <div className="bg-background-secondary border border-border rounded-lg p-4 hover:border-accent transition-colors">
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-foreground-muted" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{organization.name}</h3>
            <p className="text-sm text-foreground-muted">/{organization.slug}</p>
          </div>
        </div>

        {/* ロールバッジ */}
        <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-background-tertiary text-foreground-secondary">
          <RoleIcon className="w-3 h-3" />
          <span>{getRoleLabel(role)}</span>
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
          <Users className="w-4 h-4" />
          <span>{organization.plan}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* 設定リンク（OWNER/ADMINのみ） */}
          {(role === 'OWNER' || role === 'ADMIN') && (
            <Link
              to={`/organizations/${organization.id}/settings`}
              className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
              title="組織設定"
            >
              <Settings className="w-4 h-4" />
            </Link>
          )}

          {/* 選択ボタン */}
          <button
            onClick={onSelect}
            className="px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-subtle rounded transition-colors"
          >
            選択
          </button>
        </div>
      </div>
    </div>
  );
}
