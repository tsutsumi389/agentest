import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ダッシュボードサービスのモック
const mockDashboardService = vi.hoisted(() => ({
  getDashboard: vi.fn(),
}));

vi.mock('../../services/admin/admin-dashboard.service.js', () => ({
  AdminDashboardService: vi.fn().mockImplementation(() => mockDashboardService),
}));

vi.mock('@agentest/shared', () => ({
  AuthenticationError: class AuthenticationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthenticationError';
    }
  },
}));

// コントローラーのインポートはモック設定後
import { AdminDashboardController } from '../../controllers/admin/dashboard.controller.js';

// モックリクエストヘルパー
const mockRequest = (overrides = {}): Partial<Request> => ({
  adminUser: { id: 'admin-1', role: 'SUPER_ADMIN' } as any,
  params: {},
  body: {},
  query: {},
  ...overrides,
});

// モックレスポンスヘルパー
const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('AdminDashboardController', () => {
  let controller: AdminDashboardController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminDashboardController();
  });

  describe('getStats', () => {
    it('ダッシュボード統計を返す', async () => {
      // 準備: サービスが統計データを返すようモックする
      const statsData = {
        totalUsers: 100,
        activeUsers: 42,
        totalProjects: 25,
        totalTestCases: 500,
      };
      mockDashboardService.getDashboard.mockResolvedValue(statsData);

      const req = mockRequest();
      const res = mockResponse();
      const next = vi.fn() as unknown as NextFunction;

      // 実行
      await controller.getStats(req as Request, res as Response, next);

      // 検証: サービスが呼ばれ、結果がJSONとして返される
      expect(mockDashboardService.getDashboard).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith(statsData);
      expect(next).not.toHaveBeenCalled();
    });

    it('adminUser未認証時はnextにエラーを渡す', async () => {
      // 準備: adminUserがないリクエスト
      const req = mockRequest({ adminUser: undefined });
      const res = mockResponse();
      const next = vi.fn() as unknown as NextFunction;

      // 実行
      await controller.getStats(req as Request, res as Response, next);

      // 検証: AuthenticationErrorがnextに渡される
      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AuthenticationError',
          message: '認証が必要です',
        })
      );
      expect(res.json).not.toHaveBeenCalled();
    });

    it('サービスエラー時はnextに渡す', async () => {
      // 準備: サービスがエラーをスローするようモックする
      const serviceError = new Error('データベース接続エラー');
      mockDashboardService.getDashboard.mockRejectedValue(serviceError);

      const req = mockRequest();
      const res = mockResponse();
      const next = vi.fn() as unknown as NextFunction;

      // 実行
      await controller.getStats(req as Request, res as Response, next);

      // 検証: エラーがnextに渡される
      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
