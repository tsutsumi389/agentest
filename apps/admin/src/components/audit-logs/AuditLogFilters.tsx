import { Filter, X } from 'lucide-react';
import { ADMIN_AUDIT_LOG_CATEGORIES, type AdminAuditLogCategory } from '@agentest/shared/types';
import { CATEGORY_LABELS } from '../../lib/audit-log-utils';

interface AuditLogFiltersProps {
  category: AdminAuditLogCategory[];
  organizationId: string;
  userId: string;
  startDate: string;
  endDate: string;
  onCategoryChange: (category: AdminAuditLogCategory[]) => void;
  onOrganizationIdChange: (id: string) => void;
  onUserIdChange: (id: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear: () => void;
}

/**
 * 監査ログフィルターUI
 */
export function AuditLogFilters({
  category,
  organizationId,
  userId,
  startDate,
  endDate,
  onCategoryChange,
  onOrganizationIdChange,
  onUserIdChange,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: AuditLogFiltersProps) {
  // フィルターがアクティブか判定
  const hasActiveFilters =
    category.length > 0 ||
    organizationId !== '' ||
    userId !== '' ||
    startDate !== '' ||
    endDate !== '';

  // カテゴリをトグル
  const toggleCategory = (cat: AdminAuditLogCategory) => {
    if (category.includes(cat)) {
      onCategoryChange(category.filter((x) => x !== cat));
    } else {
      onCategoryChange([...category, cat]);
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
        {/* カテゴリフィルター */}
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">カテゴリ</label>
          <div className="flex flex-wrap gap-2">
            {ADMIN_AUDIT_LOG_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1 text-xs rounded border ${
                  category.includes(cat)
                    ? 'bg-accent-muted text-accent border-accent'
                    : 'bg-background-secondary text-foreground-muted border-border hover:border-foreground-muted'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {/* 組織IDフィルター */}
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">組織ID</label>
          <input
            type="text"
            value={organizationId}
            onChange={(e) => onOrganizationIdChange(e.target.value)}
            placeholder="UUID..."
            className="px-3 py-1 text-sm bg-background-secondary border border-border rounded text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent w-48"
          />
        </div>

        {/* ユーザーIDフィルター */}
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">ユーザーID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => onUserIdChange(e.target.value)}
            placeholder="UUID..."
            className="px-3 py-1 text-sm bg-background-secondary border border-border rounded text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent w-48"
          />
        </div>

        {/* 日時フィルター */}
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">日時</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate ? startDate.split('T')[0] : ''}
              onChange={(e) =>
                onStartDateChange(e.target.value ? `${e.target.value}T00:00:00Z` : '')
              }
              className="px-2 py-1 text-sm bg-background-secondary border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <span className="text-foreground-muted">〜</span>
            <input
              type="date"
              value={endDate ? endDate.split('T')[0] : ''}
              onChange={(e) => onEndDateChange(e.target.value ? `${e.target.value}T23:59:59Z` : '')}
              className="px-2 py-1 text-sm bg-background-secondary border border-border rounded text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
