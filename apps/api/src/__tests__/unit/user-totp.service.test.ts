import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthenticationError, ValidationError } from '@agentest/shared';

// otplib のモック
const mockOtplib = vi.hoisted(() => ({
  generateSecret: vi.fn(),
  generateURI: vi.fn(),
  verifySync: vi.fn(),
}));

vi.mock('otplib', () => mockOtplib);

// QRCode のモック
vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
}));

// bcryptjs のモック
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

// UserRepository のモック
const mockUserRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findByIdWithPassword: vi.fn(),
  enableTotp: vi.fn(),
  disableTotp: vi.fn(),
  getTotpSecret: vi.fn(),
}));

vi.mock('../../repositories/user.repository.js', () => ({
  UserRepository: vi.fn().mockImplementation(() => mockUserRepo),
}));

// AuditLogService のモック
const mockAuditLogService = vi.hoisted(() => ({
  log: vi.fn(),
}));

vi.mock('../../services/audit-log.service.js', () => ({
  AuditLogService: vi.fn().mockImplementation(() => mockAuditLogService),
}));

// totp-crypto のモック
const mockTotpCrypto = vi.hoisted(() => ({
  encryptTotpSecret: vi.fn(),
  decryptTotpSecret: vi.fn(),
}));

vi.mock('../../lib/totp-crypto.js', () => mockTotpCrypto);

// redis-store のモック
const mockRedisStore = vi.hoisted(() => ({
  setUserTotpSetupSecret: vi.fn(),
  getUserTotpSetupSecret: vi.fn(),
  deleteUserTotpSetupSecret: vi.fn(),
  markUserTotpCodeUsed: vi.fn(),
  isUserTotpCodeUsed: vi.fn(),
}));

vi.mock('../../lib/redis-store.js', () => mockRedisStore);

// モック設定後にインポート
import { UserTotpService } from '../../services/user-totp.service.js';
import bcrypt from 'bcryptjs';

