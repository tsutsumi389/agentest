import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '../../services/session.service.js';
import { NotFoundError, AuthorizationError } from '@agentest/shared';

// SessionRepository のモック
const mockSessionRepo = {
  create: vi.fn(),
  findByToken: vi.fn(),
  findById: vi.fn(),
  findActiveByUserId: vi.fn(),
  updateLastActiveAt: vi.fn(),
  revoke: vi.fn(),
  revokeByToken: vi.fn(),
  revokeAllExcept: vi.fn(),
  revokeAllByUserId: vi.fn(),
  countActiveByUserId: vi.fn(),
  deleteExpired: vi.fn(),
};

vi.mock('../../repositories/session.repository.js', () => ({
  SessionRepository: vi.fn().mockImplementation(() => mockSessionRepo),
}));

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SessionService();
  });

  describe('createSession', () => {
    it('新しいセッションを作成できる', async () => {
      const sessionData = {
        userId: 'user-1',
        token: 'refresh-token-123',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      const mockSession = { id: 'session-1', ...sessionData };
      mockSessionRepo.create.mockResolvedValue(mockSession);

      const result = await service.createSession(sessionData);

      expect(mockSessionRepo.create).toHaveBeenCalledWith(sessionData);
      expect(result).toEqual(mockSession);
    });
  });

  describe('getSessionByToken', () => {
    it('有効なセッションを取得できる', async () => {
      const mockSession = {
        id: 'session-1',
        token: 'token-123',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1時間後
      };
      mockSessionRepo.findByToken.mockResolvedValue(mockSession);

      const result = await service.getSessionByToken('token-123');

      expect(mockSessionRepo.findByToken).toHaveBeenCalledWith('token-123');
      expect(result).toEqual(mockSession);
    });

    it('セッションが存在しない場合はnullを返す', async () => {
      mockSessionRepo.findByToken.mockResolvedValue(null);

      const result = await service.getSessionByToken('invalid-token');

      expect(result).toBeNull();
    });

    it('失効済みセッションはnullを返す', async () => {
      const mockSession = {
        id: 'session-1',
        token: 'token-123',
        revokedAt: new Date(), // 失効済み
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      };
      mockSessionRepo.findByToken.mockResolvedValue(mockSession);

      const result = await service.getSessionByToken('token-123');

      expect(result).toBeNull();
    });

    it('期限切れセッションはnullを返す', async () => {
      const mockSession = {
        id: 'session-1',
        token: 'token-123',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // 過去の日時
      };
      mockSessionRepo.findByToken.mockResolvedValue(mockSession);

      const result = await service.getSessionByToken('token-123');

      expect(result).toBeNull();
    });
  });

  describe('getUserSessions', () => {
    it('ユーザーのセッション一覧を取得できる', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userAgent: 'Chrome',
          ipAddress: '192.168.1.1',
          lastActiveAt: new Date(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          createdAt: new Date(),
        },
        {
          id: 'session-2',
          userAgent: 'Firefox',
          ipAddress: '192.168.1.2',
          lastActiveAt: new Date(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          createdAt: new Date(),
        },
      ];
      mockSessionRepo.findActiveByUserId.mockResolvedValue(mockSessions);

      const result = await service.getUserSessions('user-1', 'session-1');

      expect(mockSessionRepo.findActiveByUserId).toHaveBeenCalledWith('user-1');
      expect(result).toHaveLength(2);
      expect(result[0].isCurrent).toBe(true);
      expect(result[1].isCurrent).toBe(false);
    });

    it('現在のセッションIDがない場合は全てisCurrentがfalse', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userAgent: 'Chrome',
          ipAddress: '192.168.1.1',
          lastActiveAt: new Date(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          createdAt: new Date(),
        },
      ];
      mockSessionRepo.findActiveByUserId.mockResolvedValue(mockSessions);

      const result = await service.getUserSessions('user-1');

      expect(result[0].isCurrent).toBe(false);
    });
  });

  describe('revokeSession', () => {
    it('自分のセッションを終了できる', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        revokedAt: null,
      };
      mockSessionRepo.findById.mockResolvedValue(mockSession);
      mockSessionRepo.revoke.mockResolvedValue(undefined);

      const result = await service.revokeSession('user-1', 'session-1');

      expect(mockSessionRepo.findById).toHaveBeenCalledWith('session-1');
      expect(mockSessionRepo.revoke).toHaveBeenCalledWith('session-1');
      expect(result).toEqual({ success: true });
    });

    it('存在しないセッションはNotFoundErrorを投げる', async () => {
      mockSessionRepo.findById.mockResolvedValue(null);

      await expect(service.revokeSession('user-1', 'invalid-session'))
        .rejects.toThrow(NotFoundError);
    });

    it('他ユーザーのセッションはAuthorizationErrorを投げる', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-2', // 別のユーザー
        revokedAt: null,
      };
      mockSessionRepo.findById.mockResolvedValue(mockSession);

      await expect(service.revokeSession('user-1', 'session-1'))
        .rejects.toThrow(AuthorizationError);
    });

    it('既に失効済みのセッションはNotFoundErrorを投げる', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        revokedAt: new Date(), // 既に失効
      };
      mockSessionRepo.findById.mockResolvedValue(mockSession);

      await expect(service.revokeSession('user-1', 'session-1'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('revokeOtherSessions', () => {
    it('現在のセッション以外を全て終了できる', async () => {
      mockSessionRepo.revokeAllExcept.mockResolvedValue({ count: 3 });

      const result = await service.revokeOtherSessions('user-1', 'current-session');

      expect(mockSessionRepo.revokeAllExcept).toHaveBeenCalledWith('user-1', 'current-session');
      expect(result).toEqual({ success: true, revokedCount: 3 });
    });
  });

  describe('revokeAllSessions', () => {
    it('ユーザーの全セッションを終了できる', async () => {
      mockSessionRepo.revokeAllByUserId.mockResolvedValue({ count: 5 });

      const result = await service.revokeAllSessions('user-1');

      expect(mockSessionRepo.revokeAllByUserId).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ success: true, revokedCount: 5 });
    });
  });

  describe('getActiveSessionCount', () => {
    it('有効なセッション数を取得できる', async () => {
      mockSessionRepo.countActiveByUserId.mockResolvedValue(3);

      const result = await service.getActiveSessionCount('user-1');

      expect(mockSessionRepo.countActiveByUserId).toHaveBeenCalledWith('user-1');
      expect(result).toBe(3);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('期限切れセッションを削除できる', async () => {
      mockSessionRepo.deleteExpired.mockResolvedValue({ count: 10 });

      const result = await service.cleanupExpiredSessions();

      expect(mockSessionRepo.deleteExpired).toHaveBeenCalled();
      expect(result).toEqual({ deletedCount: 10 });
    });
  });
});
