import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionRepository } from '../../repositories/session.repository.js';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaSession = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  count: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    session: mockPrismaSession,
  },
}));

describe('SessionRepository', () => {
  let repository: SessionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SessionRepository();
  });

  describe('create', () => {
    it('セッションを作成できる（tokenHashを使用）', async () => {
      const sessionData = {
        userId: 'user-1',
        tokenHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      const mockSession = { id: 'session-1', ...sessionData, createdAt: new Date() };
      mockPrismaSession.create.mockResolvedValue(mockSession);

      const result = await repository.create(sessionData);

      expect(mockPrismaSession.create).toHaveBeenCalledWith({
        data: {
          userId: sessionData.userId,
          tokenHash: sessionData.tokenHash,
          userAgent: sessionData.userAgent,
          ipAddress: sessionData.ipAddress,
          expiresAt: sessionData.expiresAt,
        },
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe('findByTokenHash', () => {
    it('トークンハッシュでセッションを取得できる', async () => {
      const mockSession = { id: 'session-1', tokenHash: 'hash-123' };
      mockPrismaSession.findUnique.mockResolvedValue(mockSession);

      const result = await repository.findByTokenHash('hash-123');

      expect(mockPrismaSession.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: 'hash-123' },
      });
      expect(result).toEqual(mockSession);
    });

    it('存在しないトークンハッシュはnullを返す', async () => {
      mockPrismaSession.findUnique.mockResolvedValue(null);

      const result = await repository.findByTokenHash('invalid-hash');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('IDでセッションを取得できる', async () => {
      const mockSession = { id: 'session-1', userId: 'user-1' };
      mockPrismaSession.findUnique.mockResolvedValue(mockSession);

      const result = await repository.findById('session-1');

      expect(mockPrismaSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe('findActiveByUserId', () => {
    it('ユーザーの有効なセッション一覧を取得できる', async () => {
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
      mockPrismaSession.findMany.mockResolvedValue(mockSessions);

      const result = await repository.findActiveByUserId('user-1');

      expect(mockPrismaSession.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          lastActiveAt: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { lastActiveAt: 'desc' },
      });
      expect(result).toEqual(mockSessions);
    });
  });

  describe('updateLastActiveAt', () => {
    it('最終活動時刻を更新できる', async () => {
      const mockSession = { id: 'session-1', lastActiveAt: new Date() };
      mockPrismaSession.update.mockResolvedValue(mockSession);

      const result = await repository.updateLastActiveAt('session-1');

      expect(mockPrismaSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { lastActiveAt: expect.any(Date) },
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe('revoke', () => {
    it('セッションを失効できる', async () => {
      const mockSession = { id: 'session-1', revokedAt: new Date() };
      mockPrismaSession.update.mockResolvedValue(mockSession);

      const result = await repository.revoke('session-1');

      expect(mockPrismaSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe('revokeByTokenHash', () => {
    it('トークンハッシュでセッションを失効できる', async () => {
      mockPrismaSession.updateMany.mockResolvedValue({ count: 1 });

      const result = await repository.revokeByTokenHash('hash-123');

      expect(mockPrismaSession.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: 'hash-123' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toEqual({ count: 1 });
    });
  });

  describe('revokeAllExcept', () => {
    it('指定セッション以外を全て失効できる', async () => {
      mockPrismaSession.updateMany.mockResolvedValue({ count: 3 });

      const result = await repository.revokeAllExcept('user-1', 'current-session');

      expect(mockPrismaSession.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          id: { not: 'current-session' },
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('revokeAllByUserId', () => {
    it('ユーザーの全セッションを失効できる', async () => {
      mockPrismaSession.updateMany.mockResolvedValue({ count: 5 });

      const result = await repository.revokeAllByUserId('user-1');

      expect(mockPrismaSession.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('countActiveByUserId', () => {
    it('有効なセッション数をカウントできる', async () => {
      mockPrismaSession.count.mockResolvedValue(3);

      const result = await repository.countActiveByUserId('user-1');

      expect(mockPrismaSession.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
      });
      expect(result).toBe(3);
    });
  });

  describe('deleteExpired', () => {
    it('期限切れ・失効済みセッションを削除できる', async () => {
      mockPrismaSession.deleteMany.mockResolvedValue({ count: 10 });

      const result = await repository.deleteExpired();

      expect(mockPrismaSession.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { revokedAt: { not: null } },
          ],
        },
      });
      expect(result).toEqual({ count: 10 });
    });
  });
});
