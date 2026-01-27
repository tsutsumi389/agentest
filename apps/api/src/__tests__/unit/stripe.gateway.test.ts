import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() でモックオブジェクトを事前定義（vi.mockのホイスティング対応）
const { mockStripeInstance, mockEnv, MockStripeErrors } = vi.hoisted(() => {
  const StripeInvalidRequestError = class extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 404) {
      super(message);
      this.statusCode = statusCode;
    }
  };

  return {
    mockStripeInstance: {
      customers: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
      },
      setupIntents: {
        create: vi.fn(),
      },
      paymentMethods: {
        attach: vi.fn(),
        detach: vi.fn(),
        list: vi.fn(),
      },
      subscriptions: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
        cancel: vi.fn(),
      },
      invoices: {
        retrieve: vi.fn(),
        list: vi.fn(),
        createPreview: vi.fn(),
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    },
    mockEnv: {
      STRIPE_SECRET_KEY: 'sk_test_mock_key',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_mock_secret',
      STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
      STRIPE_PRICE_PRO_YEARLY: 'price_pro_yearly',
    } as Record<string, string | undefined>,
    MockStripeErrors: {
      StripeInvalidRequestError,
    },
  };
});

// Stripeモジュールのモック（コンストラクタ＋エラークラス）
vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(() => mockStripeInstance);
  (MockStripe as any).errors = MockStripeErrors;
  return {
    default: MockStripe,
    __esModule: true,
  };
});

vi.mock('../../config/env.js', () => ({
  env: new Proxy(mockEnv, {
    get: (target, prop) => target[prop as string],
  }),
}));

// モック設定後にインポート
import { StripeGateway } from '../../gateways/payment/stripe.gateway.js';

