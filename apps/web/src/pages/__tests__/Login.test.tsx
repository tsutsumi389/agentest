import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// モック設定
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const { mockAuthStore } = vi.hoisted(() => {
  return {
    mockAuthStore: {
      isAuthenticated: false,
      isLoading: false,
      user: null,
      requires2FA: false,
      twoFactorToken: null,
      initialize: vi.fn(),
      setUser: vi.fn(),
      set2FARequired: vi.fn(),
    },
  };
});

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}));

const { mockConfigStore } = vi.hoisted(() => {
  return {
    mockConfigStore: {
      auth: {
        providers: { github: true, google: true },
        requireEmailVerification: true,
      },
      isLoaded: true,
      fetchConfig: vi.fn(),
      isOAuthEnabled: vi.fn(() => true),
    },
  };
});

vi.mock('../../stores/config', () => ({
  useConfigStore: () => mockConfigStore,
}));

const { mockAuthApi, MockApiError } = vi.hoisted(() => {
  // テスト用のApiErrorクラス
  class MockApiError extends Error {
    statusCode: number;
    code: string;
    constructor(statusCode: number, code: string, message: string) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
      this.code = code;
    }
  }
  return {
    mockAuthApi: {
      login: vi.fn(),
      register: vi.fn(),
      me: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
    },
    MockApiError,
  };
});

vi.mock('../../lib/api', () => ({
  authApi: mockAuthApi,
  ApiError: MockApiError,
}));

import { LoginPage } from '../Login';

