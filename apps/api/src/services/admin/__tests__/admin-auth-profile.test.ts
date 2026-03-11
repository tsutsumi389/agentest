import { describe, it, expect, vi, beforeEach } from 'vitest';

// モック定義
const mockUserRepo = {
  findByIdWithPassword: vi.fn(),
  updateName: vi.fn(),
  updatePassword: vi.fn(),
};

const mockAuditLogService = {
  log: vi.fn(),
};

const mockSessionService = {
  revokeAllSessionsExcept: vi.fn(),
};

vi.mock('../../../repositories/admin-user.repository.js', () => ({
  AdminUserRepository: vi.fn().mockImplementation(() => mockUserRepo),
}));

vi.mock('../admin-audit-log.service.js', () => ({
  AdminAuditLogService: vi.fn().mockImplementation(() => mockAuditLogService),
}));

vi.mock('../admin-session.service.js', () => ({
  AdminSessionService: vi.fn().mockImplementation(() => mockSessionService),
}));

// bcryptのモック
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

// loggerのモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});
vi.mock('../../../utils/logger.js', () => ({ logger: mockLogger }));

// テスト対象のインポート（モック設定後）
import { AdminAuthService } from '../admin-auth.service.js';
import bcrypt from 'bcryptjs';

const TEST_ADMIN_ID = 'admin-123';
const TEST_IP = '127.0.0.1';
const TEST_UA = 'TestAgent/1.0';

describe('AdminAuthService - Profile', () => {
  let service: AdminAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminAuthService();
  });

  // ============================================
  // updateProfile
  // ============================================
  describe('updateProfile', () => {
    it('名前を更新し監査ログを記録する', async () => {
      const updatedAdmin = {
        id: TEST_ADMIN_ID,
        email: 'admin@example.com',
        name: '新しい名前',
        role: 'ADMIN',
        totpEnabled: false,
      };
      mockUserRepo.updateName.mockResolvedValue(updatedAdmin);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await service.updateProfile(TEST_ADMIN_ID, '新しい名前', TEST_IP, TEST_UA);

      expect(mockUserRepo.updateName).toHaveBeenCalledWith(TEST_ADMIN_ID, '新しい名前');
      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId: TEST_ADMIN_ID,
        action: 'PROFILE_UPDATED',
        details: { name: '新しい名前' },
        ipAddress: TEST_IP,
        userAgent: TEST_UA,
      });
      expect(result).toEqual(updatedAdmin);
    });

    it('ipAddress, userAgent がなくても動作する', async () => {
      const updatedAdmin = {
        id: TEST_ADMIN_ID,
        email: 'admin@example.com',
        name: 'Updated',
        role: 'ADMIN',
        totpEnabled: false,
      };
      mockUserRepo.updateName.mockResolvedValue(updatedAdmin);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await service.updateProfile(TEST_ADMIN_ID, 'Updated');

      expect(result).toEqual(updatedAdmin);
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: undefined,
          userAgent: undefined,
        })
      );
    });
  });

  // ============================================
  // changePassword
  // ============================================
  describe('changePassword', () => {
    const currentPassword = 'OldPass123!';
    const newPassword = 'NewPass456!';
    const hashedPassword = '$2b$12$hashedNewPassword';

    it('現在のパスワードが正しい場合、新しいパスワードに変更し他セッションを失効する', async () => {
      const currentSessionId = 'session-current';
      mockUserRepo.findByIdWithPassword.mockResolvedValue({
        id: TEST_ADMIN_ID,
        email: 'admin@example.com',
        name: 'Admin',
        role: 'ADMIN',
        totpEnabled: false,
        passwordHash: '$2b$12$existingHash',
      });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue(hashedPassword);
      mockUserRepo.updatePassword.mockResolvedValue(undefined);
      mockSessionService.revokeAllSessionsExcept.mockResolvedValue(undefined);
      mockAuditLogService.log.mockResolvedValue(undefined);

      await service.changePassword(TEST_ADMIN_ID, currentPassword, newPassword, TEST_IP, TEST_UA, currentSessionId);

      expect(mockUserRepo.findByIdWithPassword).toHaveBeenCalledWith(TEST_ADMIN_ID);
      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, '$2b$12$existingHash');
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockUserRepo.updatePassword).toHaveBeenCalledWith(TEST_ADMIN_ID, hashedPassword);
      expect(mockSessionService.revokeAllSessionsExcept).toHaveBeenCalledWith(TEST_ADMIN_ID, currentSessionId);
      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId: TEST_ADMIN_ID,
        action: 'PASSWORD_CHANGED',
        ipAddress: TEST_IP,
        userAgent: TEST_UA,
      });
    });

    it('ユーザーが見つからない場合はAuthenticationErrorをスローする', async () => {
      mockUserRepo.findByIdWithPassword.mockResolvedValue(null);

      await expect(
        service.changePassword(TEST_ADMIN_ID, currentPassword, newPassword)
      ).rejects.toThrow('認証情報が無効です');
    });

    it('現在のパスワードが間違っている場合はAuthenticationErrorをスローし監査ログを記録する', async () => {
      mockUserRepo.findByIdWithPassword.mockResolvedValue({
        id: TEST_ADMIN_ID,
        passwordHash: '$2b$12$existingHash',
      });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      mockAuditLogService.log.mockResolvedValue(undefined);

      await expect(
        service.changePassword(TEST_ADMIN_ID, 'wrong-password', newPassword, TEST_IP, TEST_UA)
      ).rejects.toThrow('現在のパスワードが正しくありません');

      expect(mockUserRepo.updatePassword).not.toHaveBeenCalled();
      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId: TEST_ADMIN_ID,
        action: 'PASSWORD_CHANGE_FAILED',
        details: { reason: 'invalid_current_password' },
        ipAddress: TEST_IP,
        userAgent: TEST_UA,
      });
    });
  });
});
