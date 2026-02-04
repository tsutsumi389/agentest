import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaInvoice = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    invoice: mockPrismaInvoice,
  },
}));

import { InvoiceRepository } from '../../repositories/invoice.repository.js';

describe('InvoiceRepository', () => {
  let repository: InvoiceRepository;

  const subscriptionId = '11111111-1111-1111-1111-111111111111';
  const invoiceNumber = 'INV-2024-001';

  const mockInvoice = {
    id: '22222222-2222-2222-2222-222222222222',
    subscriptionId,
    invoiceNumber,
    amount: 2980,
    currency: 'JPY',
    status: 'PAID',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-02-01'),
    dueDate: new Date('2024-01-15'),
    pdfUrl: 'https://storage.example.com/invoices/inv-001.pdf',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new InvoiceRepository();
  });

  describe('findByInvoiceNumber', () => {
    it('請求書番号で請求書を取得できる', async () => {
      mockPrismaInvoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await repository.findByInvoiceNumber(invoiceNumber);

      expect(mockPrismaInvoice.findUnique).toHaveBeenCalledWith({
        where: { invoiceNumber },
      });
      expect(result).toEqual(mockInvoice);
    });

    it('存在しない請求書番号はnullを返す', async () => {
      mockPrismaInvoice.findUnique.mockResolvedValue(null);

      const result = await repository.findByInvoiceNumber('INV-9999');

      expect(result).toBeNull();
    });
  });

  describe('upsertByInvoiceNumber', () => {
    it('請求書をアップサートできる', async () => {
      mockPrismaInvoice.upsert.mockResolvedValue(mockInvoice);

      const data = {
        subscriptionId,
        invoiceNumber,
        amount: 2980,
        currency: 'JPY',
        status: 'PAID' as const,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
        dueDate: new Date('2024-01-15'),
        pdfUrl: 'https://storage.example.com/invoices/inv-001.pdf',
      };

      const result = await repository.upsertByInvoiceNumber(invoiceNumber, data);

      expect(mockPrismaInvoice.upsert).toHaveBeenCalledWith({
        where: { invoiceNumber },
        create: {
          subscription: { connect: { id: subscriptionId } },
          invoiceNumber,
          amount: 2980,
          currency: 'JPY',
          status: 'PAID',
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          dueDate: data.dueDate,
          pdfUrl: 'https://storage.example.com/invoices/inv-001.pdf',
        },
        update: {
          amount: 2980,
          currency: 'JPY',
          status: 'PAID',
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          dueDate: data.dueDate,
          pdfUrl: 'https://storage.example.com/invoices/inv-001.pdf',
        },
      });
      expect(result).toEqual(mockInvoice);
    });

    it('pdfUrlがundefinedの場合はnullになる', async () => {
      mockPrismaInvoice.upsert.mockResolvedValue({ ...mockInvoice, pdfUrl: null });

      const data = {
        subscriptionId,
        invoiceNumber,
        amount: 2980,
        currency: 'JPY',
        status: 'PENDING' as const,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
        dueDate: new Date('2024-01-15'),
      };

      await repository.upsertByInvoiceNumber(invoiceNumber, data);

      expect(mockPrismaInvoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            pdfUrl: null,
          }),
          update: expect.objectContaining({
            pdfUrl: null,
          }),
        })
      );
    });

    it('pdfUrlがnullの場合はnullが保持される', async () => {
      mockPrismaInvoice.upsert.mockResolvedValue({ ...mockInvoice, pdfUrl: null });

      const data = {
        subscriptionId,
        invoiceNumber,
        amount: 2980,
        currency: 'JPY',
        status: 'PAID' as const,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
        dueDate: new Date('2024-01-15'),
        pdfUrl: null,
      };

      await repository.upsertByInvoiceNumber(invoiceNumber, data);

      expect(mockPrismaInvoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            pdfUrl: null,
          }),
          update: expect.objectContaining({
            pdfUrl: null,
          }),
        })
      );
    });

    it('createにはsubscription connectが含まれる', async () => {
      mockPrismaInvoice.upsert.mockResolvedValue(mockInvoice);

      const data = {
        subscriptionId,
        invoiceNumber,
        amount: 1000,
        currency: 'JPY',
        status: 'PENDING' as const,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
        dueDate: new Date('2024-01-15'),
      };

      await repository.upsertByInvoiceNumber(invoiceNumber, data);

      const callArg = mockPrismaInvoice.upsert.mock.calls[0][0];
      expect(callArg.create.subscription).toEqual({
        connect: { id: subscriptionId },
      });
      // updateにはsubscriptionは含まれない
      expect(callArg.update).not.toHaveProperty('subscription');
      expect(callArg.update).not.toHaveProperty('subscriptionId');
    });
  });

  describe('findBySubscriptionId', () => {
    it('サブスクリプションIDで請求書をページネーション付きで取得できる', async () => {
      const invoices = [
        mockInvoice,
        { ...mockInvoice, id: '33333333-3333-3333-3333-333333333333', invoiceNumber: 'INV-2024-002' },
      ];
      mockPrismaInvoice.findMany.mockResolvedValue(invoices);
      mockPrismaInvoice.count.mockResolvedValue(5);

      const result = await repository.findBySubscriptionId(subscriptionId, {
        page: 1,
        limit: 2,
      });

      expect(mockPrismaInvoice.findMany).toHaveBeenCalledWith({
        where: { subscriptionId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 2,
      });
      expect(mockPrismaInvoice.count).toHaveBeenCalledWith({
        where: { subscriptionId },
      });
      expect(result).toEqual({
        data: invoices,
        total: 5,
        page: 1,
        limit: 2,
        totalPages: 3,
      });
    });

    it('2ページ目のデータを取得できる', async () => {
      mockPrismaInvoice.findMany.mockResolvedValue([mockInvoice]);
      mockPrismaInvoice.count.mockResolvedValue(15);

      const result = await repository.findBySubscriptionId(subscriptionId, {
        page: 2,
        limit: 10,
      });

      expect(mockPrismaInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
    });

    it('pageが0以下の場合は1に正規化される', async () => {
      mockPrismaInvoice.findMany.mockResolvedValue([]);
      mockPrismaInvoice.count.mockResolvedValue(0);

      const result = await repository.findBySubscriptionId(subscriptionId, {
        page: 0,
        limit: 10,
      });

      expect(mockPrismaInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
        })
      );
      expect(result.page).toBe(1);
    });

    it('負のpageは1に正規化される', async () => {
      mockPrismaInvoice.findMany.mockResolvedValue([]);
      mockPrismaInvoice.count.mockResolvedValue(0);

      const result = await repository.findBySubscriptionId(subscriptionId, {
        page: -5,
        limit: 10,
      });

      expect(result.page).toBe(1);
    });

    it('limitが0以下の場合は1に正規化される', async () => {
      mockPrismaInvoice.findMany.mockResolvedValue([]);
      mockPrismaInvoice.count.mockResolvedValue(0);

      const result = await repository.findBySubscriptionId(subscriptionId, {
        page: 1,
        limit: 0,
      });

      expect(mockPrismaInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        })
      );
      expect(result.limit).toBe(1);
    });

    it('limitが100を超える場合は100に正規化される', async () => {
      mockPrismaInvoice.findMany.mockResolvedValue([]);
      mockPrismaInvoice.count.mockResolvedValue(0);

      const result = await repository.findBySubscriptionId(subscriptionId, {
        page: 1,
        limit: 200,
      });

      expect(mockPrismaInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
      expect(result.limit).toBe(100);
    });

    it('totalPagesが正しく計算される', async () => {
      mockPrismaInvoice.findMany.mockResolvedValue([]);
      mockPrismaInvoice.count.mockResolvedValue(25);

      const result = await repository.findBySubscriptionId(subscriptionId, {
        page: 1,
        limit: 10,
      });

      expect(result.totalPages).toBe(3);
    });

    it('データがない場合はtotalPages=0を返す', async () => {
      mockPrismaInvoice.findMany.mockResolvedValue([]);
      mockPrismaInvoice.count.mockResolvedValue(0);

      const result = await repository.findBySubscriptionId(subscriptionId, {
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
    });

    it('findManyとcountが並列で呼ばれる', async () => {
      mockPrismaInvoice.findMany.mockResolvedValue([]);
      mockPrismaInvoice.count.mockResolvedValue(0);

      await repository.findBySubscriptionId(subscriptionId, {
        page: 1,
        limit: 10,
      });

      // 両方が呼ばれていることを確認
      expect(mockPrismaInvoice.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaInvoice.count).toHaveBeenCalledTimes(1);
    });
  });
});
