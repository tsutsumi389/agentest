import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import type { TestSuiteSearchParams } from '../../lib/api';

/**
 * ステータスオプション
 */
const STATUS_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'DRAFT', label: '下書き' },
  { value: 'ACTIVE', label: '有効' },
  { value: 'ARCHIVED', label: 'アーカイブ' },
] as const;

/**
 * ソートオプション
 */
const SORT_OPTIONS = [
  { value: 'createdAt', label: '作成日時' },
  { value: 'updatedAt', label: '更新日時' },
  { value: 'name', label: '名前' },
] as const;

/**
 * ソート順序オプション
 */
const SORT_ORDER_OPTIONS = [
  { value: 'desc', label: '降順' },
  { value: 'asc', label: '昇順' },
] as const;

interface TestSuiteSearchFilterProps {
  /**
   * 現在のフィルタ値
   */
  filters: TestSuiteSearchParams;
  /**
   * フィルタ変更時のコールバック
   */
  onFiltersChange: (filters: TestSuiteSearchParams) => void;
  /**
   * 検索結果の総件数（表示用）
   */
  totalCount?: number;
  /**
   * 管理者権限があるか（削除済み表示用）
   */
  isAdmin?: boolean;
}

/**
 * テストスイート検索・フィルタコンポーネント
 *
 * 検索ボックス、ステータスフィルタ、ソート順、削除済み表示オプションを提供
 */
export function TestSuiteSearchFilter({
  filters,
  onFiltersChange,
  totalCount,
  isAdmin = false,
}: TestSuiteSearchFilterProps) {
  const [searchInput, setSearchInput] = useState(filters.q || '');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // 検索入力のデバウンス
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.q) {
        onFiltersChange({ ...filters, q: searchInput || undefined, offset: 0 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters, onFiltersChange]);

  // 外側クリックでフィルタを閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ESCキーでフィルタを閉じる
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStatusChange = useCallback(
    (status: string) => {
      onFiltersChange({
        ...filters,
        status: status ? (status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED') : undefined,
        offset: 0,
      });
    },
    [filters, onFiltersChange]
  );

  const handleSortChange = useCallback(
    (sortBy: string) => {
      onFiltersChange({
        ...filters,
        sortBy: sortBy as 'name' | 'createdAt' | 'updatedAt',
        offset: 0,
      });
    },
    [filters, onFiltersChange]
  );

  const handleSortOrderChange = useCallback(
    (sortOrder: string) => {
      onFiltersChange({
        ...filters,
        sortOrder: sortOrder as 'asc' | 'desc',
        offset: 0,
      });
    },
    [filters, onFiltersChange]
  );

  const handleIncludeDeletedChange = useCallback(
    (checked: boolean) => {
      onFiltersChange({ ...filters, includeDeleted: checked, offset: 0 });
    },
    [filters, onFiltersChange]
  );

  const clearFilters = useCallback(() => {
    setSearchInput('');
    onFiltersChange({
      limit: filters.limit,
      offset: 0,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }, [filters.limit, onFiltersChange]);

  // アクティブなフィルタ数を計算
  const activeFilterCount = [
    filters.q,
    filters.status,
    filters.includeDeleted,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* 検索ボックス */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="テストスイートを検索..."
            className="input pl-10 pr-8"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* フィルタボタン */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`btn btn-secondary ${activeFilterCount > 0 ? 'border-accent' : ''}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            フィルタ
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent text-background rounded-full">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* フィルタドロップダウン */}
          {isFilterOpen && (
            <div className="absolute right-0 mt-2 w-72 card p-4 z-dropdown animate-fade-in">
              <div className="space-y-4">
                {/* ステータスフィルタ */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    ステータス
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleStatusChange(option.value)}
                        className={`px-3 py-1.5 text-sm rounded transition-colors ${
                          filters.status === option.value || (!filters.status && option.value === '')
                            ? 'bg-accent text-background'
                            : 'bg-background-tertiary text-foreground-muted hover:text-foreground'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ソート */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    並び順
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={filters.sortBy || 'createdAt'}
                      onChange={(e) => handleSortChange(e.target.value)}
                      className="input flex-1"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filters.sortOrder || 'desc'}
                      onChange={(e) => handleSortOrderChange(e.target.value)}
                      className="input w-24"
                    >
                      {SORT_ORDER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 削除済み表示（管理者のみ） */}
                {isAdmin && (
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.includeDeleted || false}
                        onChange={(e) => handleIncludeDeletedChange(e.target.checked)}
                        className="w-4 h-4 rounded border-border bg-background-secondary text-accent focus:ring-accent"
                      />
                      <span className="text-sm text-foreground">削除済みも表示</span>
                    </label>
                  </div>
                )}

                {/* フィルタクリア */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="w-full btn btn-ghost text-foreground-muted"
                  >
                    <X className="w-4 h-4" />
                    フィルタをクリア
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 結果件数とアクティブフィルタ表示 */}
      {(totalCount !== undefined || activeFilterCount > 0) && (
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          {totalCount !== undefined && (
            <span>{totalCount}件のテストスイート</span>
          )}
          {filters.status && (
            <span className="badge bg-background-tertiary text-foreground">
              {STATUS_OPTIONS.find((o) => o.value === filters.status)?.label}
              <button
                onClick={() => handleStatusChange('')}
                className="ml-1 hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.includeDeleted && (
            <span className="badge bg-background-tertiary text-foreground">
              削除済み含む
              <button
                onClick={() => handleIncludeDeletedChange(false)}
                className="ml-1 hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
