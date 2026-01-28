import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockSubscriptionService, mockPaymentMethodService, mockInvoiceService } = vi.hoisted(() => ({
  mockSubscriptionService: {
    getSubscription: vi.fn(),
    createSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    reactivateSubscription: vi.fn(),
    calculatePlanChange: vi.fn(),
  },
  mockPaymentMethodService: {
    getPaymentMethods: vi.fn(),
    addPaymentMethod: vi.fn(),
    deletePaymentMethod: vi.fn(),
    setDefaultPaymentMethod: vi.fn(),
    createSetupIntent: vi.fn(),
  },
  mockInvoiceService: {
    getInvoices: vi.fn(),
  },
}));

vi.mock('../../services/organization-subscription.service.js', () => ({
  OrganizationSubscriptionService: vi.fn().mockImplementation(() => mockSubscriptionService),
}));

vi.mock('../../services/organization-payment-method.service.js', () => ({
  OrganizationPaymentMethodService: vi.fn().mockImplementation(() => mockPaymentMethodService),
}));

vi.mock('../../services/organization-invoice.service.js', () => ({
  OrganizationInvoiceService: vi.fn().mockImplementation(() => mockInvoiceService),
}));

// モック設定後にインポート
import { OrganizationBillingController } from '../../controllers/organization-billing.controller.js';

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

