import { Filter, X } from 'lucide-react';
import type { AdminOrganizationStatus } from '@agentest/shared/types';

interface OrganizationFiltersProps {
  plan: ('TEAM' | 'ENTERPRISE')[];
  status: AdminOrganizationStatus;
  createdFrom: string;
  createdTo: string;
  onPlanChange: (plan: ('TEAM' | 'ENTERPRISE')[]) => void;
  onStatusChange: (status: AdminOrganizationStatus) => void;
  onCreatedFromChange: (date: string) => void;
  onCreatedToChange: (date: string) => void;
  onClear: () => void;
}

/**
 * 組織フィルターUI
 */
export function OrganizationFilters({
  plan,
  status,
  createdFrom,
  createdTo,
  onPlanChange,
  onStatusChange,
  onCreatedFromChange,
  onCreatedToChange,
  onClear,
}: OrganizationFiltersProps) {
  // フィルターがアクティブか判定
  const hasActiveFilters =
    plan.length > 0 ||
    status !== 'active' ||
    createdFrom !== '' ||
    createdTo !== '';

  // プランをトグル
  const togglePlan = (p: 'TEAM' | 'ENTERPRISE') => {
    if (plan.includes(p)) {
      onPlanChange(plan.filter((x) => x !== p));
    } else {
      onPlanChange([...plan, p]);
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
        {/* プランフィルター */}
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">プラン</label>
          <div className="flex gap-2">
            <button
              onClick={() => togglePlan('TEAM')}
              className={`px-3 py-1 text-sm rounded border ${
                plan.includes('TEAM')
                  ? 'bg-accent-muted text-accent border-accent'
                  : 'bg-background-secondary text-foreground-muted border-border hover:border-foreground-muted'
              }`}
            >
              TEAM
            </button>
            <button
              onClick={() => togglePlan('ENTERPRISE')}
              className={`px-3 py-1 text-sm rounded border ${
                plan.includes('ENTERPRISE')
                  ? 'bg-accent-muted text-accent border-accent'
                  : 'bg-background-secondary text-foreground-muted border-border hover:border-foreground-muted'
              }`}
            >
              ENTERPRISE
            </button>
          </div>
        </div>

        {/* ステータスフィルター */}
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">ステータス</label>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as AdminOrganizationStatus)}
            className="px-3 py-1 text-sm bg-background-secondary border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="active">アクティブ</option>
            <option value="deleted">削除済み</option>
            <option value="all">すべて</option>
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
