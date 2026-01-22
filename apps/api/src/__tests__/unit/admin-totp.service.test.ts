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

// AdminUserRepository のモック
const mockUserRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findByEmailWithPassword: vi.fn(),
  enableTotp: vi.fn(),
  disableTotp: vi.fn(),
  getTotpSecret: vi.fn(),
}));

vi.mock('../../repositories/admin-user.repository.js', () => ({
  AdminUserRepository: vi.fn().mockImplementation(() => mockUserRepo),
}));

// AdminAuditLogService のモック
const mockAuditLogService = vi.hoisted(() => ({
  log: vi.fn(),
}));

vi.mock('../../services/admin/admin-audit-log.service.js', () => ({
  AdminAuditLogService: vi.fn().mockImplementation(() => mockAuditLogService),
}));

// redis-store のモック
const mockRedisStore = vi.hoisted(() => ({
  setTotpSetupSecret: vi.fn(),
  getTotpSetupSecret: vi.fn(),
  deleteTotpSetupSecret: vi.fn(),
  markTotpCodeUsed: vi.fn(),
  isTotpCodeUsed: vi.fn(),
}));

vi.mock('../../lib/redis-store.js', () => mockRedisStore);

// モック設定後にインポート
import { AdminTotpService } from '../../services/admin/admin-totp.service.js';
import bcrypt from 'bcryptjs';