function renderLoginPage(initialEntries: string[] = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.isAuthenticated = false;
    mockAuthStore.isLoading = false;
    mockAuthStore.user = null;
    mockAuthStore.requires2FA = false;
    mockAuthStore.twoFactorToken = null;
    // デフォルト: 両プロバイダー有効
    mockConfigStore.auth = {
      providers: { github: true, google: true },
      requireEmailVerification: true,
    };
    mockConfigStore.isLoaded = true;
    mockConfigStore.isOAuthEnabled.mockReturnValue(true);
  });

  describe('フォーム表示', () => {
    it('メールアドレスとパスワードの入力欄が表示される', () => {
      renderLoginPage();

      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
      expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
    });

    it('ログインボタンが表示される', () => {
      renderLoginPage();

      expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
    });

    it('「パスワードを忘れた場合」リンクが表示される', () => {
      renderLoginPage();

      const link = screen.getByRole('link', { name: 'パスワードをお忘れですか？' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/forgot-password');
    });

    it('OAuthボタン（GitHub/Google）が表示される', () => {
      renderLoginPage();

      expect(screen.getByRole('button', { name: /GitHub/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Google/ })).toBeInTheDocument();
    });

    it('「アカウントをお持ちでない場合は新規登録」リンクが表示される', () => {
      renderLoginPage();

      const link = screen.getByRole('link', { name: '新規登録' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/register');
    });

    it('「または」の区切り線が表示される', () => {
      renderLoginPage();

      expect(screen.getByText('または')).toBeInTheDocument();
    });
  });

  describe('OAuth条件表示', () => {
    it('両プロバイダー無効の場合、OAuthボタンと「または」区切りが非表示', () => {
      mockConfigStore.auth = {
        providers: { github: false, google: false },
        requireEmailVerification: true,
      };
      mockConfigStore.isOAuthEnabled.mockReturnValue(false);

      renderLoginPage();

      expect(screen.queryByRole('button', { name: /GitHub/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Google/ })).not.toBeInTheDocument();
      expect(screen.queryByText('または')).not.toBeInTheDocument();
    });

    it('GitHubのみ有効の場合、GitHubボタンのみ表示', () => {
      mockConfigStore.auth = {
        providers: { github: true, google: false },
        requireEmailVerification: true,
      };
      mockConfigStore.isOAuthEnabled.mockReturnValue(true);

      renderLoginPage();

      expect(screen.getByRole('button', { name: /GitHub/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Google/ })).not.toBeInTheDocument();
      expect(screen.getByText('または')).toBeInTheDocument();
    });

    it('Googleのみ有効の場合、Googleボタンのみ表示', () => {
      mockConfigStore.auth = {
        providers: { github: false, google: true },
        requireEmailVerification: true,
      };
      mockConfigStore.isOAuthEnabled.mockReturnValue(true);

      renderLoginPage();

      expect(screen.queryByRole('button', { name: /GitHub/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Google/ })).toBeInTheDocument();
      expect(screen.getByText('または')).toBeInTheDocument();
    });
  });

  describe('フォーム送信', () => {
    it('有効なフォーム送信でauthApi.loginが呼ばれる', async () => {
      const mockUser = { id: 'user-1', name: 'テスト', email: 'test@example.com' };
      mockAuthApi.login.mockResolvedValue({ user: mockUser });

      renderLoginPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

      await waitFor(() => {
        expect(mockAuthApi.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'Password123!',
        });
      });
    });

    it('ログイン成功後にダッシュボードに遷移する', async () => {
      const mockUser = { id: 'user-1', name: 'テスト', email: 'test@example.com' };
      mockAuthApi.login.mockResolvedValue({ user: mockUser });

      renderLoginPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    it('ログイン失敗時にエラーメッセージが表示される', async () => {
      mockAuthApi.login.mockRejectedValue(new Error('メールアドレスまたはパスワードが正しくありません'));

      renderLoginPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'wrongpass' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'メールアドレスまたはパスワードが正しくありません'
        );
      });
    });

    it('ログイン失敗後にパスワード入力欄がクリアされる', async () => {
      mockAuthApi.login.mockRejectedValue(new Error('メールアドレスまたはパスワードが正しくありません'));

      renderLoginPage();

      const passwordInput = screen.getByLabelText('パスワード');
      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(passwordInput, {
        target: { value: 'wrongpass' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

      await waitFor(() => {
        expect(passwordInput).toHaveValue('');
      });
    });

    it('送信中はボタンがdisabledになる', async () => {
      // resolveしないPromiseで送信中状態を維持
      mockAuthApi.login.mockReturnValue(new Promise(() => {}));

      renderLoginPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /ログイン中/ });
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('2FAフロー', () => {
    it('2FA必要レスポンスの場合はset2FARequiredが呼ばれ、/2fa/verifyに遷移する', async () => {
      mockAuthApi.login.mockResolvedValue({
        requires2FA: true,
        twoFactorToken: 'temp-token-abc',
      });

      renderLoginPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

      await waitFor(() => {
        expect(mockAuthStore.set2FARequired).toHaveBeenCalledWith('temp-token-abc');
        expect(mockNavigate).toHaveBeenCalledWith('/2fa/verify', { replace: true });
      });
    });

    it('2FAリダイレクト時にredirectToクエリパラメータを引き継ぐ', async () => {
      mockAuthApi.login.mockResolvedValue({
        requires2FA: true,
        twoFactorToken: 'temp-token-abc',
      });

      renderLoginPage(['/login?redirect=/projects/123']);

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/2fa/verify?redirect=%2Fprojects%2F123',
          { replace: true }
        );
      });
    });

    it('2FA不要の通常ログインレスポンスは従来通りダッシュボードに遷移', async () => {
      const mockUser = { id: 'user-1', name: 'テスト', email: 'test@example.com' };
      mockAuthApi.login.mockResolvedValue({ user: mockUser });

      renderLoginPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));

      await waitFor(() => {
        expect(mockAuthStore.setUser).toHaveBeenCalledWith(mockUser);
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });
  });

  describe('認証済みリダイレクト', () => {
    it('既にログイン済みの場合はダッシュボードにリダイレクトされる', () => {
      mockAuthStore.isAuthenticated = true;

      renderLoginPage();

      // LoginPageがリダイレクトするため、フォームは表示されない
      expect(screen.queryByLabelText('メールアドレス')).not.toBeInTheDocument();
    });
  });
});
