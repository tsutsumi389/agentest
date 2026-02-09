import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// モック設定
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const { mockAuthApi } = vi.hoisted(() => {
  return {
    mockAuthApi: {
      login: vi.fn(),
      register: vi.fn(),
      me: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
    },
  };
});

vi.mock('../../lib/api', () => ({
  authApi: mockAuthApi,
}));

import { RegisterPage } from '../Register';

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <RegisterPage />
    </MemoryRouter>
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('フォーム表示', () => {
    it('名前、メールアドレス、パスワード、パスワード確認の入力欄が表示される', () => {
      renderRegisterPage();

      expect(screen.getByLabelText('名前')).toBeInTheDocument();
      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
      expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
      expect(screen.getByLabelText('パスワード（確認）')).toBeInTheDocument();
    });

    it('「アカウント作成」ボタンが表示される', () => {
      renderRegisterPage();

      expect(screen.getByRole('button', { name: 'アカウント作成' })).toBeInTheDocument();
    });

    it('OAuthボタンが表示される', () => {
      renderRegisterPage();

      expect(screen.getByRole('button', { name: /GitHub/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Google/ })).toBeInTheDocument();
    });

    it('「既にアカウントをお持ちの場合はログイン」リンクが表示される', () => {
      renderRegisterPage();

      const link = screen.getByRole('link', { name: 'ログイン' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/login');
    });
  });

  describe('パスワード強度チェック', () => {
    it('パスワード強度チェックリストが表示される', () => {
      renderRegisterPage();

      expect(screen.getByText('8文字以上')).toBeInTheDocument();
      expect(screen.getByText('大文字を含む')).toBeInTheDocument();
      expect(screen.getByText('小文字を含む')).toBeInTheDocument();
      expect(screen.getByText('数字を含む')).toBeInTheDocument();
      expect(screen.getByText('記号を含む')).toBeInTheDocument();
    });

    it('入力に応じてチェックリストが更新される', () => {
      renderRegisterPage();

      const passwordInput = screen.getByLabelText('パスワード');

      // 大文字+小文字+数字+記号+8文字以上を入力
      fireEvent.change(passwordInput, { target: { value: 'Abcdef1!' } });

      // すべてのチェックが満たされる
      const checkItems = screen.getAllByTestId('password-check-item');
      checkItems.forEach((item) => {
        expect(item).toHaveAttribute('data-met', 'true');
      });
    });

    it('条件未達のチェック項目はdata-met=falseになる', () => {
      renderRegisterPage();

      const passwordInput = screen.getByLabelText('パスワード');

      // 小文字のみ
      fireEvent.change(passwordInput, { target: { value: 'abc' } });

      const checkItems = screen.getAllByTestId('password-check-item');
      // 「小文字を含む」のみtrue、他はfalse
      const metItems = checkItems.filter((item) => item.getAttribute('data-met') === 'true');
      const unmetItems = checkItems.filter((item) => item.getAttribute('data-met') === 'false');
      expect(metItems).toHaveLength(1); // 小文字のみ
      expect(unmetItems).toHaveLength(4);
    });
  });

  describe('バリデーション', () => {
    it('パスワードと確認が不一致の場合にエラーが表示される', async () => {
      renderRegisterPage();

      fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'テスト' } });
      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'DifferentPass1!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'アカウント作成' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('パスワードが一致しません');
      });

      // APIは呼ばれない
      expect(mockAuthApi.register).not.toHaveBeenCalled();
    });
  });

  describe('フォーム送信', () => {
    it('有効なフォーム送信でauthApi.registerが呼ばれる', async () => {
      const mockUser = { id: 'user-1', name: 'テスト', email: 'test@example.com' };
      mockAuthApi.register.mockResolvedValue({ user: mockUser });

      renderRegisterPage();

      fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'テスト' } });
      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'Password123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'アカウント作成' }));

      await waitFor(() => {
        expect(mockAuthApi.register).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'Password123!',
          name: 'テスト',
        });
      });
    });

    it('登録成功後にメール確認ページに遷移する', async () => {
      mockAuthApi.register.mockResolvedValue({ message: '確認メールを送信しました', user: { id: 'user-1', email: 'test@example.com', name: 'テスト' } });

      renderRegisterPage();

      fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'テスト' } });
      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'Password123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'アカウント作成' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/check-email?email=test%40example.com', { replace: true });
      });
    });

    it('メール重複エラー時にメッセージが表示される', async () => {
      mockAuthApi.register.mockRejectedValue(
        new Error('このメールアドレスは既に登録されています')
      );

      renderRegisterPage();

      fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'テスト' } });
      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'existing@example.com' },
      });
      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'Password123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'アカウント作成' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'このメールアドレスは既に登録されています'
        );
      });
    });

    it('送信中はボタンがdisabledになる', async () => {
      // resolveしないPromiseで送信中状態を維持
      mockAuthApi.register.mockReturnValue(new Promise(() => {}));

      renderRegisterPage();

      fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'テスト' } });
      fireEvent.change(screen.getByLabelText('メールアドレス'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'Password123!' },
      });
      fireEvent.change(screen.getByLabelText('パスワード（確認）'), {
        target: { value: 'Password123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'アカウント作成' }));

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /作成中/ });
        expect(submitButton).toBeDisabled();
      });
    });
  });
});
