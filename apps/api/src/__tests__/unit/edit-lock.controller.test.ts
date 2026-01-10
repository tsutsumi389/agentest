import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { EditLockController } from '../../controllers/edit-lock.controller.js';

// EditLockService のモック（hoistedを使用）
const mockEditLockService = vi.hoisted(() => ({
  acquireLock: vi.fn(),
  getLockStatus: vi.fn(),
  updateHeartbeat: vi.fn(),
  releaseLock: vi.fn(),
  forceRelease: vi.fn(),
}));

// Prismaのモック（hoistedを使用）
const mockPrismaEditLock = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

const mockPrismaTestSuite = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

const mockPrismaTestCase = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

const mockPrismaOrgMember = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('../../services/edit-lock.service.js', () => ({
  EditLockService: vi.fn().mockImplementation(() => mockEditLockService),
  LOCK_CONFIG: {
    LOCK_DURATION_SECONDS: 90,
    HEARTBEAT_INTERVAL_SECONDS: 30,
    HEARTBEAT_TIMEOUT_SECONDS: 60,
  },
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    editLock: mockPrismaEditLock,
    testSuite: mockPrismaTestSuite,
    testCase: mockPrismaTestCase,
    organizationMember: mockPrismaOrgMember,
  },
}));

describe('EditLockController', () => {
  let controller: EditLockController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaEditLock.findUnique.mockReset();
    mockPrismaTestSuite.findUnique.mockReset();
    mockPrismaTestCase.findUnique.mockReset();
    mockPrismaOrgMember.findUnique.mockReset();
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
      mockReq.body = { targetType: 'SUITE', targetId: '11111111-1111-1111-1111-111111111111' };
      const mockLock = {
        id: '33333333-3333-3333-3333-333333333333',
        targetType: 'SUITE',
        targetId: '11111111-1111-1111-1111-111111111111',
        lockedBy: { type: 'user', id: 'user-1', name: 'Test User' },
        expiresAt: new Date(),
      };
      mockEditLockService.acquireLock.mockResolvedValue(mockLock);

      await controller.acquire(mockReq as Request, mockRes as Response, mockNext);

      expect(mockEditLockService.acquireLock).toHaveBeenCalledWith(
        'SUITE',
        '11111111-1111-1111-1111-111111111111',
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        lock: expect.objectContaining({
          id: '33333333-3333-3333-3333-333333333333',
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
      mockReq.query = { targetType: 'SUITE', targetId: '11111111-1111-1111-1111-111111111111' };
      const mockStatus = {
        isLocked: true,
        lock: {
          id: '33333333-3333-3333-3333-333333333333',
          targetType: 'SUITE',
          targetId: '11111111-1111-1111-1111-111111111111',
          lockedBy: { type: 'user', id: 'user-1', name: 'Test User' },
          expiresAt: new Date(),
        },
      };
      mockEditLockService.getLockStatus.mockResolvedValue(mockStatus);

      await controller.getStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockEditLockService.getLockStatus).toHaveBeenCalledWith('SUITE', '11111111-1111-1111-1111-111111111111');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        isLocked: true,
      }));
    });

    it('ロックがない場合はisLocked=falseを返す', async () => {
      mockReq.query = { targetType: 'SUITE', targetId: '11111111-1111-1111-1111-111111111111' };
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
      mockReq.params = { lockId: '33333333-3333-3333-3333-333333333333' };
      const mockLock = {
        id: '33333333-3333-3333-3333-333333333333',
        targetType: 'SUITE',
        targetId: '11111111-1111-1111-1111-111111111111',
        lockedBy: { type: 'user', id: 'user-1', name: 'Test User' },
        expiresAt: new Date(),
      };
      mockEditLockService.updateHeartbeat.mockResolvedValue(mockLock);

      await controller.heartbeat(mockReq as Request, mockRes as Response, mockNext);

      expect(mockEditLockService.updateHeartbeat).toHaveBeenCalledWith(
        '33333333-3333-3333-3333-333333333333',
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
      expect(mockRes.json).toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('ロックを解放できる', async () => {
      mockReq.params = { lockId: '33333333-3333-3333-3333-333333333333' };
      mockEditLockService.releaseLock.mockResolvedValue(undefined);

      await controller.release(mockReq as Request, mockRes as Response, mockNext);

      expect(mockEditLockService.releaseLock).toHaveBeenCalledWith(
        '33333333-3333-3333-3333-333333333333',
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();
    });
  });

  describe('forceRelease', () => {
    it('管理者がロックを強制解除できる', async () => {
      mockReq.params = { lockId: '33333333-3333-3333-3333-333333333333' };
      const mockLock = {
        id: '33333333-3333-3333-3333-333333333333',
        targetType: 'SUITE',
        targetId: '11111111-1111-1111-1111-111111111111',
      };

      // ロック情報を返す
      mockPrismaEditLock.findUnique.mockResolvedValue({
        id: '33333333-3333-3333-3333-333333333333',
        targetType: 'SUITE',
        targetId: '11111111-1111-1111-1111-111111111111',
      });

      // テストスイートと権限情報を返す（ADMINロール）
      mockPrismaTestSuite.findUnique.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        project: {
          id: '44444444-4444-4444-4444-444444444444',
          organizationId: null,
          members: [{ role: 'ADMIN' }],
        },
      });

      mockEditLockService.forceRelease.mockResolvedValue(mockLock);

      await controller.forceRelease(mockReq as Request, mockRes as Response, mockNext);

      expect(mockEditLockService.forceRelease).toHaveBeenCalledWith('33333333-3333-3333-3333-333333333333');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Lock forcibly released',
      }));
    });

    it('OWNERもロックを強制解除できる', async () => {
      mockReq.params = { lockId: '33333333-3333-3333-3333-333333333333' };
      const mockLock = {
        id: '33333333-3333-3333-3333-333333333333',
        targetType: 'CASE',
        targetId: '22222222-2222-2222-2222-222222222222',
      };

      mockPrismaEditLock.findUnique.mockResolvedValue({
        id: '33333333-3333-3333-3333-333333333333',
        targetType: 'CASE',
        targetId: '22222222-2222-2222-2222-222222222222',
      });

      // テストケースと権限情報を返す（OWNERロール）
      mockPrismaTestCase.findUnique.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        testSuite: {
          id: '55555555-5555-5555-5555-555555555555',
          project: {
            id: '44444444-4444-4444-4444-444444444444',
            organizationId: null,
            members: [{ role: 'OWNER' }],
          },
        },
      });

      mockEditLockService.forceRelease.mockResolvedValue(mockLock);

      await controller.forceRelease(mockReq as Request, mockRes as Response, mockNext);

      expect(mockEditLockService.forceRelease).toHaveBeenCalledWith('33333333-3333-3333-3333-333333333333');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Lock forcibly released',
      }));
    });

    it('権限がないユーザーはエラーを返す', async () => {
      mockReq.params = { lockId: '33333333-3333-3333-3333-333333333333' };

      mockPrismaEditLock.findUnique.mockResolvedValue({
        id: '33333333-3333-3333-3333-333333333333',
        targetType: 'SUITE',
        targetId: '11111111-1111-1111-1111-111111111111',
      });

      // テストスイートと権限情報を返す（MEMBERロール = 権限不足）
      mockPrismaTestSuite.findUnique.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        project: {
          id: '44444444-4444-4444-4444-444444444444',
          organizationId: null,
          members: [{ role: 'MEMBER' }],
        },
      });

      await controller.forceRelease(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockEditLockService.forceRelease).not.toHaveBeenCalled();
    });

    it('存在しないロックは404を返す', async () => {
      mockReq.params = { lockId: '77777777-7777-7777-7777-777777777777' };
      mockPrismaEditLock.findUnique.mockResolvedValue(null);

      await controller.forceRelease(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
        }),
      }));
    });

    it('組織のADMINもロックを強制解除できる', async () => {
      mockReq.params = { lockId: '33333333-3333-3333-3333-333333333333' };
      const mockLock = {
        id: '33333333-3333-3333-3333-333333333333',
        targetType: 'SUITE',
        targetId: '11111111-1111-1111-1111-111111111111',
      };

      mockPrismaEditLock.findUnique.mockResolvedValue({
        id: '33333333-3333-3333-3333-333333333333',
        targetType: 'SUITE',
        targetId: '11111111-1111-1111-1111-111111111111',
      });

      // テストスイートを返す（プロジェクトメンバーとしては権限なし）
      mockPrismaTestSuite.findUnique.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        project: {
          id: '44444444-4444-4444-4444-444444444444',
          organizationId: '66666666-6666-6666-6666-666666666666',
          members: [], // プロジェクトメンバーではない
        },
      });

      // 組織のADMINとして権限あり
      mockPrismaOrgMember.findUnique.mockResolvedValue({
        role: 'ADMIN',
      });

      mockEditLockService.forceRelease.mockResolvedValue(mockLock);

      await controller.forceRelease(mockReq as Request, mockRes as Response, mockNext);

      expect(mockEditLockService.forceRelease).toHaveBeenCalledWith('33333333-3333-3333-3333-333333333333');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Lock forcibly released',
      }));
    });
  });
});
