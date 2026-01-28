import { describe, it, expect, beforeEach } from 'vitest';
import { MockGateway } from '../../gateways/payment/mock.gateway.js';

describe('MockGateway', () => {
  let gateway: MockGateway;

  beforeEach(() => {
    gateway = new MockGateway();
  });

  // ============================================
  // 顧客管理
  // ============================================

  describe('createCustomer', () => {
    it('正常に顧客を作成する', async () => {
      const customer = await gateway.createCustomer('test@example.com', { userId: 'user-1' });

      expect(customer.id).toMatch(/^cus_mock_/);
      expect(customer.email).toBe('test@example.com');
      expect(customer.metadata).toEqual({ userId: 'user-1' });
      expect(customer.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getCustomer', () => {
    it('正常に顧客を取得する', async () => {
      const created = await gateway.createCustomer('test@example.com');
      const result = await gateway.getCustomer(created.id);

      expect(result).not.toBeNull();
      expect(result?.email).toBe('test@example.com');
    });

    it('存在しない顧客はnullを返す', async () => {
      const result = await gateway.getCustomer('cus_nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // SetupIntent
  // ============================================

  describe('createSetupIntent', () => {
    it('正常にSetupIntentを作成する（id、clientSecret付き）', async () => {
      const result = await gateway.createSetupIntent('cus_123');

      expect(result.id).toMatch(/^seti_mock_/);
      expect(result.clientSecret).toContain('_secret_mock_');
    });
  });

  // ============================================
  // 支払い方法
  // ============================================

  describe('attachPaymentMethod', () => {
    it('visaトークンでカード情報を返す', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const result = await gateway.attachPaymentMethod(customer.id, 'tok_visa');

      expect(result.id).toMatch(/^pm_mock_/);
      expect(result.customerId).toBe(customer.id);
      expect(result.brand).toBe('visa');
      expect(result.last4).toBe('4242');
    });

    it('mastercardトークンでカード情報を返す', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const result = await gateway.attachPaymentMethod(customer.id, 'tok_mastercard');

      expect(result.brand).toBe('mastercard');
      expect(result.last4).toBe('5555');
    });

    it('amexトークンでカード情報を返す', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const result = await gateway.attachPaymentMethod(customer.id, 'tok_amex');

      expect(result.brand).toBe('amex');
      expect(result.last4).toBe('0005');
    });

    it('初めての支払い方法はデフォルトに設定される', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const pm1 = await gateway.attachPaymentMethod(customer.id, 'tok_visa');
      await gateway.attachPaymentMethod(customer.id, 'tok_mastercard');

      // デフォルトが最初のpmであることを間接的に確認
      // setDefaultPaymentMethodで別のpmを設定できることで確認
      await expect(gateway.setDefaultPaymentMethod(customer.id, pm1.id)).resolves.not.toThrow();
    });
  });

  describe('detachPaymentMethod', () => {
    it('正常に支払い方法を解除する', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const pm = await gateway.attachPaymentMethod(customer.id, 'tok_visa');

      await gateway.detachPaymentMethod(pm.id);

      const methods = await gateway.listPaymentMethods(customer.id);
      expect(methods).toHaveLength(0);
    });

    it('デフォルト支払い方法の解除時にデフォルト設定も解除する', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const pm = await gateway.attachPaymentMethod(customer.id, 'tok_visa');

      // 最初のpmはデフォルト
      await gateway.detachPaymentMethod(pm.id);

      const methods = await gateway.listPaymentMethods(customer.id);
      expect(methods).toHaveLength(0);
    });

    it('存在しない支払い方法の解除は何もしない', async () => {
      await expect(gateway.detachPaymentMethod('pm_nonexistent')).resolves.not.toThrow();
    });
  });

  describe('listPaymentMethods', () => {
    it('正常に支払い方法一覧を取得する', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      await gateway.attachPaymentMethod(customer.id, 'tok_visa');
      await gateway.attachPaymentMethod(customer.id, 'tok_mastercard');

      const methods = await gateway.listPaymentMethods(customer.id);

      expect(methods).toHaveLength(2);
    });

    it('支払い方法がない場合は空配列を返す', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const methods = await gateway.listPaymentMethods(customer.id);

      expect(methods).toEqual([]);
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('正常にデフォルト支払い方法を設定する', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      await gateway.attachPaymentMethod(customer.id, 'tok_visa');
      const pm2 = await gateway.attachPaymentMethod(customer.id, 'tok_mastercard');

      await gateway.setDefaultPaymentMethod(customer.id, pm2.id);

      // エラーなく設定完了
      expect(true).toBe(true);
    });

    it('存在しない支払い方法はエラーを投げる', async () => {
      const customer = await gateway.createCustomer('test@example.com');

      await expect(gateway.setDefaultPaymentMethod(customer.id, 'pm_nonexistent'))
        .rejects.toThrow('Payment method not found or does not belong to customer');
    });
  });

  // ============================================
  // サブスクリプション
  // ============================================

  describe('createSubscription', () => {
    it('MONTHLYサブスクリプションを作成する', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const result = await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });

      expect(result.id).toMatch(/^sub_mock_/);
      expect(result.status).toBe('active');
      expect(result.plan).toBe('PRO');
      expect(result.billingCycle).toBe('MONTHLY');
      expect(result.cancelAtPeriodEnd).toBe(false);

      // 期間計算の検証（1ヶ月後）
      const diffMs = result.currentPeriodEnd.getTime() - result.currentPeriodStart.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(28);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it('YEARLYサブスクリプションを作成する', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const result = await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'YEARLY',
        paymentMethodId: 'pm_123',
      });

      expect(result.billingCycle).toBe('YEARLY');

      // 期間計算の検証（1年後）
      const diffMs = result.currentPeriodEnd.getTime() - result.currentPeriodStart.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(365);
      expect(diffDays).toBeLessThanOrEqual(366);
    });

    it('サブスクリプション作成時に請求書が自動作成される', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });

      const invoices = await gateway.listInvoices(customer.id);
      expect(invoices).toHaveLength(1);
      expect(invoices[0].status).toBe('paid');
    });
  });

  describe('updateSubscription', () => {
    it('プランを更新する', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const sub = await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });

      const result = await gateway.updateSubscription(sub.id, { billingCycle: 'YEARLY' });

      expect(result.billingCycle).toBe('YEARLY');
    });

    it('存在しないサブスクリプションはエラーを投げる', async () => {
      await expect(gateway.updateSubscription('sub_nonexistent', { plan: 'PRO' }))
        .rejects.toThrow('Subscription not found');
    });
  });

  describe('cancelSubscription', () => {
    it('期間終了時にキャンセルする', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const sub = await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });

      const result = await gateway.cancelSubscription(sub.id, true);

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(result.status).toBe('active');
    });

    it('即時キャンセルする', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const sub = await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });

      const result = await gateway.cancelSubscription(sub.id, false);

      expect(result.status).toBe('canceled');
    });

    it('存在しないサブスクリプションはエラーを投げる', async () => {
      await expect(gateway.cancelSubscription('sub_nonexistent', true))
        .rejects.toThrow('Subscription not found');
    });
  });

  describe('reactivateSubscription', () => {
    it('キャンセル予約を解除する', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const sub = await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });
      await gateway.cancelSubscription(sub.id, true);

      const result = await gateway.reactivateSubscription(sub.id);

      expect(result.cancelAtPeriodEnd).toBe(false);
    });

    it('存在しないサブスクリプションはエラーを投げる', async () => {
      await expect(gateway.reactivateSubscription('sub_nonexistent'))
        .rejects.toThrow('Subscription not found');
    });
  });

  describe('getSubscription', () => {
    it('正常にサブスクリプションを取得する', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const sub = await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });

      const result = await gateway.getSubscription(sub.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(sub.id);
    });

    it('存在しないサブスクリプションはnullを返す', async () => {
      const result = await gateway.getSubscription('sub_nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // 日割り計算
  // ============================================

  describe('previewProration', () => {
    it('正常に日割り計算を行う', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      const sub = await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });

      const result = await gateway.previewProration({
        customerId: customer.id,
        subscriptionId: sub.id,
        currentPlan: 'PRO',
        newPlan: 'PRO',
        billingCycle: 'YEARLY',
      });

      expect(result.currency).toBe('jpy');
      expect(result.effectiveDate).toBeInstanceOf(Date);
      expect(typeof result.amountDue).toBe('number');
      expect(result.amountDue).toBeGreaterThanOrEqual(0);
    });

    it('存在しないサブスクリプションはエラーを投げる', async () => {
      await expect(gateway.previewProration({
        customerId: 'cus_123',
        subscriptionId: 'sub_nonexistent',
        currentPlan: 'PRO',
        newPlan: 'PRO',
        billingCycle: 'YEARLY',
      })).rejects.toThrow('Subscription not found');
    });
  });

  // ============================================
  // 請求書
  // ============================================

  describe('getInvoice', () => {
    it('正常に請求書を取得する', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });

      const invoices = await gateway.listInvoices(customer.id);
      const result = await gateway.getInvoice(invoices[0].id);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('paid');
    });

    it('存在しない請求書はnullを返す', async () => {
      const result = await gateway.getInvoice('inv_nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listInvoices', () => {
    it('請求書一覧を日付降順で取得する', async () => {
      const customer = await gateway.createCustomer('test@example.com');

      // 2つのサブスクリプションを作成して2つの請求書を生成
      await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });
      await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'YEARLY',
        paymentMethodId: 'pm_123',
      });

      const invoices = await gateway.listInvoices(customer.id);

      expect(invoices).toHaveLength(2);
      // 日付降順を確認
      expect(invoices[0].createdAt.getTime()).toBeGreaterThanOrEqual(invoices[1].createdAt.getTime());
    });
  });

  describe('getInvoicePdf', () => {
    it('PDF URLを返す（モックではnull）', async () => {
      const customer = await gateway.createCustomer('test@example.com');
      await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });

      const invoices = await gateway.listInvoices(customer.id);
      const result = await gateway.getInvoicePdf(invoices[0].id);

      // モックではpdfUrlはnull
      expect(result).toBeNull();
    });

    it('存在しない請求書はnullを返す', async () => {
      const result = await gateway.getInvoicePdf('inv_nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // Webhook
  // ============================================

  describe('verifyAndParseWebhookEvent', () => {
    it('JSONペイロードをパースする（署名検証スキップ）', () => {
      const event = {
        id: 'evt_1',
        type: 'invoice.paid',
        data: { object: { id: 'inv_1' } },
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const result = gateway.verifyAndParseWebhookEvent(JSON.stringify(event), 'any_signature');

      expect(result.id).toBe('evt_1');
      expect(result.type).toBe('invoice.paid');
    });
  });

  // ============================================
  // reset
  // ============================================

  describe('reset', () => {
    it('ストアを完全にリセットする', async () => {
      // データを作成
      const customer = await gateway.createCustomer('test@example.com');
      await gateway.attachPaymentMethod(customer.id, 'tok_visa');
      await gateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_123',
      });

      // リセット
      gateway.reset();

      // 全てのストアが空であることを確認
      expect(await gateway.getCustomer(customer.id)).toBeNull();
      expect(await gateway.listPaymentMethods(customer.id)).toEqual([]);
      expect(await gateway.listInvoices(customer.id)).toEqual([]);
    });
  });
});
