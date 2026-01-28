import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockGateway, mockWebhookService } = vi.hoisted(() => ({
  mockGateway: {
    verifyAndParseWebhookEvent: vi.fn(),
  },
  mockWebhookService: {
    handleEvent: vi.fn(),
  },
}));

vi.mock('../../gateways/payment/index.js', () => ({
  getPaymentGateway: () => mockGateway,
}));

vi.mock('../../services/webhook.service.js', () => ({
  WebhookService: vi.fn().mockImplementation(() => mockWebhookService),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// モック設定後にインポート
import { WebhookController } from '../../controllers/webhook.controller.js';

/**
 * モックRequest作成ヘルパー
 */
function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: undefined,
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

describe('WebhookController', () => {
  let controller: WebhookController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new WebhookController();
    mockNext = vi.fn();
  });

  describe('handleStripeWebhook', () => {
    it('raw body（Buffer）で正常処理する', async () => {
      const rawBody = Buffer.from('{"type":"invoice.paid"}');
      const req = mockRequest({
        body: rawBody,
        headers: { 'stripe-signature': 'sig_123' },
      });
      const res = mockResponse();

      const mockEvent = {
        id: 'evt_1',
        type: 'invoice.paid',
        data: { object: {} },
        createdAt: new Date(),
      };
      mockGateway.verifyAndParseWebhookEvent.mockReturnValue(mockEvent);
      mockWebhookService.handleEvent.mockResolvedValue({ duplicate: false });

      await controller.handleStripeWebhook(req, res, mockNext);

      expect(mockGateway.verifyAndParseWebhookEvent).toHaveBeenCalledWith(
        rawBody.toString('utf8'),
        'sig_123',
      );
      expect(mockWebhookService.handleEvent).toHaveBeenCalledWith(mockEvent);
      expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: false });
    });

    it('raw body（string）で正常処理する', async () => {
      const rawBody = '{"type":"invoice.paid"}';
      const req = mockRequest({
        body: rawBody,
        headers: { 'stripe-signature': 'sig_123' },
      });
      const res = mockResponse();

      const mockEvent = {
        id: 'evt_1',
        type: 'invoice.paid',
        data: { object: {} },
        createdAt: new Date(),
      };
      mockGateway.verifyAndParseWebhookEvent.mockReturnValue(mockEvent);
      mockWebhookService.handleEvent.mockResolvedValue({ duplicate: false });

      await controller.handleStripeWebhook(req, res, mockNext);

      expect(mockGateway.verifyAndParseWebhookEvent).toHaveBeenCalledWith(rawBody, 'sig_123');
      expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: false });
    });

    it('重複イベントの場合はduplicate: trueを返す', async () => {
      const rawBody = '{"type":"invoice.paid"}';
      const req = mockRequest({
        body: rawBody,
        headers: { 'stripe-signature': 'sig_123' },
      });
      const res = mockResponse();

      const mockEvent = {
        id: 'evt_1',
        type: 'invoice.paid',
        data: { object: {} },
        createdAt: new Date(),
      };
      mockGateway.verifyAndParseWebhookEvent.mockReturnValue(mockEvent);
      mockWebhookService.handleEvent.mockResolvedValue({ duplicate: true });

      await controller.handleStripeWebhook(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: true });
    });

    it('JSONオブジェクト（非raw）の場合は400エラーを返す', async () => {
      const req = mockRequest({
        body: { type: 'invoice.paid' },
        headers: { 'stripe-signature': 'sig_123' },
      });
      const res = mockResponse();

      await controller.handleStripeWebhook(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid request body: raw body is required for webhook signature verification',
      });
      expect(mockGateway.verifyAndParseWebhookEvent).not.toHaveBeenCalled();
    });

    it('stripe-signatureヘッダー欠損の場合は400エラーを返す', async () => {
      const req = mockRequest({
        body: Buffer.from('{}'),
        headers: {},
      });
      const res = mockResponse();

      await controller.handleStripeWebhook(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing stripe-signature header' });
    });

    it('署名検証失敗時はnextにエラーを渡す', async () => {
      const req = mockRequest({
        body: Buffer.from('{}'),
        headers: { 'stripe-signature': 'invalid_sig' },
      });
      const res = mockResponse();

      const signatureError = new Error('Signature verification failed');
      mockGateway.verifyAndParseWebhookEvent.mockImplementation(() => {
        throw signatureError;
      });

      await controller.handleStripeWebhook(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(signatureError);
    });

    it('WebhookService.handleEvent失敗時はnextにエラーを渡す', async () => {
      const req = mockRequest({
        body: Buffer.from('{}'),
        headers: { 'stripe-signature': 'sig_123' },
      });
      const res = mockResponse();

      const mockEvent = {
        id: 'evt_1',
        type: 'invoice.paid',
        data: { object: {} },
        createdAt: new Date(),
      };
      mockGateway.verifyAndParseWebhookEvent.mockReturnValue(mockEvent);

      const serviceError = new Error('Service error');
      mockWebhookService.handleEvent.mockRejectedValue(serviceError);

      await controller.handleStripeWebhook(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(serviceError);
    });
  });
});
