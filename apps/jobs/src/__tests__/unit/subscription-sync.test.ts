/**
 * subscription-sync ユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockPrisma, mockGetStripeClient, mockStripe, mockLogger } = vi.hoisted(() => {
  const mockStripe = {
    subscriptions: {
      retrieve: vi.fn(),
    },
  };
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return {
    mockPrisma: {
      subscription: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
    },
    mockGetStripeClient: vi.fn(),
    mockStripe,
    mockLogger,
  };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../lib/stripe.js', () => ({
  getStripeClient: mockGetStripeClient,
}));

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// モック設定後にインポート
import { runSubscriptionSync } from '../../jobs/subscription-sync.js';

describe('runSubscriptionSync', () => {
  const mockDbSubscription = {
    id: 'sub-db-1',
    externalId: 'sub_stripe_123',
    status: 'ACTIVE',
    plan: 'PRO',
    currentPeriodEnd: new Date('2025-06-01T00:00:00.000Z'),
    userId: 'user-1',
    organizationId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Stripeクライアントが未初期化の場合はスキップする', async () => {
    mockGetStripeClient.mockReturnValue(null);

    await runSubscriptionSync();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Stripeクライアントが初期化されていません。スキップします。'
    );
    expect(mockPrisma.subscription.findMany).not.toHaveBeenCalled();
  });

  it('DBとStripeのステータスが一致する場合は更新しない', async () => {
    mockGetStripeClient.mockReturnValue(mockStripe);
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([mockDbSubscription])
      .mockResolvedValueOnce([]);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_stripe_123',
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

    await runSubscriptionSync();

    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('ステータス不一致時にDBを更新する', async () => {
    mockGetStripeClient.mockReturnValue(mockStripe);
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([mockDbSubscription])
      .mockResolvedValueOnce([]);
    // StripeはPAST_DUEだがDBはACTIVE
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_stripe_123',
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
    mockPrisma.subscription.update.mockResolvedValue({});

    await runSubscriptionSync();

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-db-1' },
      data: { status: 'PAST_DUE' },
    });
  });

  it('CANCELED時にUser.planをFREEに更新する', async () => {
    mockGetStripeClient.mockReturnValue(mockStripe);
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([mockDbSubscription])
      .mockResolvedValueOnce([]);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_stripe_123',
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
    mockPrisma.subscription.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    await runSubscriptionSync();

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-db-1' },
      data: { status: 'CANCELED' },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { plan: 'FREE' },
    });
  });

  it('Stripe resource_missingエラー時にCANCELED化する', async () => {
    mockGetStripeClient.mockReturnValue(mockStripe);
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([mockDbSubscription])
      .mockResolvedValueOnce([]);
    mockStripe.subscriptions.retrieve.mockRejectedValue({
      code: 'resource_missing',
    });
    mockPrisma.subscription.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    await runSubscriptionSync();

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-db-1' },
      data: { status: 'CANCELED' },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { plan: 'FREE' },
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: 'sub_stripe_123',
        userId: 'user-1',
        organizationId: null,
      }),
      'Stripeでサブスクリプションが見つかりません'
    );
  });

  it('期間終了日の1日超誤差を修正する', async () => {
    mockGetStripeClient.mockReturnValue(mockStripe);
    const subWithOldPeriodEnd = {
      ...mockDbSubscription,
      // DBは5/30、Stripeは6/5で5日以上ずれている
      currentPeriodEnd: new Date('2025-05-30T00:00:00.000Z'),
    };
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([subWithOldPeriodEnd])
      .mockResolvedValueOnce([]);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_stripe_123',
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
    mockPrisma.subscription.update.mockResolvedValue({});

    await runSubscriptionSync();

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-db-1' },
      data: { currentPeriodEnd: new Date('2025-06-05T00:00:00.000Z') },
    });
  });

  it('期間終了日の1日以内の誤差は無視する', async () => {
    mockGetStripeClient.mockReturnValue(mockStripe);
    const subWithSmallDiff = {
      ...mockDbSubscription,
      // 12時間程度の誤差
      currentPeriodEnd: new Date('2025-06-01T12:00:00.000Z'),
    };
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([subWithSmallDiff])
      .mockResolvedValueOnce([]);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_stripe_123',
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

    await runSubscriptionSync();

    // ステータスも期間も一致扱いなので更新なし
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('externalIdがnullの場合はスキップする', async () => {
    mockGetStripeClient.mockReturnValue(mockStripe);
    const subWithoutExternal = {
      ...mockDbSubscription,
      externalId: null,
    };
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([subWithoutExternal])
      .mockResolvedValueOnce([]);

    await runSubscriptionSync();

    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('組織サブスクリプションでもUser更新はスキップする', async () => {
    mockGetStripeClient.mockReturnValue(mockStripe);
    const orgSubscription = {
      ...mockDbSubscription,
      userId: null,
      organizationId: 'org-1',
    };
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([orgSubscription])
      .mockResolvedValueOnce([]);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_stripe_123',
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
    mockPrisma.subscription.update.mockResolvedValue({});

    await runSubscriptionSync();

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-db-1' },
      data: { status: 'CANCELED' },
    });
    // userIdがないのでuser.updateは呼ばれない
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('同期チェック完了後にサマリーを出力する', async () => {
    mockGetStripeClient.mockReturnValue(mockStripe);
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([mockDbSubscription])
      .mockResolvedValueOnce([]);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_stripe_123',
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

    await runSubscriptionSync();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        totalChecked: 1,
        totalMismatched: 0,
        totalUpdated: 0,
        totalNotFound: 0,
      }),
      'サブスクリプション同期チェック完了'
    );
  });

  it('カーソルベースバッチ処理が正しく動作する', async () => {
    mockGetStripeClient.mockReturnValue(mockStripe);
    const batch1 = [mockDbSubscription];
    const batch2 = [{ ...mockDbSubscription, id: 'sub-db-2' }];

    mockPrisma.subscription.findMany
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce([]);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_stripe_123',
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

    await runSubscriptionSync();

    expect(mockPrisma.subscription.findMany).toHaveBeenCalledTimes(3);
    expect(mockPrisma.subscription.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        skip: 1,
        cursor: { id: 'sub-db-1' },
      })
    );
  });
});
