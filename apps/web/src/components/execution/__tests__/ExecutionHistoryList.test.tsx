import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ExecutionItem } from '../ExecutionHistoryList';
import type { Execution } from '../../../lib/api';

// ProgressBar のモック
vi.mock('../../ui/ProgressBar', () => ({
  ProgressBar: () => <div data-testid="progress-bar" />,
}));

// date のモック
vi.mock('../../../lib/date', () => ({
  formatDateTime: () => '2024-01-01 00:00:00',
  formatRelativeTime: () => '2日前',
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
 * MemoryRouter でラップしてレンダリングするヘルパー
 */
function renderItem(execution: Execution) {
  return render(
    <MemoryRouter>
      <ExecutionItem execution={execution} />
    </MemoryRouter>,
  );
}

describe('ExecutionItem 合格率ラベル', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PASS:3, FAIL:2, PENDING:1, SKIPPED:2 のとき "3/8 (38%)" を表示する', () => {
    renderItem(createExecution());
    const label = screen.getByTestId('pass-rate-label');
    expect(label).toHaveTextContent('3/8 (38%)');
  });

  it('total === 0 のときラベルを表示しない', () => {
    renderItem(
      createExecution({
        judgmentCounts: { PASS: 0, FAIL: 0, PENDING: 0, SKIPPED: 0 },
      }),
    );
    expect(screen.queryByTestId('pass-rate-label')).toBeNull();
  });

  it('全件 PASS のとき "5/5 (100%)" を表示する', () => {
    renderItem(
      createExecution({
        judgmentCounts: { PASS: 5, FAIL: 0, PENDING: 0, SKIPPED: 0 },
      }),
    );
    expect(screen.getByTestId('pass-rate-label')).toHaveTextContent('5/5 (100%)');
  });

  it('全件 PENDING のとき "0/5 (0%)" を表示する', () => {
    renderItem(
      createExecution({
        judgmentCounts: { PASS: 0, FAIL: 0, PENDING: 5, SKIPPED: 0 },
      }),
    );
    expect(screen.getByTestId('pass-rate-label')).toHaveTextContent('0/5 (0%)');
  });

  it('全件 FAIL のとき "0/3 (0%)" を表示する', () => {
    renderItem(
      createExecution({
        judgmentCounts: { PASS: 0, FAIL: 3, PENDING: 0, SKIPPED: 0 },
      }),
    );
    expect(screen.getByTestId('pass-rate-label')).toHaveTextContent('0/3 (0%)');
  });

  it('judgmentCounts が undefined のときラベルを表示しない', () => {
    renderItem(
      createExecution({
        judgmentCounts: undefined,
      }),
    );
    expect(screen.queryByTestId('pass-rate-label')).toBeNull();
  });

  it('ラベルに font-code クラスが適用されている', () => {
    renderItem(createExecution());
    const label = screen.getByTestId('pass-rate-label');
    expect(label.className).toContain('font-code');
  });
});
