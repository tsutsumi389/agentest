import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockSubscriptionService } = vi.hoisted(() => ({
  mockSubscriptionService: {
    getSubscription: vi.fn(),
    createSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    reactivateSubscription: vi.fn(),
  },
}));

vi.mock('../../services/subscription.service.js', () => ({
  SubscriptionService: vi.fn().mockImplementation(() => mockSubscriptionService),
}));

// モック設定後にインポート
import { SubscriptionController } from '../../controllers/subscription.controller.js';

/**
 * モックRequest作成ヘルパー
 */
function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    headers: {},
    params: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

/**
 * モックResponse作成ヘルパー
 */
function mockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('SubscriptionController', () => {
  let controller: SubscriptionController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new SubscriptionController();
    mockNext = vi.fn();
  });

  // ============================================
  // getSubscription
  // ============================================

  describe('getSubscription', () => {
    it('正常にサブスクリプションを取得する', async () => {
      const mockSub = {
        id: 'sub-1',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
      };
      mockSubscriptionService.getSubscription.mockResolvedValue(mockSub);

      const req = mockRequest({ params: { userId: 'user-1' } });
      const res = mockResponse();

      await controller.getSubscription(req, res, mockNext);

      expect(mockSubscriptionService.getSubscription).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ subscription: mockSub });
    });

    it('サブスクリプションがない場合はnullを返す', async () => {
      mockSubscriptionService.getSubscription.mockResolvedValue(null);

      const req = mockRequest({ params: { userId: 'user-1' } });
      const res = mockResponse();

      await controller.getSubscription(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({ subscription: null });
    });

    it('エラー時はnextに渡す', async () => {
      const error = new Error('DB error');
      mockSubscriptionService.getSubscription.mockRejectedValue(error);

      const req = mockRequest({ params: { userId: 'user-1' } });
      const res = mockResponse();

      await controller.getSubscription(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ============================================
  // createSubscription
  // ============================================

  describe('createSubscription', () => {
    it('正常にサブスクリプションを作成する（201）', async () => {
      const mockSub = {
        id: 'sub-1',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
      };
      mockSubscriptionService.createSubscription.mockResolvedValue(mockSub);

      const req = mockRequest({
        params: { userId: 'user-1' },
        body: {
          plan: 'PRO',
          billingCycle: 'MONTHLY',
          paymentMethodId: '00000000-0000-0000-0000-000000000001',
        },
      });
      const res = mockResponse();

      await controller.createSubscription(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ subscription: mockSub });
      expect(mockSubscriptionService.createSubscription).toHaveBeenCalledWith('user-1', {
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: '00000000-0000-0000-0000-000000000001',
      });
    });

    it('無効なプランの場合はnextにZodエラーを渡す', async () => {
      const req = mockRequest({
        params: { userId: 'user-1' },
        body: {
          plan: 'INVALID',
          billingCycle: 'MONTHLY',
          paymentMethodId: '00000000-0000-0000-0000-000000000001',
        },
      });
      const res = mockResponse();

      await controller.createSubscription(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockSubscriptionService.createSubscription).not.toHaveBeenCalled();
    });

    it('無効な請求サイクルの場合はnextにZodエラーを渡す', async () => {
      const req = mockRequest({
        params: { userId: 'user-1' },
        body: {
          plan: 'PRO',
          billingCycle: 'WEEKLY',
          paymentMethodId: '00000000-0000-0000-0000-000000000001',
        },
      });
      const res = mockResponse();

      await controller.createSubscription(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockSubscriptionService.createSubscription).not.toHaveBeenCalled();
    });

    it('不正なUUIDの場合はnextにZodエラーを渡す', async () => {
      const req = mockRequest({
        params: { userId: 'user-1' },
        body: {
          plan: 'PRO',
          billingCycle: 'MONTHLY',
          paymentMethodId: 'not-a-uuid',
        },
      });
      const res = mockResponse();

      await controller.createSubscription(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockSubscriptionService.createSubscription).not.toHaveBeenCalled();
    });

    it('サービスエラー時はnextに渡す', async () => {
      const error = new Error('Service error');
      mockSubscriptionService.createSubscription.mockRejectedValue(error);

      const req = mockRequest({
        params: { userId: 'user-1' },
        body: {
          plan: 'PRO',
          billingCycle: 'MONTHLY',
          paymentMethodId: '00000000-0000-0000-0000-000000000001',
        },
      });
      const res = mockResponse();

      await controller.createSubscription(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ============================================
  // cancelSubscription
  // ============================================

  describe('cancelSubscription', () => {
    it('正常にサブスクリプションをキャンセルする', async () => {
      const mockSub = {
        id: 'sub-1',
        plan: 'PRO',
        cancelAtPeriodEnd: true,
      };
      mockSubscriptionService.cancelSubscription.mockResolvedValue(mockSub);

      const req = mockRequest({ params: { userId: 'user-1' } });
      const res = mockResponse();

      await controller.cancelSubscription(req, res, mockNext);

      expect(mockSubscriptionService.cancelSubscription).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ subscription: mockSub });
    });

    it('エラー時はnextに渡す', async () => {
      const error = new Error('Cancel error');
      mockSubscriptionService.cancelSubscription.mockRejectedValue(error);

      const req = mockRequest({ params: { userId: 'user-1' } });
      const res = mockResponse();

      await controller.cancelSubscription(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ============================================
  // reactivateSubscription
  // ============================================

  describe('reactivateSubscription', () => {
    it('正常にサブスクリプションを再有効化する', async () => {
      const mockSub = {
        id: 'sub-1',
        plan: 'PRO',
        cancelAtPeriodEnd: false,
      };
      mockSubscriptionService.reactivateSubscription.mockResolvedValue(mockSub);

      const req = mockRequest({ params: { userId: 'user-1' } });
      const res = mockResponse();

      await controller.reactivateSubscription(req, res, mockNext);

      expect(mockSubscriptionService.reactivateSubscription).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ subscription: mockSub });
    });

    it('エラー時はnextに渡す', async () => {
      const error = new Error('Reactivate error');
      mockSubscriptionService.reactivateSubscription.mockRejectedValue(error);

      const req = mockRequest({ params: { userId: 'user-1' } });
      const res = mockResponse();

      await controller.reactivateSubscription(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
