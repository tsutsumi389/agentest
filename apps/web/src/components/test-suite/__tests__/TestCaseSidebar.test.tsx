import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestCaseSidebar } from '../TestCaseSidebar';
import { testCasesApi, type TestCase } from '../../../lib/api';
import { toast } from '../../../stores/toast';

// APIモック
vi.mock('../../../lib/api', () => ({
  testSuitesApi: {
    getTestCases: vi.fn(),
    reorderTestCases: vi.fn(),
  },
  testCasesApi: {
    restore: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

// toastモック
vi.mock('../../../stores/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * テスト用テストケースファクトリ
 */
function createTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'tc-1',
    testSuiteId: 'suite-1',
    title: 'ログインテスト',
    description: null,
    priority: 'HIGH' as const,
    status: 'ACTIVE' as const,
    orderKey: 'a',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

/**
 * テスト用QueryClientProvider
 */
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

const defaultProps = {
  testSuiteId: 'suite-1',
  testCases: [
    createTestCase({ id: 'tc-1', title: 'ログインテスト', orderKey: 'a' }),
    createTestCase({ id: 'tc-2', title: 'ログアウトテスト', orderKey: 'b' }),
  ],
  selectedTestCaseId: null,
  onSelect: vi.fn(),
  onCreateClick: vi.fn(),
  currentRole: 'OWNER' as const,
};

// 固定時刻（2026-02-14T12:00:00Z）- テストの決定性を担保
const FIXED_NOW = new Date('2026-02-14T12:00:00Z').getTime();

describe('TestCaseSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  describe('フィルタボタンの表示', () => {
    it('フィルタボタンが4つ表示される（アクティブ、下書き、アーカイブ、ゴミ箱）', () => {
      renderWithProviders(<TestCaseSidebar {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'アクティブ' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '下書き' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'アーカイブ' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ゴミ箱' })).toBeInTheDocument();
    });

    it('デフォルトで「アクティブ」が選択状態になっている', () => {
      renderWithProviders(<TestCaseSidebar {...defaultProps} />);

      const activeButton = screen.getByRole('button', { name: 'アクティブ' });
      expect(activeButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('他のフィルタは非選択状態になっている', () => {
      renderWithProviders(<TestCaseSidebar {...defaultProps} />);

      expect(screen.getByRole('button', { name: '下書き' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: 'アーカイブ' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: 'ゴミ箱' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('フィルタ切り替え', () => {
    it('「下書き」フィルタをクリックすると選択状態が切り替わる', () => {
      renderWithProviders(<TestCaseSidebar {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: '下書き' }));

      expect(screen.getByRole('button', { name: '下書き' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'アクティブ' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('「アーカイブ」フィルタをクリックすると選択状態が切り替わる', () => {
      renderWithProviders(<TestCaseSidebar {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'アーカイブ' }));

      expect(screen.getByRole('button', { name: 'アーカイブ' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('「ゴミ箱」フィルタをクリックすると選択状態が切り替わる', () => {
      renderWithProviders(<TestCaseSidebar {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'ゴミ箱' }));

      expect(screen.getByRole('button', { name: 'ゴミ箱' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('フィルタ切り替え時にonFilterChangeコールバックが呼ばれる', () => {
      const onFilterChange = vi.fn();
      renderWithProviders(
        <TestCaseSidebar {...defaultProps} onFilterChange={onFilterChange} />
      );

      fireEvent.click(screen.getByRole('button', { name: '下書き' }));

      expect(onFilterChange).toHaveBeenCalledWith('draft');
    });
  });

  describe('フィルタに応じたテストケース表示', () => {
    it('アクティブフィルタ時、propsのtestCasesをそのまま表示する', () => {
      renderWithProviders(<TestCaseSidebar {...defaultProps} />);

      expect(screen.getByText('ログインテスト')).toBeInTheDocument();
      expect(screen.getByText('ログアウトテスト')).toBeInTheDocument();
    });

    it('テストケースが0件の場合、空メッセージを表示する', () => {
      renderWithProviders(
        <TestCaseSidebar {...defaultProps} testCases={[]} />
      );

      expect(screen.getByText('テストケースがありません')).toBeInTheDocument();
    });
  });

  describe('ゴミ箱フィルタ', () => {
    // 固定時刻（2026-02-14T12:00:00Z）基準で計算
    const deletedTestCases = [
      createTestCase({
        id: 'tc-del-1',
        title: '削除済みテスト1',
        // 5日前に削除 → 残り25日
        deletedAt: '2026-02-09T12:00:00Z',
      }),
      createTestCase({
        id: 'tc-del-2',
        title: '削除済みテスト2',
        // 27日前に削除 → 残り3日
        deletedAt: '2026-01-18T12:00:00Z',
      }),
    ];

    it('ゴミ箱フィルタ時、削除済みテストケースに残り日数バッジを表示する', () => {
      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          testCases={deletedTestCases}
          activeFilter="deleted"
        />
      );

      // 残り日数表示を確認
      expect(screen.getByText(/残り25日/)).toBeInTheDocument();
      expect(screen.getByText(/残り3日/)).toBeInTheDocument();
    });

    it('残り3日以下の場合、警告スタイルが適用される', () => {
      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          testCases={deletedTestCases}
          activeFilter="deleted"
        />
      );

      // 残り3日のテストケースは警告色
      const warningBadge = screen.getByText(/残り3日/);
      expect(warningBadge).toHaveClass('text-warning');
    });

    it('ゴミ箱フィルタ時、復元ボタンが各テストケースに表示される', () => {
      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          testCases={deletedTestCases}
          activeFilter="deleted"
        />
      );

      const restoreButtons = screen.getAllByRole('button', { name: '復元' });
      expect(restoreButtons).toHaveLength(2);
    });

    it('ゴミ箱が空の場合、適切な空メッセージを表示する', () => {
      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          testCases={[]}
          activeFilter="deleted"
        />
      );

      expect(screen.getByText('削除済みテストケースはありません')).toBeInTheDocument();
    });

    it('ゴミ箱フィルタ時、ドラッグハンドルが表示されない', () => {
      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          testCases={deletedTestCases}
          activeFilter="deleted"
        />
      );

      expect(screen.queryByLabelText('ドラッグして並び替え')).not.toBeInTheDocument();
    });

    it('ゴミ箱フィルタ時、作成ボタンのリンクが表示されない', () => {
      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          testCases={[]}
          activeFilter="deleted"
        />
      );

      // 空状態でも「テストケースを作成」リンクは表示されない
      expect(screen.queryByText('テストケースを作成')).not.toBeInTheDocument();
    });
  });

  describe('復元機能', () => {
    const deletedTestCases = [
      createTestCase({
        id: 'tc-del-1',
        title: '削除済みテスト1',
        deletedAt: '2026-02-09T12:00:00Z',
      }),
    ];

    it('復元ボタンクリックでtestCasesApi.restore()が呼ばれる', async () => {
      vi.mocked(testCasesApi.restore).mockResolvedValue({
        testCase: createTestCase({ id: 'tc-del-1' }),
      });

      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          testCases={deletedTestCases}
          activeFilter="deleted"
        />
      );

      const restoreButton = screen.getByRole('button', { name: '復元' });
      fireEvent.click(restoreButton);

      await waitFor(() => {
        expect(testCasesApi.restore).toHaveBeenCalledWith('tc-del-1');
      });
    });

    it('復元成功時にサクセストーストを表示する', async () => {
      vi.mocked(testCasesApi.restore).mockResolvedValue({
        testCase: createTestCase({ id: 'tc-del-1' }),
      });

      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          testCases={deletedTestCases}
          activeFilter="deleted"
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '復元' }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('テストケースを復元しました');
      });
    });

    it('復元失敗時にエラートーストを表示する', async () => {
      vi.mocked(testCasesApi.restore).mockRejectedValue(new Error('復元失敗'));

      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          testCases={deletedTestCases}
          activeFilter="deleted"
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '復元' }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('テストケースの復元に失敗しました');
      });
    });

    it('READ権限ユーザーにはゴミ箱フィルタで復元ボタンが表示されない', () => {
      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          currentRole="READ"
          testCases={deletedTestCases}
          activeFilter="deleted"
        />
      );

      expect(screen.queryByRole('button', { name: '復元' })).not.toBeInTheDocument();
    });

    it('二重クリック時にAPIが1回しか呼ばれない', async () => {
      // resolveを遅延させて二重クリックをシミュレート
      let resolveRestore: () => void;
      vi.mocked(testCasesApi.restore).mockImplementation(
        () => new Promise<{ testCase: TestCase }>((resolve) => {
          resolveRestore = () => resolve({ testCase: createTestCase({ id: 'tc-del-1' }) });
        })
      );

      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          testCases={deletedTestCases}
          activeFilter="deleted"
        />
      );

      const restoreButton = screen.getByRole('button', { name: '復元' });
      fireEvent.click(restoreButton);
      fireEvent.click(restoreButton);

      // 遅延Promiseを解決
      resolveRestore!();

      await waitFor(() => {
        expect(testCasesApi.restore).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('検索とフィルタの組み合わせ', () => {
    it('検索クエリがフィルタ結果に対して適用される', () => {
      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          testCases={[
            createTestCase({ id: 'tc-1', title: 'ログインテスト', orderKey: 'a' }),
            createTestCase({ id: 'tc-2', title: 'ログアウトテスト', orderKey: 'b' }),
            createTestCase({ id: 'tc-3', title: 'ユーザー登録', orderKey: 'c' }),
          ]}
        />
      );

      const searchInput = screen.getByPlaceholderText('検索...');
      fireEvent.change(searchInput, { target: { value: 'ログイン' } });

      expect(screen.getByText('ログインテスト')).toBeInTheDocument();
      expect(screen.queryByText('ログアウトテスト')).not.toBeInTheDocument();
      expect(screen.queryByText('ユーザー登録')).not.toBeInTheDocument();
    });
  });

  describe('テストケース名のツールチップ', () => {
    it('テストケース名のspanにtitle属性が設定されている', () => {
      renderWithProviders(<TestCaseSidebar {...defaultProps} />);

      const loginTest = screen.getByText('ログインテスト');
      expect(loginTest).toHaveAttribute('title', 'ログインテスト');
    });

    it('長いタイトルでもtitleに全文が含まれる', () => {
      const longTitle = 'これはとても長いテストケース名で、サイドバーの幅では表示しきれないほどの長さがあります';
      renderWithProviders(
        <TestCaseSidebar
          {...defaultProps}
          testCases={[createTestCase({ id: 'tc-long', title: longTitle, orderKey: 'a' })]}
        />
      );

      const testCaseSpan = screen.getByText(longTitle);
      expect(testCaseSpan).toHaveAttribute('title', longTitle);
    });
  });

  describe('件数表示', () => {
    it('フッターに表示中のテストケース件数を表示する', () => {
      renderWithProviders(<TestCaseSidebar {...defaultProps} />);

      expect(screen.getByText('2 件')).toBeInTheDocument();
    });
  });

  describe('ローディング表示', () => {
    it('isLoading=trueでスケルトンが表示される', () => {
      renderWithProviders(<TestCaseSidebar {...defaultProps} isLoading={true} />);

      const skeletonItems = screen.getAllByTestId('test-case-sidebar-skeleton-item');
      expect(skeletonItems.length).toBeGreaterThan(0);
    });
  });
});
