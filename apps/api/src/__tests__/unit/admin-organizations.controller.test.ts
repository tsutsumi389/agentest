import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, ValidationError, NotFoundError } from '@agentest/shared';

// AdminOrganizationsServiceモック
const mockOrganizationsService = vi.hoisted(() => ({
  findOrganizations: vi.fn(),
  findOrganizationById: vi.fn(),
}));

vi.mock('../../services/admin/admin-organizations.service.js', () => ({
  AdminOrganizationsService: vi.fn().mockImplementation(() => mockOrganizationsService),
}));

import { AdminOrganizationsController } from '../../controllers/admin/organizations.controller.js';

describe('AdminOrganizationsController', () => {
  let controller: AdminOrganizationsController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminOrganizationsController();

    // モックリクエスト・レスポンスを初期化
    mockReq = {
      adminUser: { id: 'admin-123', email: 'admin@example.com', name: 'Admin', role: 'ADMIN', totpEnabled: false },
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
    const validOrgId = '550e8400-e29b-41d4-a716-446655440000';

    it('認証済み管理者が組織詳細を取得できる', async () => {
      const mockOrgDetail = {
        organization: {
          id: validOrgId,
          name: 'Test Organization',
          description: 'Test description',
          avatarUrl: 'https://example.com/avatar.png',
          plan: 'TEAM',
          billingEmail: 'billing@example.com',
          paymentCustomerId: 'cus_12345',
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-01-20T00:00:00.000Z',
          deletedAt: null,
          stats: { memberCount: 5, projectCount: 3, testSuiteCount: 10, executionCount: 25 },
          members: [],
          projects: [],
          subscription: null,
          recentAuditLogs: [],
        },
      };

      mockReq.params = { id: validOrgId };
      mockOrganizationsService.findOrganizationById.mockResolvedValue(mockOrgDetail);

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockOrganizationsService.findOrganizationById).toHaveBeenCalledWith(validOrgId);
      expect(mockRes.json).toHaveBeenCalledWith(mockOrgDetail);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('未認証の場合はAuthenticationErrorをnextに渡す', async () => {
      mockReq.adminUser = undefined;
      mockReq.params = { id: validOrgId };

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
      expect(error.message).toBe('無効な組織IDです');
      expect(mockOrganizationsService.findOrganizationById).not.toHaveBeenCalled();
    });

    it('空のID文字列の場合はValidationErrorをnextに渡す', async () => {
      mockReq.params = { id: '' };

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
      expect(mockOrganizationsService.findOrganizationById).not.toHaveBeenCalled();
    });

    it('組織が見つからない場合はNotFoundErrorをnextに渡す', async () => {
      mockReq.params = { id: validOrgId };
      mockOrganizationsService.findOrganizationById.mockResolvedValue(null);

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockOrganizationsService.findOrganizationById).toHaveBeenCalledWith(validOrgId);
      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error).toBeInstanceOf(NotFoundError);
      // NotFoundErrorはリソース名に " not found" を付加する仕様
      expect(error.message).toBe('組織が見つかりません not found');
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('サービスエラーをnextに渡す', async () => {
      const serviceError = new Error('Database connection failed');
      mockReq.params = { id: validOrgId };
      mockOrganizationsService.findOrganizationById.mockRejectedValue(serviceError);

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith(serviceError);
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('正しい形式のUUIDでサービスが呼び出される', async () => {
      const mockOrgDetail = {
        organization: {
          id: validOrgId,
          name: 'Test Organization',
          description: null,
          avatarUrl: null,
          plan: 'ENTERPRISE',
          billingEmail: 'billing@example.com',
          paymentCustomerId: null,
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-01-20T00:00:00.000Z',
          deletedAt: null,
          stats: { memberCount: 10, projectCount: 5, testSuiteCount: 20, executionCount: 100 },
          members: [
            { id: 'member-1', userId: 'user-1', name: 'Owner', email: 'owner@example.com', avatarUrl: null, role: 'OWNER', joinedAt: '2024-01-15T00:00:00.000Z' },
          ],
          projects: [
            { id: 'project-1', name: 'Project A', description: null, memberCount: 3, testSuiteCount: 5, createdAt: '2024-01-16T00:00:00.000Z' },
          ],
          subscription: {
            plan: 'ENTERPRISE',
            status: 'ACTIVE',
            billingCycle: 'YEARLY',
            currentPeriodStart: '2024-01-01T00:00:00.000Z',
            currentPeriodEnd: '2025-01-01T00:00:00.000Z',
            cancelAtPeriodEnd: false,
          },
          recentAuditLogs: [],
        },
      };

      // 大文字小文字を含むUUID
      const uppercaseUuid = validOrgId.toUpperCase();
      mockReq.params = { id: uppercaseUuid };
      mockOrganizationsService.findOrganizationById.mockResolvedValue(mockOrgDetail);

      await controller.getById(mockReq as Request, mockRes as Response, mockNext);

      // バリデーション後に小文字に変換される（zodのuuidバリデーション）
      expect(mockOrganizationsService.findOrganizationById).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockOrgDetail);
    });
  });
});
