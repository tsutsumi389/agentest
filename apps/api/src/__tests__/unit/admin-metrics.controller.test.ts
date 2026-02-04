import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// メトリクスサービスのモック
const mockMetricsService = vi.hoisted(() => ({
  getActiveUserMetrics: vi.fn(),
  getPlanDistribution: vi.fn(),
}));

vi.mock('../../services/admin/admin-metrics.service.js', () => ({
  AdminMetricsService: vi.fn().mockImplementation(() => mockMetricsService),
}));

vi.mock('@agentest/shared', () => ({
  AuthenticationError: class AuthenticationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthenticationError';
    }
  },
  activeUserMetricsQuerySchema: {
    parse: vi.fn().mockReturnValue({ period: '7d' }),
  },
  planDistributionQuerySchema: {
    parse: vi.fn().mockReturnValue({}),
  },
}));

// コントローラーのインポートはモック設定後
import { AdminMetricsController } from '../../controllers/admin/metrics.controller.js';

// モックされたスキーマを取得するためにインポート
import {
  activeUserMetricsQuerySchema,
  planDistributionQuerySchema,
} from '@agentest/shared';

// モックリクエストヘルパー
const mockRequest = (overrides = {}): Partial<Request> => ({
  adminUser: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'SUPER_ADMIN', totpEnabled: false },
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

describe('AdminMetricsController', () => {
  let controller: AdminMetricsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminMetricsController();
  });

  describe('getActiveUserMetrics', () => {
    it('成功時にメトリクスを返す', async () => {
      // 準備: サービスがメトリクスデータを返すようモックする
      const metricsData = {
        dailyActiveUsers: 50,
        weeklyActiveUsers: 200,
        monthlyActiveUsers: 500,
      };
      mockMetricsService.getActiveUserMetrics.mockResolvedValue(metricsData);

      const req = mockRequest({ query: { period: '7d' } });
      const res = mockResponse();
      const next = vi.fn() as unknown as NextFunction;

      // 実行
      await controller.getActiveUserMetrics(req as Request, res as Response, next);

      // 検証: クエリがパースされ、サービスが呼ばれ、結果がJSONとして返される
      expect(activeUserMetricsQuerySchema.parse).toHaveBeenCalledWith(req.query);
      expect(mockMetricsService.getActiveUserMetrics).toHaveBeenCalledWith({ period: '7d' });
      expect(res.json).toHaveBeenCalledWith(metricsData);
      expect(next).not.toHaveBeenCalled();
    });

    it('adminUser未認証時はnextにエラーを渡す', async () => {
      // 準備: adminUserがないリクエスト
      const req = mockRequest({ adminUser: undefined });
      const res = mockResponse();
      const next = vi.fn() as unknown as NextFunction;

      // 実行
      await controller.getActiveUserMetrics(req as Request, res as Response, next);

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
      const serviceError = new Error('メトリクス取得失敗');
      mockMetricsService.getActiveUserMetrics.mockRejectedValue(serviceError);

      const req = mockRequest({ query: { period: '7d' } });
      const res = mockResponse();
      const next = vi.fn() as unknown as NextFunction;

      // 実行
      await controller.getActiveUserMetrics(req as Request, res as Response, next);

      // 検証: エラーがnextに渡される
      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('getPlanDistribution', () => {
    it('成功時にプラン分布を返す', async () => {
      // 準備: サービスがプラン分布データを返すようモックする
      const distributionData = {
        free: 100,
        pro: 50,
        enterprise: 10,
      };
      mockMetricsService.getPlanDistribution.mockResolvedValue(distributionData);

      const req = mockRequest({ query: {} });
      const res = mockResponse();
      const next = vi.fn() as unknown as NextFunction;

      // 実行
      await controller.getPlanDistribution(req as Request, res as Response, next);

      // 検証: クエリがパースされ、サービスが呼ばれ、結果がJSONとして返される
      expect(planDistributionQuerySchema.parse).toHaveBeenCalledWith(req.query);
      expect(mockMetricsService.getPlanDistribution).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith(distributionData);
      expect(next).not.toHaveBeenCalled();
    });

    it('adminUser未認証時はnextにエラーを渡す', async () => {
      // 準備: adminUserがないリクエスト
      const req = mockRequest({ adminUser: undefined });
      const res = mockResponse();
      const next = vi.fn() as unknown as NextFunction;

      // 実行
      await controller.getPlanDistribution(req as Request, res as Response, next);

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
  });
});
