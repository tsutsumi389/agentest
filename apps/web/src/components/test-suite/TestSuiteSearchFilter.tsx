import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import type { TestSuiteSearchParams, Label } from '../../lib/api';

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
  { value: 'updatedAt', label: '更新日時' },
  { value: 'createdAt', label: '作成日時' },
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
  /**
   * プロジェクトのラベル一覧
   */
  labels?: Label[];
}

/**
 * テストスイート検索・フィルタコンポーネント
 *
 * インラインフィルター形式:
 * - 検索ボックス、ステータスフィルタ、ラベルフィルタが常に表示
 * - 並び順と削除済み表示オプションも常に表示
 * - 選択中のラベルがバッジで表示される
 */
export function TestSuiteSearchFilter({
  filters,
  onFiltersChange,
  totalCount,
  isAdmin = false,
  labels = [],
}: TestSuiteSearchFilterProps) {
  const [searchInput, setSearchInput] = useState(filters.q || '');
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isLabelOpen, setIsLabelOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  // 最新のfiltersをrefで保持（デバウンス処理で使用）
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // 選択されているラベルを取得
  const selectedLabels = useMemo(() => {
    if (!filters.labelIds?.length) return [];
    return labels.filter((label) => filters.labelIds?.includes(label.id));
  }, [labels, filters.labelIds]);

  // 検索入力のデバウンス
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filtersRef.current.q) {
        onFiltersChange({ ...filtersRef.current, q: searchInput || undefined, offset: 0 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, onFiltersChange]);

  // 外側クリックでドロップダウンを閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
      if (labelRef.current && !labelRef.current.contains(event.target as Node)) {
        setIsLabelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ESCキーでドロップダウンを閉じる
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsStatusOpen(false);
        setIsLabelOpen(false);
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
      setIsStatusOpen(false);
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

  // ラベルの選択/解除を切り替え
  const toggleLabel = useCallback(
    (labelId: string) => {
      const currentIds = filters.labelIds || [];
      const newIds = currentIds.includes(labelId)
        ? currentIds.filter((id) => id !== labelId)
        : [...currentIds, labelId];
      onFiltersChange({
        ...filters,
        labelIds: newIds.length > 0 ? newIds : undefined,
        offset: 0,
      });
    },
    [filters, onFiltersChange]
  );

  // ラベルを削除
  const removeLabel = useCallback(
    (labelId: string) => {
      const currentIds = filters.labelIds || [];
      const newIds = currentIds.filter((id) => id !== labelId);
      onFiltersChange({
        ...filters,
        labelIds: newIds.length > 0 ? newIds : undefined,
        offset: 0,
      });
    },
    [filters, onFiltersChange]
  );

  // すべてクリア
  const clearAllFilters = useCallback(() => {
    setSearchInput('');
    onFiltersChange({
      limit: filters.limit,
      offset: 0,
      status: 'ACTIVE',
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });
  }, [filters.limit, onFiltersChange]);

  // 現在のステータス表示ラベル
  const currentStatusLabel = STATUS_OPTIONS.find((o) => o.value === (filters.status || ''))?.label || 'すべて';

  // フィルタがデフォルトと異なるかどうか
  const hasActiveFilters = Boolean(
    filters.q ||
    filters.labelIds?.length ||
    filters.status !== 'ACTIVE' ||
    filters.includeDeleted
  );

  return (
    <div className="flex flex-col gap-3">
      {/* 1行目: 検索、ステータス、ラベル */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 検索ボックス */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="テストスイートを検索..."
            className="input pl-10 pr-8 w-full"
            aria-label="テストスイートを検索"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
              aria-label="検索をクリア"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ステータスドロップダウン */}
        <div className="relative" ref={statusRef}>
          <button
            onClick={() => setIsStatusOpen(!isStatusOpen)}
            className={`btn btn-secondary min-w-[140px] justify-between ${
              filters.status && filters.status !== 'ACTIVE' ? 'border-accent' : ''
            }`}
            aria-expanded={isStatusOpen}
            aria-haspopup="listbox"
            aria-label="ステータスでフィルタ"
          >
            <span>ステータス: {currentStatusLabel}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isStatusOpen ? 'rotate-180' : ''}`} />
          </button>
          {isStatusOpen && (
            <div className="absolute left-0 mt-1 w-40 card py-1 z-dropdown animate-fade-in" role="listbox">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(option.value)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-background-tertiary transition-colors flex items-center justify-between ${
                    (filters.status || '') === option.value ? 'bg-background-tertiary' : ''
                  }`}
                  role="option"
                  aria-selected={(filters.status || '') === option.value}
                >
                  <span>{option.label}</span>
                  {(filters.status || '') === option.value && <Check className="w-4 h-4 text-accent" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ラベルドロップダウン */}
        {labels.length > 0 && (
          <div className="relative" ref={labelRef}>
            <button
              onClick={() => setIsLabelOpen(!isLabelOpen)}
              className={`btn btn-secondary min-w-[100px] justify-between ${
                selectedLabels.length > 0 ? 'border-accent' : ''
              }`}
              aria-expanded={isLabelOpen}
              aria-haspopup="listbox"
              aria-label="ラベルでフィルタ"
            >
              <span>ラベル{selectedLabels.length > 0 && ` (${selectedLabels.length})`}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isLabelOpen ? 'rotate-180' : ''}`} />
            </button>
            {isLabelOpen && (
              <div className="absolute left-0 mt-1 w-56 card py-1 z-dropdown animate-fade-in max-h-60 overflow-y-auto" role="listbox">
                {labels.map((label) => {
                  const isSelected = filters.labelIds?.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => toggleLabel(label.id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-background-tertiary transition-colors flex items-center gap-2 ${
                        isSelected ? 'bg-background-tertiary' : ''
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="flex-1 truncate">{label.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2行目: 並び順、削除済み表示、件数 */}
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="text-foreground-muted">並び順:</span>
        <select
          value={filters.sortBy || 'updatedAt'}
          onChange={(e) => handleSortChange(e.target.value)}
          className="input py-1 px-2 text-sm"
          aria-label="並び順"
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
          className="input py-1 px-2 text-sm w-20"
          aria-label="順序"
        >
          {SORT_ORDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* 削除済み表示（管理者のみ） */}
        {isAdmin && (
          <label className="flex items-center gap-2 cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={filters.includeDeleted || false}
              onChange={(e) => handleIncludeDeletedChange(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-background-secondary text-accent focus:ring-accent"
            />
            <span className="text-foreground-muted">削除済みも表示</span>
          </label>
        )}

        {/* 件数表示 */}
        {totalCount !== undefined && (
          <span className="text-foreground-muted ml-auto">{totalCount}件のテストスイート</span>
        )}
      </div>

      {/* 選択中のラベル表示 */}
      {selectedLabels.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
          <span className="text-sm text-foreground-muted">選択中:</span>
          {selectedLabels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${label.color}20`,
                color: label.color,
                border: `1px solid ${label.color}40`,
              }}
            >
              {label.name}
              <button
                onClick={() => removeLabel(label.id)}
                className="hover:opacity-70"
                aria-label={`${label.name}ラベルを解除`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-foreground-muted hover:text-foreground ml-auto"
            >
              すべてクリア
            </button>
          )}
        </div>
      )}
    </div>
  );
}
