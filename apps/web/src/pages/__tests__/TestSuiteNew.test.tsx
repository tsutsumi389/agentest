import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// モック
vi.mock('../../lib/api', () => ({
  projectsApi: {
    getById: vi.fn(),
  },
}));

vi.mock('../../components/test-suite/TestSuiteForm', () => ({
  TestSuiteForm: vi.fn(
    ({
      mode,
      projectId,
      onSave,
      onCancel,
    }: {
      mode: string;
      projectId: string;
      onSave: (id?: string) => void;
      onCancel: () => void;
    }) => (
      <div data-testid="test-suite-form">
        <span data-testid="form-mode">{mode}</span>
        <span data-testid="form-project-id">{projectId}</span>
        <button data-testid="form-save" onClick={() => onSave('new-suite-id')}>
          保存
        </button>
        <button data-testid="form-cancel" onClick={() => onCancel()}>
          キャンセル
        </button>
      </div>
    )
  ),
}));

import { projectsApi } from '../../lib/api';
import { TestSuiteNewPage } from '../TestSuiteNew';

const mockedProjectsApi = vi.mocked(projectsApi);

/**
 * テスト用ラッパー
 */
function renderWithProviders(searchParams: string = '') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const path = `/test-suites/new${searchParams ? `?${searchParams}` : ''}`;

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="test-suites/new" element={<TestSuiteNewPage />} />
          <Route
            path="test-suites/:testSuiteId"
            element={<div data-testid="suite-detail">スイート詳細</div>}
          />
          <Route
            path="projects/:projectId"
            element={<div data-testid="project-detail">プロジェクト詳細</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TestSuiteNewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('projectId未指定時', () => {
    it('エラーメッセージを表示する', () => {
      renderWithProviders();

      expect(screen.getByText('プロジェクトが指定されていません')).toBeInTheDocument();
    });

    it('TestSuiteFormを表示しない', () => {
      renderWithProviders();

      expect(screen.queryByTestId('test-suite-form')).not.toBeInTheDocument();
    });
  });

  describe('プロジェクト読み込みエラー時', () => {
    it('エラーメッセージを表示する', async () => {
      mockedProjectsApi.getById.mockRejectedValue(new Error('Not found'));
      renderWithProviders('projectId=invalid-id');

      expect(await screen.findByText('プロジェクトの読み込みに失敗しました')).toBeInTheDocument();
    });

    it('TestSuiteFormを表示しない', async () => {
      mockedProjectsApi.getById.mockRejectedValue(new Error('Not found'));
      renderWithProviders('projectId=invalid-id');

      await screen.findByText('プロジェクトの読み込みに失敗しました');
      expect(screen.queryByTestId('test-suite-form')).not.toBeInTheDocument();
    });
  });

  describe('projectId指定時', () => {
    beforeEach(() => {
      mockedProjectsApi.getById.mockResolvedValue({
        project: {
          id: 'proj-1',
          name: 'テストプロジェクト',
          description: 'テスト用プロジェクト',
          organizationId: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      });
    });

    it('TestSuiteFormをcreateモードで表示する', async () => {
      renderWithProviders('projectId=proj-1');

      expect(screen.getByTestId('test-suite-form')).toBeInTheDocument();
      expect(screen.getByTestId('form-mode')).toHaveTextContent('create');
      expect(screen.getByTestId('form-project-id')).toHaveTextContent('proj-1');
    });

    it('プロジェクト名をパンくずリストに表示する', async () => {
      renderWithProviders('projectId=proj-1');

      // プロジェクト名が表示されるまで待つ
      const projectLink = await screen.findByText('テストプロジェクト');
      expect(projectLink).toBeInTheDocument();
    });

    it('パンくずリストにプロジェクト詳細へのリンクがある', async () => {
      renderWithProviders('projectId=proj-1');

      const projectLink = await screen.findByText('テストプロジェクト');
      expect(projectLink.closest('a')).toHaveAttribute('href', '/projects/proj-1?tab=suites');
    });

    it('保存成功時に /test-suites/:id へ遷移する', async () => {
      renderWithProviders('projectId=proj-1');

      await act(async () => {
        screen.getByTestId('form-save').click();
      });

      expect(await screen.findByTestId('suite-detail')).toBeInTheDocument();
    });

    it('キャンセル時に /projects/:projectId?tab=suites へ遷移する', async () => {
      renderWithProviders('projectId=proj-1');

      await act(async () => {
        screen.getByTestId('form-cancel').click();
      });

      expect(await screen.findByTestId('project-detail')).toBeInTheDocument();
    });
  });
});
