import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, ValidationError, NotFoundError } from '@agentest/shared';

// AdminUsersServiceモック
const mockUsersService = vi.hoisted(() => ({
  findUserById: vi.fn(),
  findUsers: vi.fn(),
}));

vi.mock('../../services/admin/admin-users.service.js', () => ({
  AdminUsersService: vi.fn().mockImplementation(() => mockUsersService),
}));

import { AdminUsersController } from '../../controllers/admin/users.controller.js';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminUsersController();

    // モックリクエスト・レスポンスを初期化
    mockReq = {
      adminUser: {
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'ADMIN',
        totpEnabled: false,
      },
      params: {},
      query: {},
    };

    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('getById', () => {
    const validUserId = '550e8400-e29b-41d4-a716-446655440000';

    it('認証済み管理者がユーザー詳細を取得できる', async () => {
      const mockUserDetail = {
        user: {
          id: validUserId,
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: null,
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-01-20T00:00:00.000Z',
          deletedAt: null,
          activity: { lastActiveAt: null, activeSessionCount: 0 },
          stats: { organizationCount: 0, projectCount: 0, testSuiteCount: 0, executionCount: 0 },
          organizations: [],
          oauthProviders: [],
          recentAuditLogs: [],
        },
      };

      mockReq.params = { id: validUserId };
      mockUsersService.findUserById.mockResolvedValue(mockUserDetail);

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockUsersService.findUserById).toHaveBeenCalledWith(validUserId);
      expect(mockRes.json).toHaveBeenCalledWith(mockUserDetail);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('未認証の場合はAuthenticationErrorをnextに渡す', async () => {
      mockReq.adminUser = undefined;
      mockReq.params = { id: validUserId };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('認証が必要です');
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('無効なUUID形式の場合はValidationErrorをnextに渡す', async () => {
      mockReq.params = { id: 'invalid-uuid' };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('無効なユーザーIDです');
      expect(mockUsersService.findUserById).not.toHaveBeenCalled();
    });

    it('空のID文字列の場合はValidationErrorをnextに渡す', async () => {
      mockReq.params = { id: '' };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
      expect(mockUsersService.findUserById).not.toHaveBeenCalled();
    });

    it('ユーザーが見つからない場合はNotFoundErrorをnextに渡す', async () => {
      mockReq.params = { id: validUserId };
      mockUsersService.findUserById.mockResolvedValue(null);

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockUsersService.findUserById).toHaveBeenCalledWith(validUserId);
      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error).toBeInstanceOf(NotFoundError);
      // NotFoundErrorはリソース名に " not found" を付加する仕様
      expect(error.message).toBe('ユーザーが見つかりません not found');
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('サービスエラーをnextに渡す', async () => {
      const serviceError = new Error('Database connection failed');
      mockReq.params = { id: validUserId };
      mockUsersService.findUserById.mockRejectedValue(serviceError);

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith(serviceError);
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('正しい形式のUUIDでサービスが呼び出される', async () => {
      const mockUserDetail = {
        user: {
          id: validUserId,
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: null,
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-01-20T00:00:00.000Z',
          deletedAt: null,
          activity: { lastActiveAt: '2024-01-20T12:00:00.000Z', activeSessionCount: 2 },
          stats: { organizationCount: 1, projectCount: 3, testSuiteCount: 5, executionCount: 20 },
          organizations: [
            { id: 'org-1', name: 'Test Org', role: 'MEMBER', joinedAt: '2024-01-10T00:00:00.000Z' },
          ],
          oauthProviders: [{ provider: 'github', createdAt: '2024-01-05T00:00:00.000Z' }],
          recentAuditLogs: [],
        },
      };

      // 大文字小文字を含むUUID
      const uppercaseUuid = validUserId.toUpperCase();
      mockReq.params = { id: uppercaseUuid };
      mockUsersService.findUserById.mockResolvedValue(mockUserDetail);

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      // バリデーション後に小文字に変換される（zodのuuidバリデーション）
      expect(mockUsersService.findUserById).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockUserDetail);
    });
  });
});
