import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ストア モック
const { mockAuthStore, mockToast } = vi.hoisted(() => {
  return {
    mockAuthStore: {
      user: { id: 'user-1', name: 'テストユーザー', email: 'test@example.com', totpEnabled: false },
    },
    mockToast: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}));

vi.mock('../../../stores/toast', () => ({
  toast: mockToast,
}));

// API モック
const { mockAuthApi } = vi.hoisted(() => {
  return {
    mockAuthApi: {
      get2FAStatus: vi.fn(),
      setup2FA: vi.fn(),
      enable2FA: vi.fn(),
      disable2FA: vi.fn(),
    },
  };
});

vi.mock('../../../lib/api', () => ({
  authApi: mockAuthApi,
  ApiError: class ApiError extends Error {
    statusCode: number;
    code: string;
    constructor(statusCode: number, code: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  },
}));

import { TwoFactorSettings } from '../TwoFactorSettings';

function renderComponent() {
  return render(<TwoFactorSettings />);
}

describe('TwoFactorSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.user = {
      id: 'user-1',
      name: 'テストユーザー',
      email: 'test@example.com',
      totpEnabled: false,
    };
  });

  describe('2FA無効時の表示', () => {
    it('「二要素認証」セクションが表示される', async () => {
      mockAuthApi.get2FAStatus.mockResolvedValue({ totpEnabled: false });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('二要素認証')).toBeInTheDocument();
      });
    });

    it('2FA無効時に「セットアップ」ボタンが表示される', async () => {
      mockAuthApi.get2FAStatus.mockResolvedValue({ totpEnabled: false });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'セットアップ' })).toBeInTheDocument();
      });
    });

    it('2FA無効時のステータスメッセージが表示される', async () => {
      mockAuthApi.get2FAStatus.mockResolvedValue({ totpEnabled: false });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('二要素認証は無効です')).toBeInTheDocument();
      });
    });
  });

  describe('2FA有効時の表示', () => {
    it('2FA有効時に「無効にする」ボタンが表示される', async () => {
      mockAuthApi.get2FAStatus.mockResolvedValue({ totpEnabled: true });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '無効にする' })).toBeInTheDocument();
      });
    });

    it('2FA有効時のステータスメッセージが表示される', async () => {
      mockAuthApi.get2FAStatus.mockResolvedValue({ totpEnabled: true });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('二要素認証は有効です')).toBeInTheDocument();
      });
    });
  });

  describe('セットアップフロー', () => {
    beforeEach(() => {
      mockAuthApi.get2FAStatus.mockResolvedValue({ totpEnabled: false });
    });

    it('セットアップボタンをクリックするとQRコードが表示される', async () => {
      mockAuthApi.setup2FA.mockResolvedValue({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeDataUrl: 'data:image/png;base64,mockQRCode',
        otpauthUrl: 'otpauth://totp/Agentest:test@example.com?secret=JBSWY3DPEHPK3PXP',
      });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'セットアップ' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'セットアップ' }));

      await waitFor(() => {
        expect(screen.getByAltText('2FA QRコード')).toBeInTheDocument();
      });
    });

    it('シークレットキーが表示される', async () => {
      mockAuthApi.setup2FA.mockResolvedValue({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeDataUrl: 'data:image/png;base64,mockQRCode',
        otpauthUrl: 'otpauth://totp/Agentest:test@example.com?secret=JBSWY3DPEHPK3PXP',
      });
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'セットアップ' }));
      });

      await waitFor(() => {
        expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
      });
    });

    it('認証コード入力欄が表示される', async () => {
      mockAuthApi.setup2FA.mockResolvedValue({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeDataUrl: 'data:image/png;base64,mockQRCode',
        otpauthUrl: 'otpauth://totp/Agentest:test@example.com?secret=JBSWY3DPEHPK3PXP',
      });
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'セットアップ' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument();
      });
    });

    it('有効なコードで有効化ボタンを押すとenable2FAが呼ばれる', async () => {
      mockAuthApi.setup2FA.mockResolvedValue({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeDataUrl: 'data:image/png;base64,mockQRCode',
        otpauthUrl: 'otpauth://totp/Agentest:test@example.com?secret=JBSWY3DPEHPK3PXP',
      });
      mockAuthApi.enable2FA.mockResolvedValue({ message: '2FAを有効にしました' });
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'セットアップ' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('認証コード'), {
        target: { value: '123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: '有効にする' }));

      await waitFor(() => {
        expect(mockAuthApi.enable2FA).toHaveBeenCalledWith('123456');
      });
    });

    it('有効化成功後にステータスが更新される', async () => {
      mockAuthApi.setup2FA.mockResolvedValue({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeDataUrl: 'data:image/png;base64,mockQRCode',
        otpauthUrl: 'otpauth://totp/Agentest:test@example.com?secret=JBSWY3DPEHPK3PXP',
      });
      mockAuthApi.enable2FA.mockResolvedValue({ message: '2FAを有効にしました' });
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'セットアップ' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('認証コード'), {
        target: { value: '123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: '有効にする' }));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('二要素認証を有効にしました');
      });
    });

    it('有効化失敗時にエラーメッセージが表示される', async () => {
      mockAuthApi.setup2FA.mockResolvedValue({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeDataUrl: 'data:image/png;base64,mockQRCode',
        otpauthUrl: 'otpauth://totp/Agentest:test@example.com?secret=JBSWY3DPEHPK3PXP',
      });
      mockAuthApi.enable2FA.mockRejectedValue(new Error('認証コードが無効です'));
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'セットアップ' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('認証コード'), {
        target: { value: '000000' },
      });
      fireEvent.click(screen.getByRole('button', { name: '有効にする' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('認証コードが無効です');
      });
    });

    it('セットアップ取得失敗時にエラーが表示される', async () => {
      mockAuthApi.setup2FA.mockRejectedValue(new Error('セットアップに失敗しました'));
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'セットアップ' }));
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('セットアップに失敗しました');
      });
    });

    it('キャンセルボタンでセットアップフローを終了できる', async () => {
      mockAuthApi.setup2FA.mockResolvedValue({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeDataUrl: 'data:image/png;base64,mockQRCode',
        otpauthUrl: 'otpauth://totp/Agentest:test@example.com?secret=JBSWY3DPEHPK3PXP',
      });
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'セットアップ' }));
      });

      await waitFor(() => {
        expect(screen.getByAltText('2FA QRコード')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

      await waitFor(() => {
        expect(screen.queryByAltText('2FA QRコード')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'セットアップ' })).toBeInTheDocument();
      });
    });
  });

  describe('無効化フロー', () => {
    beforeEach(() => {
      mockAuthApi.get2FAStatus.mockResolvedValue({ totpEnabled: true });
    });

    it('無効化ボタンをクリックするとパスワード確認モーダルが表示される', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: '無効にする' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
      });
    });

    it('パスワード入力後にdisable2FAが呼ばれる', async () => {
      mockAuthApi.disable2FA.mockResolvedValue({ message: '2FAを無効にしました' });
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: '無効にする' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'MyPassword123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: '二要素認証を無効にする' }));

      await waitFor(() => {
        expect(mockAuthApi.disable2FA).toHaveBeenCalledWith('MyPassword123!');
      });
    });

    it('無効化成功後にステータスが更新される', async () => {
      mockAuthApi.disable2FA.mockResolvedValue({ message: '2FAを無効にしました' });
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: '無効にする' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'MyPassword123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: '二要素認証を無効にする' }));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('二要素認証を無効にしました');
      });
    });

    it('無効化失敗時にエラーが表示される', async () => {
      mockAuthApi.disable2FA.mockRejectedValue(new Error('パスワードが正しくありません'));
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: '無効にする' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('パスワード'), {
        target: { value: 'wrongpassword' },
      });
      fireEvent.click(screen.getByRole('button', { name: '二要素認証を無効にする' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('パスワードが正しくありません');
      });
    });

    it('キャンセルボタンで無効化フローを終了できる', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: '無効にする' }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

      await waitFor(() => {
        expect(screen.queryByLabelText('パスワード')).not.toBeInTheDocument();
      });
    });
  });
});
