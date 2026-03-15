import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// モック
vi.mock('../../../lib/api', () => ({
  projectsApi: {
    create: vi.fn().mockResolvedValue({ project: { id: 'proj-1', name: 'テスト' } }),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      public code: string,
      message: string
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

const mockOrganizations = [
  {
    organization: { id: 'org-1', name: 'テスト組織', deletedAt: null },
    role: 'OWNER' as const,
  },
  {
    organization: { id: 'org-2', name: '削除済み組織', deletedAt: '2024-01-01T00:00:00Z' },
    role: 'MEMBER' as const,
  },
];

vi.mock('../../../stores/organization', () => ({
  useOrganizationStore: () => ({
    organizations: mockOrganizations,
  }),
}));

import { projectsApi } from '../../../lib/api';
import { CreateProjectModal } from '../CreateProjectModal';

const mockedProjectsApi = vi.mocked(projectsApi);

function renderModal(props: { organizationId?: string } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const onClose = vi.fn();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <CreateProjectModal isOpen={true} onClose={onClose} organizationId={props.organizationId} />
    </QueryClientProvider>
  );

  return { ...result, onClose };
}

describe('CreateProjectModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('所有者選択UIの廃止', () => {
    it('個人/組織の所有者選択ボタンが表示されない', () => {
      renderModal();

      // 「個人」「組織」の選択ボタンが存在しないことを確認
      expect(screen.queryByRole('button', { name: '個人' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '組織' })).not.toBeInTheDocument();
    });

    it('組織選択ドロップダウンが表示されない', () => {
      renderModal({ organizationId: 'org-1' });

      // 組織選択のセレクトが存在しないことを確認
      expect(screen.queryByText('組織を選択')).not.toBeInTheDocument();
    });

    it('「所有者」ラベルが表示されない', () => {
      renderModal();

      expect(screen.queryByText('所有者')).not.toBeInTheDocument();
    });
  });

  describe('モーダルタイトル', () => {
    it('organizationId未指定時は「新規プロジェクト（個人）」を表示する', () => {
      renderModal();

      expect(screen.getByText('新規プロジェクト（個人）')).toBeInTheDocument();
    });

    it('organizationId指定時は「新規プロジェクト（組織名）」を表示する', () => {
      renderModal({ organizationId: 'org-1' });

      expect(screen.getByText('新規プロジェクト（テスト組織）')).toBeInTheDocument();
    });
  });

  describe('プロジェクト作成', () => {
    it('organizationId未指定時、個人プロジェクトとして作成する', async () => {
      renderModal();

      fireEvent.change(screen.getByPlaceholderText('例: Webアプリテスト'), {
        target: { value: 'テストプロジェクト' },
      });
      fireEvent.click(screen.getByRole('button', { name: '作成' }));

      await waitFor(() => {
        expect(mockedProjectsApi.create).toHaveBeenCalledWith({
          name: 'テストプロジェクト',
          description: undefined,
          organizationId: undefined,
        });
      });
    });

    it('organizationId指定時、組織プロジェクトとして作成する', async () => {
      renderModal({ organizationId: 'org-1' });

      fireEvent.change(screen.getByPlaceholderText('例: Webアプリテスト'), {
        target: { value: '組織プロジェクト' },
      });
      fireEvent.click(screen.getByRole('button', { name: '作成' }));

      await waitFor(() => {
        expect(mockedProjectsApi.create).toHaveBeenCalledWith({
          name: '組織プロジェクト',
          description: undefined,
          organizationId: 'org-1',
        });
      });
    });
  });
});
