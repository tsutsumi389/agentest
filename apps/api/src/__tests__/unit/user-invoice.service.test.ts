import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, AuthorizationError } from '@agentest/shared';
import type { InvoiceResult } from '../../gateways/payment/types.js';

// Prismaのモック
vi.mock('@agentest/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Redisキャッシュのモック
vi.mock('../../lib/redis-store.js', () => ({
  getUserInvoicesCache: vi.fn(),
  setUserInvoicesCache: vi.fn(),
  invalidateUserInvoicesCache: vi.fn(),
}));

// モックをインポート
import { prisma } from '@agentest/db';
import {
  getUserInvoicesCache,
  setUserInvoicesCache,
  invalidateUserInvoicesCache,
} from '../../lib/redis-store.js';
import { UserInvoiceService } from '../../services/user-invoice.service.js';

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_CUSTOMER_ID = 'cus_test123';
const OTHER_CUSTOMER_ID = 'cus_other456';
const TEST_INVOICE_ID = 'in_test123';

// PaymentGatewayのモック
const mockPaymentGateway = {
  listInvoices: vi.fn(),
  getInvoice: vi.fn(),
  getInvoicePdf: vi.fn(),
};

// テスト用の請求書データ
const createMockInvoice = (overrides = {}): InvoiceResult => ({
  id: TEST_INVOICE_ID,
  subscriptionId: 'sub_test123',
  customerId: TEST_CUSTOMER_ID,
  invoiceNumber: 'INV-001',
  amount: 1000,
  currency: 'jpy',
  status: 'paid',
  periodStart: new Date('2024-01-01T00:00:00.000Z'),
  periodEnd: new Date('2024-01-31T23:59:59.999Z'),
  dueDate: null,
  pdfUrl: 'https://stripe.com/invoices/in_test123/pdf',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('UserInvoiceService', () => {
  let service: UserInvoiceService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserInvoicesCache).mockResolvedValue(null);
    vi.mocked(setUserInvoicesCache).mockResolvedValue(true);
    vi.mocked(invalidateUserInvoicesCache).mockResolvedValue(true);
    service = new UserInvoiceService(mockPaymentGateway as any);
  });

  describe('getInvoices', () => {
    it('キャッシュがある場合はキャッシュを返す', async () => {
      const cachedResult = {
        invoices: [createMockInvoice()],
        total: 1,
      };
      vi.mocked(getUserInvoicesCache).mockResolvedValue(cachedResult);

      const result = await service.getInvoices(TEST_USER_ID);

      expect(result).toEqual(cachedResult);
      expect(mockPaymentGateway.listInvoices).not.toHaveBeenCalled();
    });

    it('ユーザーが存在しない場合はNotFoundError', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.getInvoices(TEST_USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('paymentCustomerIdがない場合は空のリストを返す', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        paymentCustomerId: null,
      } as any);

      const result = await service.getInvoices(TEST_USER_ID);

      expect(result).toEqual({ invoices: [], total: 0 });
      expect(setUserInvoicesCache).toHaveBeenCalledWith(
        TEST_USER_ID,
        { invoices: [], total: 0 }
      );
    });

    it('Stripeから請求履歴を取得してキャッシュに保存する', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        paymentCustomerId: TEST_CUSTOMER_ID,
      } as any);
      const mockInvoices = [createMockInvoice(), createMockInvoice({ id: 'in_test456' })];
      mockPaymentGateway.listInvoices.mockResolvedValue(mockInvoices);

      const result = await service.getInvoices(TEST_USER_ID);

      expect(result.total).toBe(2);
      expect(result.invoices).toHaveLength(2);
      expect(mockPaymentGateway.listInvoices).toHaveBeenCalledWith(TEST_CUSTOMER_ID);
      expect(setUserInvoicesCache).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({ total: 2 })
      );
    });
  });

  describe('getInvoice', () => {
    it('請求書詳細を取得できる', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        paymentCustomerId: TEST_CUSTOMER_ID,
      } as any);
      const mockInvoice = createMockInvoice();
      mockPaymentGateway.getInvoice.mockResolvedValue(mockInvoice);

      const result = await service.getInvoice(TEST_USER_ID, TEST_INVOICE_ID);

      expect(result.id).toBe(TEST_INVOICE_ID);
      expect(result.invoiceNumber).toBe('INV-001');
      expect(mockPaymentGateway.getInvoice).toHaveBeenCalledWith(TEST_INVOICE_ID);
    });

    it('ユーザーが存在しない場合はNotFoundError', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.getInvoice(TEST_USER_ID, TEST_INVOICE_ID)).rejects.toThrow(
        NotFoundError
      );
    });

    it('paymentCustomerIdがない場合はNotFoundError', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        paymentCustomerId: null,
      } as any);

      await expect(service.getInvoice(TEST_USER_ID, TEST_INVOICE_ID)).rejects.toThrow(
        NotFoundError
      );
    });

    it('請求書が存在しない場合はNotFoundError', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        paymentCustomerId: TEST_CUSTOMER_ID,
      } as any);
      mockPaymentGateway.getInvoice.mockResolvedValue(null);

      await expect(service.getInvoice(TEST_USER_ID, TEST_INVOICE_ID)).rejects.toThrow(
        NotFoundError
      );
    });

    it('他のユーザーの請求書にアクセスするとAuthorizationError', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        paymentCustomerId: TEST_CUSTOMER_ID,
      } as any);
      // 顧客IDが異なる請求書
      const mockInvoice = createMockInvoice({ customerId: OTHER_CUSTOMER_ID });
      mockPaymentGateway.getInvoice.mockResolvedValue(mockInvoice);

      await expect(service.getInvoice(TEST_USER_ID, TEST_INVOICE_ID)).rejects.toThrow(
        AuthorizationError
      );
    });
  });

  describe('getInvoicePdfUrl', () => {
    it('PDF URLを取得できる', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        paymentCustomerId: TEST_CUSTOMER_ID,
      } as any);
      const mockInvoice = createMockInvoice();
      mockPaymentGateway.getInvoice.mockResolvedValue(mockInvoice);
      mockPaymentGateway.getInvoicePdf.mockResolvedValue(
        'https://stripe.com/invoices/in_test123/pdf'
      );

      const result = await service.getInvoicePdfUrl(TEST_USER_ID, TEST_INVOICE_ID);

      expect(result).toBe('https://stripe.com/invoices/in_test123/pdf');
      expect(mockPaymentGateway.getInvoicePdf).toHaveBeenCalledWith(TEST_INVOICE_ID);
    });

    it('PDFが存在しない場合はNotFoundError', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        paymentCustomerId: TEST_CUSTOMER_ID,
      } as any);
      const mockInvoice = createMockInvoice();
      mockPaymentGateway.getInvoice.mockResolvedValue(mockInvoice);
      mockPaymentGateway.getInvoicePdf.mockResolvedValue(null);

      await expect(
        service.getInvoicePdfUrl(TEST_USER_ID, TEST_INVOICE_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('他のユーザーの請求書PDFにアクセスするとAuthorizationError', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        paymentCustomerId: TEST_CUSTOMER_ID,
      } as any);
      const mockInvoice = createMockInvoice({ customerId: OTHER_CUSTOMER_ID });
      mockPaymentGateway.getInvoice.mockResolvedValue(mockInvoice);

      await expect(
        service.getInvoicePdfUrl(TEST_USER_ID, TEST_INVOICE_ID)
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('invalidateCache', () => {
    it('キャッシュを無効化できる', async () => {
      await service.invalidateCache(TEST_USER_ID);

      expect(invalidateUserInvoicesCache).toHaveBeenCalledWith(TEST_USER_ID);
    });
  });
});
