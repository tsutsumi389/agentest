import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search, X, ChevronDown, Check, ArrowUpDown, Tag } from 'lucide-react';
import type { TestSuiteSearchParams, Label } from '../../lib/api';

/**
 * ステータスオプション（トグルボタングループ用）
 */
const STATUS_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'DRAFT', label: '下書き' },
  { value: 'ACTIVE', label: '有効' },
  { value: 'ARCHIVED', label: 'アーカイブ' },
] as const;

/**
 * ソート統合オプション（フィールド + 順序を1つに統合）
 */
const SORT_COMBINED_OPTIONS = [
  {
    value: 'updatedAt-desc',
    label: '更新日(新しい順)',
    sortBy: 'updatedAt' as const,
    sortOrder: 'desc' as const,
  },
  {
    value: 'updatedAt-asc',
    label: '更新日(古い順)',
    sortBy: 'updatedAt' as const,
    sortOrder: 'asc' as const,
  },
  {
    value: 'createdAt-desc',
    label: '作成日(新しい順)',
    sortBy: 'createdAt' as const,
    sortOrder: 'desc' as const,
  },
  {
    value: 'createdAt-asc',
    label: '作成日(古い順)',
    sortBy: 'createdAt' as const,
    sortOrder: 'asc' as const,
  },
  { value: 'name-asc', label: '名前(A→Z)', sortBy: 'name' as const, sortOrder: 'asc' as const },
  { value: 'name-desc', label: '名前(Z→A)', sortBy: 'name' as const, sortOrder: 'desc' as const },
] as const;

interface TestSuiteSearchFilterProps {
  /** 現在のフィルタ値 */
  filters: TestSuiteSearchParams;
  /** フィルタ変更時のコールバック */
  onFiltersChange: (filters: TestSuiteSearchParams) => void;
  /** 検索結果の総件数（表示用） */
  totalCount?: number;
  /** 管理者権限があるか（削除済み表示用） */
  isAdmin?: boolean;
  /** プロジェクトのラベル一覧 */
  labels?: Label[];
}

/**
 * テストスイート検索・フィルタコンポーネント
 *
 * コンパクト1行レイアウト:
 * [検索] [すべて|下書き|有効|アーカイブ] [ラベル(N)] [ソート] [□削除済み] N件
 */
