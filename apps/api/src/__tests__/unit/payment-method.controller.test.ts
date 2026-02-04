import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// PaymentMethodServiceのモック
const mockPaymentMethodService = vi.hoisted(() => ({
  createSetupIntent: vi.fn(),
  getPaymentMethods: vi.fn(),
  addPaymentMethod: vi.fn(),
  deletePaymentMethod: vi.fn(),
  setDefaultPaymentMethod: vi.fn(),
}));

vi.mock('../../services/payment-method.service.js', () => ({
  PaymentMethodService: vi.fn().mockImplementation(() => mockPaymentMethodService),
}));

import { PaymentMethodController } from '../../controllers/payment-method.controller.js';

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PAYMENT_METHOD_ID = '22222222-2222-2222-2222-222222222222';

// Expressのモックヘルパー
const mockRequest = (overrides = {}): Partial<Request> => ({
  params: {},
  body: {},
  user: { id: TEST_USER_ID } as Request['user'],
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('PaymentMethodController', () => {
  let controller: PaymentMethodController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new PaymentMethodController();
    mockNext = vi.fn();
  });

  describe('createSetupIntent', () => {
    it('SetupIntentを作成できる', async () => {
      const mockSetupIntent = { clientSecret: 'seti_xxx_secret_xxx' };
      mockPaymentMethodService.createSetupIntent.mockResolvedValue(mockSetupIntent);

      const req = mockRequest({
        params: { userId: TEST_USER_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.createSetupIntent(req, res, mockNext);

      expect(mockPaymentMethodService.createSetupIntent).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ setupIntent: mockSetupIntent });
    });

    it('サービスエラー時にnextを呼ぶ', async () => {
      const error = new Error('SetupIntent作成失敗');
      mockPaymentMethodService.createSetupIntent.mockRejectedValue(error);

      const req = mockRequest({
        params: { userId: TEST_USER_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.createSetupIntent(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getPaymentMethods', () => {
    it('支払い方法一覧を取得できる', async () => {
      const mockPaymentMethods = [
        { id: TEST_PAYMENT_METHOD_ID, type: 'card', last4: '4242' },
      ];
      mockPaymentMethodService.getPaymentMethods.mockResolvedValue(mockPaymentMethods);

      const req = mockRequest({
        params: { userId: TEST_USER_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getPaymentMethods(req, res, mockNext);

      expect(mockPaymentMethodService.getPaymentMethods).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ paymentMethods: mockPaymentMethods });
    });

    it('サービスエラー時にnextを呼ぶ', async () => {
      const error = new Error('支払い方法取得失敗');
      mockPaymentMethodService.getPaymentMethods.mockRejectedValue(error);

      const req = mockRequest({
        params: { userId: TEST_USER_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getPaymentMethods(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('addPaymentMethod', () => {
    it('支払い方法を追加できる', async () => {
      const mockPaymentMethod = {
        id: TEST_PAYMENT_METHOD_ID,
        type: 'card',
        last4: '4242',
      };
      mockPaymentMethodService.addPaymentMethod.mockResolvedValue(mockPaymentMethod);

      const req = mockRequest({
        params: { userId: TEST_USER_ID },
        body: { token: 'tok_xxx' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.addPaymentMethod(req, res, mockNext);

      expect(mockPaymentMethodService.addPaymentMethod).toHaveBeenCalledWith(
        TEST_USER_ID,
        'tok_xxx'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ paymentMethod: mockPaymentMethod });
    });

    it('トークンが空文字の場合バリデーションエラーでnextを呼ぶ', async () => {
      const req = mockRequest({
        params: { userId: TEST_USER_ID },
        body: { token: '' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.addPaymentMethod(req, res, mockNext);

      expect(mockPaymentMethodService.addPaymentMethod).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('トークンが未指定の場合バリデーションエラーでnextを呼ぶ', async () => {
      const req = mockRequest({
        params: { userId: TEST_USER_ID },
        body: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.addPaymentMethod(req, res, mockNext);

      expect(mockPaymentMethodService.addPaymentMethod).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('サービスエラー時にnextを呼ぶ', async () => {
      const error = new Error('支払い方法追加失敗');
      mockPaymentMethodService.addPaymentMethod.mockRejectedValue(error);

      const req = mockRequest({
        params: { userId: TEST_USER_ID },
        body: { token: 'tok_xxx' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.addPaymentMethod(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deletePaymentMethod', () => {
    it('支払い方法を削除できる', async () => {
      mockPaymentMethodService.deletePaymentMethod.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { userId: TEST_USER_ID, paymentMethodId: TEST_PAYMENT_METHOD_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deletePaymentMethod(req, res, mockNext);

      expect(mockPaymentMethodService.deletePaymentMethod).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_PAYMENT_METHOD_ID
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('サービスエラー時にnextを呼ぶ', async () => {
      const error = new Error('支払い方法削除失敗');
      mockPaymentMethodService.deletePaymentMethod.mockRejectedValue(error);

      const req = mockRequest({
        params: { userId: TEST_USER_ID, paymentMethodId: TEST_PAYMENT_METHOD_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deletePaymentMethod(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('デフォルト支払い方法を設定できる', async () => {
      const mockPaymentMethod = {
        id: TEST_PAYMENT_METHOD_ID,
        type: 'card',
        last4: '4242',
        isDefault: true,
      };
      mockPaymentMethodService.setDefaultPaymentMethod.mockResolvedValue(mockPaymentMethod);

      const req = mockRequest({
        params: { userId: TEST_USER_ID, paymentMethodId: TEST_PAYMENT_METHOD_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.setDefaultPaymentMethod(req, res, mockNext);

      expect(mockPaymentMethodService.setDefaultPaymentMethod).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_PAYMENT_METHOD_ID
      );
      expect(res.json).toHaveBeenCalledWith({ paymentMethod: mockPaymentMethod });
    });

    it('サービスエラー時にnextを呼ぶ', async () => {
      const error = new Error('デフォルト設定失敗');
      mockPaymentMethodService.setDefaultPaymentMethod.mockRejectedValue(error);

      const req = mockRequest({
        params: { userId: TEST_USER_ID, paymentMethodId: TEST_PAYMENT_METHOD_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.setDefaultPaymentMethod(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
