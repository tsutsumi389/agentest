import { describe, it, expect, vi, beforeEach } from 'vitest';

// AdminSessionRepository のモック（vi.hoistedを使用）
const mockSessionRepo = vi.hoisted(() => ({
  create: vi.fn(),
  findByTokenHash: vi.fn(),
  findById: vi.fn(),
  updateLastActiveAt: vi.fn(),
  extendExpiry: vi.fn(),
  revoke: vi.fn(),
  revokeByTokenHash: vi.fn(),
  revokeAllByUserId: vi.fn(),
  deleteExpired: vi.fn(),
}));

vi.mock('../../repositories/admin-session.repository.js', () => ({
  AdminSessionRepository: vi.fn().mockImplementation(() => mockSessionRepo),
}));

// サービスのインポートはモック設定後
import { AdminSessionService } from '../../services/admin/admin-session.service.js';
import { hashToken } from '../../utils/pkce.js';

describe('AdminSessionService', () => {
  let service: AdminSessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminSessionService();
  });

  describe('generateToken', () => {
    it('128文字のセキュアなトークンを生成する', () => {
      const token = service.generateToken();

      expect(token).toHaveLength(128);
      // hex文字列であることを確認
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('生成されるトークンは毎回異なる', () => {
      const token1 = service.generateToken();
      const token2 = service.generateToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('createSession', () => {
    it('セッションを作成できる（tokenHashをDBに保存、生トークンを返却）', async () => {
      const now = Date.now();
      const mockSession = {
        id: 'session-1',
        adminUserId: 'admin-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(now + 2 * 60 * 60 * 1000),
        createdAt: new Date(now),
      };
      mockSessionRepo.create.mockResolvedValue(mockSession);

      const result = await service.createSession({
        adminUserId: 'admin-1',
        userAgent: 'Test Browser',
        ipAddress: '127.0.0.1',
      });

      expect(mockSessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          userAgent: 'Test Browser',
          ipAddress: '127.0.0.1',
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        })
      );

      // tokenHashは64文字のhex文字列（SHA-256）
      const createCall = mockSessionRepo.create.mock.calls[0][0];
      expect(createCall.tokenHash).toHaveLength(64);
      expect(createCall.tokenHash).toMatch(/^[a-f0-9]+$/);

      // 有効期限が約2時間後であることを確認
      const expiresAt = createCall.expiresAt.getTime();
      const expectedExpiry = now + 2 * 60 * 60 * 1000;
      expect(Math.abs(expiresAt - expectedExpiry)).toBeLessThan(5000);

      // 生トークンが返却される（128文字のhex）
      expect(result.token).toBeDefined();
      expect(result.token).toHaveLength(128);
    });
  });

  describe('validateSession', () => {
    const validAdminUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Test Admin',
      role: 'ADMIN',
      totpEnabled: false,
      deletedAt: null,
    };

    it('有効なセッションを検証できる（トークンをハッシュ化して検索）', async () => {
      const mockSession = {
        id: 'session-1',
        tokenHash: 'hashed-value',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
        revokedAt: null,
        adminUser: validAdminUser,
      };
      mockSessionRepo.findByTokenHash.mockResolvedValue(mockSession);

      const result = await service.validateSession('valid-token');

      expect(mockSessionRepo.findByTokenHash).toHaveBeenCalledWith(hashToken('valid-token'));
      expect(result).not.toBeNull();
      expect(result?.id).toBe('session-1');
      expect(result?.adminUser.id).toBe('admin-1');
      expect(result?.adminUser.email).toBe('admin@example.com');
      // ValidatedAdminSession にはtokenフィールドがない
      expect(result).not.toHaveProperty('token');
    });

    it('存在しないセッションはnullを返す', async () => {
      mockSessionRepo.findByTokenHash.mockResolvedValue(null);

      const result = await service.validateSession('nonexistent-token');

      expect(result).toBeNull();
    });

    it('失効済みセッションはnullを返す', async () => {
      const mockSession = {
        id: 'session-1',
        tokenHash: 'hashed-value',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: new Date(), // 失効済み
        adminUser: validAdminUser,
      };
      mockSessionRepo.findByTokenHash.mockResolvedValue(mockSession);

      const result = await service.validateSession('revoked-token');

      expect(result).toBeNull();
    });

    it('期限切れセッションはnullを返す', async () => {
      const mockSession = {
        id: 'session-1',
        tokenHash: 'hashed-value',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3時間前
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1時間前（期限切れ）
        revokedAt: null,
        adminUser: validAdminUser,
      };
      mockSessionRepo.findByTokenHash.mockResolvedValue(mockSession);

      const result = await service.validateSession('expired-token');

      expect(result).toBeNull();
    });

    it('削除済み管理者のセッションはnullを返す', async () => {
      const mockSession = {
        id: 'session-1',
        tokenHash: 'hashed-value',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: null,
        adminUser: {
          ...validAdminUser,
          deletedAt: new Date(), // 削除済み
        },
      };
      mockSessionRepo.findByTokenHash.mockResolvedValue(mockSession);

      const result = await service.validateSession('deleted-user-token');

      expect(result).toBeNull();
    });
  });

  describe('refreshSession', () => {
    it('セッション有効期限を延長できる（2時間延長）', async () => {
      const now = Date.now();
      const createdAt = new Date(now - 60 * 60 * 1000); // 1時間前に作成
      mockSessionRepo.extendExpiry.mockResolvedValue(undefined);

      const result = await service.refreshSession('session-1', createdAt);

      expect(result).not.toBeNull();
      expect(mockSessionRepo.extendExpiry).toHaveBeenCalledWith(
        'session-1',
        expect.any(Date)
      );

      // 新しい有効期限が約2時間後であることを確認
      const newExpiry = result!.getTime();
      const expectedExpiry = now + 2 * 60 * 60 * 1000;
      expect(Math.abs(newExpiry - expectedExpiry)).toBeLessThan(5000);
    });

    it('最大延長期限（8時間）を超えない', async () => {
      const now = Date.now();
      // 7時間前に作成（最大延長期限まで1時間）
      const createdAt = new Date(now - 7 * 60 * 60 * 1000);
      mockSessionRepo.extendExpiry.mockResolvedValue(undefined);

      const result = await service.refreshSession('session-1', createdAt);

      expect(result).not.toBeNull();
      // 新しい有効期限が最大延長期限（作成から8時間）を超えないことを確認
      const maxExpiry = createdAt.getTime() + 8 * 60 * 60 * 1000;
      expect(result!.getTime()).toBeLessThanOrEqual(maxExpiry);
    });

    it('最大延長期限を超過している場合はnullを返す', async () => {
      const now = Date.now();
      // 8時間1秒前に作成（最大延長期限を超過）
      const createdAt = new Date(now - 8 * 60 * 60 * 1000 - 1000);

      const result = await service.refreshSession('session-1', createdAt);

      expect(result).toBeNull();
      expect(mockSessionRepo.extendExpiry).not.toHaveBeenCalled();
    });
  });

  describe('revokeSession', () => {
    it('トークンをハッシュ化してセッションを失効できる', async () => {
      mockSessionRepo.revokeByTokenHash.mockResolvedValue({ count: 1 });

      await service.revokeSession('session-token');

      expect(mockSessionRepo.revokeByTokenHash).toHaveBeenCalledWith(hashToken('session-token'));
    });
  });

  describe('updateActivity', () => {
    it('最終活動時刻を更新できる', async () => {
      mockSessionRepo.updateLastActiveAt.mockResolvedValue(undefined);

      await service.updateActivity('session-1');

      expect(mockSessionRepo.updateLastActiveAt).toHaveBeenCalledWith('session-1');
    });

    it('更新エラーでも例外をスローしない', async () => {
      mockSessionRepo.updateLastActiveAt.mockRejectedValue(new Error('DB Error'));

      // エラーがスローされないことを確認
      await expect(service.updateActivity('session-1')).resolves.toBeUndefined();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('期限切れセッションを削除できる', async () => {
      mockSessionRepo.deleteExpired.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpiredSessions();

      expect(mockSessionRepo.deleteExpired).toHaveBeenCalled();
      expect(result.deletedCount).toBe(5);
    });
  });
});
