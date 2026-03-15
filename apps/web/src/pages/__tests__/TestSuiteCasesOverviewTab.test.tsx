import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { OverviewTab } from '../TestSuiteCases';
import type { Execution } from '../../lib/api';

// ProgressBar のモック
vi.mock('../../components/ui/ProgressBar', () => ({
  ProgressBar: () => <div data-testid="progress-bar" />,
}));

// date のモック
vi.mock('../../lib/date', () => ({
  formatDateTime: (d: string) => `formatted:${d}`,
  formatRelativeTime: () => '2日前',
}));

// ReviewSessionContext のモック
vi.mock('../../contexts/ReviewSessionContext', () => ({
  useReviewSession: () => ({
    currentReview: null,
    refreshReview: vi.fn(),
  }),
}));

// CommentableField のモック
vi.mock('../../components/review/CommentableField', () => ({
  CommentableField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// PreconditionList のモック
vi.mock('../../components/test-suite/PreconditionList', () => ({
  PreconditionList: () => <div data-testid="precondition-list" />,
}));

// MarkdownPreview のモック
vi.mock('../../components/common/markdown/MarkdownPreview', () => ({
  MarkdownPreview: () => <div data-testid="markdown-preview" />,
}));

/**
 * テスト用 Execution データを作成するヘルパー
 */
function createExecution(overrides: Partial<Execution> = {}): Execution {
  return {
    id: 'exec-1',
    testSuiteId: 'suite-1',
    environmentId: 'env-1',
    createdAt: '2024-01-01T00:00:00Z',
    executedByUser: { id: 'user-1', name: 'テスター', avatarUrl: null },
    environment: { id: 'env-1', name: 'DEV' },
    judgmentCounts: { PASS: 3, FAIL: 2, PENDING: 1, SKIPPED: 2 },
    ...overrides,
  };
}

/**
 * OverviewTab をレンダリングするヘルパー
 */
function renderOverviewTab(executions: Execution[] = []) {
  return render(
    <MemoryRouter>
      <OverviewTab
        testSuiteId="suite-1"
        description="テスト説明"
        executions={executions}
        currentRole="OWNER"
      />
    </MemoryRouter>
  );
}

describe('OverviewTab 実行履歴サマリー', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('環境名バッジが表示される（environment あり）', () => {
    renderOverviewTab([createExecution({ environment: { id: 'env-1', name: 'DEV' } })]);
    expect(screen.getByText('DEV')).toBeInTheDocument();
  });

  it('環境名バッジが非表示（environment なし）', () => {
    renderOverviewTab([createExecution({ environment: undefined })]);
    expect(screen.queryByText('DEV')).toBeNull();
  });

  it('ProgressBar が表示される（total > 0）', () => {
    renderOverviewTab([createExecution()]);
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('ProgressBar が非表示（total === 0）', () => {
    renderOverviewTab([
      createExecution({
        judgmentCounts: { PASS: 0, FAIL: 0, PENDING: 0, SKIPPED: 0 },
      }),
    ]);
    expect(screen.queryByTestId('progress-bar')).toBeNull();
  });

  it('合格率ラベル: PASS:3, FAIL:2, PENDING:1, SKIPPED:2 → "3/8 (38%)"', () => {
    renderOverviewTab([createExecution()]);
    const label = screen.getByTestId('pass-rate-label');
    expect(label).toHaveTextContent('3/8 (38%)');
  });

  it('合格率ラベル: 全件PASS → "5/5 (100%)"', () => {
    renderOverviewTab([
      createExecution({
        judgmentCounts: { PASS: 5, FAIL: 0, PENDING: 0, SKIPPED: 0 },
      }),
    ]);
    expect(screen.getByTestId('pass-rate-label')).toHaveTextContent('5/5 (100%)');
  });

  it('合格率ラベル: 全件PENDING → "0/5 (0%)"', () => {
    renderOverviewTab([
      createExecution({
        judgmentCounts: { PASS: 0, FAIL: 0, PENDING: 5, SKIPPED: 0 },
      }),
    ]);
    expect(screen.getByTestId('pass-rate-label')).toHaveTextContent('0/5 (0%)');
  });

  it('judgmentCounts が undefined → ProgressBar・ラベル非表示', () => {
    renderOverviewTab([createExecution({ judgmentCounts: undefined })]);
    expect(screen.queryByTestId('progress-bar')).toBeNull();
    expect(screen.queryByTestId('pass-rate-label')).toBeNull();
  });

  it('実行履歴が空 → 「実行履歴がありません」表示', () => {
    renderOverviewTab([]);
    expect(screen.getByText('実行履歴がありません')).toBeInTheDocument();
  });

  it('合格率ラベル: 全件FAIL → "0/3 (0%)"', () => {
    renderOverviewTab([
      createExecution({
        judgmentCounts: { PASS: 0, FAIL: 3, PENDING: 0, SKIPPED: 0 },
      }),
    ]);
    expect(screen.getByTestId('pass-rate-label')).toHaveTextContent('0/3 (0%)');
  });

  it('合格率ラベルに font-code クラスが適用されている', () => {
    renderOverviewTab([createExecution()]);
    const label = screen.getByTestId('pass-rate-label');
    expect(label.className).toContain('font-code');
  });

  it('複数実行が個別に表示される', () => {
    renderOverviewTab([
      createExecution({ id: 'exec-1', environment: { id: 'env-1', name: 'DEV' } }),
      createExecution({ id: 'exec-2', environment: { id: 'env-2', name: 'STG' } }),
    ]);
    expect(screen.getByText('DEV')).toBeInTheDocument();
    expect(screen.getByText('STG')).toBeInTheDocument();
    expect(screen.getAllByTestId('progress-bar')).toHaveLength(2);
  });
});