describe('StripeGateway', () => {
  let gateway: StripeGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    // env値をリセット
    mockEnv.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    mockEnv.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_secret';
    mockEnv.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
    mockEnv.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly';
    gateway = new StripeGateway();
  });

  // ============================================
  // 顧客管理
  // ============================================

  describe('createCustomer', () => {
    it('正常に顧客を作成する', async () => {
      mockStripeInstance.customers.create.mockResolvedValue({
        id: 'cus_123',
        email: 'test@example.com',
        created: 1704067200,
        metadata: { userId: 'user-1' },
      });

      const result = await gateway.createCustomer('test@example.com', { userId: 'user-1' });

      expect(result).toEqual({
        id: 'cus_123',
        email: 'test@example.com',
        createdAt: new Date(1704067200 * 1000),
        metadata: { userId: 'user-1' },
      });
      expect(mockStripeInstance.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        metadata: { userId: 'user-1' },
      });
    });

    it('メタデータなしで顧客を作成する', async () => {
      mockStripeInstance.customers.create.mockResolvedValue({
        id: 'cus_456',
        email: 'test@example.com',
        created: 1704067200,
        metadata: {},
      });

      const result = await gateway.createCustomer('test@example.com');

      expect(result.id).toBe('cus_456');
      expect(mockStripeInstance.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        metadata: undefined,
      });
    });
  });

  describe('getCustomer', () => {
    it('正常に顧客を取得する', async () => {
      mockStripeInstance.customers.retrieve.mockResolvedValue({
        id: 'cus_123',
        email: 'test@example.com',
        created: 1704067200,
        metadata: {},
        deleted: undefined,
      });

      const result = await gateway.getCustomer('cus_123');

      expect(result).toEqual({
        id: 'cus_123',
        email: 'test@example.com',
        createdAt: new Date(1704067200 * 1000),
        metadata: {},
      });
    });

    it('削除済み顧客の場合はnullを返す', async () => {
      mockStripeInstance.customers.retrieve.mockResolvedValue({
        id: 'cus_123',
        deleted: true,
      });

      const result = await gateway.getCustomer('cus_123');

      expect(result).toBeNull();
    });

    it('404エラーの場合はnullを返す', async () => {
      const error = new MockStripeErrors.StripeInvalidRequestError('Not found', 404);
      mockStripeInstance.customers.retrieve.mockRejectedValue(error);

      const result = await gateway.getCustomer('cus_notfound');

      expect(result).toBeNull();
    });

    it('その他のエラーはthrowする', async () => {
      const error = new Error('Network error');
      mockStripeInstance.customers.retrieve.mockRejectedValue(error);

      await expect(gateway.getCustomer('cus_123')).rejects.toThrow('Network error');
    });
  });

  // ============================================
  // SetupIntent
  // ============================================

  describe('createSetupIntent', () => {
    it('正常にSetupIntentを作成する', async () => {
      mockStripeInstance.setupIntents.create.mockResolvedValue({
        id: 'seti_123',
        client_secret: 'seti_123_secret',
      });

      const result = await gateway.createSetupIntent('cus_123');

      expect(result).toEqual({
        id: 'seti_123',
        clientSecret: 'seti_123_secret',
      });
      expect(mockStripeInstance.setupIntents.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        payment_method_types: ['card'],
      });
    });

    it('client_secretが欠損している場合はエラーを投げる', async () => {
      mockStripeInstance.setupIntents.create.mockResolvedValue({
        id: 'seti_123',
        client_secret: null,
      });

      await expect(gateway.createSetupIntent('cus_123'))
        .rejects.toThrow('SetupIntent client_secret is missing');
    });
  });

  // ============================================
  // 支払い方法
  // ============================================

  describe('attachPaymentMethod', () => {
    it('正常に支払い方法を紐付ける', async () => {
      mockStripeInstance.paymentMethods.attach.mockResolvedValue({
        id: 'pm_123',
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
      });

      const result = await gateway.attachPaymentMethod('cus_123', 'pm_123');

      expect(result).toEqual({
        id: 'pm_123',
        customerId: 'cus_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
      });
    });
  });

  describe('detachPaymentMethod', () => {
    it('正常に支払い方法を解除する', async () => {
      mockStripeInstance.paymentMethods.detach.mockResolvedValue({});

      await gateway.detachPaymentMethod('pm_123');

      expect(mockStripeInstance.paymentMethods.detach).toHaveBeenCalledWith('pm_123');
    });
  });

  describe('listPaymentMethods', () => {
    it('正常に支払い方法一覧を取得する', async () => {
      mockStripeInstance.paymentMethods.list.mockResolvedValue({
        data: [
          { id: 'pm_1', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } },
          { id: 'pm_2', card: { brand: 'mastercard', last4: '5555', exp_month: 6, exp_year: 2025 } },
        ],
      });

      const result = await gateway.listPaymentMethods('cus_123');

      expect(result).toHaveLength(2);
      expect(result[0].brand).toBe('visa');
      expect(result[1].brand).toBe('mastercard');
    });

    it('空の一覧を返す', async () => {
      mockStripeInstance.paymentMethods.list.mockResolvedValue({ data: [] });

      const result = await gateway.listPaymentMethods('cus_123');

      expect(result).toEqual([]);
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('正常にデフォルト支払い方法を設定する', async () => {
      mockStripeInstance.customers.update.mockResolvedValue({});

      await gateway.setDefaultPaymentMethod('cus_123', 'pm_123');

      expect(mockStripeInstance.customers.update).toHaveBeenCalledWith('cus_123', {
        invoice_settings: { default_payment_method: 'pm_123' },
      });
    });
  });

  // ============================================
  // サブスクリプション
  // ============================================

  describe('createSubscription', () => {
    const mockSubResponse = {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      cancel_at_period_end: false,
      items: {
        data: [{
          id: 'si_1',
          current_period_start: 1704067200,
          current_period_end: 1706745600,
        }],
      },
      metadata: { plan: 'PRO', billingCycle: 'MONTHLY' },
    };

    it('MONTHLYプランでサブスクリプションを作成する', async () => {
      mockStripeInstance.subscriptions.create.mockResolvedValue(mockSubResponse);

      const result = await gateway.createSubscription({
        customerId: 'cus_123',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });

      expect(result.id).toBe('sub_123');
      expect(result.status).toBe('active');
      expect(mockStripeInstance.subscriptions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        items: [{ price: 'price_pro_monthly' }],
        default_payment_method: 'pm_123',
        metadata: { plan: 'PRO', billingCycle: 'MONTHLY' },
      });
    });

    it('YEARLYプランでサブスクリプションを作成する', async () => {
      mockStripeInstance.subscriptions.create.mockResolvedValue({
        ...mockSubResponse,
        metadata: { plan: 'PRO', billingCycle: 'YEARLY' },
      });

      await gateway.createSubscription({
        customerId: 'cus_123',
        plan: 'PRO',
        billingCycle: 'YEARLY',
        paymentMethodId: 'pm_123',
      });

      expect(mockStripeInstance.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ price: 'price_pro_yearly' }],
          metadata: { plan: 'PRO', billingCycle: 'YEARLY' },
        }),
      );
    });
  });

  describe('updateSubscription', () => {
    const mockCurrentSub = {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      cancel_at_period_end: false,
      items: {
        data: [{
          id: 'si_1',
          current_period_start: 1704067200,
          current_period_end: 1706745600,
        }],
      },
      metadata: { plan: 'PRO', billingCycle: 'MONTHLY' },
    };

    it('プラン変更を行う', async () => {
      mockStripeInstance.subscriptions.retrieve.mockResolvedValue(mockCurrentSub);
      mockStripeInstance.subscriptions.update.mockResolvedValue({
        ...mockCurrentSub,
        metadata: { plan: 'PRO', billingCycle: 'YEARLY' },
      });

      await gateway.updateSubscription('sub_123', { billingCycle: 'YEARLY' });

      expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith(
        'sub_123',
        expect.objectContaining({
          items: [{ id: 'si_1', price: 'price_pro_yearly' }],
          metadata: { plan: 'PRO', billingCycle: 'YEARLY' },
          proration_behavior: 'create_prorations',
        }),
      );
    });

    it('支払い方法を変更する', async () => {
      mockStripeInstance.subscriptions.retrieve.mockResolvedValue(mockCurrentSub);
      mockStripeInstance.subscriptions.update.mockResolvedValue(mockCurrentSub);

      await gateway.updateSubscription('sub_123', { paymentMethodId: 'pm_new' });

      expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith(
        'sub_123',
        expect.objectContaining({
          default_payment_method: 'pm_new',
        }),
      );
    });

    it('アイテムがない場合はエラーを投げる', async () => {
      mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
        ...mockCurrentSub,
        items: { data: [] },
      });

      await expect(gateway.updateSubscription('sub_123', { plan: 'PRO' }))
        .rejects.toThrow('Subscription has no items');
    });
  });

  describe('cancelSubscription', () => {
    const mockSubResponse = {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      cancel_at_period_end: true,
      items: {
        data: [{
          id: 'si_1',
          current_period_start: 1704067200,
          current_period_end: 1706745600,
        }],
      },
      metadata: { plan: 'PRO', billingCycle: 'MONTHLY' },
    };

    it('期間終了時にキャンセルする', async () => {
      mockStripeInstance.subscriptions.update.mockResolvedValue(mockSubResponse);

      const result = await gateway.cancelSubscription('sub_123', true);

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true,
      });
    });

    it('即時キャンセルする', async () => {
      mockStripeInstance.subscriptions.cancel.mockResolvedValue({
        ...mockSubResponse,
        status: 'canceled',
        cancel_at_period_end: false,
      });

      const result = await gateway.cancelSubscription('sub_123', false);

      expect(result.status).toBe('canceled');
      expect(mockStripeInstance.subscriptions.cancel).toHaveBeenCalledWith('sub_123');
    });
  });

  describe('reactivateSubscription', () => {
    it('キャンセル予約を解除する', async () => {
      mockStripeInstance.subscriptions.update.mockResolvedValue({
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        cancel_at_period_end: false,
        items: {
          data: [{
            id: 'si_1',
            current_period_start: 1704067200,
            current_period_end: 1706745600,
          }],
        },
        metadata: { plan: 'PRO', billingCycle: 'MONTHLY' },
      });

      const result = await gateway.reactivateSubscription('sub_123');

      expect(result.cancelAtPeriodEnd).toBe(false);
      expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: false,
      });
    });
  });

  describe('getSubscription', () => {
    it('正常にサブスクリプションを取得する', async () => {
      mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        cancel_at_period_end: false,
        items: {
          data: [{
            id: 'si_1',
            current_period_start: 1704067200,
            current_period_end: 1706745600,
          }],
        },
        metadata: { plan: 'PRO', billingCycle: 'MONTHLY' },
      });

      const result = await gateway.getSubscription('sub_123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('sub_123');
    });

    it('404の場合はnullを返す', async () => {
      const error = new MockStripeErrors.StripeInvalidRequestError('Not found', 404);
      mockStripeInstance.subscriptions.retrieve.mockRejectedValue(error);

      const result = await gateway.getSubscription('sub_notfound');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // 日割り計算
  // ============================================

  describe('previewProration', () => {
    it('正常に日割り計算をプレビューする', async () => {
      mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: {
          data: [{ id: 'si_1' }],
        },
      });
      mockStripeInstance.invoices.createPreview.mockResolvedValue({
        currency: 'jpy',
        lines: {
          data: [
            {
              amount: 500,
              parent: { invoice_item_details: { proration: true } },
            },
            {
              amount: -200,
              parent: { subscription_item_details: { proration: true } },
            },
          ],
        },
      });

      const result = await gateway.previewProration({
        customerId: 'cus_123',
        subscriptionId: 'sub_123',
        currentPlan: 'PRO',
        newPlan: 'PRO',
        billingCycle: 'YEARLY',
      });

      expect(result.amountDue).toBe(300);
      expect(result.currency).toBe('jpy');
    });

    it('アイテムがない場合はエラーを投げる', async () => {
      mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: { data: [] },
      });

      await expect(gateway.previewProration({
        customerId: 'cus_123',
        subscriptionId: 'sub_123',
        currentPlan: 'PRO',
        newPlan: 'PRO',
        billingCycle: 'YEARLY',
      })).rejects.toThrow('Subscription has no items');
    });
  });

  // ============================================
  // 請求書
  // ============================================

  describe('getInvoice', () => {
    it('正常に請求書を取得する', async () => {
      mockStripeInstance.invoices.retrieve.mockResolvedValue({
        id: 'inv_123',
        number: 'INV-001',
        parent: { subscription_details: { subscription: 'sub_123' } },
        customer: 'cus_123',
        amount_due: 980,
        currency: 'jpy',
        status: 'paid',
        period_start: 1704067200,
        period_end: 1706745600,
        due_date: 1704067200,
        invoice_pdf: 'https://example.com/inv.pdf',
        created: 1704067200,
      });

      const result = await gateway.getInvoice('inv_123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('inv_123');
      expect(result?.status).toBe('paid');
    });

    it('404の場合はnullを返す', async () => {
      const error = new MockStripeErrors.StripeInvalidRequestError('Not found', 404);
      mockStripeInstance.invoices.retrieve.mockRejectedValue(error);

      const result = await gateway.getInvoice('inv_notfound');

      expect(result).toBeNull();
    });
  });

  describe('listInvoices', () => {
    it('正常に請求書一覧を取得する', async () => {
      // Stripe SDKのauto-pagingイテレータをモック
      const invoiceData = [
        {
          id: 'inv_1',
          number: 'INV-001',
          parent: { subscription_details: { subscription: 'sub_123' } },
          customer: 'cus_123',
          amount_due: 980,
          currency: 'jpy',
          status: 'paid',
          period_start: 1704067200,
          period_end: 1706745600,
          due_date: null,
          invoice_pdf: null,
          created: 1704067200,
        },
      ];
      mockStripeInstance.invoices.list.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const inv of invoiceData) {
            yield inv;
          }
        },
      });

      const result = await gateway.listInvoices('cus_123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('inv_1');
    });
  });

  describe('getInvoicePdf', () => {
    it('正常にPDF URLを取得する', async () => {
      mockStripeInstance.invoices.retrieve.mockResolvedValue({
        id: 'inv_123',
        invoice_pdf: 'https://example.com/inv.pdf',
      });

      const result = await gateway.getInvoicePdf('inv_123');

      expect(result).toBe('https://example.com/inv.pdf');
    });

    it('404の場合はnullを返す', async () => {
      const error = new MockStripeErrors.StripeInvalidRequestError('Not found', 404);
      mockStripeInstance.invoices.retrieve.mockRejectedValue(error);

      const result = await gateway.getInvoicePdf('inv_notfound');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // Webhook
  // ============================================

  describe('verifyAndParseWebhookEvent', () => {
    it('正常にWebhookイベントを検証・パースする', () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        id: 'evt_123',
        type: 'invoice.paid',
        data: { object: { id: 'inv_123' } },
        created: 1704067200,
      });

      const result = gateway.verifyAndParseWebhookEvent('payload', 'sig_123');

      expect(result).toEqual({
        id: 'evt_123',
        type: 'invoice.paid',
        data: { object: { id: 'inv_123' } },
        createdAt: new Date(1704067200 * 1000),
      });
    });

    it('未対応のイベントタイプはエラーを投げる', () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        id: 'evt_123',
        type: 'charge.succeeded',
        data: { object: {} },
        created: 1704067200,
      });

      expect(() => gateway.verifyAndParseWebhookEvent('payload', 'sig_123'))
        .toThrow('Unsupported webhook event type: charge.succeeded');
    });

    it('STRIPE_WEBHOOK_SECRETが未設定の場合はエラーを投げる', () => {
      mockEnv.STRIPE_WEBHOOK_SECRET = undefined;
      // 新しいゲートウェイインスタンスを作る必要はない（envはProxy経由で参照）

      expect(() => gateway.verifyAndParseWebhookEvent('payload', 'sig_123'))
        .toThrow('STRIPE_WEBHOOK_SECRET is required');
    });
  });

  // ============================================
  // ユーティリティ（privateメソッドを間接的にテスト）
  // ============================================

  describe('resolvePriceId（createSubscription経由）', () => {
    it('FREEプランはエラーを投げる', async () => {
      await expect(gateway.createSubscription({
        customerId: 'cus_123',
        plan: 'FREE',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      })).rejects.toThrow('FREE plan does not have a Stripe Price ID');
    });

    it('STRIPE_PRICE_PRO_MONTHLYが未設定の場合はエラーを投げる', async () => {
      mockEnv.STRIPE_PRICE_PRO_MONTHLY = undefined;

      await expect(gateway.createSubscription({
        customerId: 'cus_123',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      })).rejects.toThrow('STRIPE_PRICE_PRO_MONTHLY is not configured');
    });

    it('STRIPE_PRICE_PRO_YEARLYが未設定の場合はエラーを投げる', async () => {
      mockEnv.STRIPE_PRICE_PRO_YEARLY = undefined;

      await expect(gateway.createSubscription({
        customerId: 'cus_123',
        plan: 'PRO',
        billingCycle: 'YEARLY',
        paymentMethodId: 'pm_123',
      })).rejects.toThrow('STRIPE_PRICE_PRO_YEARLY is not configured');
    });
  });

  describe('toSubscriptionResult（getSubscription経由）', () => {
    it('各ステータスを正しくマッピングする', async () => {
      const statuses = ['active', 'past_due', 'canceled', 'paused', 'trialing', 'incomplete', 'incomplete_expired'] as const;
      const expected = ['active', 'past_due', 'canceled', 'paused', 'trialing', 'incomplete', 'incomplete_expired'];

      for (let i = 0; i < statuses.length; i++) {
        mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
          id: 'sub_123',
          customer: 'cus_123',
          status: statuses[i],
          cancel_at_period_end: false,
          items: {
            data: [{
              id: 'si_1',
              current_period_start: 1704067200,
              current_period_end: 1706745600,
            }],
          },
          metadata: { plan: 'PRO', billingCycle: 'MONTHLY' },
        });

        const result = await gateway.getSubscription('sub_123');
        expect(result?.status).toBe(expected[i]);
      }
    });

    it('アイテムなしのサブスクリプションはエラーを投げる', async () => {
      mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        cancel_at_period_end: false,
        items: { data: [] },
        metadata: { plan: 'PRO', billingCycle: 'MONTHLY' },
      });

      await expect(gateway.getSubscription('sub_123'))
        .rejects.toThrow('Subscription sub_123 has no items');
    });
  });
});
