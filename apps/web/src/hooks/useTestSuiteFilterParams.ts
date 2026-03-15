import { useCallback, useMemo } from 'react';
import type { useSearchParams } from 'react-router';
import type { TestSuiteSearchParams } from '../lib/api';

/**
 * デフォルトの検索パラメータ
 */
export const DEFAULT_SEARCH_PARAMS: TestSuiteSearchParams = {
  limit: 20,
  offset: 0,
  status: 'ACTIVE',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

// フィルター用URLパラメータキー（tab/sectionと区別するため）
const FILTER_PARAM_KEYS = ['q', 'status', 'labels', 'sort', 'order', 'deleted', 'page'] as const;

/**
 * URLパラメータからTestSuiteSearchParamsを読み取る
 */
function parseFiltersFromURL(searchParams: URLSearchParams): TestSuiteSearchParams {
  const limit = DEFAULT_SEARCH_PARAMS.limit!;

  const q = searchParams.get('q') || undefined;

  // status: 空文字は「すべて」(undefined)、なしはデフォルト(ACTIVE)
  const statusParam = searchParams.get('status');
  let status: TestSuiteSearchParams['status'];
  if (statusParam === '') {
    status = undefined;
  } else if (statusParam === 'DRAFT' || statusParam === 'ACTIVE' || statusParam === 'ARCHIVED') {
    status = statusParam;
  } else {
    status = DEFAULT_SEARCH_PARAMS.status;
  }

  // labels: カンマ区切り → 配列（IDはUUID想定）
  const labelsParam = searchParams.get('labels');
  const labelIds = labelsParam ? labelsParam.split(',').filter(Boolean) : undefined;

  // sort / order
  const sortParam = searchParams.get('sort');
  const sortBy =
    sortParam === 'name' || sortParam === 'createdAt' || sortParam === 'updatedAt'
      ? sortParam
      : DEFAULT_SEARCH_PARAMS.sortBy;

  const orderParam = searchParams.get('order');
  const sortOrder =
    orderParam === 'asc' || orderParam === 'desc' ? orderParam : DEFAULT_SEARCH_PARAMS.sortOrder;

  // deleted
  const includeDeleted = searchParams.get('deleted') === 'true' ? true : undefined;

  // page → offset（NaN/負数はデフォルト1にフォールバック）
  const pageParam = searchParams.get('page');
  const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
  const offset = (page - 1) * limit;

  return {
    q,
    status,
    labelIds,
    sortBy,
    sortOrder,
    includeDeleted,
    limit,
    offset,
  };
}

/**
 * TestSuiteSearchParamsからURLパラメータに変換する（デフォルト値は省略）
 */
function filtersToURLParams(
  filters: TestSuiteSearchParams,
  existingParams: URLSearchParams
): URLSearchParams {
  const params = new URLSearchParams();

  // 既存パラメータ（tab/section等）を保持
  existingParams.forEach((value, key) => {
    if (!(FILTER_PARAM_KEYS as readonly string[]).includes(key)) {
      params.set(key, value);
    }
  });

  // q: 値がある場合のみ
  if (filters.q) {
    params.set('q', filters.q);
  }

  // status: デフォルト(ACTIVE)の場合は省略、undefinedは空文字
  if (filters.status === undefined) {
    params.set('status', '');
  } else if (filters.status !== DEFAULT_SEARCH_PARAMS.status) {
    params.set('status', filters.status);
  }

  // labels: 値がある場合のみ
  if (filters.labelIds && filters.labelIds.length > 0) {
    params.set('labels', filters.labelIds.join(','));
  }

  // sort: デフォルト(updatedAt)の場合は省略
  if (filters.sortBy && filters.sortBy !== DEFAULT_SEARCH_PARAMS.sortBy) {
    params.set('sort', filters.sortBy);
  }

  // order: デフォルト(desc)の場合は省略
  if (filters.sortOrder && filters.sortOrder !== DEFAULT_SEARCH_PARAMS.sortOrder) {
    params.set('order', filters.sortOrder);
  }

  // deleted: trueの場合のみ
  if (filters.includeDeleted) {
    params.set('deleted', 'true');
  }

  // page: 1の場合は省略
  const limit = filters.limit || DEFAULT_SEARCH_PARAMS.limit!;
  const offset = filters.offset || 0;
  const page = Math.floor(offset / limit) + 1;
  if (page > 1) {
    params.set('page', String(page));
  }

  return params;
}

export interface UseTestSuiteFilterParamsReturn {
  /** 現在のフィルター値 */
  filters: TestSuiteSearchParams;
  /** フィルターを更新してURLに反映する */
  setFilters: (filters: TestSuiteSearchParams) => void;
  /** 現在のページ番号（1始まり） */
  currentPage: number;
  /** ページ番号を指定して更新する */
  setPage: (page: number) => void;
  /** フィルターをデフォルト値にリセットする */
  resetFilters: () => void;
}

/**
 * テストスイート検索フィルターとURLパラメータを双方向同期するフック
 *
 * - 外部からuseSearchParamsの結果を受け取ることで、同一コンポーネントツリー内の
 *   他のURLパラメータ操作（tab/section等）との競合を防止
 * - デフォルト値と同じ場合はURLパラメータを省略
 * - replace: trueでブラウザ履歴を汚さない
 */
export function useTestSuiteFilterParams(
  searchParams: URLSearchParams,
  setSearchParams: ReturnType<typeof useSearchParams>[1]
): UseTestSuiteFilterParamsReturn {
  const filters = useMemo(() => parseFiltersFromURL(searchParams), [searchParams]);

  const currentPage = useMemo(() => {
    const limit = filters.limit || DEFAULT_SEARCH_PARAMS.limit!;
    const offset = filters.offset || 0;
    return Math.floor(offset / limit) + 1;
  }, [filters.limit, filters.offset]);

  const setFilters = useCallback(
    (newFilters: TestSuiteSearchParams) => {
      const params = filtersToURLParams(newFilters, searchParams);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const setPage = useCallback(
    (page: number) => {
      const limit = filters.limit || DEFAULT_SEARCH_PARAMS.limit!;
      const newFilters = { ...filters, offset: (page - 1) * limit };
      const params = filtersToURLParams(newFilters, searchParams);
      setSearchParams(params, { replace: true });
    },
    [filters, searchParams, setSearchParams]
  );

  const resetFilters = useCallback(() => {
    const params = filtersToURLParams(DEFAULT_SEARCH_PARAMS, searchParams);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return {
    filters,
    setFilters,
    currentPage,
    setPage,
    resetFilters,
  };
}
