/**
 * subscription-sync 結合テスト
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import {
  createTestUser,
  createTestSubscription,
  cleanupTestData,
} from './test-helpers.js';

const { mockLogger } = vi.hoisted(() => {
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
  return { mockLogger };
});

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// Stripeをモック
const mockStripe = {
  subscriptions: {
    retrieve: vi.fn(),
  },
};

vi.mock('../../lib/stripe.js', () => ({
  getStripeClient: vi.fn(() => mockStripe),
}));

// モック設定後にインポート
import { runSubscriptionSync } from '../../jobs/subscription-sync.js';

describe('runSubscriptionSync（結合テスト）', () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it('DBとStripeのステータス不一致を修正する', async () => {
    // DBはACTIVE、StripeはPAST_DUE
    const user = await createTestUser({ plan: 'PRO' });
    await createTestSubscription({
      userId: user.id,
      plan: 'PRO',
      status: 'ACTIVE',
      externalId: 'sub_mismatch_123',
      currentPeriodEnd: new Date('2025-06-01T00:00:00.000Z'),
    });

    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_mismatch_123',
      status: 'past_due',
      items: {
        data: [
          {
            current_period_end: Math.floor(
              new Date('2025-06-01T00:00:00.000Z').getTime() / 1000
            ),
          },
        ],
      },
    });

    await runSubscriptionSync();

    const subscription = await prisma.subscription.findFirst({
      where: { externalId: 'sub_mismatch_123' },
    });
    expect(subscription?.status).toBe('PAST_DUE');
  });

  it('Stripeでcanceled時にUser.planをFREEに更新する', async () => {
    // DBはACTIVE、Stripeはcanceled
    const user = await createTestUser({ plan: 'PRO' });
    await createTestSubscription({
      userId: user.id,
      plan: 'PRO',
      status: 'ACTIVE',
      externalId: 'sub_canceled_123',
      currentPeriodEnd: new Date('2025-06-01T00:00:00.000Z'),
    });

    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_canceled_123',
      status: 'canceled',
      items: {
        data: [
          {
            current_period_end: Math.floor(
              new Date('2025-06-01T00:00:00.000Z').getTime() / 1000
            ),
          },
        ],
      },
    });

    await runSubscriptionSync();

    const subscription = await prisma.subscription.findFirst({
      where: { externalId: 'sub_canceled_123' },
    });
    expect(subscription?.status).toBe('CANCELED');

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(updatedUser?.plan).toBe('FREE');
  });

  it('Stripe resource_missingエラー時にCANCELED化する', async () => {
    // Stripeで見つからないサブスクリプション
    const user = await createTestUser({ plan: 'PRO' });
    await createTestSubscription({
      userId: user.id,
      plan: 'PRO',
      status: 'ACTIVE',
      externalId: 'sub_not_found_123',
      currentPeriodEnd: new Date('2025-06-01T00:00:00.000Z'),
    });

    mockStripe.subscriptions.retrieve.mockRejectedValue({
      code: 'resource_missing',
    });

    await runSubscriptionSync();

    const subscription = await prisma.subscription.findFirst({
      where: { externalId: 'sub_not_found_123' },
    });
    expect(subscription?.status).toBe('CANCELED');

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(updatedUser?.plan).toBe('FREE');
  });

  it('期間終了日の大きな不一致を修正する', async () => {
    const user = await createTestUser({ plan: 'PRO' });
    // DBは5/20、Stripeは6/5（15日以上ずれ）
    await createTestSubscription({
      userId: user.id,
      plan: 'PRO',
      status: 'ACTIVE',
      externalId: 'sub_period_diff_123',
      currentPeriodEnd: new Date('2025-05-20T00:00:00.000Z'),
    });

    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_period_diff_123',
      status: 'active',
      items: {
        data: [
          {
            current_period_end: Math.floor(
              new Date('2025-06-05T00:00:00.000Z').getTime() / 1000
            ),
          },
        ],
      },
    });

    await runSubscriptionSync();

    const subscription = await prisma.subscription.findFirst({
      where: { externalId: 'sub_period_diff_123' },
    });
    expect(subscription?.currentPeriodEnd?.toISOString()).toBe(
      '2025-06-05T00:00:00.000Z'
    );
  });

  it('ステータス一致・期間一致の場合は更新しない', async () => {
    const user = await createTestUser({ plan: 'PRO' });
    const periodEnd = new Date('2025-06-01T00:00:00.000Z');
    await createTestSubscription({
      userId: user.id,
      plan: 'PRO',
      status: 'ACTIVE',
      externalId: 'sub_match_123',
      currentPeriodEnd: periodEnd,
    });

    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_match_123',
      status: 'active',
      items: {
        data: [
          {
            current_period_end: Math.floor(periodEnd.getTime() / 1000),
          },
        ],
      },
    });

    await runSubscriptionSync();

    // チェックのみで更新はされていないことを確認
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ totalMismatched: 0, totalUpdated: 0 }),
      'サブスクリプション同期チェック完了'
    );
  });

  it('externalIdがないサブスクリプションはスキップする', async () => {
    const user = await createTestUser({ plan: 'FREE' });
    // externalIdなし（FREEプランの無料サブスクリプション）
    await createTestSubscription({
      userId: user.id,
      plan: 'FREE',
      status: 'ACTIVE',
      externalId: null,
    });

    await runSubscriptionSync();

    // Stripe APIは呼ばれない
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('CANCELED済みのサブスクリプションはスキップする', async () => {
    const user = await createTestUser({ plan: 'FREE' });
    await createTestSubscription({
      userId: user.id,
      plan: 'PRO',
      status: 'CANCELED',
      externalId: 'sub_already_canceled_123',
    });

    await runSubscriptionSync();

    // CANCELED済みは対象外
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('複数サブスクリプションを適切に処理する', async () => {
    // ユーザー1: ACTIVE → PAST_DUE
    const user1 = await createTestUser({ email: 'u1@test.com', plan: 'PRO' });
    await createTestSubscription({
      userId: user1.id,
      plan: 'PRO',
      status: 'ACTIVE',
      externalId: 'sub_multi_1',
      currentPeriodEnd: new Date('2025-06-01T00:00:00.000Z'),
    });

    // ユーザー2: ACTIVE → ACTIVE（一致）
    const user2 = await createTestUser({ email: 'u2@test.com', plan: 'PRO' });
    await createTestSubscription({
      userId: user2.id,
      plan: 'PRO',
      status: 'ACTIVE',
      externalId: 'sub_multi_2',
      currentPeriodEnd: new Date('2025-06-01T00:00:00.000Z'),
    });

    // 呼び出し順序に依存しないよう、externalIdに基づいてレスポンスを返す
    mockStripe.subscriptions.retrieve.mockImplementation(
      (externalId: string) => {
        if (externalId === 'sub_multi_1') {
          return Promise.resolve({
            id: 'sub_multi_1',
            status: 'past_due',
            items: {
              data: [
                {
                  current_period_end: Math.floor(
                    new Date('2025-06-01T00:00:00.000Z').getTime() / 1000
                  ),
                },
              ],
            },
          });
        } else if (externalId === 'sub_multi_2') {
          return Promise.resolve({
            id: 'sub_multi_2',
            status: 'active',
            items: {
              data: [
                {
                  current_period_end: Math.floor(
                    new Date('2025-06-01T00:00:00.000Z').getTime() / 1000
                  ),
                },
              ],
            },
          });
        }
        return Promise.reject({ code: 'resource_missing' });
      }
    );

    await runSubscriptionSync();

    const sub1 = await prisma.subscription.findFirst({
      where: { externalId: 'sub_multi_1' },
    });
    const sub2 = await prisma.subscription.findFirst({
      where: { externalId: 'sub_multi_2' },
    });

    expect(sub1?.status).toBe('PAST_DUE');
    expect(sub2?.status).toBe('ACTIVE');
  });
});
