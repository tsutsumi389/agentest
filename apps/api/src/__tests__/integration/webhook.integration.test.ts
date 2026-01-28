import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestSubscription,
  cleanupTestData,
} from './test-helpers.js';
import { AuthenticationError } from '@agentest/shared';
import { resetPaymentGateway, setPaymentGateway, MockGateway } from '../../gateways/payment/index.js';

/**
 * 認証ユーザーの型定義
 */
interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: string;
  createdAt: Date;
}

// グローバルな認証状態（モック用）
let mockAuthUser: AuthUser | null = null;

function clearTestAuth() {
  mockAuthUser = null;
}

vi.mock('@agentest/auth', () => ({
  requireAuth: () => (req: any, _res: any, next: any) => {
    if (!mockAuthUser) {
      return next(new AuthenticationError('認証が必要です'));
    }
    req.user = mockAuthUser;
    next();
  },
  optionalAuth: () => (_req: any, _res: any, next: any) => next(),
  requireOrgRole: () => (_req: any, _res: any, next: any) => next(),
  requireProjectRole: () => (_req: any, _res: any, next: any) => next(),
  authenticate: (_options: { optional?: boolean } = {}) => (req: any, _res: any, next: any) => { if (mockAuthUser) req.user = mockAuthUser; next(); },
  configurePassport: vi.fn(),
  passport: { initialize: vi.fn(), authenticate: vi.fn() },
  generateTokens: vi.fn(),
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  decodeToken: vi.fn(),
  getTokenExpiry: vi.fn(),
  createAuthConfig: vi.fn(),
  defaultAuthConfig: {},
}));

/**
 * Webhook用のHTTPリクエスト送信ヘルパー
 * express.raw()がapplication/jsonのContent-Typeで受信するとBufferに変換する。
 * supertest の .send(Buffer) はBufferをJSON直列化してしまうため、
 * 文字列として送信し、express.raw()にBuffer変換させる。
 */
function sendWebhookRequest(app: Express, payload: object) {
  return request(app)
    .post('/webhooks/stripe')
    .set('stripe-signature', 'test_signature')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(payload));
}

