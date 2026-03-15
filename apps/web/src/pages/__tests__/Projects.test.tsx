import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// モック
const mockUser = { id: 'user-1', name: 'テストユーザー', email: 'test@example.com' };
const mockOrganizations = [
  {
    organization: { id: 'org-1', name: 'テスト組織', deletedAt: null },
    role: 'OWNER' as const,
  },
];

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({ user: mockUser }),
}));

const { mockOrganizationStore } = vi.hoisted(() => {
  return {
    mockOrganizationStore: {
      organizations: [] as Array<{
        organization: { id: string; name: string; deletedAt: string | null };
        role: string;
      }>,
    },
  };
});

vi.mock('../../stores/organization', () => ({
  useOrganizationStore: () => mockOrganizationStore,
}));

vi.mock('../../lib/api', () => ({
  usersApi: {
    getProjects: vi.fn().mockResolvedValue({ projects: [] }),
  },
}));

vi.mock('../../components/project/CreateProjectModal', () => ({
  CreateProjectModal: vi.fn(
    ({
      isOpen,
      organizationId,
    }: {
      isOpen: boolean;
      onClose: () => void;
      organizationId?: string;
    }) =>
      isOpen ? (
        <div data-testid="create-project-modal">
          <span data-testid="modal-organization-id">{organizationId ?? 'undefined'}</span>
        </div>
      ) : null
  ),
}));

import { ProjectsPage } from '../Projects';

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrganizationStore.organizations = mockOrganizations;
  });

  describe('組織フィルター', () => {
    it('「すべて」の選択肢が存在しない', () => {
      renderWithProviders();

      const select = screen.getByRole('combobox');
      const options = Array.from(select.querySelectorAll('option'));
      const optionValues = options.map((o) => o.getAttribute('value'));

      expect(optionValues).not.toContain('all');
    });

    it('デフォルトで「個人プロジェクト」が選択されている', () => {
      renderWithProviders();

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('personal');
    });

    it('組織の選択肢が表示される', () => {
      renderWithProviders();

      const select = screen.getByRole('combobox');
      const options = Array.from(select.querySelectorAll('option'));
      const optionValues = options.map((o) => o.getAttribute('value'));

      expect(optionValues).toContain('personal');
      expect(optionValues).toContain('org-1');
    });
  });

  describe('CreateProjectModal へのコンテキスト連動', () => {
    it('個人フィルター時、organizationId=undefined でモーダルに渡す', () => {
      renderWithProviders();

      // 「新規プロジェクト」ボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: /新規プロジェクト/ }));

      expect(screen.getByTestId('modal-organization-id')).toHaveTextContent('undefined');
    });

    it('組織フィルター時、organizationId でモーダルに渡す', () => {
      renderWithProviders();

      // フィルターを組織に切り替え
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'org-1' } });

      // 「新規プロジェクト」ボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: /新規プロジェクト/ }));

      expect(screen.getByTestId('modal-organization-id')).toHaveTextContent('org-1');
    });
  });
});
