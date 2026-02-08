import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// モック設定
const { mockAuthApi } = vi.hoisted(() => {
  return {
    mockAuthApi: {
      login: vi.fn(),
      register: vi.fn(),
      me: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
    },
  };
});

vi.mock('../../lib/api', () => ({
  authApi: mockAuthApi,
}));

import { ForgotPasswordPage } from '../ForgotPassword';

function renderForgotPasswordPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <ForgotPasswordPage />
    </MemoryRouter>
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('フォーム表示', () => {
    it('メールアドレス入力欄が表示される', () => {
      renderForgotPasswordPage();

      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
    });

    it('「リセットリンクを送信」ボタンが表示される', () => {
      renderForgotPasswordPage();

      expect(screen.getByRole('button', { name: 'リセットリンクを送信' })).toBeInTheDocument();
    });

    it('「ログインに戻る」リンクが表示される', () => {
      renderForgotPasswordPage();

      const link = screen.getByRole('link', { name: 'ログインに戻る' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/login');
    });
  });

  describe('フォーム送信', () => {
    it('有効なメール入力で送信するとauthApi.forgotPasswordが呼ばれる', async () => {
      mockAuthApi.forgotPassword.mockResolvedValue({ message: 'メールを送信しました' });

      renderForgotPasswordPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'リセットリンクを送信' }));

      await waitFor(() => {
        expect(mockAuthApi.forgotPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
        });
      });
    });

    it('送信中はボタンがdisabledになる', async () => {
      // resolveしないPromiseで送信中状態を維持
      mockAuthApi.forgotPassword.mockReturnValue(new Promise(() => {}));

      renderForgotPasswordPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'リセットリンクを送信' }));

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /送信中/ });
        expect(submitButton).toBeDisabled();
      });
    });

    it('API失敗時にエラーメッセージが表示される', async () => {
      mockAuthApi.forgotPassword.mockRejectedValue(new Error('送信に失敗しました'));

      renderForgotPasswordPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'リセットリンクを送信' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('送信に失敗しました');
      });
    });
  });

  describe('送信完了', () => {
    it('送信成功後に「メールを送信しました」メッセージが表示される', async () => {
      mockAuthApi.forgotPassword.mockResolvedValue({ message: 'メールを送信しました' });

      renderForgotPasswordPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'リセットリンクを送信' }));

      await waitFor(() => {
        expect(screen.getByText('メールを送信しました')).toBeInTheDocument();
      });
    });

    it('送信成功後に「ログインに戻る」リンクが表示される', async () => {
      mockAuthApi.forgotPassword.mockResolvedValue({ message: 'メールを送信しました' });

      renderForgotPasswordPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'リセットリンクを送信' }));

      await waitFor(() => {
        expect(screen.getByText('メールを送信しました')).toBeInTheDocument();
      });

      const link = screen.getByRole('link', { name: 'ログインに戻る' });
      expect(link).toHaveAttribute('href', '/login');
    });

    it('送信成功後に「再送信」ボタンが表示される', async () => {
      mockAuthApi.forgotPassword.mockResolvedValue({ message: 'メールを送信しました' });

      renderForgotPasswordPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'リセットリンクを送信' }));

      await waitFor(() => {
        expect(screen.getByText('メールを送信しました')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /再送信/ })).toBeInTheDocument();
    });

    it('再送信ボタンクリックでauthApi.forgotPasswordが再度呼ばれる', async () => {
      mockAuthApi.forgotPassword.mockResolvedValue({ message: 'メールを送信しました' });

      renderForgotPasswordPage();

      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'リセットリンクを送信' }));

      await waitFor(() => {
        expect(screen.getByText('メールを送信しました')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /再送信/ }));

      await waitFor(() => {
        expect(mockAuthApi.forgotPassword).toHaveBeenCalledTimes(2);
      });
    });
  });
});
