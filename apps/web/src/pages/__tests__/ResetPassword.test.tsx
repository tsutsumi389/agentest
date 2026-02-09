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
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      public code: string,
      message: string,
      public details?: Record<string, string[]>
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

import { ResetPasswordPage } from '../ResetPassword';
import { ApiError } from '../../lib/api';

function renderResetPasswordPage(initialEntries: string[] = ['/reset-password?token=valid-token']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ResetPasswordPage />
    </MemoryRouter>
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('トークン確認', () => {
    it('トークンがURLに含まれない場合にエラーが表示される', () => {
      renderResetPasswordPage(['/reset-password']);

      expect(screen.getByText('無効なリンクです')).toBeInTheDocument();
    });

    it('トークンがURLに含まれる場合はフォームが表示される', () => {
      renderResetPasswordPage();

      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
    });
  });

  describe('フォーム表示', () => {
    it('新しいパスワード入力欄が表示される', () => {
      renderResetPasswordPage();

      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
    });

    it('パスワード確認入力欄が表示される', () => {
      renderResetPasswordPage();

      expect(screen.getByLabelText('パスワード（確認）')).toBeInTheDocument();
    });

    it('パスワード強度チェックリストが表示される', () => {
      renderResetPasswordPage();

      expect(screen.getByText('8文字以上')).toBeInTheDocument();
      expect(screen.getByText('大文字を含む')).toBeInTheDocument();
      expect(screen.getByText('小文字を含む')).toBeInTheDocument();
      expect(screen.getByText('数字を含む')).toBeInTheDocument();
      expect(screen.getByText('記号を含む')).toBeInTheDocument();
    });

    it('「パスワードを変更」ボタンが表示される', () => {
      renderResetPasswordPage();

      expect(screen.getByRole('button', { name: 'パスワードを変更' })).toBeInTheDocument();
    });
  });

  describe('バリデーション', () => {
    it('パスワードと確認が一致しない場合にエラーが表示される', async () => {
      renderResetPasswordPage();

      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'DifferentPass1!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('パスワードが一致しません');
      });

      // APIは呼ばれない
      expect(mockAuthApi.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('フォーム送信', () => {
    it('有効なフォーム送信でauthApi.resetPasswordが呼ばれる', async () => {
      mockAuthApi.resetPassword.mockResolvedValue({ message: 'パスワードを変更しました' });

      renderResetPasswordPage();

      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

      await waitFor(() => {
        expect(mockAuthApi.resetPassword).toHaveBeenCalledWith({
          token: 'valid-token',
          password: 'NewPassword123!',
        });
      });
    });

    it('送信中はボタンがdisabledになる', async () => {
      mockAuthApi.resetPassword.mockReturnValue(new Promise(() => {}));

      renderResetPasswordPage();

      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /変更中/ });
        expect(submitButton).toBeDisabled();
      });
    });

    it('リセット成功後に「パスワードを変更しました」メッセージが表示される', async () => {
      mockAuthApi.resetPassword.mockResolvedValue({ message: 'パスワードを変更しました' });

      renderResetPasswordPage();

      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

      await waitFor(() => {
        expect(screen.getByText('パスワードを変更しました')).toBeInTheDocument();
      });
    });

    it('リセット成功後にログインリンクが表示される', async () => {
      mockAuthApi.resetPassword.mockResolvedValue({ message: 'パスワードを変更しました' });

      renderResetPasswordPage();

      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

      await waitFor(() => {
        expect(screen.getByText('パスワードを変更しました')).toBeInTheDocument();
      });

      const link = screen.getByRole('link', { name: 'ログインする' });
      expect(link).toHaveAttribute('href', '/login');
    });

    it('トークンが無効な場合にエラーメッセージが表示される', async () => {
      mockAuthApi.resetPassword.mockRejectedValue(
        new ApiError(400, 'INVALID_TOKEN', 'トークンが無効です')
      );

      renderResetPasswordPage();

      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('トークンが無効です');
      });
    });

    it('トークンが期限切れの場合にエラーメッセージと再送信リンクが表示される', async () => {
      mockAuthApi.resetPassword.mockRejectedValue(
        new ApiError(400, 'TOKEN_EXPIRED', 'トークンの有効期限が切れています')
      );

      renderResetPasswordPage();

      fireEvent.change(screen.getByLabelText('新しいパスワード'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'NewPassword123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('トークンの有効期限が切れています');
      });

      const resendLink = screen.getByRole('link', { name: '再送信する' });
      expect(resendLink).toHaveAttribute('href', '/forgot-password');
    });
  });
});
