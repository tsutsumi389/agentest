import { Filter, X } from 'lucide-react';
import type { SystemAdminRole, SystemAdminStatus } from '@agentest/shared/types';

interface SystemAdminFiltersProps {
  role: SystemAdminRole[];
  status: SystemAdminStatus;
  totpEnabled: boolean | undefined;
  createdFrom: string;
  createdTo: string;
  onRoleChange: (role: SystemAdminRole[]) => void;
  onStatusChange: (status: SystemAdminStatus) => void;
  onTotpEnabledChange: (enabled: boolean | undefined) => void;
  onCreatedFromChange: (date: string) => void;
  onCreatedToChange: (date: string) => void;
  onClear: () => void;
}

const roles: SystemAdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'VIEWER'];

/**
 * システム管理者フィルターUI
 */
export function SystemAdminFilters({
  role,
  status,
  totpEnabled,
  createdFrom,
  createdTo,
  onRoleChange,
  onStatusChange,
  onTotpEnabledChange,
  onCreatedFromChange,
  onCreatedToChange,
  onClear,
}: SystemAdminFiltersProps) {
  // フィルターがアクティブか判定
  const hasActiveFilters =
    role.length > 0 ||
    status !== 'active' ||
    totpEnabled !== undefined ||
    createdFrom !== '' ||
    createdTo !== '';

  // ロールをトグル
  const toggleRole = (r: SystemAdminRole) => {
    if (role.includes(r)) {
      onRoleChange(role.filter((x) => x !== r));
    } else {
      onRoleChange([...role, r]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Filter className="w-4 h-4" />
          <span>フィルター</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
          >
            <X className="w-4 h-4" />
            クリア
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        {/* ロールフィルター */}
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">ロール</label>
          <div className="flex gap-2">
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => toggleRole(r)}
                className={`px-3 py-1 text-sm rounded border ${
                  role.includes(r)
                    ? 'bg-accent-muted text-accent border-accent'
                    : 'bg-background-secondary text-foreground-muted border-border hover:border-foreground-muted'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* ステータスフィルター */}
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">ステータス</label>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as SystemAdminStatus)}
            className="px-3 py-1 text-sm bg-background-secondary border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="active">有効</option>
            <option value="deleted">削除済み</option>
            <option value="locked">ロック中</option>
            <option value="all">すべて</option>
          </select>
        </div>

        {/* 2FAフィルター */}
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">2FA</label>
          <select
            value={totpEnabled === undefined ? '' : String(totpEnabled)}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '') {
                onTotpEnabledChange(undefined);
              } else {
                onTotpEnabledChange(value === 'true');
              }
            }}
            className="px-3 py-1 text-sm bg-background-secondary border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">すべて</option>
            <option value="true">有効</option>
            <option value="false">無効</option>
          </select>
        </div>

        {/* 登録日フィルター */}
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">登録日</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={createdFrom ? createdFrom.split('T')[0] : ''}
              onChange={(e) =>
                onCreatedFromChange(e.target.value ? `${e.target.value}T00:00:00Z` : '')
              }
              className="px-2 py-1 text-sm bg-background-secondary border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <span className="text-foreground-muted">〜</span>
            <input
              type="date"
              value={createdTo ? createdTo.split('T')[0] : ''}
              onChange={(e) =>
                onCreatedToChange(e.target.value ? `${e.target.value}T23:59:59Z` : '')
              }
              className="px-2 py-1 text-sm bg-background-secondary border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
