import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTestSuiteFilterParams, DEFAULT_SEARCH_PARAMS } from '../useTestSuiteFilterParams';

describe('useTestSuiteFilterParams', () => {
  let mockSearchParams: URLSearchParams;
  let mockSetSearchParams: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockSetSearchParams = vi.fn();
  });

  // ヘルパー: フックをレンダリング
  function renderFilterHook(params?: URLSearchParams) {
    const sp = params ?? mockSearchParams;
    return renderHook(() => useTestSuiteFilterParams(sp, mockSetSearchParams));
  }

  describe('URLパラメータからの読み取り', () => {
    it('パラメータなしの場合、デフォルト値を返す', () => {
      const { result } = renderFilterHook();

      expect(result.current.filters).toEqual(DEFAULT_SEARCH_PARAMS);
    });

    it('qパラメータを読み取る', () => {
      const { result } = renderFilterHook(new URLSearchParams('q=テスト'));

      expect(result.current.filters.q).toBe('テスト');
    });

    it('statusパラメータを読み取る', () => {
      const { result } = renderFilterHook(new URLSearchParams('status=DRAFT'));

      expect(result.current.filters.status).toBe('DRAFT');
    });

    it('status空文字はundefinedとして扱う（すべて）', () => {
      const { result } = renderFilterHook(new URLSearchParams('status='));

      expect(result.current.filters.status).toBeUndefined();
    });

    it('labelsパラメータをカンマ区切りで配列に変換する', () => {
      const { result } = renderFilterHook(new URLSearchParams('labels=id1,id2,id3'));

      expect(result.current.filters.labelIds).toEqual(['id1', 'id2', 'id3']);
    });

    it('sortパラメータを読み取る', () => {
      const { result } = renderFilterHook(new URLSearchParams('sort=createdAt'));

      expect(result.current.filters.sortBy).toBe('createdAt');
    });

    it('orderパラメータを読み取る', () => {
      const { result } = renderFilterHook(new URLSearchParams('order=asc'));

      expect(result.current.filters.sortOrder).toBe('asc');
    });

    it('deletedパラメータを読み取る', () => {
      const { result } = renderFilterHook(new URLSearchParams('deleted=true'));

      expect(result.current.filters.includeDeleted).toBe(true);
    });

    it('pageパラメータをoffsetに変換する', () => {
      const { result } = renderFilterHook(new URLSearchParams('page=3'));

      // page=3, limit=20 → offset=40
      expect(result.current.filters.offset).toBe(40);
    });

    it('すべてのパラメータを同時に読み取る', () => {
      const { result } = renderFilterHook(
        new URLSearchParams(
          'q=検索語&status=ARCHIVED&labels=a,b&sort=name&order=asc&deleted=true&page=2'
        )
      );

      expect(result.current.filters).toEqual({
        q: '検索語',
        status: 'ARCHIVED',
        labelIds: ['a', 'b'],
        sortBy: 'name',
        sortOrder: 'asc',
        includeDeleted: true,
        limit: 20,
        offset: 20,
      });
    });
  });

  describe('フィルター変更時のURL更新', () => {
    it('テキスト検索を更新するとqパラメータが設定される', () => {
      const { result } = renderFilterHook();

      act(() => {
        result.current.setFilters({ ...DEFAULT_SEARCH_PARAMS, q: '新しい検索' });
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledParams.get('q')).toBe('新しい検索');
    });

    it('ステータスをデフォルト(ACTIVE)に設定するとstatusパラメータが省略される', () => {
      const { result } = renderFilterHook();

      act(() => {
        result.current.setFilters({ ...DEFAULT_SEARCH_PARAMS, status: 'ACTIVE' });
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledParams.has('status')).toBe(false);
    });

    it('ステータスをDRAFTに設定するとstatusパラメータが設定される', () => {
      const { result } = renderFilterHook();

      act(() => {
        result.current.setFilters({ ...DEFAULT_SEARCH_PARAMS, status: 'DRAFT' });
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledParams.get('status')).toBe('DRAFT');
    });

    it('ステータスを「すべて」(undefined)に設定するとstatus空文字が設定される', () => {
      const { result } = renderFilterHook();

      act(() => {
        result.current.setFilters({ ...DEFAULT_SEARCH_PARAMS, status: undefined });
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledParams.get('status')).toBe('');
    });

    it('ラベルIDを設定するとlabelsパラメータがカンマ区切りで設定される', () => {
      const { result } = renderFilterHook();

      act(() => {
        result.current.setFilters({ ...DEFAULT_SEARCH_PARAMS, labelIds: ['x', 'y'] });
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledParams.get('labels')).toBe('x,y');
    });

    it('ソートをデフォルト値(updatedAt/desc)に設定するとsort/orderパラメータが省略される', () => {
      const { result } = renderFilterHook();

      act(() => {
        result.current.setFilters(DEFAULT_SEARCH_PARAMS);
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledParams.has('sort')).toBe(false);
      expect(calledParams.has('order')).toBe(false);
    });

    it('ページ1の場合はpageパラメータが省略される', () => {
      const { result } = renderFilterHook();

      act(() => {
        result.current.setFilters({ ...DEFAULT_SEARCH_PARAMS, offset: 0 });
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledParams.has('page')).toBe(false);
    });

    it('ページ2以降の場合はpageパラメータが設定される', () => {
      const { result } = renderFilterHook();

      act(() => {
        result.current.setFilters({ ...DEFAULT_SEARCH_PARAMS, offset: 20 });
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledParams.get('page')).toBe('2');
    });

    it('replace: trueでURLが更新される', () => {
      const { result } = renderFilterHook();

      act(() => {
        result.current.setFilters({ ...DEFAULT_SEARCH_PARAMS, q: 'test' });
      });

      expect(mockSetSearchParams).toHaveBeenCalledWith(expect.any(URLSearchParams), {
        replace: true,
      });
    });

    it('フィルタ変更時にpageがリセットされること', () => {
      const { result } = renderFilterHook(new URLSearchParams('q=old&page=3'));

      act(() => {
        result.current.setFilters({ ...DEFAULT_SEARCH_PARAMS, q: 'new', offset: 0 });
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledParams.has('page')).toBe(false);
      expect(calledParams.get('q')).toBe('new');
    });
  });

  describe('既存URLパラメータとの共存', () => {
    it('tabパラメータが保持される', () => {
      const { result } = renderFilterHook(new URLSearchParams('tab=suites'));

      act(() => {
        result.current.setFilters({ ...DEFAULT_SEARCH_PARAMS, q: 'test' });
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledParams.get('tab')).toBe('suites');
      expect(calledParams.get('q')).toBe('test');
    });

    it('sectionパラメータが保持される', () => {
      const { result } = renderFilterHook(new URLSearchParams('tab=settings&section=members'));

      act(() => {
        result.current.setFilters({ ...DEFAULT_SEARCH_PARAMS, status: 'DRAFT' });
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledParams.get('tab')).toBe('settings');
      expect(calledParams.get('section')).toBe('members');
      expect(calledParams.get('status')).toBe('DRAFT');
    });
  });

  describe('currentPage ヘルパー', () => {
    it('offsetなしの場合、ページ1を返す', () => {
      const { result } = renderFilterHook();

      expect(result.current.currentPage).toBe(1);
    });

    it('offset=20の場合、ページ2を返す', () => {
      const { result } = renderFilterHook(new URLSearchParams('page=2'));

      expect(result.current.currentPage).toBe(2);
    });
  });

  describe('setPage ヘルパー', () => {
    it('ページ番号を指定してoffsetを更新する', () => {
      const { result } = renderFilterHook();

      act(() => {
        result.current.setPage(3);
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(calledParams.get('page')).toBe('3');
    });
  });

  describe('resetFilters ヘルパー', () => {
    it('フィルターをデフォルト値にリセットする', () => {
      const { result } = renderFilterHook(
        new URLSearchParams('q=test&status=DRAFT&labels=a,b&page=3&tab=suites')
      );

      act(() => {
        result.current.resetFilters();
      });

      const calledParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
      // フィルターパラメータがクリアされる
      expect(calledParams.has('q')).toBe(false);
      expect(calledParams.has('status')).toBe(false);
      expect(calledParams.has('labels')).toBe(false);
      expect(calledParams.has('page')).toBe(false);
      // tab/sectionは保持される
      expect(calledParams.get('tab')).toBe('suites');
    });
  });
});
