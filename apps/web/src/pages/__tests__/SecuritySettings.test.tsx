import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useSearchParams, useLocation } from 'react-router';

// react-router モック
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useSearchParams: vi.fn(),
    useLocation: vi.fn(),
  };
});

// ストア モック
const { mockAuthStore, mockToast } = vi.hoisted(() => {
  return {
    mockAuthStore: {
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'user-1', name: 'テストユーザー', email: 'test@example.com' },
      initialize: vi.fn(),
      setUser: vi.fn(),
    },
    mockToast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}));

vi.mock('../../stores/toast', () => ({
  toast: mockToast,
}));

// API モック
const { mockSessionsApi, mockAccountsApi, mockPasswordApi, mockApiTokensApi } = vi.hoisted(() => {
  return {
    mockSessionsApi: {
      list: vi.fn(),
      count: vi.fn(),
      revoke: vi.fn(),
      revokeOthers: vi.fn(),
    },
    mockAccountsApi: {
      list: vi.fn(),
      unlink: vi.fn(),
      getLinkUrl: vi.fn(),
    },
    mockPasswordApi: {
      getStatus: vi.fn(),
      setPassword: vi.fn(),
      changePassword: vi.fn(),
    },
    mockApiTokensApi: {
      list: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    },
  };
});

vi.mock('../../lib/api', () => ({
  sessionsApi: mockSessionsApi,
  accountsApi: mockAccountsApi,
  passwordApi: mockPasswordApi,
  apiTokensApi: mockApiTokensApi,
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

import { SettingsPage } from '../Settings';

// ヘルパー関数
function renderSecuritySettings() {
  // security タブを表示する
  const mockSetSearchParams = vi.fn();
  vi.mocked(useSearchParams).mockReturnValue([
    new URLSearchParams('tab=security'),
    mockSetSearchParams,
  ] as unknown as ReturnType<typeof useSearchParams>);
  vi.mocked(useLocation).mockReturnValue({
    pathname: '/settings',
    search: '?tab=security',
    hash: '',
    state: null,
    key: 'default',
  });

  return render(
    <MemoryRouter initialEntries={['/settings?tab=security']}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

// デフォルトのAPIモック設定
function setupDefaultMocks(options?: {
  hasPassword?: boolean;
  accountCount?: number;
}) {
  const { hasPassword = false, accountCount = 1 } = options ?? {};

  mockPasswordApi.getStatus.mockResolvedValue({
    hasPassword,
  });

  const accounts = [];
  if (accountCount >= 1) {
    accounts.push({
      id: 'acc-1',
      provider: 'github',
      providerAccountId: 'gh-123',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    });
  }
  if (accountCount >= 2) {
    accounts.push({
      id: 'acc-2',
      provider: 'google',
      providerAccountId: 'g-456',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    });
  }

  mockAccountsApi.list.mockResolvedValue({ data: accounts });
  mockSessionsApi.list.mockResolvedValue({
    data: [
      {
        id: 'session-1',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        lastAccessedAt: new Date().toISOString(),
        isCurrent: true,
      },
    ],
  });
  mockApiTokensApi.list.mockResolvedValue({ tokens: [] });
}

describe('SecuritySettings - パスワード管理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.user = { id: 'user-1', name: 'テストユーザー', email: 'test@example.com' };
  });

  describe('パスワード管理セクション表示', () => {
    it('パスワード未設定時に「パスワードを設定」ボタンが表示される', async () => {
      setupDefaultMocks({ hasPassword: false });
      renderSecuritySettings();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'パスワードを設定' })).toBeInTheDocument();
      });
    });

    it('パスワード設定済み時に「パスワードを変更」ボタンが表示される', async () => {
      setupDefaultMocks({ hasPassword: true });
      renderSecuritySettings();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'パスワードを変更' })).toBeInTheDocument();
      });
    });

    it('パスワード管理セクションが「接続済みアカウント」セクションの前に表示される', async () => {
      setupDefaultMocks({ hasPassword: false });
      renderSecuritySettings();

      await waitFor(() => {
        expect(screen.getByText('パスワード')).toBeInTheDocument();
      });

      // パスワードセクションが接続済みアカウントの前にあることを確認
      const passwordSection = screen.getByText('パスワード');
      const oauthSection = screen.getByText('接続済みアカウント');
      expect(
        passwordSection.compareDocumentPosition(oauthSection) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe('パスワード設定モーダル（未設定時）', () => {
    beforeEach(() => {
      setupDefaultMocks({ hasPassword: false });
    });

    it('「パスワードを設定」ボタンクリックでモーダルが開く', async () => {
      renderSecuritySettings();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'パスワードを設定' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'パスワードを設定' }));

      await waitFor(() => {
        expect(screen.getByText('パスワードを設定する')).toBeInTheDocument();
      });
    });

    it('新しいパスワード入力欄が表示される', async () => {
      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを設定' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
      });
    });

    it('パスワード確認入力欄が表示される', async () => {
      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを設定' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('パスワード（確認）')).toBeInTheDocument();
      });
    });

    it('パスワード強度チェックリストが表示される', async () => {
      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを設定' }));
      });

      await waitFor(() => {
        expect(screen.getAllByTestId('password-check-item')).toHaveLength(5);
      });
    });

    it('パスワードと確認が一致しない場合にエラーが表示される', async () => {
      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを設定' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'DifferentPassword1!' },
      });

      // 送信ボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: '設定する' }));

      await waitFor(() => {
        expect(screen.getByText('パスワードが一致しません')).toBeInTheDocument();
      });
    });

    it('有効な入力で送信するとpasswordApi.setPasswordが呼ばれる', async () => {
      mockPasswordApi.setPassword.mockResolvedValue({ message: 'パスワードを設定しました' });

      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを設定' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: '設定する' }));

      await waitFor(() => {
        expect(mockPasswordApi.setPassword).toHaveBeenCalledWith('user-1', {
          password: 'Password123!',
        });
      });
    });

    it('設定成功後にモーダルが閉じ、ステータスが更新される', async () => {
      mockPasswordApi.setPassword.mockResolvedValue({ message: 'パスワードを設定しました' });
      // 成功後の再取得でパスワード設定済みを返す
      mockPasswordApi.getStatus
        .mockResolvedValueOnce({ hasPassword: false })
        .mockResolvedValueOnce({ hasPassword: true });

      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを設定' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: '設定する' }));

      await waitFor(() => {
        // モーダルが閉じて「パスワードを変更」ボタンが表示される
        expect(screen.getByRole('button', { name: 'パスワードを変更' })).toBeInTheDocument();
      });
    });

    it('エラー時にエラーメッセージが表示される', async () => {
      const { ApiError } = await import('../../lib/api');
      mockPasswordApi.setPassword.mockRejectedValue(
        new ApiError(400, 'VALIDATION_ERROR', 'パスワードが要件を満たしていません'),
      );

      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを設定' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: '設定する' }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('パスワードが要件を満たしていません');
      });
    });
  });

  describe('パスワード変更モーダル（設定済み時）', () => {
    beforeEach(() => {
      setupDefaultMocks({ hasPassword: true });
    });

    it('「パスワードを変更」ボタンクリックでモーダルが開く', async () => {
      renderSecuritySettings();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'パスワードを変更' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

      await waitFor(() => {
        expect(screen.getByText('パスワードを変更する')).toBeInTheDocument();
      });
    });

    it('現在のパスワード入力欄が表示される', async () => {
      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('現在のパスワード')).toBeInTheDocument();
      });
    });

    it('新しいパスワード入力欄が表示される', async () => {
      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
      });
    });

    it('パスワード確認入力欄が表示される', async () => {
      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('パスワード（確認）')).toBeInTheDocument();
      });
    });

    it('有効な入力で送信するとpasswordApi.changePasswordが呼ばれる', async () => {
      mockPasswordApi.changePassword.mockResolvedValue({ message: 'パスワードを変更しました' });

      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('現在のパスワード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('現在のパスワード'), {
        target: { value: 'OldPassword1!' },
      });
      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'NewPassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: '変更する' }));

      await waitFor(() => {
        expect(mockPasswordApi.changePassword).toHaveBeenCalledWith('user-1', {
          currentPassword: 'OldPassword1!',
          newPassword: 'NewPassword123!',
        });
      });
    });

    it('現在のパスワードが間違っている場合にエラーが表示される', async () => {
      const { ApiError } = await import('../../lib/api');
      mockPasswordApi.changePassword.mockRejectedValue(
        new ApiError(401, 'INVALID_PASSWORD', '現在のパスワードが正しくありません'),
      );

      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('現在のパスワード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('現在のパスワード'), {
        target: { value: 'WrongPassword1!' },
      });
      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'NewPassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: '変更する' }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('現在のパスワードが正しくありません');
      });
    });

    it('変更成功後にモーダルが閉じる', async () => {
      mockPasswordApi.changePassword.mockResolvedValue({ message: 'パスワードを変更しました' });

      renderSecuritySettings();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('現在のパスワード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('現在のパスワード'), {
        target: { value: 'OldPassword1!' },
      });
      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'NewPassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: '変更する' }));

      await waitFor(() => {
        // モーダルが閉じて「変更する」ボタンが消える
        expect(screen.queryByText('パスワードを変更する')).not.toBeInTheDocument();
      });
    });
  });

  describe('OAuth解除制約の更新', () => {
    it('パスワード設定済み＆OAuth連携1つの場合、OAuth解除ボタンが有効になる', async () => {
      setupDefaultMocks({ hasPassword: true, accountCount: 1 });
      renderSecuritySettings();

      await waitFor(() => {
        // パスワードが設定されているので、1つだけの連携でも解除ボタンが表示される
        expect(screen.getByTitle('連携を解除')).toBeInTheDocument();
      });
    });

    it('パスワード未設定＆OAuth連携1つの場合、OAuth解除ボタンが無効のまま', async () => {
      setupDefaultMocks({ hasPassword: false, accountCount: 1 });
      renderSecuritySettings();

      await waitFor(() => {
        expect(screen.getByText('接続済み')).toBeInTheDocument();
      });

      // 解除ボタンは表示されない（canUnlink = false）
      expect(screen.queryByTitle('連携を解除')).not.toBeInTheDocument();
    });

    it('パスワード未設定＆OAuth連携2つ以上の場合、OAuth解除ボタンが有効（既存動作維持）', async () => {
      setupDefaultMocks({ hasPassword: false, accountCount: 2 });
      renderSecuritySettings();

      await waitFor(() => {
        // 複数の連携があるので解除ボタンが表示される
        const unlinkButtons = screen.getAllByTitle('連携を解除');
        expect(unlinkButtons.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