describe('UserTotpService', () => {
  let service: UserTotpService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserTotpService();
  });

  describe('setupTotp', () => {
    it('TOTP秘密鍵とQRコードを生成できる', async () => {
      const userId = 'user-1';
      const email = 'user@example.com';
      const secret = 'JBSWY3DPEHPK3PXP';
      const otpauthUrl = `otpauth://totp/Agentest:${email}?secret=${secret}&issuer=Agentest`;

      mockOtplib.generateSecret.mockReturnValue(secret);
      mockOtplib.generateURI.mockReturnValue(otpauthUrl);
      mockRedisStore.setUserTotpSetupSecret.mockResolvedValue(true);

      const result = await service.setupTotp(userId, email, '127.0.0.1', 'Test Browser');

      expect(result).toEqual({
        secret,
        qrCodeDataUrl: 'data:image/png;base64,mock-qr-code',
        otpauthUrl,
      });
      expect(mockOtplib.generateSecret).toHaveBeenCalled();
      expect(mockOtplib.generateURI).toHaveBeenCalledWith({
        issuer: 'Agentest',
        label: email,
        secret,
      });
      expect(mockRedisStore.setUserTotpSetupSecret).toHaveBeenCalledWith(userId, secret, 300);
      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId,
        category: 'AUTH',
        action: 'TOTP_SETUP_INITIATED',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('Redis保存失敗時にエラーをスローする', async () => {
      mockOtplib.generateSecret.mockReturnValue('secret');
      mockOtplib.generateURI.mockReturnValue('otpauth://...');
      mockRedisStore.setUserTotpSetupSecret.mockResolvedValue(false);

      await expect(
        service.setupTotp('user-1', 'user@example.com')
      ).rejects.toThrow('TOTPセットアップの一時保存に失敗しました');
    });
  });

  describe('enableTotp', () => {
    it('正しいコードでTOTPを有効化できる', async () => {
      const userId = 'user-1';
      const code = '123456';
      const tempSecret = 'JBSWY3DPEHPK3PXP';
      const encryptedSecret = 'enc:v1:iv:tag:cipher';

      mockUserRepo.getTotpSecret.mockResolvedValue(null); // まだ2FA未設定
      mockRedisStore.getUserTotpSetupSecret.mockResolvedValue(tempSecret);
      mockOtplib.verifySync.mockReturnValue({ valid: true });
      mockTotpCrypto.encryptTotpSecret.mockReturnValue(encryptedSecret);
      mockUserRepo.enableTotp.mockResolvedValue(undefined);
      mockRedisStore.deleteUserTotpSetupSecret.mockResolvedValue(true);

      await service.enableTotp(userId, code, '127.0.0.1', 'Test Browser');

      // コード検証に一時秘密鍵が使われる
      expect(mockOtplib.verifySync).toHaveBeenCalledWith({ secret: tempSecret, token: code });
      // 暗号化してからDB保存
      expect(mockTotpCrypto.encryptTotpSecret).toHaveBeenCalledWith(tempSecret);
      expect(mockUserRepo.enableTotp).toHaveBeenCalledWith(userId, encryptedSecret);
      // Redis一時データの削除
      expect(mockRedisStore.deleteUserTotpSetupSecret).toHaveBeenCalledWith(userId);
      // 監査ログ
      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId,
        category: 'AUTH',
        action: 'TOTP_ENABLED',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('既に2FAが有効な場合はValidationError', async () => {
      mockUserRepo.getTotpSecret.mockResolvedValue('EXISTING_ENCRYPTED_SECRET');

      await expect(
        service.enableTotp('user-1', '123456', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow(ValidationError);
    });

    it('一時秘密鍵が期限切れの場合はValidationError', async () => {
      mockUserRepo.getTotpSecret.mockResolvedValue(null);
      mockRedisStore.getUserTotpSetupSecret.mockResolvedValue(null);

      await expect(
        service.enableTotp('user-1', '123456')
      ).rejects.toThrow(ValidationError);
    });

    it('暗号化失敗時はエラーをスローする', async () => {
      mockUserRepo.getTotpSecret.mockResolvedValue(null);
      mockRedisStore.getUserTotpSetupSecret.mockResolvedValue('JBSWY3DPEHPK3PXP');
      mockOtplib.verifySync.mockReturnValue({ valid: true });
      mockTotpCrypto.encryptTotpSecret.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      await expect(
        service.enableTotp('user-1', '123456', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow('2要素認証の有効化に失敗しました');

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        category: 'AUTH',
        action: 'TOTP_ENABLE_FAILED',
        details: { reason: 'encryption_failed' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('不正なコードの場合はValidationError + 監査ログ', async () => {
      mockUserRepo.getTotpSecret.mockResolvedValue(null);
      mockRedisStore.getUserTotpSetupSecret.mockResolvedValue('JBSWY3DPEHPK3PXP');
      mockOtplib.verifySync.mockReturnValue({ valid: false });

      await expect(
        service.enableTotp('user-1', '000000', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow(ValidationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        category: 'AUTH',
        action: 'TOTP_ENABLE_FAILED',
        details: { reason: 'invalid_code' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });
  });

  describe('verifyTotp', () => {
    it('正しいコードで検証成功する', async () => {
      const userId = 'user-1';
      const code = '123456';
      const encryptedSecret = 'enc:v1:iv:tag:cipher';
      const decryptedSecret = 'JBSWY3DPEHPK3PXP';

      mockRedisStore.isUserTotpCodeUsed.mockResolvedValue(false);
      mockUserRepo.getTotpSecret.mockResolvedValue(encryptedSecret);
      mockTotpCrypto.decryptTotpSecret.mockReturnValue(decryptedSecret);
      mockOtplib.verifySync.mockReturnValue({ valid: true });
      mockRedisStore.markUserTotpCodeUsed.mockResolvedValue(true);

      const result = await service.verifyTotp(userId, code, '127.0.0.1', 'Test Browser');

      expect(result).toBe(true);
      // 暗号化秘密鍵を復号してから検証
      expect(mockTotpCrypto.decryptTotpSecret).toHaveBeenCalledWith(encryptedSecret);
      expect(mockOtplib.verifySync).toHaveBeenCalledWith({ secret: decryptedSecret, token: code });
      // リプレイ攻撃対策
      expect(mockRedisStore.markUserTotpCodeUsed).toHaveBeenCalledWith(userId, code, 90);
      // 監査ログ
      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId,
        category: 'AUTH',
        action: 'TOTP_VERIFY_SUCCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('復号化失敗時はAuthenticationErrorをスローする', async () => {
      mockRedisStore.isUserTotpCodeUsed.mockResolvedValue(false);
      mockUserRepo.getTotpSecret.mockResolvedValue('corrupted-data');
      mockTotpCrypto.decryptTotpSecret.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      await expect(
        service.verifyTotp('user-1', '123456', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow(AuthenticationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        category: 'AUTH',
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'decryption_failed' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('使用済みコードの場合はAuthenticationError', async () => {
      mockRedisStore.isUserTotpCodeUsed.mockResolvedValue(true);

      await expect(
        service.verifyTotp('user-1', '123456', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow(AuthenticationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        category: 'AUTH',
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'code_already_used' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('TOTP未設定の場合はAuthenticationError', async () => {
      mockRedisStore.isUserTotpCodeUsed.mockResolvedValue(false);
      mockUserRepo.getTotpSecret.mockResolvedValue(null);

      await expect(
        service.verifyTotp('user-1', '123456', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow(AuthenticationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        category: 'AUTH',
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'totp_not_enabled' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('不正なコードの場合はAuthenticationError', async () => {
      const encryptedSecret = 'enc:v1:iv:tag:cipher';
      mockRedisStore.isUserTotpCodeUsed.mockResolvedValue(false);
      mockUserRepo.getTotpSecret.mockResolvedValue(encryptedSecret);
      mockTotpCrypto.decryptTotpSecret.mockReturnValue('JBSWY3DPEHPK3PXP');
      mockOtplib.verifySync.mockReturnValue({ valid: false });

      await expect(
        service.verifyTotp('user-1', '000000', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow(AuthenticationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        category: 'AUTH',
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'invalid_code' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });
  });

  describe('disableTotp', () => {
    it('正しいパスワードでTOTPを無効化できる', async () => {
      const userId = 'user-1';
      const password = 'correct-password';
      const passwordHash = '$2b$12$hash';

      mockUserRepo.findByIdWithPassword.mockResolvedValue({
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        totpEnabled: true,
        passwordHash,
      });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      mockUserRepo.disableTotp.mockResolvedValue(undefined);

      await service.disableTotp(userId, password, '127.0.0.1', 'Test Browser');

      expect(bcrypt.compare).toHaveBeenCalledWith(password, passwordHash);
      expect(mockUserRepo.disableTotp).toHaveBeenCalledWith(userId);
      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId,
        category: 'AUTH',
        action: 'TOTP_DISABLED',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('ユーザーが見つからない場合はAuthenticationError', async () => {
      mockUserRepo.findByIdWithPassword.mockResolvedValue(null);

      await expect(
        service.disableTotp('user-1', 'password')
      ).rejects.toThrow(AuthenticationError);
    });

    it('パスワードが間違っている場合はAuthenticationError + 監査ログ', async () => {
      mockUserRepo.findByIdWithPassword.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        totpEnabled: true,
        passwordHash: '$2b$12$hash',
      });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      await expect(
        service.disableTotp('user-1', 'wrong-password', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow(AuthenticationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        category: 'AUTH',
        action: 'TOTP_DISABLE_FAILED',
        details: { reason: 'invalid_password' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('パスワード未設定（OAuthユーザー）の場合はAuthenticationError', async () => {
      mockUserRepo.findByIdWithPassword.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        totpEnabled: true,
        passwordHash: null,
      });

      await expect(
        service.disableTotp('user-1', 'password')
      ).rejects.toThrow(AuthenticationError);
    });
  });
});
