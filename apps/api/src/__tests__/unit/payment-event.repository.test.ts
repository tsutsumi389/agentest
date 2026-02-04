import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaPaymentEvent = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  groupBy: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    paymentEvent: mockPrismaPaymentEvent,
  },
}));

import { PaymentEventRepository } from '../../repositories/payment-event.repository.js';

describe('PaymentEventRepository', () => {
  let repository: PaymentEventRepository;

  const eventId = '11111111-1111-1111-1111-111111111111';
  const externalId = 'evt_stripe_22222222';

  const mockPaymentEvent = {
    id: eventId,
    externalId,
    eventType: 'invoice.payment_succeeded',
    payload: { id: 'inv_123', amount: 1000 },
    status: 'PENDING',
    processedAt: null,
    errorMessage: null,
    retryCount: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new PaymentEventRepository();
  });

  describe('findById', () => {
    it('IDで決済イベントを取得できる', async () => {
      mockPrismaPaymentEvent.findUnique.mockResolvedValue(mockPaymentEvent);

      const result = await repository.findById(eventId);

      expect(mockPrismaPaymentEvent.findUnique).toHaveBeenCalledWith({
        where: { id: eventId },
      });
      expect(result).toEqual(mockPaymentEvent);
    });

    it('存在しないIDはnullを返す', async () => {
      mockPrismaPaymentEvent.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByExternalId', () => {
    it('外部IDで決済イベントを取得できる', async () => {
      mockPrismaPaymentEvent.findUnique.mockResolvedValue(mockPaymentEvent);

      const result = await repository.findByExternalId(externalId);

      expect(mockPrismaPaymentEvent.findUnique).toHaveBeenCalledWith({
        where: { externalId },
      });
      expect(result).toEqual(mockPaymentEvent);
    });

    it('存在しない外部IDはnullを返す', async () => {
      mockPrismaPaymentEvent.findUnique.mockResolvedValue(null);

      const result = await repository.findByExternalId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('決済イベントを作成できる', async () => {
      mockPrismaPaymentEvent.create.mockResolvedValue(mockPaymentEvent);

      const params = {
        externalId,
        eventType: 'invoice.payment_succeeded',
        payload: { id: 'inv_123', amount: 1000 },
      };

      const result = await repository.create(params);

      expect(mockPrismaPaymentEvent.create).toHaveBeenCalledWith({
        data: {
          externalId,
          eventType: 'invoice.payment_succeeded',
          payload: { id: 'inv_123', amount: 1000 },
          status: 'PENDING',
        },
      });
      expect(result).toEqual(mockPaymentEvent);
    });

    it('ステータスがPENDINGで作成される', async () => {
      mockPrismaPaymentEvent.create.mockResolvedValue(mockPaymentEvent);

      await repository.create({
        externalId,
        eventType: 'customer.subscription.updated',
        payload: {},
      });

      expect(mockPrismaPaymentEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });
  });

  describe('update', () => {
    it('決済イベントを更新できる', async () => {
      const updated = { ...mockPaymentEvent, status: 'PROCESSED' };
      mockPrismaPaymentEvent.update.mockResolvedValue(updated);

      const result = await repository.update(eventId, { status: 'PROCESSED' as const });

      expect(mockPrismaPaymentEvent.update).toHaveBeenCalledWith({
        where: { id: eventId },
        data: { status: 'PROCESSED' },
      });
      expect(result).toEqual(updated);
    });

    it('undefinedのフィールドはdataに含まれない', async () => {
      mockPrismaPaymentEvent.update.mockResolvedValue(mockPaymentEvent);

      await repository.update(eventId, { status: 'PROCESSED' as const });

      const callArg = mockPrismaPaymentEvent.update.mock.calls[0][0];
      expect(callArg.data).toEqual({ status: 'PROCESSED' });
      expect(callArg.data).not.toHaveProperty('processedAt');
      expect(callArg.data).not.toHaveProperty('errorMessage');
      expect(callArg.data).not.toHaveProperty('retryCount');
    });

    it('複数のフィールドを同時に更新できる', async () => {
      const processedAt = new Date();
      mockPrismaPaymentEvent.update.mockResolvedValue({
        ...mockPaymentEvent,
        status: 'PROCESSED',
        processedAt,
      });

      await repository.update(eventId, {
        status: 'PROCESSED' as const,
        processedAt,
      });

      expect(mockPrismaPaymentEvent.update).toHaveBeenCalledWith({
        where: { id: eventId },
        data: {
          status: 'PROCESSED',
          processedAt,
        },
      });
    });
  });

  describe('markAsProcessed', () => {
    it('決済イベントを処理済みとしてマークできる', async () => {
      const processed = {
        ...mockPaymentEvent,
        status: 'PROCESSED',
        processedAt: new Date(),
      };
      mockPrismaPaymentEvent.update.mockResolvedValue(processed);

      const result = await repository.markAsProcessed(eventId);

      expect(mockPrismaPaymentEvent.update).toHaveBeenCalledWith({
        where: { id: eventId },
        data: {
          status: 'PROCESSED',
          processedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(processed);
    });
  });

  describe('markAsFailed', () => {
    it('決済イベントを失敗としてマークできる', async () => {
      const failed = {
        ...mockPaymentEvent,
        status: 'FAILED',
        errorMessage: 'Payment declined',
        retryCount: 1,
      };
      mockPrismaPaymentEvent.update.mockResolvedValue(failed);

      const result = await repository.markAsFailed(eventId, 'Payment declined');

      expect(mockPrismaPaymentEvent.update).toHaveBeenCalledWith({
        where: { id: eventId },
        data: {
          status: 'FAILED',
          errorMessage: 'Payment declined',
          retryCount: {
            increment: 1,
          },
        },
      });
      expect(result).toEqual(failed);
    });
  });

  describe('findFailedForRetry', () => {
    it('リトライ対象の失敗イベントを取得できる', async () => {
      const failedEvents = [
        { ...mockPaymentEvent, status: 'FAILED', retryCount: 1 },
        { ...mockPaymentEvent, id: '33333333-3333-3333-3333-333333333333', status: 'FAILED', retryCount: 2 },
      ];
      mockPrismaPaymentEvent.findMany.mockResolvedValue(failedEvents);

      const result = await repository.findFailedForRetry(5);

      expect(mockPrismaPaymentEvent.findMany).toHaveBeenCalledWith({
        where: {
          status: 'FAILED',
          retryCount: {
            lt: 5,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 100,
      });
      expect(result).toHaveLength(2);
    });

    it('デフォルトのlimitは100', async () => {
      mockPrismaPaymentEvent.findMany.mockResolvedValue([]);

      await repository.findFailedForRetry(3);

      expect(mockPrismaPaymentEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it('limitを指定できる', async () => {
      mockPrismaPaymentEvent.findMany.mockResolvedValue([]);

      await repository.findFailedForRetry(3, 10);

      expect(mockPrismaPaymentEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it('該当なしの場合は空配列を返す', async () => {
      mockPrismaPaymentEvent.findMany.mockResolvedValue([]);

      const result = await repository.findFailedForRetry(3);

      expect(result).toEqual([]);
    });
  });

  describe('resetForRetry', () => {
    it('リトライのためにPENDINGに戻せる', async () => {
      const reset = { ...mockPaymentEvent, status: 'PENDING', errorMessage: null };
      mockPrismaPaymentEvent.update.mockResolvedValue(reset);

      const result = await repository.resetForRetry(eventId);

      expect(mockPrismaPaymentEvent.update).toHaveBeenCalledWith({
        where: { id: eventId },
        data: {
          status: 'PENDING',
          errorMessage: null,
        },
      });
      expect(result).toEqual(reset);
    });
  });

  describe('deleteProcessedBefore', () => {
    it('古い処理済みイベントを削除できる', async () => {
      const beforeDate = new Date('2024-01-01');
      mockPrismaPaymentEvent.deleteMany.mockResolvedValue({ count: 5 });

      const result = await repository.deleteProcessedBefore(beforeDate);

      expect(mockPrismaPaymentEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          status: 'PROCESSED',
          createdAt: {
            lt: beforeDate,
          },
        },
      });
      expect(result).toBe(5);
    });

    it('削除対象がない場合は0を返す', async () => {
      mockPrismaPaymentEvent.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repository.deleteProcessedBefore(new Date());

      expect(result).toBe(0);
    });
  });

  describe('countByStatus', () => {
    it('ステータス別のイベント数を取得できる', async () => {
      mockPrismaPaymentEvent.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: { status: 3 } },
        { status: 'PROCESSED', _count: { status: 10 } },
        { status: 'FAILED', _count: { status: 2 } },
      ]);

      const result = await repository.countByStatus();

      expect(mockPrismaPaymentEvent.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        _count: {
          status: true,
        },
      });
      expect(result).toEqual({
        PENDING: 3,
        PROCESSED: 10,
        FAILED: 2,
      });
    });

    it('該当するステータスがない場合は0を返す', async () => {
      mockPrismaPaymentEvent.groupBy.mockResolvedValue([]);

      const result = await repository.countByStatus();

      expect(result).toEqual({
        PENDING: 0,
        PROCESSED: 0,
        FAILED: 0,
      });
    });

    it('一部のステータスのみ存在する場合は他は0を返す', async () => {
      mockPrismaPaymentEvent.groupBy.mockResolvedValue([
        { status: 'PROCESSED', _count: { status: 5 } },
      ]);

      const result = await repository.countByStatus();

      expect(result).toEqual({
        PENDING: 0,
        PROCESSED: 5,
        FAILED: 0,
      });
    });
  });

  describe('findByEventType', () => {
    it('イベントタイプでイベントを検索できる', async () => {
      const events = [mockPaymentEvent];
      mockPrismaPaymentEvent.findMany.mockResolvedValue(events);

      const result = await repository.findByEventType('invoice.payment_succeeded');

      expect(mockPrismaPaymentEvent.findMany).toHaveBeenCalledWith({
        where: {
          eventType: 'invoice.payment_succeeded',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
        skip: 0,
      });
      expect(result).toEqual(events);
    });

    it('statusオプションを指定してフィルタリングできる', async () => {
      mockPrismaPaymentEvent.findMany.mockResolvedValue([]);

      await repository.findByEventType('invoice.payment_succeeded', {
        status: 'PROCESSED' as const,
      });

      expect(mockPrismaPaymentEvent.findMany).toHaveBeenCalledWith({
        where: {
          eventType: 'invoice.payment_succeeded',
          status: 'PROCESSED',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
        skip: 0,
      });
    });

    it('limitとoffsetを指定できる', async () => {
      mockPrismaPaymentEvent.findMany.mockResolvedValue([]);

      await repository.findByEventType('invoice.payment_succeeded', {
        limit: 10,
        offset: 20,
      });

      expect(mockPrismaPaymentEvent.findMany).toHaveBeenCalledWith({
        where: {
          eventType: 'invoice.payment_succeeded',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        skip: 20,
      });
    });

    it('オプションなしの場合はデフォルト値が適用される', async () => {
      mockPrismaPaymentEvent.findMany.mockResolvedValue([]);

      await repository.findByEventType('customer.subscription.updated');

      expect(mockPrismaPaymentEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 0,
        })
      );
    });

    it('該当なしの場合は空配列を返す', async () => {
      mockPrismaPaymentEvent.findMany.mockResolvedValue([]);

      const result = await repository.findByEventType('non.existent.event');

      expect(result).toEqual([]);
    });
  });
});
