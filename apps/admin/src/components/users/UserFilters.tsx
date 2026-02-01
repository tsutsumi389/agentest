import { Filter, X } from 'lucide-react';
import type { AdminUserStatus } from '@agentest/shared/types';

interface UserFiltersProps {
  plan: ('FREE' | 'PRO')[];
  status: AdminUserStatus;
  createdFrom: string;
  createdTo: string;
  onPlanChange: (plan: ('FREE' | 'PRO')[]) => void;
  onStatusChange: (status: AdminUserStatus) => void;
  onCreatedFromChange: (date: string) => void;
  onCreatedToChange: (date: string) => void;
  onClear: () => void;
}

/**
 * ユーザーフィルターUI
 */
export function UserFilters({
  plan,
  status,
  createdFrom,
  createdTo,
  onPlanChange,
  onStatusChange,
  onCreatedFromChange,
  onCreatedToChange,
  onClear,
}: UserFiltersProps) {
  // フィルターがアクティブか判定
  const hasActiveFilters =
    plan.length > 0 ||
    status !== 'active' ||
    createdFrom !== '' ||
    createdTo !== '';

  // プランをトグル
  const togglePlan = (p: 'FREE' | 'PRO') => {
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
              onClick={() => togglePlan('FREE')}
              className={`px-3 py-1 text-sm rounded border ${
                plan.includes('FREE')
                  ? 'bg-accent-muted text-accent border-accent'
                  : 'bg-background-secondary text-foreground-muted border-border hover:border-foreground-muted'
              }`}
            >
              FREE
            </button>
            <button
              onClick={() => togglePlan('PRO')}
              className={`px-3 py-1 text-sm rounded border ${
                plan.includes('PRO')
                  ? 'bg-accent-muted text-accent border-accent'
                  : 'bg-background-secondary text-foreground-muted border-border hover:border-foreground-muted'
              }`}
            >
              PRO
            </button>
          </div>
        </div>

        {/* ステータスフィルター */}
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">ステータス</label>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as AdminUserStatus)}
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
