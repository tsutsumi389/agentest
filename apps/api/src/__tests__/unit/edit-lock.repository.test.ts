import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditLockRepository } from '../../repositories/edit-lock.repository.js';

// Prisma のモック
const mockPrismaEditLock = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    editLock: mockPrismaEditLock,
  },
}));

describe('EditLockRepository', () => {
  let repository: EditLockRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new EditLockRepository();
  });

  describe('findByTarget', () => {
    it('ターゲットでロックを取得できる', async () => {
      const mockLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: 'user-1',
        lockedBy: { id: 'user-1', name: 'Test User', avatarUrl: null },
        expiresAt: new Date(),
      };
      mockPrismaEditLock.findUnique.mockResolvedValue(mockLock);

      const result = await repository.findByTarget('SUITE', 'suite-1');

      expect(mockPrismaEditLock.findUnique).toHaveBeenCalledWith({
        where: {
          targetType_targetId: {
            targetType: 'SUITE',
            targetId: 'suite-1',
          },
        },
        include: {
          lockedBy: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });
      expect(result).toEqual(mockLock);
    });

    it('存在しないターゲットはnullを返す', async () => {
      mockPrismaEditLock.findUnique.mockResolvedValue(null);

      const result = await repository.findByTarget('SUITE', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('IDでロックを取得できる', async () => {
      const mockLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: 'user-1',
        lockedBy: { id: 'user-1', name: 'Test User', avatarUrl: null },
        expiresAt: new Date(),
      };
      mockPrismaEditLock.findUnique.mockResolvedValue(mockLock);

      const result = await repository.findById('lock-1');

      expect(mockPrismaEditLock.findUnique).toHaveBeenCalledWith({
        where: { id: 'lock-1' },
        include: {
          lockedBy: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });
      expect(result).toEqual(mockLock);
    });
  });

  describe('create', () => {
    it('ロックを作成できる', async () => {
      const createData = {
        targetType: 'SUITE' as const,
        targetId: 'suite-1',
        lockedByUserId: 'user-1',
        expiresAt: new Date(Date.now() + 90000),
      };
      const mockLock = {
        id: 'lock-1',
        ...createData,
        lockedAt: new Date(),
        lastHeartbeat: new Date(),
        lockedBy: { id: 'user-1', name: 'Test User', avatarUrl: null },
      };
      mockPrismaEditLock.create.mockResolvedValue(mockLock);

      const result = await repository.create(createData);

      expect(mockPrismaEditLock.create).toHaveBeenCalled();
      expect(result).toEqual(mockLock);
    });
  });

  describe('updateHeartbeat', () => {
    it('ハートビートを更新できる', async () => {
      const newExpiresAt = new Date(Date.now() + 90000);
      const mockLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: 'user-1',
        lockedBy: { id: 'user-1', name: 'Test User', avatarUrl: null },
        lastHeartbeat: new Date(),
        expiresAt: newExpiresAt,
      };
      mockPrismaEditLock.update.mockResolvedValue(mockLock);

      const result = await repository.updateHeartbeat('lock-1', newExpiresAt);

      expect(mockPrismaEditLock.update).toHaveBeenCalledWith({
        where: { id: 'lock-1' },
        data: {
          lastHeartbeat: expect.any(Date),
          expiresAt: newExpiresAt,
        },
        include: {
          lockedBy: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });
      expect(result.expiresAt).toEqual(newExpiresAt);
    });
  });

  describe('delete', () => {
    it('ロックを削除できる', async () => {
      mockPrismaEditLock.delete.mockResolvedValue({});

      await repository.delete('lock-1');

      expect(mockPrismaEditLock.delete).toHaveBeenCalledWith({
        where: { id: 'lock-1' },
      });
    });
  });

  describe('findExpired', () => {
    it('期限切れロックを取得できる', async () => {
      const expiredLocks = [
        { id: 'lock-1', expiresAt: new Date(Date.now() - 1000) },
        { id: 'lock-2', expiresAt: new Date(Date.now() - 2000) },
      ];
      mockPrismaEditLock.findMany.mockResolvedValue(expiredLocks);

      const result = await repository.findExpired();

      expect(mockPrismaEditLock.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
        include: {
          lockedBy: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('deleteExpired', () => {
    it('期限切れロックを一括削除できる', async () => {
      mockPrismaEditLock.deleteMany.mockResolvedValue({ count: 5 });

      const result = await repository.deleteExpired();

      expect(mockPrismaEditLock.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
      expect(result).toBe(5);
    });
  });
});
