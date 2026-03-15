import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditLockService, LOCK_CONFIG } from '../../services/edit-lock.service.js';
import { LockConflictError, NotFoundError, AuthorizationError } from '@agentest/shared';

// EditLockRepository のモック
const mockLockRepo = {
  findByTarget: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateHeartbeat: vi.fn(),
  delete: vi.fn(),
  findExpired: vi.fn(),
  deleteExpired: vi.fn(),
};

vi.mock('../../repositories/edit-lock.repository.js', () => ({
  EditLockRepository: vi.fn().mockImplementation(() => mockLockRepo),
}));

describe('EditLockService', () => {
  let service: EditLockService;

  const mockUser = {
    type: 'user' as const,
    id: 'user-1',
    name: 'Test User',
  };

  const mockOtherUser = {
    type: 'user' as const,
    id: 'user-2',
    name: 'Other User',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EditLockService();
  });

  describe('acquireLock', () => {
    it('新規ロックを取得できる', async () => {
      mockLockRepo.findByTarget.mockResolvedValue(null);
      const mockCreatedLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: mockUser.id,
        lockedBy: { id: mockUser.id, name: mockUser.name },
        expiresAt: new Date(Date.now() + LOCK_CONFIG.LOCK_DURATION_SECONDS * 1000),
      };
      mockLockRepo.create.mockResolvedValue(mockCreatedLock);

      const result = await service.acquireLock('SUITE', 'suite-1', mockUser);

      expect(mockLockRepo.findByTarget).toHaveBeenCalledWith('SUITE', 'suite-1');
      expect(mockLockRepo.create).toHaveBeenCalled();
      expect(result.id).toBe('lock-1');
      expect(result.lockedBy.id).toBe(mockUser.id);
    });

    it('自分のロックが既にある場合はハートビート更新として扱う', async () => {
      const existingLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: mockUser.id,
        lockedBy: { id: mockUser.id, name: mockUser.name },
        expiresAt: new Date(Date.now() + 60000), // まだ有効
      };
      mockLockRepo.findByTarget.mockResolvedValue(existingLock);
      mockLockRepo.findById.mockResolvedValue(existingLock);
      const updatedLock = {
        ...existingLock,
        expiresAt: new Date(Date.now() + LOCK_CONFIG.LOCK_DURATION_SECONDS * 1000),
      };
      mockLockRepo.updateHeartbeat.mockResolvedValue(updatedLock);

      const result = await service.acquireLock('SUITE', 'suite-1', mockUser);

      expect(result.id).toBe('lock-1');
      expect(mockLockRepo.updateHeartbeat).toHaveBeenCalled();
    });

    it('他者がロック中の場合はLockConflictErrorをスロー', async () => {
      const existingLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: mockOtherUser.id,
        lockedBy: { id: mockOtherUser.id, name: mockOtherUser.name },
        expiresAt: new Date(Date.now() + 60000), // まだ有効
      };
      mockLockRepo.findByTarget.mockResolvedValue(existingLock);

      await expect(service.acquireLock('SUITE', 'suite-1', mockUser)).rejects.toThrow(
        LockConflictError
      );
    });

    it('期限切れのロックは削除して新規ロックを取得できる', async () => {
      const expiredLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: mockOtherUser.id,
        lockedBy: { id: mockOtherUser.id, name: mockOtherUser.name },
        expiresAt: new Date(Date.now() - 1000), // 期限切れ
      };
      mockLockRepo.findByTarget.mockResolvedValue(expiredLock);
      const newLock = {
        id: 'lock-2',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: mockUser.id,
        lockedBy: { id: mockUser.id, name: mockUser.name },
        expiresAt: new Date(Date.now() + LOCK_CONFIG.LOCK_DURATION_SECONDS * 1000),
      };
      mockLockRepo.create.mockResolvedValue(newLock);

      const result = await service.acquireLock('SUITE', 'suite-1', mockUser);

      expect(mockLockRepo.delete).toHaveBeenCalledWith('lock-1');
      expect(mockLockRepo.create).toHaveBeenCalled();
      expect(result.id).toBe('lock-2');
    });
  });

  describe('getLockStatus', () => {
    it('ロックがない場合はisLocked=falseを返す', async () => {
      mockLockRepo.findByTarget.mockResolvedValue(null);

      const result = await service.getLockStatus('SUITE', 'suite-1');

      expect(result.isLocked).toBe(false);
      expect(result.lock).toBeNull();
    });

    it('有効なロックがある場合はisLocked=trueを返す', async () => {
      const existingLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: mockUser.id,
        lockedBy: { id: mockUser.id, name: mockUser.name },
        expiresAt: new Date(Date.now() + 60000),
      };
      mockLockRepo.findByTarget.mockResolvedValue(existingLock);

      const result = await service.getLockStatus('SUITE', 'suite-1');

      expect(result.isLocked).toBe(true);
      expect(result.lock?.id).toBe('lock-1');
    });

    it('期限切れのロックはisLocked=falseを返す', async () => {
      const expiredLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: mockUser.id,
        lockedBy: { id: mockUser.id, name: mockUser.name },
        expiresAt: new Date(Date.now() - 1000), // 期限切れ
      };
      mockLockRepo.findByTarget.mockResolvedValue(expiredLock);

      const result = await service.getLockStatus('SUITE', 'suite-1');

      expect(result.isLocked).toBe(false);
      expect(result.lock).toBeNull();
    });
  });

  describe('updateHeartbeat', () => {
    it('自分のロックのハートビートを更新できる', async () => {
      const existingLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: mockUser.id,
        lockedBy: { id: mockUser.id, name: mockUser.name },
        expiresAt: new Date(Date.now() + 30000),
      };
      mockLockRepo.findById.mockResolvedValue(existingLock);
      const updatedLock = {
        ...existingLock,
        expiresAt: new Date(Date.now() + LOCK_CONFIG.LOCK_DURATION_SECONDS * 1000),
      };
      mockLockRepo.updateHeartbeat.mockResolvedValue(updatedLock);

      const result = await service.updateHeartbeat('lock-1', mockUser);

      expect(result.id).toBe('lock-1');
      expect(mockLockRepo.updateHeartbeat).toHaveBeenCalled();
    });

    it('存在しないロックはNotFoundErrorをスロー', async () => {
      mockLockRepo.findById.mockResolvedValue(null);

      await expect(service.updateHeartbeat('lock-not-exist', mockUser)).rejects.toThrow(
        NotFoundError
      );
    });

    it('他者のロックはAuthorizationErrorをスロー', async () => {
      const existingLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: mockOtherUser.id,
        lockedBy: { id: mockOtherUser.id, name: mockOtherUser.name },
        expiresAt: new Date(Date.now() + 30000),
      };
      mockLockRepo.findById.mockResolvedValue(existingLock);

      await expect(service.updateHeartbeat('lock-1', mockUser)).rejects.toThrow(AuthorizationError);
    });
  });

  describe('releaseLock', () => {
    it('自分のロックを解放できる', async () => {
      const existingLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: mockUser.id,
        lockedBy: { id: mockUser.id, name: mockUser.name },
        expiresAt: new Date(Date.now() + 30000),
      };
      mockLockRepo.findById.mockResolvedValue(existingLock);

      await service.releaseLock('lock-1', mockUser);

      expect(mockLockRepo.delete).toHaveBeenCalledWith('lock-1');
    });

    it('存在しないロックは何もしない', async () => {
      mockLockRepo.findById.mockResolvedValue(null);

      await service.releaseLock('lock-not-exist', mockUser);

      expect(mockLockRepo.delete).not.toHaveBeenCalled();
    });

    it('他者のロックはAuthorizationErrorをスロー', async () => {
      const existingLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: mockOtherUser.id,
        lockedBy: { id: mockOtherUser.id, name: mockOtherUser.name },
        expiresAt: new Date(Date.now() + 30000),
      };
      mockLockRepo.findById.mockResolvedValue(existingLock);

      await expect(service.releaseLock('lock-1', mockUser)).rejects.toThrow(AuthorizationError);
    });
  });

  describe('forceRelease', () => {
    it('管理者は任意のロックを強制解除できる', async () => {
      const existingLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        lockedByUserId: mockOtherUser.id,
        lockedBy: { id: mockOtherUser.id, name: mockOtherUser.name },
        expiresAt: new Date(Date.now() + 30000),
      };
      mockLockRepo.findById.mockResolvedValue(existingLock);

      const result = await service.forceRelease('lock-1');

      expect(mockLockRepo.delete).toHaveBeenCalledWith('lock-1');
      expect(result?.id).toBe('lock-1');
    });

    it('存在しないロックはnullを返す', async () => {
      mockLockRepo.findById.mockResolvedValue(null);

      const result = await service.forceRelease('lock-not-exist');

      expect(result).toBeNull();
    });
  });

  describe('processExpiredLocks', () => {
    it('期限切れロックを一括削除できる', async () => {
      const expiredLocks = [
        { id: 'lock-1', targetType: 'SUITE', targetId: 'suite-1' },
        { id: 'lock-2', targetType: 'CASE', targetId: 'case-1' },
      ];
      mockLockRepo.findExpired.mockResolvedValue(expiredLocks);
      mockLockRepo.deleteExpired.mockResolvedValue(2);

      const result = await service.processExpiredLocks();

      expect(result.count).toBe(2);
      expect(result.locks).toHaveLength(2);
    });
  });
});
