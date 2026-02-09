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
      initialize: vi.fn(),
      setUser: vi.fn(),
    },
  };
});

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
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

  describe('認証済みリダイレクト', () => {
    it('既にログイン済みの場合はダッシュボードにリダイレクトされる', () => {
      mockAuthStore.isAuthenticated = true;

      renderLoginPage();

      // LoginPageがリダイレクトするため、フォームは表示されない
      expect(screen.queryByLabelText('メールアドレス')).not.toBeInTheDocument();
    });
  });
});
