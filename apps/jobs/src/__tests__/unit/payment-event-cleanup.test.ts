/**
 * payment-event-cleanup ユニットテスト
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
        deleteMany: vi.fn(),
        groupBy: vi.fn(),
      },
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
import { runPaymentEventCleanup } from '../../jobs/payment-event-cleanup.js';

describe('runPaymentEventCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-15T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('PROCESSED状態の90日以上前イベントを削除する', async () => {
    mockPrisma.paymentEvent.deleteMany
      .mockResolvedValueOnce({ count: 150 }) // PROCESSED
      .mockResolvedValueOnce({ count: 10 }); // FAILED
    mockPrisma.paymentEvent.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { status: 5 } },
      { status: 'FAILED', _count: { status: 3 } },
    ]);

    await runPaymentEventCleanup();

    // PROCESSED削除のクエリを確認
    expect(mockPrisma.paymentEvent.deleteMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: 'PROCESSED',
        createdAt: { lt: expect.any(Date) },
      },
    });

    // 基準日が90日前であることを確認
    const firstCall = mockPrisma.paymentEvent.deleteMany.mock.calls[0][0];
    const cutoffDate = firstCall.where.createdAt.lt;
    const expectedCutoff = new Date('2025-02-14T00:00:00.000Z'); // 90日前
    expect(cutoffDate.getTime()).toBe(expectedCutoff.getTime());
  });

  it('FAILED + リトライ上限到達の90日以上前イベントを削除する', async () => {
    mockPrisma.paymentEvent.deleteMany
      .mockResolvedValueOnce({ count: 50 })
      .mockResolvedValueOnce({ count: 25 });
    mockPrisma.paymentEvent.groupBy.mockResolvedValue([]);

    await runPaymentEventCleanup();

    // FAILED削除のクエリを確認（2回目の呼び出し）
    expect(mockPrisma.paymentEvent.deleteMany).toHaveBeenNthCalledWith(2, {
      where: {
        status: 'FAILED',
        retryCount: { gte: 5 }, // MAX_RETRY_COUNT
        createdAt: { lt: expect.any(Date) },
      },
    });
  });

  it('削除件数をログ出力する', async () => {
    mockPrisma.paymentEvent.deleteMany
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 20 });
    mockPrisma.paymentEvent.groupBy.mockResolvedValue([]);

    await runPaymentEventCleanup();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ count: 100 }),
      '処理済みイベントを削除'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ count: 20 }),
      '失敗イベント（リトライ上限到達）を削除'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ totalDeleted: 120 }),
      'イベントの削除が完了しました'
    );
  });

  it('残りイベントのステータス別集計を出力する', async () => {
    mockPrisma.paymentEvent.deleteMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    mockPrisma.paymentEvent.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { status: 10 } },
      { status: 'PROCESSED', _count: { status: 30 } },
      { status: 'FAILED', _count: { status: 5 } },
    ]);

    await runPaymentEventCleanup();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        remaining: { PENDING: 10, PROCESSED: 30, FAILED: 5 },
      }),
      '残りのイベント数'
    );
  });

  it('削除対象がない場合でも正常に完了する', async () => {
    mockPrisma.paymentEvent.deleteMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    mockPrisma.paymentEvent.groupBy.mockResolvedValue([]);

    await runPaymentEventCleanup();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ totalDeleted: 0 }),
      'イベントの削除が完了しました'
    );
  });
});
