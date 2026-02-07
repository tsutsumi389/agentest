/**
 * webhook-retry 結合テスト
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { runWebhookRetry } from '../../jobs/webhook-retry.js';
import {
  createTestUser,
  createTestSubscription,
  createTestPaymentEvent,
  cleanupTestData,
} from './test-helpers.js';

const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

describe('runWebhookRetry（結合テスト）', () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it('FAILEDイベント再処理でInvoiceを作成する', async () => {
    // サブスクリプション準備
    const user = await createTestUser({ plan: 'PRO' });
    const subscription = await createTestSubscription({
      userId: user.id,
      plan: 'PRO',
      externalId: 'sub_integration_123',
    });

    // FAILEDイベント作成
    await createTestPaymentEvent({
      externalId: 'evt_invoice_paid',
      eventType: 'invoice.paid',
      status: 'FAILED',
      retryCount: 2,
      payload: {
        id: 'evt_invoice_paid',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_123',
            number: 'INV-INT-001',
            subscription: 'sub_integration_123',
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
    });

    await runWebhookRetry();

    // イベントがPROCESSEDになる
    const event = await prisma.paymentEvent.findFirst({
      where: { externalId: 'evt_invoice_paid' },
    });
    expect(event?.status).toBe('PROCESSED');

    // Invoiceが作成される
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: 'INV-INT-001' },
    });
    expect(invoice).not.toBeNull();
    expect(invoice?.subscriptionId).toBe(subscription.id);
    expect(invoice?.status).toBe('PAID');
    expect(Number(invoice?.amount)).toBe(980);
  });

  it('サブスクリプションが見つからない場合も正常完了（スキップ）する', async () => {
    // サブスクリプションなしでイベント作成
    await createTestPaymentEvent({
      externalId: 'evt_no_sub',
      eventType: 'invoice.paid',
      status: 'FAILED',
      retryCount: 1,
      payload: {
        id: 'evt_no_sub',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_xxx',
            number: 'INV-NOT-FOUND',
            subscription: 'sub_not_exists',
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
    });

    await runWebhookRetry();

    // サブスクリプションがない場合はスキップされてPROCESSED扱い
    const event = await prisma.paymentEvent.findFirst({
      where: { externalId: 'evt_no_sub' },
    });
    expect(event?.status).toBe('PROCESSED');
  });

  it('customer.subscription.updatedイベントでサブスクリプションを更新する', async () => {
    // サブスクリプション準備
    const user = await createTestUser({ plan: 'PRO' });
    await createTestSubscription({
      userId: user.id,
      plan: 'PRO',
      externalId: 'sub_update_123',
      cancelAtPeriodEnd: false,
    });

    // subscription.updatedイベント
    await createTestPaymentEvent({
      externalId: 'evt_sub_updated',
      eventType: 'customer.subscription.updated',
      status: 'FAILED',
      retryCount: 1,
      payload: {
        id: 'evt_sub_updated',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_update_123',
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
              billingCycle: 'YEARLY',
            },
          },
        },
      },
    });

    await runWebhookRetry();

    // サブスクリプションが更新される
    const subscription = await prisma.subscription.findFirst({
      where: { externalId: 'sub_update_123' },
    });
    expect(subscription?.cancelAtPeriodEnd).toBe(true);
    expect(subscription?.billingCycle).toBe('YEARLY');
  });

  it('customer.subscription.deletedイベントでCANCELED化とプラン更新を行う', async () => {
    // サブスクリプション準備
    const user = await createTestUser({ plan: 'PRO' });
    await createTestSubscription({
      userId: user.id,
      plan: 'PRO',
      externalId: 'sub_delete_123',
      status: 'ACTIVE',
    });

    // subscription.deletedイベント
    await createTestPaymentEvent({
      externalId: 'evt_sub_deleted',
      eventType: 'customer.subscription.deleted',
      status: 'FAILED',
      retryCount: 0,
      payload: {
        id: 'evt_sub_deleted',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_delete_123',
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
    });

    await runWebhookRetry();

    // サブスクリプションがCANCELEDになる
    const subscription = await prisma.subscription.findFirst({
      where: { externalId: 'sub_delete_123' },
    });
    expect(subscription?.status).toBe('CANCELED');

    // ユーザープランがFREEになる
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(updatedUser?.plan).toBe('FREE');
  });

  it('リトライ上限到達のイベントは処理対象外', async () => {
    // リトライ上限到達イベント
    await createTestPaymentEvent({
      externalId: 'evt_max_retry',
      eventType: 'invoice.paid',
      status: 'FAILED',
      retryCount: 5, // MAX_RETRY_COUNT
      payload: { id: 'evt_max_retry', type: 'invoice.paid', data: { object: {} } },
    });

    await runWebhookRetry();

    // ステータスは変わらない
    const event = await prisma.paymentEvent.findFirst({
      where: { externalId: 'evt_max_retry' },
    });
    expect(event?.status).toBe('FAILED');
    expect(event?.retryCount).toBe(5);
  });

  it('リトライ対象がない場合はメッセージを出力して終了', async () => {
    // FAILEDイベントなし
    await createTestPaymentEvent({
      externalId: 'evt_processed',
      status: 'PROCESSED',
    });

    await runWebhookRetry();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'リトライ対象のイベントはありません'
    );
  });
});
