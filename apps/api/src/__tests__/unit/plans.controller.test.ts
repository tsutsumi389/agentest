import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockSubscriptionService } = vi.hoisted(() => ({
  mockSubscriptionService: {
    calculatePlanChange: vi.fn(),
  },
}));

vi.mock('../../services/subscription.service.js', () => ({
  SubscriptionService: vi.fn().mockImplementation(() => mockSubscriptionService),
}));

// モック設定後にインポート
import { PlansController } from '../../controllers/plans.controller.js';

/**
 * モックRequest作成ヘルパー
 */
function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    headers: {},
    params: {},
    query: {},
    user: undefined,
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

describe('PlansController', () => {
  let controller: PlansController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new PlansController();
    mockNext = vi.fn();
  });

  // ============================================
  // getPlans
  // ============================================

  describe('getPlans', () => {
    it('プラン一覧を取得する（FREEとPROの価格・features含む）', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await controller.getPlans(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        plans: expect.arrayContaining([
          expect.objectContaining({
            plan: 'FREE',
            monthlyPrice: expect.any(Number),
            yearlyPrice: expect.any(Number),
            yearlySavings: expect.any(Number),
            features: expect.any(Array),
          }),
          expect.objectContaining({
            plan: 'PRO',
            monthlyPrice: expect.any(Number),
            yearlyPrice: expect.any(Number),
            yearlySavings: expect.any(Number),
            features: expect.any(Array),
          }),
        ]),
      });

      // プランが2つあることを確認
      const call = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.plans).toHaveLength(2);
    });
  });

  // ============================================
  // calculatePlanChange
  // ============================================

  describe('calculatePlanChange', () => {
    it('正常に料金計算を行う', async () => {
      const mockCalc = {
        currentPlan: 'FREE',
        newPlan: 'PRO',
        billingCycle: 'MONTHLY',
        prorationAmount: 980,
      };
      mockSubscriptionService.calculatePlanChange.mockResolvedValue(mockCalc);

      const req = mockRequest({
        params: { plan: 'PRO' },
        query: { billingCycle: 'MONTHLY' },
        user: { id: 'user-1' } as any,
      });
      const res = mockResponse();

      await controller.calculatePlanChange(req, res, mockNext);

      expect(mockSubscriptionService.calculatePlanChange).toHaveBeenCalledWith(
        'user-1',
        'PRO',
        'MONTHLY',
      );
      expect(res.json).toHaveBeenCalledWith({ calculation: mockCalc });
    });

    it('未認証の場合はAuthorizationErrorをnextに渡す', async () => {
      const req = mockRequest({
        params: { plan: 'PRO' },
        query: { billingCycle: 'MONTHLY' },
        // user未設定
      });
      const res = mockResponse();

      await controller.calculatePlanChange(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('認証が必要です');
    });

    it('無効なプランの場合はZodエラーをnextに渡す', async () => {
      const req = mockRequest({
        params: { plan: 'INVALID' },
        query: { billingCycle: 'MONTHLY' },
        user: { id: 'user-1' } as any,
      });
      const res = mockResponse();

      await controller.calculatePlanChange(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockSubscriptionService.calculatePlanChange).not.toHaveBeenCalled();
    });

    it('無効なbillingCycleの場合はZodエラーをnextに渡す', async () => {
      const req = mockRequest({
        params: { plan: 'PRO' },
        query: { billingCycle: 'WEEKLY' },
        user: { id: 'user-1' } as any,
      });
      const res = mockResponse();

      await controller.calculatePlanChange(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockSubscriptionService.calculatePlanChange).not.toHaveBeenCalled();
    });
  });
});
