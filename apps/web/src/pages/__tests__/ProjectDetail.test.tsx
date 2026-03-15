import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// モックデータ
const mockUser = {
  id: 'user-1',
  name: 'テストユーザー',
  email: 'test@example.com',
  avatarUrl: null,
};

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({ user: mockUser }),
}));

vi.mock('../../lib/api', () => ({
  projectsApi: {
    getById: vi.fn(),
    getMembers: vi.fn(),
    searchTestSuites: vi.fn(),
  },
  usersApi: {
    getProjects: vi.fn(),
  },
  labelsApi: {
    getByProject: vi.fn(),
  },
}));

vi.mock('../../components/project/ProjectOverviewTab', () => ({
  ProjectOverviewTab: () => <div data-testid="overview-tab">概要タブ</div>,
}));

vi.mock('../../components/project/ProjectSettingsTab', () => ({
  ProjectSettingsTab: () => <div data-testid="settings-tab">設定タブ</div>,
}));

vi.mock('../../components/test-suite/TestSuiteSearchFilter', () => ({
  TestSuiteSearchFilter: () => <div data-testid="search-filter">フィルタ</div>,
}));

import { projectsApi, usersApi, labelsApi } from '../../lib/api';
import { ProjectDetailPage } from '../ProjectDetail';

const mockedProjectsApi = vi.mocked(projectsApi);
const mockedUsersApi = vi.mocked(usersApi);
const mockedLabelsApi = vi.mocked(labelsApi);

/**
 * テスト用ラッパー
 */
function renderWithProviders(projectId: string = 'proj-1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/projects/${projectId}?tab=suites`]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * テストスイートデータ生成ヘルパー
 */
function createTestSuite(
  overrides: {
    id?: string;
    name?: string;
    lastExecution?: {
      id: string;
      createdAt: string;
      environment: { id: string; name: string } | null;
      judgmentCounts: { PASS: number; FAIL: number; PENDING: number; SKIPPED: number };
    } | null;
  } = {}
) {
  return {
    id: overrides.id ?? 'suite-1',
    projectId: 'proj-1',
    name: overrides.name ?? 'テストスイート1',
    description: null,
    status: 'ACTIVE' as const,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    _count: { testCases: 5, preconditions: 0 },
    labels: [],
    lastExecution: overrides.lastExecution !== undefined ? overrides.lastExecution : null,
  };
}

describe('ProjectDetailPage - TestSuiteRow プログレスバー', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 共通モック設定
    mockedProjectsApi.getById.mockResolvedValue({
      project: {
        id: 'proj-1',
        name: 'テストプロジェクト',
        description: 'テスト用',
        organizationId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    });
    mockedProjectsApi.getMembers.mockResolvedValue({
      members: [
        {
          id: 'member-1',
          projectId: 'proj-1',
          userId: 'user-1',
          role: 'OWNER',
          addedAt: '2024-01-01T00:00:00Z',
          user: mockUser,
        },
      ],
    });
    mockedUsersApi.getProjects.mockResolvedValue({ projects: [] });
    mockedLabelsApi.getByProject.mockResolvedValue({ labels: [] });
  });

  it('lastExecutionがある場合、プログレスバーが表示される', async () => {
    mockedProjectsApi.searchTestSuites.mockResolvedValue({
      testSuites: [
        createTestSuite({
          lastExecution: {
            id: 'exec-1',
            createdAt: '2024-01-01T00:00:00Z',
            environment: { id: 'env-1', name: '開発環境' },
            judgmentCounts: { PASS: 3, FAIL: 2, PENDING: 0, SKIPPED: 2 },
          },
        }),
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    renderWithProviders();

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
  });

  it('合格率(%)が正しく計算・表示される（PASS:3, FAIL:2, SKIPPED:2 → 43%）', async () => {
    mockedProjectsApi.searchTestSuites.mockResolvedValue({
      testSuites: [
        createTestSuite({
          lastExecution: {
            id: 'exec-1',
            createdAt: '2024-01-01T00:00:00Z',
            environment: { id: 'env-1', name: '開発環境' },
            judgmentCounts: { PASS: 3, FAIL: 2, PENDING: 0, SKIPPED: 2 },
          },
        }),
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    renderWithProviders();

    // 合格率 = PASS / (PASS + FAIL + SKIPPED) = 3/7 ≈ 43%
    expect(await screen.findByText('43%')).toBeInTheDocument();
  });

  it('lastExecutionがない場合、プログレスバーは表示されない', async () => {
    mockedProjectsApi.searchTestSuites.mockResolvedValue({
      testSuites: [createTestSuite({ lastExecution: null })],
      total: 1,
      limit: 20,
      offset: 0,
    });

    renderWithProviders();

    // テストスイート名が表示されるのを待つ
    await screen.findByText('テストスイート1');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('全件PENDINGの場合、合格率は0%になる', async () => {
    mockedProjectsApi.searchTestSuites.mockResolvedValue({
      testSuites: [
        createTestSuite({
          lastExecution: {
            id: 'exec-1',
            createdAt: '2024-01-01T00:00:00Z',
            environment: null,
            judgmentCounts: { PASS: 0, FAIL: 0, PENDING: 5, SKIPPED: 0 },
          },
        }),
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    renderWithProviders();

    expect(await screen.findByText('0%')).toBeInTheDocument();
  });

  it('全件PASSの場合、合格率は100%になる', async () => {
    mockedProjectsApi.searchTestSuites.mockResolvedValue({
      testSuites: [
        createTestSuite({
          lastExecution: {
            id: 'exec-1',
            createdAt: '2024-01-01T00:00:00Z',
            environment: { id: 'env-1', name: '本番環境' },
            judgmentCounts: { PASS: 10, FAIL: 0, PENDING: 0, SKIPPED: 0 },
          },
        }),
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    renderWithProviders();

    expect(await screen.findByText('100%')).toBeInTheDocument();
  });
});

describe('ProjectDetailPage - ローディング表示', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedProjectsApi.getById.mockResolvedValue({
      project: {
        id: 'proj-1',
        name: 'テストプロジェクト',
        description: 'テスト用',
        organizationId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    });
    mockedProjectsApi.getMembers.mockResolvedValue({
      members: [
        {
          id: 'member-1',
          projectId: 'proj-1',
          userId: 'user-1',
          role: 'OWNER',
          addedAt: '2024-01-01T00:00:00Z',
          user: mockUser,
        },
      ],
    });
    mockedUsersApi.getProjects.mockResolvedValue({ projects: [] });
    mockedLabelsApi.getByProject.mockResolvedValue({ labels: [] });
  });

  it('テストスイート読み込み中にスケルトン行が表示される', async () => {
    // searchTestSuitesを未解決Promiseにしてローディング状態を維持
    mockedProjectsApi.searchTestSuites.mockReturnValue(new Promise(() => {}));

    renderWithProviders();

    // スケルトン行が表示されることを確認
    const skeletonItems = await screen.findAllByTestId('test-suite-row-skeleton-item');
    expect(skeletonItems.length).toBeGreaterThan(0);
  });
});