export function TestSuiteSearchFilter({
  filters,
  onFiltersChange,
  totalCount,
  isAdmin = false,
  labels = [],
}: TestSuiteSearchFilterProps) {
  const [searchInput, setSearchInput] = useState(filters.q || '');
  const [isLabelOpen, setIsLabelOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [labelSearchQuery, setLabelSearchQuery] = useState('');
  const labelRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const labelSearchInputRef = useRef<HTMLInputElement>(null);

  // 最新のfiltersをrefで保持（デバウンス処理で使用）
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // ブラウザバック/フォワード等で外部からfilters.qが変更された場合に同期
  useEffect(() => {
    setSearchInput(filters.q || '');
  }, [filters.q]);

  // 選択されているラベル
  const selectedLabels = useMemo(() => {
    if (!filters.labelIds?.length) return [];
    return labels.filter((label) => filters.labelIds?.includes(label.id));
  }, [labels, filters.labelIds]);

  // ラベル検索フィルタリング
  const filteredLabels = useMemo(() => {
    if (!labelSearchQuery) return labels;
    const query = labelSearchQuery.toLowerCase();
    return labels.filter((label) => label.name.toLowerCase().includes(query));
  }, [labels, labelSearchQuery]);

  // 現在のソート値
  const currentSortValue = `${filters.sortBy || 'updatedAt'}-${filters.sortOrder || 'desc'}`;
  const currentSortLabel =
    SORT_COMBINED_OPTIONS.find((o) => o.value === currentSortValue)?.label || '更新日(新しい順)';

  // 検索入力のデバウンス
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filtersRef.current.q) {
        onFiltersChange({ ...filtersRef.current, q: searchInput || undefined, offset: 0 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, onFiltersChange]);

  // ドロップダウンが開いている時のみリスナーを登録（外側クリック + ESCキー）
  useEffect(() => {
    if (!isLabelOpen && !isSortOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (isLabelOpen && labelRef.current && !labelRef.current.contains(event.target as Node)) {
        setIsLabelOpen(false);
        setLabelSearchQuery('');
      }
      if (isSortOpen && sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsLabelOpen(false);
        setIsSortOpen(false);
        setLabelSearchQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLabelOpen, isSortOpen]);

  // ラベルドロップダウンを開いたとき、検索入力にフォーカス
  useEffect(() => {
    if (isLabelOpen) {
      labelSearchInputRef.current?.focus();
    }
  }, [isLabelOpen]);

  // ステータストグル（1クリック切り替え）
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

  // ソート変更（統合ドロップダウン）
  const handleSortCombinedChange = useCallback(
    (value: string) => {
      const option = SORT_COMBINED_OPTIONS.find((o) => o.value === value);
      if (option) {
        onFiltersChange({
          ...filters,
          sortBy: option.sortBy,
          sortOrder: option.sortOrder,
          offset: 0,
        });
      }
      setIsSortOpen(false);
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

  // ラベル選択をすべてクリア
  const clearLabelSelection = useCallback(() => {
    onFiltersChange({
      ...filters,
      labelIds: undefined,
      offset: 0,
    });
  }, [filters, onFiltersChange]);

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      {/* 検索ボックス */}
      <div className="relative flex-1 min-w-[180px] max-w-[300px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-muted" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="テストスイートを検索..."
          className="input pl-8 pr-7 py-1.5 w-full text-xs"
          aria-label="テストスイートを検索"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
            aria-label="検索をクリア"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ステータストグルボタングループ */}
      <div
        className="inline-flex rounded-md border border-border overflow-hidden"
        role="radiogroup"
        aria-label="ステータス"
      >
        {STATUS_OPTIONS.map((option) => {
          const isActive = (filters.status || '') === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => handleStatusChange(option.value)}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-foreground-muted hover:text-foreground hover:bg-background-hover'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* ラベルドロップダウン（検索機能付き） */}
      {labels.length > 0 && (
        <div className="relative" ref={labelRef}>
          <button
            onClick={() => setIsLabelOpen(!isLabelOpen)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              selectedLabels.length > 0
                ? 'border-accent text-accent bg-background'
                : 'border-border text-foreground-muted bg-background hover:text-foreground hover:bg-background-hover'
            }`}
            aria-expanded={isLabelOpen}
            aria-haspopup="listbox"
            aria-label="ラベルでフィルタ"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>ラベル{selectedLabels.length > 0 && ` (${selectedLabels.length})`}</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${isLabelOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {isLabelOpen && (
            <div
              className="absolute left-0 mt-1 w-56 card z-dropdown animate-fade-in overflow-hidden"
              role="listbox"
            >
              {/* ラベル検索入力 */}
              <div className="p-2 border-b border-border">
                <input
                  ref={labelSearchInputRef}
                  type="text"
                  value={labelSearchQuery}
                  onChange={(e) => setLabelSearchQuery(e.target.value)}
                  placeholder="ラベルを検索..."
                  className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              {/* ラベル一覧 */}
              <div className="overflow-y-auto max-h-48 py-1">
                {filteredLabels.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-foreground-muted">
                    一致するラベルがありません
                  </div>
                ) : (
                  filteredLabels.map((label) => {
                    const isSelected = filters.labelIds?.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        onClick={() => toggleLabel(label.id)}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-background-tertiary transition-colors flex items-center gap-2 ${
                          isSelected ? 'bg-background-tertiary' : ''
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="flex-1 truncate">{label.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
              {/* 選択件数とクリア */}
              {selectedLabels.length > 0 && (
                <div className="px-3 py-2 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-foreground-muted">
                    {selectedLabels.length}件選択中
                  </span>
                  <button
                    onClick={clearLabelSelection}
                    className="text-xs text-foreground-muted hover:text-foreground"
                  >
                    クリア
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ソート統合ドロップダウン */}
      <div className="relative" ref={sortRef}>
        <button
          onClick={() => setIsSortOpen(!isSortOpen)}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border transition-colors ${
            currentSortValue !== 'updatedAt-desc'
              ? 'text-accent border-accent bg-background'
              : 'text-foreground-muted bg-background hover:text-foreground hover:bg-background-hover'
          }`}
          aria-expanded={isSortOpen}
          aria-haspopup="listbox"
          aria-label="並び順"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>{currentSortLabel}</span>
          <ChevronDown
            className={`w-3 h-3 transition-transform ${isSortOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {isSortOpen && (
          <div
            className="absolute left-0 mt-1 w-48 card py-1 z-dropdown animate-fade-in"
            role="listbox"
          >
            {SORT_COMBINED_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSortCombinedChange(option.value)}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-background-tertiary transition-colors flex items-center justify-between ${
                  currentSortValue === option.value ? 'bg-background-tertiary' : ''
                }`}
                role="option"
                aria-selected={currentSortValue === option.value}
              >
                <span>{option.label}</span>
                {currentSortValue === option.value && <Check className="w-3.5 h-3.5 text-accent" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 削除済み表示（管理者のみ） */}
      {isAdmin && (
        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={filters.includeDeleted || false}
            onChange={(e) => handleIncludeDeletedChange(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-border bg-background-secondary text-accent focus:ring-accent"
          />
          <span className="text-foreground-muted">削除済み</span>
        </label>
      )}

      {/* 件数表示 */}
      {totalCount !== undefined && (
        <span className="text-foreground-muted ml-auto text-xs whitespace-nowrap">
          {totalCount}件
        </span>
      )}
    </div>
  );
}
