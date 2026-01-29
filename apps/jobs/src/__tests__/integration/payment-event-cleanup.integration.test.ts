/**
 * payment-event-cleanup 結合テスト
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { runPaymentEventCleanup } from '../../jobs/payment-event-cleanup.js';
import {
  createTestPaymentEvent,
  cleanupTestData,
  daysAgo,
} from './test-helpers.js';

describe('runPaymentEventCleanup（結合テスト）', () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    await cleanupTestData();
    vi.restoreAllMocks();
  });

  it('90日以上前のPROCESSEDイベントを削除する', async () => {
    // 91日前のPROCESSEDイベント（削除対象）
    await createTestPaymentEvent({
      externalId: 'evt_old_processed',
      status: 'PROCESSED',
      createdAt: daysAgo(91),
    });

    // 89日前のPROCESSEDイベント（削除されない）
    await createTestPaymentEvent({
      externalId: 'evt_recent_processed',
      status: 'PROCESSED',
      createdAt: daysAgo(89),
    });

    await runPaymentEventCleanup();

    const remaining = await prisma.paymentEvent.findMany({
      where: { status: 'PROCESSED' },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].externalId).toBe('evt_recent_processed');
  });

  it('90日以上前でリトライ上限到達のFAILEDイベントを削除する', async () => {
    // 91日前のFAILEDイベント、リトライ上限到達（削除対象）
    await createTestPaymentEvent({
      externalId: 'evt_old_failed_max',
      status: 'FAILED',
      retryCount: 5, // MAX_RETRY_COUNT
      createdAt: daysAgo(91),
    });

    // 91日前のFAILEDイベント、リトライ途中（削除されない）
    await createTestPaymentEvent({
      externalId: 'evt_old_failed_retry',
      status: 'FAILED',
      retryCount: 3,
      createdAt: daysAgo(91),
    });

    // 89日前のFAILEDイベント、リトライ上限到達（削除されない）
    await createTestPaymentEvent({
      externalId: 'evt_recent_failed_max',
      status: 'FAILED',
      retryCount: 5,
      createdAt: daysAgo(89),
    });

    await runPaymentEventCleanup();

    const remaining = await prisma.paymentEvent.findMany({
      where: { status: 'FAILED' },
      orderBy: { externalId: 'asc' },
    });
    expect(remaining).toHaveLength(2);
    expect(remaining.map((e) => e.externalId)).toEqual([
      'evt_old_failed_retry',
      'evt_recent_failed_max',
    ]);
  });

  it('PENDINGイベントは古くても削除されない', async () => {
    // 100日前のPENDINGイベント（削除されない）
    await createTestPaymentEvent({
      externalId: 'evt_old_pending',
      status: 'PENDING',
      createdAt: daysAgo(100),
    });

    await runPaymentEventCleanup();

    const remaining = await prisma.paymentEvent.findMany({
      where: { externalId: 'evt_old_pending' },
    });
    expect(remaining).toHaveLength(1);
  });

  it('削除対象がない場合も正常に完了する', async () => {
    // 新しいイベントのみ
    await createTestPaymentEvent({
      externalId: 'evt_new',
      status: 'PROCESSED',
      createdAt: new Date(),
    });

    await expect(runPaymentEventCleanup()).resolves.not.toThrow();

    const remaining = await prisma.paymentEvent.findMany();
    expect(remaining).toHaveLength(1);
  });

  it('複数のイベントを一括削除できる', async () => {
    // 複数の古いPROCESSEDイベント
    for (let i = 0; i < 10; i++) {
      await createTestPaymentEvent({
        externalId: `evt_old_${i}`,
        status: 'PROCESSED',
        createdAt: daysAgo(95 + i),
      });
    }

    // 新しいイベント
    await createTestPaymentEvent({
      externalId: 'evt_new',
      status: 'PROCESSED',
      createdAt: new Date(),
    });

    await runPaymentEventCleanup();

    const remaining = await prisma.paymentEvent.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].externalId).toBe('evt_new');
  });
});