describe('AdminTotpService', () => {
  let service: AdminTotpService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminTotpService();
  });

  describe('setupTotp', () => {
    it('TOTP秘密鍵とQRコードを生成できる', async () => {
      const adminUserId = 'admin-1';
      const email = 'admin@example.com';
      const secret = 'JBSWY3DPEHPK3PXP';
      const otpauthUrl = `otpauth://totp/Agentest%20Admin:${email}?secret=${secret}&issuer=Agentest%20Admin`;

      mockOtplib.generateSecret.mockReturnValue(secret);
      mockOtplib.generateURI.mockReturnValue(otpauthUrl);
      mockRedisStore.setTotpSetupSecret.mockResolvedValue(true);

      const result = await service.setupTotp(adminUserId, email, '127.0.0.1', 'Test Browser');

      expect(result).toEqual({
        secret,
        qrCodeDataUrl: 'data:image/png;base64,mock-qr-code',
        otpauthUrl,
      });
      expect(mockRedisStore.setTotpSetupSecret).toHaveBeenCalledWith(adminUserId, secret, 300);
      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId,
        action: 'TOTP_SETUP_INITIATED',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('Redis保存失敗時にエラーをスローする', async () => {
      mockOtplib.generateSecret.mockReturnValue('secret');
      mockOtplib.generateURI.mockReturnValue('otpauth://...');
      mockRedisStore.setTotpSetupSecret.mockResolvedValue(false);

      await expect(
        service.setupTotp('admin-1', 'admin@example.com')
      ).rejects.toThrow('TOTPセットアップの一時保存に失敗しました');
    });
  });

  describe('enableTotp', () => {
    it('正しいコードでTOTPを有効化できる', async () => {
      const adminUserId = 'admin-1';
      const code = '123456';
      const tempSecret = 'JBSWY3DPEHPK3PXP';

      mockRedisStore.getTotpSetupSecret.mockResolvedValue(tempSecret);
      mockOtplib.verifySync.mockReturnValue({ valid: true });
      mockUserRepo.enableTotp.mockResolvedValue(undefined);
      mockRedisStore.deleteTotpSetupSecret.mockResolvedValue(true);

      await service.enableTotp(adminUserId, code, '127.0.0.1', 'Test Browser');

      expect(mockOtplib.verifySync).toHaveBeenCalledWith({ secret: tempSecret, token: code });
      expect(mockUserRepo.enableTotp).toHaveBeenCalledWith(adminUserId, tempSecret);
      expect(mockRedisStore.deleteTotpSetupSecret).toHaveBeenCalledWith(adminUserId);
      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId,
        action: 'TOTP_ENABLED',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('一時秘密鍵が期限切れの場合はValidationError', async () => {
      mockRedisStore.getTotpSetupSecret.mockResolvedValue(null);

      await expect(
        service.enableTotp('admin-1', '123456')
      ).rejects.toThrow(ValidationError);
    });

    it('不正なコードの場合はValidationError', async () => {
      mockRedisStore.getTotpSetupSecret.mockResolvedValue('JBSWY3DPEHPK3PXP');
      mockOtplib.verifySync.mockReturnValue({ valid: false });

      await expect(
        service.enableTotp('admin-1', '000000', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow(ValidationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId: 'admin-1',
        action: 'TOTP_ENABLE_FAILED',
        details: { reason: 'invalid_code' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });
  });

  describe('verifyTotp', () => {
    it('正しいコードで検証成功する', async () => {
      const adminUserId = 'admin-1';
      const code = '123456';
      const secret = 'JBSWY3DPEHPK3PXP';

      mockRedisStore.isTotpCodeUsed.mockResolvedValue(false);
      mockUserRepo.getTotpSecret.mockResolvedValue(secret);
      mockOtplib.verifySync.mockReturnValue({ valid: true });
      mockRedisStore.markTotpCodeUsed.mockResolvedValue(true);

      const result = await service.verifyTotp(adminUserId, code, '127.0.0.1', 'Test Browser');

      expect(result).toBe(true);
      expect(mockRedisStore.markTotpCodeUsed).toHaveBeenCalledWith(adminUserId, code, 90);
      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId,
        action: 'TOTP_VERIFY_SUCCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('使用済みコードの場合はAuthenticationError', async () => {
      mockRedisStore.isTotpCodeUsed.mockResolvedValue(true);

      await expect(
        service.verifyTotp('admin-1', '123456', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow(AuthenticationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId: 'admin-1',
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'code_already_used' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('TOTP未設定の場合はAuthenticationError', async () => {
      mockRedisStore.isTotpCodeUsed.mockResolvedValue(false);
      mockUserRepo.getTotpSecret.mockResolvedValue(null);

      await expect(
        service.verifyTotp('admin-1', '123456', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow(AuthenticationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId: 'admin-1',
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'totp_not_enabled' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('不正なコードの場合はAuthenticationError', async () => {
      mockRedisStore.isTotpCodeUsed.mockResolvedValue(false);
      mockUserRepo.getTotpSecret.mockResolvedValue('JBSWY3DPEHPK3PXP');
      mockOtplib.verifySync.mockReturnValue({ valid: false });

      await expect(
        service.verifyTotp('admin-1', '000000', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow(AuthenticationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId: 'admin-1',
        action: 'TOTP_VERIFY_FAILED',
        details: { reason: 'invalid_code' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });
  });

  describe('disableTotp', () => {
    it('正しいパスワードでTOTPを無効化できる', async () => {
      const adminUserId = 'admin-1';
      const password = 'correct-password';
      const passwordHash = '$2b$12$hash';

      mockUserRepo.findById.mockResolvedValue({
        id: adminUserId,
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'ADMIN',
        totpEnabled: true,
      });
      mockUserRepo.findByEmailWithPassword.mockResolvedValue({
        id: adminUserId,
        email: 'admin@example.com',
        passwordHash,
      });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      mockUserRepo.disableTotp.mockResolvedValue(undefined);

      await service.disableTotp(adminUserId, password, '127.0.0.1', 'Test Browser');

      expect(bcrypt.compare).toHaveBeenCalledWith(password, passwordHash);
      expect(mockUserRepo.disableTotp).toHaveBeenCalledWith(adminUserId);
      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId,
        action: 'TOTP_DISABLED',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });

    it('ユーザーが見つからない場合はAuthenticationError', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        service.disableTotp('admin-1', 'password')
      ).rejects.toThrow(AuthenticationError);
    });

    it('パスワードが間違っている場合はAuthenticationError', async () => {
      mockUserRepo.findById.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'ADMIN',
        totpEnabled: true,
      });
      mockUserRepo.findByEmailWithPassword.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@example.com',
        passwordHash: '$2b$12$hash',
      });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      await expect(
        service.disableTotp('admin-1', 'wrong-password', '127.0.0.1', 'Test Browser')
      ).rejects.toThrow(AuthenticationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId: 'admin-1',
        action: 'TOTP_DISABLE_FAILED',
        details: { reason: 'invalid_password' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });
    });
  });
});
