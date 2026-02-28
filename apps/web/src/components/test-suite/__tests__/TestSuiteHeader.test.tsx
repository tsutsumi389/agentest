import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TestSuiteHeader } from '../TestSuiteHeader';
import type { TestSuite } from '../../../lib/api';

/**
 * テスト用ラッパー
 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

/**
 * テスト用テストスイートファクトリ
 */
function createTestSuite(overrides: Partial<TestSuite> = {}): TestSuite {
  return {
    id: 'suite-1',
    projectId: 'proj-1',
    name: 'ログインテストスイート',
    description: 'ログイン関連のテスト',
    status: 'ACTIVE',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
    _count: { testCases: 5, preconditions: 2 },
    ...overrides,
  };
}

const defaultProps = {
  testSuite: createTestSuite(),
  testCaseCount: 5,
  currentRole: 'OWNER' as const,
  onStartExecution: vi.fn(),
  onEdit: vi.fn(),
};

describe('TestSuiteHeader - パンくずリスト', () => {
  it('projectNameとprojectIdが渡された時、パンくずリストが表示される', () => {
    renderWithRouter(
      <TestSuiteHeader
        {...defaultProps}
        projectId="proj-1"
        projectName="テストプロジェクト"
      />
    );

    const breadcrumb = screen.getByRole('navigation', { name: 'パンくずリスト' });
    expect(breadcrumb).toBeInTheDocument();
  });

  it('パンくずリストにプロジェクト名が表示される', () => {
    renderWithRouter(
      <TestSuiteHeader
        {...defaultProps}
        projectId="proj-1"
        projectName="テストプロジェクト"
      />
    );

    expect(screen.getByText('テストプロジェクト')).toBeInTheDocument();
  });

  it('プロジェクト名がプロジェクト詳細ページへのリンクになっている', () => {
    renderWithRouter(
      <TestSuiteHeader
        {...defaultProps}
        projectId="proj-1"
        projectName="テストプロジェクト"
      />
    );

    const projectLink = screen.getByText('テストプロジェクト').closest('a');
    expect(projectLink).toHaveAttribute('href', '/projects/proj-1?tab=suites');
  });

  it('テストスイート名が現在ページとして表示される', () => {
    renderWithRouter(
      <TestSuiteHeader
        {...defaultProps}
        projectId="proj-1"
        projectName="テストプロジェクト"
      />
    );

    // パンくずリスト内でテストスイート名がaria-current="page"を持つ
    const breadcrumb = screen.getByRole('navigation', { name: 'パンくずリスト' });
    const currentItem = breadcrumb.querySelector('[aria-current="page"]');
    expect(currentItem).toHaveTextContent('ログインテストスイート');
  });

  it('テストケース選択時はテストスイート名がリンクになりテストケース名が現在ページになる', () => {
    renderWithRouter(
      <TestSuiteHeader
        {...defaultProps}
        projectId="proj-1"
        projectName="テストプロジェクト"
        selectedTestCase={{
          id: 'tc-1',
          title: 'ログインフォームの表示',
          priority: 'HIGH',
          status: 'ACTIVE',
        }}
      />
    );

    // パンくずリスト内でテストスイート名がリンクになっている
    const breadcrumb = screen.getByRole('navigation', { name: 'パンくずリスト' });
    const suiteLink = breadcrumb.querySelector('a[href="/test-suites/suite-1"]');
    expect(suiteLink).toBeInTheDocument();
    expect(suiteLink).toHaveTextContent('ログインテストスイート');

    // パンくずリスト内でテストケース名が現在ページ
    const currentItems = breadcrumb.querySelectorAll('[aria-current="page"]');
    const lastItem = currentItems[currentItems.length - 1];
    expect(lastItem).toHaveTextContent('ログインフォームの表示');
  });

  it('projectNameが未指定の場合、パンくずリストが表示されない', () => {
    renderWithRouter(
      <TestSuiteHeader {...defaultProps} />
    );

    expect(screen.queryByRole('navigation', { name: 'パンくずリスト' })).not.toBeInTheDocument();
  });
});
