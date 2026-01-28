import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { UserInvoiceController } from '../../controllers/user-invoice.controller.js';
import { AuthorizationError, NotFoundError } from '@agentest/shared';

// UserInvoiceService のモック
const mockUserInvoiceService = {
  getInvoices: vi.fn(),
  getInvoice: vi.fn(),
  getInvoicePdfUrl: vi.fn(),
  invalidateCache: vi.fn(),
};

vi.mock('../../services/user-invoice.service.js', () => ({
  UserInvoiceService: vi.fn().mockImplementation(() => mockUserInvoiceService),
}));

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
const TEST_INVOICE_ID = 'in_test123';

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID, email: 'test@example.com' } as any,
  params: { userId: TEST_USER_ID },
  body: {},
  query: {},
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.redirect = vi.fn().mockReturnValue(res);
  return res;
};

describe('UserInvoiceController', () => {
  let controller: UserInvoiceController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new UserInvoiceController();
    mockNext = vi.fn();
  });

  describe('getInvoices', () => {
    it('請求履歴一覧を取得できる', async () => {
      const mockInvoices = {
        invoices: [
          {
            id: 'in_123',
            invoiceNumber: 'INV-001',
            amount: 1000,
            currency: 'jpy',
            status: 'paid',
            periodStart: new Date('2024-01-01'),
            periodEnd: new Date('2024-01-31'),
            dueDate: null,
            pdfUrl: 'https://stripe.com/pdf',
            createdAt: new Date('2024-01-01'),
          },
        ],
        total: 1,
      };
      mockUserInvoiceService.getInvoices.mockResolvedValue(mockInvoices);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getInvoices(req, res, mockNext);

      expect(mockUserInvoiceService.getInvoices).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith(mockInvoices);
    });

    it('他人の請求履歴取得はAuthorizationError', async () => {
      const req = mockRequest({
        params: { userId: OTHER_USER_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getInvoices(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect(mockUserInvoiceService.getInvoices).not.toHaveBeenCalled();
    });

    it('エラーをnextに渡す', async () => {
      const error = new NotFoundError('User', TEST_USER_ID);
      mockUserInvoiceService.getInvoices.mockRejectedValue(error);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getInvoices(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getInvoice', () => {
    it('請求書詳細を取得できる', async () => {
      const mockInvoice = {
        id: TEST_INVOICE_ID,
        invoiceNumber: 'INV-001',
        amount: 1000,
        currency: 'jpy',
        status: 'paid',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        dueDate: null,
        pdfUrl: 'https://stripe.com/pdf',
        createdAt: new Date('2024-01-01'),
      };
      mockUserInvoiceService.getInvoice.mockResolvedValue(mockInvoice);

      const req = mockRequest({
        params: { userId: TEST_USER_ID, invoiceId: TEST_INVOICE_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getInvoice(req, res, mockNext);

      expect(mockUserInvoiceService.getInvoice).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_INVOICE_ID
      );
      expect(res.json).toHaveBeenCalledWith({ invoice: mockInvoice });
    });

    it('他人の請求書取得はAuthorizationError', async () => {
      const req = mockRequest({
        params: { userId: OTHER_USER_ID, invoiceId: TEST_INVOICE_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getInvoice(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect(mockUserInvoiceService.getInvoice).not.toHaveBeenCalled();
    });

    it('存在しない請求書はエラー', async () => {
      const error = new NotFoundError('Invoice', TEST_INVOICE_ID);
      mockUserInvoiceService.getInvoice.mockRejectedValue(error);

      const req = mockRequest({
        params: { userId: TEST_USER_ID, invoiceId: TEST_INVOICE_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getInvoice(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getInvoicePdf', () => {
    it('PDFにリダイレクトする', async () => {
      const pdfUrl = 'https://stripe.com/invoices/in_123/pdf';
      mockUserInvoiceService.getInvoicePdfUrl.mockResolvedValue(pdfUrl);

      const req = mockRequest({
        params: { userId: TEST_USER_ID, invoiceId: TEST_INVOICE_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getInvoicePdf(req, res, mockNext);

      expect(mockUserInvoiceService.getInvoicePdfUrl).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_INVOICE_ID
      );
      expect(res.redirect).toHaveBeenCalledWith(pdfUrl);
    });

    it('他人のPDF取得はAuthorizationError', async () => {
      const req = mockRequest({
        params: { userId: OTHER_USER_ID, invoiceId: TEST_INVOICE_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getInvoicePdf(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect(mockUserInvoiceService.getInvoicePdfUrl).not.toHaveBeenCalled();
    });

    it('PDFが存在しない場合はエラー', async () => {
      const error = new NotFoundError('InvoicePdf', TEST_INVOICE_ID);
      mockUserInvoiceService.getInvoicePdfUrl.mockRejectedValue(error);

      const req = mockRequest({
        params: { userId: TEST_USER_ID, invoiceId: TEST_INVOICE_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getInvoicePdf(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
