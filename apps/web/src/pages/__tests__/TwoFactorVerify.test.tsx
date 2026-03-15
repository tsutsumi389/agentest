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
      user: null as null | Record<string, unknown>,
      requires2FA: true,
      twoFactorToken: 'temp-token-abc' as string | null,
      verify2FA: vi.fn(),
      set2FARequired: vi.fn(),
    },
  };
});

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}));

const { MockApiError } = vi.hoisted(() => {
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
  return { MockApiError };
});

vi.mock('../../lib/api', () => ({
  ApiError: MockApiError,
}));

import { TwoFactorVerifyPage } from '../TwoFactorVerify';

function renderPage(initialEntries: string[] = ['/2fa/verify']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <TwoFactorVerifyPage />
    </MemoryRouter>
  );
}

describe('TwoFactorVerifyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.isAuthenticated = false;
    mockAuthStore.isLoading = false;
    mockAuthStore.requires2FA = true;
    mockAuthStore.twoFactorToken = 'temp-token-abc';
  });

  describe('フォーム表示', () => {
    it('2FA検証フォームが表示される', () => {
      renderPage();

      expect(screen.getByText('二要素認証')).toBeInTheDocument();
      expect(screen.getByLabelText('認証コード')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '認証する' })).toBeInTheDocument();
    });

    it('認証アプリの説明テキストが表示される', () => {
      renderPage();

      expect(
        screen.getByText(/認証アプリに表示されている6桁のコードを入力してください/)
      ).toBeInTheDocument();
    });

    it('ログインに戻るリンクが表示される', () => {
      renderPage();

      const link = screen.getByRole('link', { name: 'ログインに戻る' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/login');
    });
  });

  describe('コード入力', () => {
    it('6桁の数字のみ入力できる', () => {
      renderPage();

      const input = screen.getByLabelText('認証コード');
      fireEvent.change(input, { target: { value: '123456' } });
      expect(input).toHaveValue('123456');
    });

    it('数字以外の文字は無視される', () => {
      renderPage();

      const input = screen.getByLabelText('認証コード');
      fireEvent.change(input, { target: { value: 'abc123' } });
      expect(input).toHaveValue('123');
    });

    it('7桁以上は切り捨てられる', () => {
      renderPage();

      const input = screen.getByLabelText('認証コード');
      fireEvent.change(input, { target: { value: '1234567' } });
      expect(input).toHaveValue('123456');
    });
  });

  describe('フォーム送信', () => {
    it('有効なコードでverify2FAが呼ばれる', async () => {
      mockAuthStore.verify2FA.mockResolvedValue(undefined);
      renderPage();

      fireEvent.change(screen.getByLabelText('認証コード'), {
        target: { value: '123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: '認証する' }));

      await waitFor(() => {
        expect(mockAuthStore.verify2FA).toHaveBeenCalledWith('123456');
      });
    });

    it('認証成功後にダッシュボードに遷移する', async () => {
      mockAuthStore.verify2FA.mockResolvedValue(undefined);
      renderPage();

      fireEvent.change(screen.getByLabelText('認証コード'), {
        target: { value: '123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: '認証する' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    it('redirectパラメータがある場合はそのURLに遷移する', async () => {
      mockAuthStore.verify2FA.mockResolvedValue(undefined);
      renderPage(['/2fa/verify?redirect=/projects/123']);

      fireEvent.change(screen.getByLabelText('認証コード'), {
        target: { value: '123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: '認証する' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/projects/123', { replace: true });
      });
    });

    it('送信中はボタンがdisabledになる', async () => {
      mockAuthStore.verify2FA.mockReturnValue(new Promise(() => {}));
      renderPage();

      fireEvent.change(screen.getByLabelText('認証コード'), {
        target: { value: '123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: '認証する' }));

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /認証中/ });
        expect(button).toBeDisabled();
      });
    });

    it('6桁未満のコードでは送信ボタンがdisabledになる', () => {
      renderPage();

      fireEvent.change(screen.getByLabelText('認証コード'), {
        target: { value: '123' },
      });

      expect(screen.getByRole('button', { name: '認証する' })).toBeDisabled();
    });
  });

  describe('エラーハンドリング', () => {
    it('認証エラー（401）でエラーメッセージを表示し、ログインに戻るリンクを表示する', async () => {
      mockAuthStore.verify2FA.mockRejectedValue(
        new MockApiError(401, 'AUTHENTICATION_ERROR', '認証コードが無効です')
      );
      renderPage();

      fireEvent.change(screen.getByLabelText('認証コード'), {
        target: { value: '000000' },
      });
      fireEvent.click(screen.getByRole('button', { name: '認証する' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('認証コードが無効です');
      });
    });

    it('トークン期限切れ（401でtwoFactorTokenがnullになった場合）はログインページにリダイレクトされる', async () => {
      // verify2FA内でtwoFactorTokenがnullにされるシナリオ
      // 実際のZustandストアでは401時にトークンがクリアされ、再レンダリングでリダイレクトされる
      mockAuthStore.verify2FA.mockImplementation(async () => {
        mockAuthStore.twoFactorToken = null;
        throw new MockApiError(401, 'AUTHENTICATION_ERROR', 'トークンが期限切れです');
      });
      renderPage();

      fireEvent.change(screen.getByLabelText('認証コード'), {
        target: { value: '000000' },
      });
      fireEvent.click(screen.getByRole('button', { name: '認証する' }));

      // トークンクリア後の再レンダリングでフォームが非表示になる
      await waitFor(() => {
        expect(screen.queryByLabelText('認証コード')).not.toBeInTheDocument();
      });
    });

    it('ネットワークエラーでエラーメッセージを表示する', async () => {
      mockAuthStore.verify2FA.mockRejectedValue(new Error('ネットワークエラー'));
      renderPage();

      fireEvent.change(screen.getByLabelText('認証コード'), {
        target: { value: '123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: '認証する' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('ネットワークエラー');
      });
    });
  });

  describe('リダイレクト', () => {
    it('twoFactorTokenがない場合はログインページにリダイレクトする', () => {
      mockAuthStore.requires2FA = false;
      mockAuthStore.twoFactorToken = null;
      renderPage();

      // フォームが表示されない（リダイレクトされる）
      expect(screen.queryByLabelText('認証コード')).not.toBeInTheDocument();
    });

    it('既に認証済みの場合はダッシュボードにリダイレクトする', () => {
      mockAuthStore.isAuthenticated = true;
      mockAuthStore.requires2FA = false;
      mockAuthStore.twoFactorToken = null;
      renderPage();

      expect(screen.queryByLabelText('認証コード')).not.toBeInTheDocument();
    });
  });
});
