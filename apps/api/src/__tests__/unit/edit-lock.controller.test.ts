import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { EditLockController } from '../../controllers/edit-lock.controller.js';
import { LockConflictError } from '@agentest/shared';

// EditLockService のモック
const mockEditLockService = {
  acquireLock: vi.fn(),
  getLockStatus: vi.fn(),
  updateHeartbeat: vi.fn(),
  releaseLock: vi.fn(),
  forceRelease: vi.fn(),
};

vi.mock('../../services/edit-lock.service.js', () => ({
  EditLockService: vi.fn().mockImplementation(() => mockEditLockService),
  LOCK_CONFIG: {
    LOCK_DURATION_SECONDS: 90,
    HEARTBEAT_INTERVAL_SECONDS: 30,
    HEARTBEAT_TIMEOUT_SECONDS: 60,
  },
}));

describe('EditLockController', () => {
  let controller: EditLockController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new EditLockController();

    mockReq = {
      body: {},
      query: {},
      params: {},
      user: { id: 'user-1', name: 'Test User' } as Request['user'],
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn(),
    };

    mockNext = vi.fn();
  });

  describe('acquire', () => {
    it('ロックを取得できる', async () => {
      mockReq.body = { targetType: 'SUITE', targetId: 'suite-123' };
      const mockLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-123',
        lockedBy: { type: 'user', id: 'user-1', name: 'Test User' },
        expiresAt: new Date(),
      };
      mockEditLockService.acquireLock.mockResolvedValue(mockLock);

      await controller.acquire(mockReq as Request, mockRes as Response, mockNext);

      expect(mockEditLockService.acquireLock).toHaveBeenCalledWith(
        'SUITE',
        'suite-123',
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        lock: expect.objectContaining({
          id: 'lock-1',
          targetType: 'SUITE',
        }),
      }));
    });

    it('不正なリクエストはエラーを返す', async () => {
      mockReq.body = { targetType: 'INVALID', targetId: 'not-uuid' };

      await controller.acquire(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('ロック状態を取得できる', async () => {
      mockReq.query = { targetType: 'SUITE', targetId: 'suite-123' };
      const mockStatus = {
        isLocked: true,
        lock: {
          id: 'lock-1',
          targetType: 'SUITE',
          targetId: 'suite-123',
          lockedBy: { type: 'user', id: 'user-1', name: 'Test User' },
          expiresAt: new Date(),
        },
      };
      mockEditLockService.getLockStatus.mockResolvedValue(mockStatus);

      await controller.getStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockEditLockService.getLockStatus).toHaveBeenCalledWith('SUITE', 'suite-123');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        isLocked: true,
      }));
    });

    it('ロックがない場合はisLocked=falseを返す', async () => {
      mockReq.query = { targetType: 'SUITE', targetId: 'suite-123' };
      mockEditLockService.getLockStatus.mockResolvedValue({ isLocked: false, lock: null });

      await controller.getStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        isLocked: false,
        lock: null,
      });
    });
  });

  describe('heartbeat', () => {
    it('ハートビートを更新できる', async () => {
      mockReq.params = { lockId: 'lock-1' };
      const mockLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-123',
        lockedBy: { type: 'user', id: 'user-1', name: 'Test User' },
        expiresAt: new Date(),
      };
      mockEditLockService.updateHeartbeat.mockResolvedValue(mockLock);

      await controller.heartbeat(mockReq as Request, mockRes as Response, mockNext);

      expect(mockEditLockService.updateHeartbeat).toHaveBeenCalledWith(
        'lock-1',
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
      expect(mockRes.json).toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('ロックを解放できる', async () => {
      mockReq.params = { lockId: 'lock-1' };
      mockEditLockService.releaseLock.mockResolvedValue(undefined);

      await controller.release(mockReq as Request, mockRes as Response, mockNext);

      expect(mockEditLockService.releaseLock).toHaveBeenCalledWith(
        'lock-1',
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();
    });
  });

  describe('forceRelease', () => {
    it('管理者がロックを強制解除できる', async () => {
      mockReq.params = { lockId: 'lock-1' };
      const mockLock = {
        id: 'lock-1',
        targetType: 'SUITE',
        targetId: 'suite-123',
      };
      mockEditLockService.forceRelease.mockResolvedValue(mockLock);

      await controller.forceRelease(mockReq as Request, mockRes as Response, mockNext);

      expect(mockEditLockService.forceRelease).toHaveBeenCalledWith('lock-1');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Lock forcibly released',
      }));
    });

    it('存在しないロックは404を返す', async () => {
      mockReq.params = { lockId: 'lock-not-exist' };
      mockEditLockService.forceRelease.mockResolvedValue(null);

      await controller.forceRelease(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
        }),
      }));
    });
  });
});
