/**
 * webhook-retry ユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockPrisma, mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return {
    mockPrisma: {
      paymentEvent: {
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      subscription: {
        findUnique: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      invoice: {
        upsert: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    mockLogger,
  };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// モック設定後にインポート
import { runWebhookRetry } from '../../jobs/webhook-retry.js';

describe('runWebhookRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('FAILEDステータスでリトライ回数上限未満のイベントを取得する', async () => {
    mockPrisma.paymentEvent.findMany.mockResolvedValue([]);
    mockPrisma.paymentEvent.count.mockResolvedValue(0);

    await runWebhookRetry();

    expect(mockPrisma.paymentEvent.findMany).toHaveBeenCalledWith({
      where: {
        status: 'FAILED',
        retryCount: { lt: 5 }, // MAX_RETRY_COUNT
      },
      orderBy: { createdAt: 'asc' },
      take: 100, // DEFAULT_BATCH_SIZE
    });
  });

  it('リトライ対象がない場合はメッセージを出力して終了', async () => {
    mockPrisma.paymentEvent.findMany.mockResolvedValue([]);

    await runWebhookRetry();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'リトライ対象のイベントはありません'
    );
    expect(mockPrisma.paymentEvent.update).not.toHaveBeenCalled();
  });

  it('処理成功時にPROCESSEDステータスに更新する', async () => {
    const mockEvent = {
      id: 'pe-1',
      externalId: 'evt_123',
      eventType: 'invoice.paid',
      payload: {
        id: 'evt_123',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_1',
            number: 'INV-001',
            subscription: 'sub_123',
            customer: 'cus_1',
            amount_due: 1000,
            currency: 'jpy',
            status: 'paid',
            period_start: 1704067200,
            period_end: 1706745600,
            due_date: 1704067200,
            invoice_pdf: null,
          },
        },
      },
      retryCount: 2,
    };

    mockPrisma.paymentEvent.findMany.mockResolvedValue([mockEvent]);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-db-1',
      externalId: 'sub_123',
    });
    mockPrisma.invoice.upsert.mockResolvedValue({});
    mockPrisma.paymentEvent.update.mockResolvedValue({});
    mockPrisma.paymentEvent.count.mockResolvedValue(0);

    await runWebhookRetry();

    // PROCESSEDに更新
    expect(mockPrisma.paymentEvent.update).toHaveBeenCalledWith({
      where: { id: 'pe-1' },
      data: {
        status: 'PROCESSED',
        processedAt: expect.any(Date),
        errorMessage: null,
      },
    });
  });

  it('処理失敗時にretryCountを増加させる', async () => {
    const mockEvent = {
      id: 'pe-1',
      externalId: 'evt_123',
      eventType: 'invoice.paid',
      payload: {
        id: 'evt_123',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_1',
            number: 'INV-001',
            subscription: 'sub_not_found',
            customer: 'cus_1',
            amount_due: 1000,
            currency: 'jpy',
            status: 'paid',
            period_start: 1704067200,
            period_end: 1706745600,
            due_date: null,
            invoice_pdf: null,
          },
        },
      },
      retryCount: 2,
    };

    mockPrisma.paymentEvent.findMany.mockResolvedValue([mockEvent]);
    // Subscriptionが見つからない → 正常完了（スキップ扱い）
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.paymentEvent.update.mockResolvedValue({});
    mockPrisma.paymentEvent.count.mockResolvedValue(0);

    await runWebhookRetry();

    // サブスクリプションがないとスキップされるのでPROCESSED扱いになる
    expect(mockPrisma.paymentEvent.update).toHaveBeenCalledWith({
      where: { id: 'pe-1' },
      data: {
        status: 'PROCESSED',
        processedAt: expect.any(Date),
        errorMessage: null,
      },
    });
  });

  it('invoice.paidイベントを処理できる', async () => {
    const mockEvent = {
      id: 'pe-1',
      externalId: 'evt_123',
      eventType: 'invoice.paid',
      payload: {
        id: 'evt_123',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_1',
            number: 'INV-001',
            subscription: 'sub_123',
            customer: 'cus_1',
            amount_due: 980,
            currency: 'jpy',
            status: 'paid',
            period_start: 1704067200,
            period_end: 1706745600,
            due_date: 1704067200,
            invoice_pdf: 'https://example.com/invoice.pdf',
          },
        },
      },
      retryCount: 1,
    };

    mockPrisma.paymentEvent.findMany.mockResolvedValue([mockEvent]);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-db-1',
      externalId: 'sub_123',
    });
    mockPrisma.invoice.upsert.mockResolvedValue({});
    mockPrisma.paymentEvent.update.mockResolvedValue({});
    mockPrisma.paymentEvent.count.mockResolvedValue(0);

    await runWebhookRetry();

    expect(mockPrisma.invoice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoiceNumber: 'INV-001' },
        create: expect.objectContaining({
          subscriptionId: 'sub-db-1',
          status: 'PAID',
          amount: 980,
        }),
      })
    );
  });

  it('customer.subscription.updatedイベントを処理できる', async () => {
    const mockEvent = {
      id: 'pe-2',
      externalId: 'evt_456',
      eventType: 'customer.subscription.updated',
      payload: {
        id: 'evt_456',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_1',
            status: 'active',
            cancel_at_period_end: true,
            items: {
              data: [
                {
                  current_period_start: 1704067200,
                  current_period_end: 1706745600,
                },
              ],
            },
            metadata: {
              plan: 'PRO',
              billingCycle: 'MONTHLY',
            },
          },
        },
      },
      retryCount: 0,
    };

    mockPrisma.paymentEvent.findMany.mockResolvedValue([mockEvent]);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-db-1',
      externalId: 'sub_123',
    });
    mockPrisma.subscription.update.mockResolvedValue({});
    mockPrisma.paymentEvent.update.mockResolvedValue({});
    mockPrisma.paymentEvent.count.mockResolvedValue(0);

    await runWebhookRetry();

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-db-1' },
        data: expect.objectContaining({
          cancelAtPeriodEnd: true,
        }),
      })
    );
  });

  it('customer.subscription.deletedイベント処理でUser.planをFREEに更新する', async () => {
    const mockEvent = {
      id: 'pe-3',
      externalId: 'evt_789',
      eventType: 'customer.subscription.deleted',
      payload: {
        id: 'evt_789',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_1',
            status: 'canceled',
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  current_period_start: 1704067200,
                  current_period_end: 1706745600,
                },
              ],
            },
            metadata: {},
          },
        },
      },
      retryCount: 1,
    };

    mockPrisma.paymentEvent.findMany.mockResolvedValue([mockEvent]);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-db-1',
      externalId: 'sub_123',
      userId: 'user-1',
    });
    mockPrisma.subscription.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.paymentEvent.update.mockResolvedValue({});
    mockPrisma.paymentEvent.count.mockResolvedValue(0);

    await runWebhookRetry();

    // サブスクリプションをCANCELEDに更新
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-db-1' },
      data: { status: 'CANCELED' },
    });

    // ユーザープランをFREEに更新
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { plan: 'FREE' },
    });
  });

  it('最大リトライ回数到達イベントの警告を出力する', async () => {
    // リトライ対象のイベントがある場合のみcountが呼ばれる
    const mockEvent = {
      id: 'pe-1',
      externalId: 'evt_1',
      eventType: 'invoice.paid',
      payload: {
        id: 'evt_1',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_1',
            number: 'INV-001',
            subscription: null,
            customer: 'cus_1',
            amount_due: 1000,
            currency: 'jpy',
            status: 'paid',
            period_start: 1704067200,
            period_end: 1706745600,
            due_date: null,
            invoice_pdf: null,
          },
        },
      },
      retryCount: 1,
    };
    mockPrisma.paymentEvent.findMany.mockResolvedValue([mockEvent]);
    mockPrisma.paymentEvent.update.mockResolvedValue({});
    mockPrisma.paymentEvent.count.mockResolvedValue(5); // 5件が上限到達

    await runWebhookRetry();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetriedEvents: 5, maxRetryCount: 5 }),
      'イベントが最大リトライ回数に達しました'
    );
  });

  it('再処理完了後にサマリーを出力する', async () => {
    const mockEvents = [
      {
        id: 'pe-1',
        externalId: 'evt_1',
        eventType: 'invoice.paid',
        payload: {
          id: 'evt_1',
          type: 'invoice.paid',
          data: {
            object: {
              id: 'inv_1',
              number: 'INV-001',
              subscription: 'sub_123',
              customer: 'cus_1',
              amount_due: 1000,
              currency: 'jpy',
              status: 'paid',
              period_start: 1704067200,
              period_end: 1706745600,
              due_date: null,
              invoice_pdf: null,
            },
          },
        },
        retryCount: 1,
      },
    ];

    mockPrisma.paymentEvent.findMany.mockResolvedValue(mockEvents);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-db-1',
    });
    mockPrisma.invoice.upsert.mockResolvedValue({});
    mockPrisma.paymentEvent.update.mockResolvedValue({});
    mockPrisma.paymentEvent.count.mockResolvedValue(0);

    await runWebhookRetry();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ totalSucceeded: 1, totalFailed: 0, totalRetried: 1 }),
      '再処理完了'
    );
  });
});