describe('OrganizationBillingController', () => {
  let controller: OrganizationBillingController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new OrganizationBillingController();
    mockNext = vi.fn();
  });

  // ============================================
  // Subscription エンドポイント
  // ============================================

  describe('Subscription エンドポイント', () => {
    describe('getSubscription', () => {
      it('正常にサブスクリプションを取得する', async () => {
        const mockSub = {
          id: 'sub-1',
          plan: 'TEAM',
          billingCycle: 'MONTHLY',
          status: 'ACTIVE',
          quantity: 5,
        };
        mockSubscriptionService.getSubscription.mockResolvedValue(mockSub);

        const req = mockRequest({ params: { organizationId: 'org-1' } });
        const res = mockResponse();

        await controller.getSubscription(req, res, mockNext);

        expect(mockSubscriptionService.getSubscription).toHaveBeenCalledWith('org-1');
        expect(res.json).toHaveBeenCalledWith({ subscription: mockSub });
      });

      it('サブスクリプションがない場合はnullを返す', async () => {
        mockSubscriptionService.getSubscription.mockResolvedValue(null);

        const req = mockRequest({ params: { organizationId: 'org-1' } });
        const res = mockResponse();

        await controller.getSubscription(req, res, mockNext);

        expect(res.json).toHaveBeenCalledWith({ subscription: null });
      });

      it('エラー時はnextに渡す', async () => {
        const error = new Error('DB error');
        mockSubscriptionService.getSubscription.mockRejectedValue(error);

        const req = mockRequest({ params: { organizationId: 'org-1' } });
        const res = mockResponse();

        await controller.getSubscription(req, res, mockNext);

        expect(mockNext).toHaveBeenCalledWith(error);
      });
    });

    describe('createSubscription', () => {
      it('正常にサブスクリプションを作成する（201）', async () => {
        const mockSub = {
          id: 'sub-1',
          plan: 'TEAM',
          billingCycle: 'MONTHLY',
          status: 'ACTIVE',
          quantity: 3,
        };
        mockSubscriptionService.createSubscription.mockResolvedValue(mockSub);

        const req = mockRequest({
          params: { organizationId: 'org-1' },
          body: {
            billingCycle: 'MONTHLY',
            paymentMethodId: '00000000-0000-0000-0000-000000000001',
          },
        });
        const res = mockResponse();

        await controller.createSubscription(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ subscription: mockSub });
        expect(mockSubscriptionService.createSubscription).toHaveBeenCalledWith('org-1', {
          plan: 'TEAM',
          billingCycle: 'MONTHLY',
          paymentMethodId: '00000000-0000-0000-0000-000000000001',
        });
      });

      it('無効な請求サイクルの場合はnextにZodエラーを渡す', async () => {
        const req = mockRequest({
          params: { organizationId: 'org-1' },
          body: {
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
          params: { organizationId: 'org-1' },
          body: {
            billingCycle: 'MONTHLY',
            paymentMethodId: 'not-a-uuid',
          },
        });
        const res = mockResponse();

        await controller.createSubscription(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockSubscriptionService.createSubscription).not.toHaveBeenCalled();
      });
    });

    describe('updateSubscription', () => {
      it('正常にサブスクリプションを更新する', async () => {
        const mockSub = {
          id: 'sub-1',
          plan: 'TEAM',
          billingCycle: 'YEARLY',
          status: 'ACTIVE',
        };
        mockSubscriptionService.updateSubscription.mockResolvedValue(mockSub);

        const req = mockRequest({
          params: { organizationId: 'org-1' },
          body: { billingCycle: 'YEARLY' },
        });
        const res = mockResponse();

        await controller.updateSubscription(req, res, mockNext);

        expect(mockSubscriptionService.updateSubscription).toHaveBeenCalledWith('org-1', {
          billingCycle: 'YEARLY',
        });
        expect(res.json).toHaveBeenCalledWith({ subscription: mockSub });
      });

      it('無効な請求サイクルの場合はnextにZodエラーを渡す', async () => {
        const req = mockRequest({
          params: { organizationId: 'org-1' },
          body: { billingCycle: 'INVALID' },
        });
        const res = mockResponse();

        await controller.updateSubscription(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockSubscriptionService.updateSubscription).not.toHaveBeenCalled();
      });
    });

    describe('cancelSubscription', () => {
      it('正常にサブスクリプションをキャンセルする', async () => {
        const mockSub = {
          id: 'sub-1',
          plan: 'TEAM',
          cancelAtPeriodEnd: true,
        };
        mockSubscriptionService.cancelSubscription.mockResolvedValue(mockSub);

        const req = mockRequest({ params: { organizationId: 'org-1' } });
        const res = mockResponse();

        await controller.cancelSubscription(req, res, mockNext);

        expect(mockSubscriptionService.cancelSubscription).toHaveBeenCalledWith('org-1');
        expect(res.json).toHaveBeenCalledWith({ subscription: mockSub });
      });

      it('エラー時はnextに渡す', async () => {
        const error = new Error('Cancel error');
        mockSubscriptionService.cancelSubscription.mockRejectedValue(error);

        const req = mockRequest({ params: { organizationId: 'org-1' } });
        const res = mockResponse();

        await controller.cancelSubscription(req, res, mockNext);

        expect(mockNext).toHaveBeenCalledWith(error);
      });
    });

    describe('reactivateSubscription', () => {
      it('正常にサブスクリプションを再有効化する', async () => {
        const mockSub = {
          id: 'sub-1',
          plan: 'TEAM',
          cancelAtPeriodEnd: false,
        };
        mockSubscriptionService.reactivateSubscription.mockResolvedValue(mockSub);

        const req = mockRequest({ params: { organizationId: 'org-1' } });
        const res = mockResponse();

        await controller.reactivateSubscription(req, res, mockNext);

        expect(mockSubscriptionService.reactivateSubscription).toHaveBeenCalledWith('org-1');
        expect(res.json).toHaveBeenCalledWith({ subscription: mockSub });
      });

      it('エラー時はnextに渡す', async () => {
        const error = new Error('Reactivate error');
        mockSubscriptionService.reactivateSubscription.mockRejectedValue(error);

        const req = mockRequest({ params: { organizationId: 'org-1' } });
        const res = mockResponse();

        await controller.reactivateSubscription(req, res, mockNext);

        expect(mockNext).toHaveBeenCalledWith(error);
      });
    });

    describe('calculatePlanChange', () => {
      it('正常に料金計算結果を返す', async () => {
        const mockCalc = {
          plan: 'TEAM',
          billingCycle: 'MONTHLY',
          pricePerUser: 1500,
          quantity: 3,
          totalPrice: 4500,
          currency: 'jpy',
          effectiveDate: new Date(),
        };
        mockSubscriptionService.calculatePlanChange.mockResolvedValue(mockCalc);

        const req = mockRequest({
          params: { organizationId: 'org-1' },
          query: { billingCycle: 'MONTHLY' },
        });
        const res = mockResponse();

        await controller.calculatePlanChange(req, res, mockNext);

        expect(mockSubscriptionService.calculatePlanChange).toHaveBeenCalledWith('org-1', 'TEAM', 'MONTHLY');
        expect(res.json).toHaveBeenCalledWith({ calculation: mockCalc });
      });

      it('無効なクエリパラメータの場合はnextにエラーを渡す', async () => {
        const req = mockRequest({
          params: { organizationId: 'org-1' },
          query: { billingCycle: 'INVALID' },
        });
        const res = mockResponse();

        await controller.calculatePlanChange(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockSubscriptionService.calculatePlanChange).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // PaymentMethod エンドポイント
  // ============================================

  describe('PaymentMethod エンドポイント', () => {
    describe('getPaymentMethods', () => {
      it('正常に支払い方法一覧を取得する', async () => {
        const mockPaymentMethods = [
          { id: 'pm-1', brand: 'visa', last4: '4242', isDefault: true },
          { id: 'pm-2', brand: 'mastercard', last4: '5555', isDefault: false },
        ];
        mockPaymentMethodService.getPaymentMethods.mockResolvedValue(mockPaymentMethods);

        const req = mockRequest({ params: { organizationId: 'org-1' } });
        const res = mockResponse();

        await controller.getPaymentMethods(req, res, mockNext);

        expect(mockPaymentMethodService.getPaymentMethods).toHaveBeenCalledWith('org-1');
        expect(res.json).toHaveBeenCalledWith({ paymentMethods: mockPaymentMethods });
      });
    });

    describe('addPaymentMethod', () => {
      it('正常に支払い方法を追加する（201）', async () => {
        const mockPM = { id: 'pm-1', brand: 'visa', last4: '4242', isDefault: true };
        mockPaymentMethodService.addPaymentMethod.mockResolvedValue(mockPM);

        const req = mockRequest({
          params: { organizationId: 'org-1' },
          body: { token: 'tok_visa_4242' },
        });
        const res = mockResponse();

        await controller.addPaymentMethod(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ paymentMethod: mockPM });
        expect(mockPaymentMethodService.addPaymentMethod).toHaveBeenCalledWith('org-1', 'tok_visa_4242');
      });

      it('トークンがない場合はnextにZodエラーを渡す', async () => {
        const req = mockRequest({
          params: { organizationId: 'org-1' },
          body: {},
        });
        const res = mockResponse();

        await controller.addPaymentMethod(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockPaymentMethodService.addPaymentMethod).not.toHaveBeenCalled();
      });

      it('空のトークンの場合はnextにZodエラーを渡す', async () => {
        const req = mockRequest({
          params: { organizationId: 'org-1' },
          body: { token: '' },
        });
        const res = mockResponse();

        await controller.addPaymentMethod(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockPaymentMethodService.addPaymentMethod).not.toHaveBeenCalled();
      });
    });

    describe('deletePaymentMethod', () => {
      it('正常に支払い方法を削除する（204）', async () => {
        mockPaymentMethodService.deletePaymentMethod.mockResolvedValue(undefined);

        const req = mockRequest({
          params: { organizationId: 'org-1', paymentMethodId: 'pm-1' },
        });
        const res = mockResponse();

        await controller.deletePaymentMethod(req, res, mockNext);

        expect(mockPaymentMethodService.deletePaymentMethod).toHaveBeenCalledWith('org-1', 'pm-1');
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalled();
      });
    });

    describe('setDefaultPaymentMethod', () => {
      it('正常にデフォルト支払い方法を設定する', async () => {
        const mockPM = { id: 'pm-1', brand: 'visa', last4: '4242', isDefault: true };
        mockPaymentMethodService.setDefaultPaymentMethod.mockResolvedValue(mockPM);

        const req = mockRequest({
          params: { organizationId: 'org-1', paymentMethodId: 'pm-1' },
        });
        const res = mockResponse();

        await controller.setDefaultPaymentMethod(req, res, mockNext);

        expect(mockPaymentMethodService.setDefaultPaymentMethod).toHaveBeenCalledWith('org-1', 'pm-1');
        expect(res.json).toHaveBeenCalledWith({ paymentMethod: mockPM });
      });
    });

    describe('createSetupIntent', () => {
      it('正常にSetupIntentを作成する', async () => {
        const mockResult = { clientSecret: 'seti_secret_123' };
        mockPaymentMethodService.createSetupIntent.mockResolvedValue(mockResult);

        const req = mockRequest({ params: { organizationId: 'org-1' } });
        const res = mockResponse();

        await controller.createSetupIntent(req, res, mockNext);

        expect(mockPaymentMethodService.createSetupIntent).toHaveBeenCalledWith('org-1');
        expect(res.json).toHaveBeenCalledWith({ setupIntent: mockResult });
      });
    });
  });

  // ============================================
  // Invoice エンドポイント
  // ============================================

  describe('Invoice エンドポイント', () => {
    describe('getInvoices', () => {
      it('正常に請求履歴を取得する', async () => {
        // サービスが返す形式（data）
        const mockServiceResult = {
          data: [{ id: 'inv-1', amount: 4500, status: 'PAID' }],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        };
        // コントローラーが返す形式（invoices）
        const expectedControllerResult = {
          invoices: [{ id: 'inv-1', amount: 4500, status: 'PAID' }],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        };
        mockInvoiceService.getInvoices.mockResolvedValue(mockServiceResult);

        const req = mockRequest({
          params: { organizationId: 'org-1' },
          query: { page: '1', limit: '20' },
        });
        const res = mockResponse();

        await controller.getInvoices(req, res, mockNext);

        expect(mockInvoiceService.getInvoices).toHaveBeenCalledWith('org-1', { page: 1, limit: 20 });
        expect(res.json).toHaveBeenCalledWith(expectedControllerResult);
      });

      it('デフォルトのページネーションパラメータを使用する', async () => {
        const mockServiceResult = {
          data: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        };
        mockInvoiceService.getInvoices.mockResolvedValue(mockServiceResult);

        const req = mockRequest({
          params: { organizationId: 'org-1' },
          query: {},
        });
        const res = mockResponse();

        await controller.getInvoices(req, res, mockNext);

        expect(mockInvoiceService.getInvoices).toHaveBeenCalledWith('org-1', { page: 1, limit: 20 });
      });

      it('limitが100を超える場合はZodエラーを渡す', async () => {
        const req = mockRequest({
          params: { organizationId: 'org-1' },
          query: { page: '1', limit: '101' },
        });
        const res = mockResponse();

        await controller.getInvoices(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockInvoiceService.getInvoices).not.toHaveBeenCalled();
      });
    });
  });
});
