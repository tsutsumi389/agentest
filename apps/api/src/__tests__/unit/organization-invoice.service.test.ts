import { describe, it, expect, vi, beforeEach } from 'vitest';

// InvoiceRepositoryのモック
const mockInvoiceRepo = vi.hoisted(() => ({
  findBySubscriptionId: vi.fn(),
}));

// SubscriptionRepositoryのモック
const mockSubscriptionRepo = vi.hoisted(() => ({
  findByOrganizationId: vi.fn(),
}));

vi.mock('../../repositories/invoice.repository.js', () => ({
  InvoiceRepository: vi.fn().mockImplementation(() => mockInvoiceRepo),
}));

vi.mock('../../repositories/subscription.repository.js', () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => mockSubscriptionRepo),
}));

import { OrganizationInvoiceService } from '../../services/organization-invoice.service.js';

// テスト用の固定値
const TEST_ORG_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUBSCRIPTION_ID = '22222222-2222-2222-2222-222222222222';
const TEST_INVOICE_ID = '33333333-3333-3333-3333-333333333333';

// Prisma Decimal型をシミュレートするヘルパー
// Number()で数値変換できるようにvalueOf/toStringを実装
const createDecimal = (value: number) => ({
  valueOf: () => value,
  toString: () => String(value),
  toNumber: () => value,
});

// テスト用の請求書データ（Prisma Decimal型をシミュレート）
const createMockInvoice = (overrides = {}) => ({
  id: TEST_INVOICE_ID,
  invoiceNumber: 'INV-2024-001',
  amount: createDecimal(1000),
  currency: 'JPY',
  status: 'PAID',
  periodStart: new Date('2024-01-01T00:00:00.000Z'),
  periodEnd: new Date('2024-01-31T23:59:59.999Z'),
  dueDate: new Date('2024-02-15T00:00:00.000Z'),
  pdfUrl: 'https://example.com/invoices/inv-001.pdf',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('OrganizationInvoiceService', () => {
  let service: OrganizationInvoiceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrganizationInvoiceService();
  });

  describe('getInvoices', () => {
    it('サブスクリプションが存在する場合、請求書一覧を取得できる', async () => {
      const mockSubscription = { id: TEST_SUBSCRIPTION_ID };
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(mockSubscription);

      const mockInvoices = [createMockInvoice()];
      mockInvoiceRepo.findBySubscriptionId.mockResolvedValue({
        data: mockInvoices,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const result = await service.getInvoices(TEST_ORG_ID, { page: 1, limit: 10 });

      expect(mockSubscriptionRepo.findByOrganizationId).toHaveBeenCalledWith(TEST_ORG_ID);
      expect(mockInvoiceRepo.findBySubscriptionId).toHaveBeenCalledWith(
        TEST_SUBSCRIPTION_ID,
        { page: 1, limit: 10 }
      );
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.data).toHaveLength(1);
      // Decimal型がNumber型に変換されていることを確認
      expect(result.data[0].amount).toBe(1000);
      expect(typeof result.data[0].amount).toBe('number');
    });

    it('amountがDecimalからNumberに変換される', async () => {
      const mockSubscription = { id: TEST_SUBSCRIPTION_ID };
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(mockSubscription);

      const mockInvoices = [
        createMockInvoice({ id: 'inv-1', amount: createDecimal(500) }),
        createMockInvoice({ id: 'inv-2', amount: createDecimal(2000) }),
      ];
      mockInvoiceRepo.findBySubscriptionId.mockResolvedValue({
        data: mockInvoices,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const result = await service.getInvoices(TEST_ORG_ID, { page: 1, limit: 10 });

      expect(result.data[0].amount).toBe(500);
      expect(result.data[1].amount).toBe(2000);
    });

    it('サブスクリプションが存在しない場合、空の結果を返す', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);

      const result = await service.getInvoices(TEST_ORG_ID, { page: 1, limit: 10 });

      expect(mockSubscriptionRepo.findByOrganizationId).toHaveBeenCalledWith(TEST_ORG_ID);
      expect(mockInvoiceRepo.findBySubscriptionId).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
    });

    it('ページネーションパラメータが正しく渡される', async () => {
      const mockSubscription = { id: TEST_SUBSCRIPTION_ID };
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(mockSubscription);
      mockInvoiceRepo.findBySubscriptionId.mockResolvedValue({
        data: [],
        total: 0,
        page: 3,
        limit: 5,
        totalPages: 0,
      });

      const result = await service.getInvoices(TEST_ORG_ID, { page: 3, limit: 5 });

      expect(mockInvoiceRepo.findBySubscriptionId).toHaveBeenCalledWith(
        TEST_SUBSCRIPTION_ID,
        { page: 3, limit: 5 }
      );
      expect(result.page).toBe(3);
      expect(result.limit).toBe(5);
    });

    it('レスポンスにすべてのフィールドが含まれる', async () => {
      const mockSubscription = { id: TEST_SUBSCRIPTION_ID };
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(mockSubscription);

      const mockInvoice = createMockInvoice();
      mockInvoiceRepo.findBySubscriptionId.mockResolvedValue({
        data: [mockInvoice],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const result = await service.getInvoices(TEST_ORG_ID, { page: 1, limit: 10 });

      const invoice = result.data[0];
      expect(invoice).toEqual({
        id: TEST_INVOICE_ID,
        invoiceNumber: 'INV-2024-001',
        amount: 1000,
        currency: 'JPY',
        status: 'PAID',
        periodStart: new Date('2024-01-01T00:00:00.000Z'),
        periodEnd: new Date('2024-01-31T23:59:59.999Z'),
        dueDate: new Date('2024-02-15T00:00:00.000Z'),
        pdfUrl: 'https://example.com/invoices/inv-001.pdf',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      });
    });
  });
});