describe('Webhook Integration Tests', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let mockGateway: MockGateway;

  beforeAll(async () => {
    mockGateway = new MockGateway();
    setPaymentGateway(mockGateway);
    const { createApp } = await import('../../app.js');
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    resetPaymentGateway();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
    clearTestAuth();
    mockGateway.reset();

    testUser = await createTestUser({
      email: 'webhook-test@example.com',
      name: 'Webhook Test User',
      plan: 'PRO',
    });
  });

  describe('POST /webhooks/stripe', () => {
    it('invoice.paid: サブスクリプション存在時にInvoice PAIDを作成する', async () => {
      // テスト用サブスクリプションを作成（externalId付き）
      const subscription = await createTestSubscription({
        userId: testUser.id,
        plan: 'PRO',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
      });
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { externalId: 'sub_stripe_webhook_1' },
      });

      const webhookEvent = {
        id: 'evt_invoice_paid_1',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_1',
            number: 'INV-WEBHOOK-001',
            subscription: 'sub_stripe_webhook_1',
            customer: 'cus_1',
            amount_due: 980,
            currency: 'jpy',
            status: 'paid',
            period_start: 1704067200,
            period_end: 1706745600,
            due_date: 1704067200,
            invoice_pdf: null,
          },
        },
        createdAt: new Date().toISOString(),
      };

      const response = await sendWebhookRequest(app, webhookEvent);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });

      // Invoiceが作成されたことを確認
      const invoice = await prisma.invoice.findFirst({
        where: { invoiceNumber: 'INV-WEBHOOK-001' },
      });
      expect(invoice).not.toBeNull();
      expect(invoice?.status).toBe('PAID');
      expect(Number(invoice?.amount)).toBe(980);
    });

    it('invoice.payment_failed: トランザクションでInvoice作成とステータスPAST_DUE更新', async () => {
      const subscription = await createTestSubscription({
        userId: testUser.id,
        plan: 'PRO',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
      });
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { externalId: 'sub_stripe_webhook_2' },
      });

      const webhookEvent = {
        id: 'evt_invoice_failed_1',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'inv_2',
            number: 'INV-WEBHOOK-002',
            subscription: 'sub_stripe_webhook_2',
            customer: 'cus_1',
            amount_due: 980,
            currency: 'jpy',
            status: 'open',
            period_start: 1704067200,
            period_end: 1706745600,
            due_date: 1704067200,
            invoice_pdf: null,
          },
        },
        createdAt: new Date().toISOString(),
      };

      const response = await sendWebhookRequest(app, webhookEvent);

      expect(response.status).toBe(200);

      // Invoiceが作成されたことを確認
      const invoice = await prisma.invoice.findFirst({
        where: { invoiceNumber: 'INV-WEBHOOK-002' },
      });
      expect(invoice).not.toBeNull();
      expect(invoice?.status).toBe('FAILED');

      // サブスクリプションがPAST_DUEに更新されたことを確認
      const updatedSub = await prisma.subscription.findUnique({
        where: { id: subscription.id },
      });
      expect(updatedSub?.status).toBe('PAST_DUE');
    });

    it('customer.subscription.updated: DB同期（plan, billingCycle, status, period, cancelAtPeriodEnd）', async () => {
      const subscription = await createTestSubscription({
        userId: testUser.id,
        plan: 'PRO',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        cancelAtPeriodEnd: false,
      });
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { externalId: 'sub_stripe_webhook_3' },
      });

      const webhookEvent = {
        id: 'evt_sub_updated_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_webhook_3',
            customer: 'cus_1',
            status: 'active',
            cancel_at_period_end: true,
            items: {
              data: [{
                current_period_start: 1706745600,
                current_period_end: 1738368000,
              }],
            },
            metadata: {
              plan: 'PRO',
              billingCycle: 'YEARLY',
            },
          },
        },
        createdAt: new Date().toISOString(),
      };

      const response = await sendWebhookRequest(app, webhookEvent);

      expect(response.status).toBe(200);

      // DB同期の確認
      const updatedSub = await prisma.subscription.findUnique({
        where: { id: subscription.id },
      });
      expect(updatedSub?.billingCycle).toBe('YEARLY');
      expect(updatedSub?.status).toBe('ACTIVE');
      expect(updatedSub?.cancelAtPeriodEnd).toBe(true);
      expect(updatedSub?.currentPeriodStart).toEqual(new Date(1706745600 * 1000));
      expect(updatedSub?.currentPeriodEnd).toEqual(new Date(1738368000 * 1000));
    });

    it('customer.subscription.deleted: CANCELED更新とユーザープランFREEダウングレード', async () => {
      const subscription = await createTestSubscription({
        userId: testUser.id,
        plan: 'PRO',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
      });
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { externalId: 'sub_stripe_webhook_4' },
      });

      const webhookEvent = {
        id: 'evt_sub_deleted_1',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_stripe_webhook_4',
            customer: 'cus_1',
            status: 'canceled',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1704067200,
                current_period_end: 1706745600,
              }],
            },
            metadata: {},
          },
        },
        createdAt: new Date().toISOString(),
      };

      const response = await sendWebhookRequest(app, webhookEvent);

      expect(response.status).toBe(200);

      // サブスクリプションがCANCELEDに更新されたことを確認
      const updatedSub = await prisma.subscription.findUnique({
        where: { id: subscription.id },
      });
      expect(updatedSub?.status).toBe('CANCELED');

      // ユーザーのプランがFREEにダウングレードされたことを確認
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser?.plan).toBe('FREE');
    });

    it('raw bodyでないリクエストは400エラーを返す', async () => {
      // express.raw()はapplication/jsonのみ処理するため、
      // text/plainで送信するとexpress.jsonでもパースされず、undefinedになる
      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .set('Content-Type', 'text/plain')
        .send('not json');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('raw body is required');
    });

    it('stripe-signatureヘッダー欠損は400エラーを返す', async () => {
      const response = await request(app)
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ type: 'test' }));

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('stripe-signature');
    });
  });
});
