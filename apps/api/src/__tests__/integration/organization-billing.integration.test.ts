import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestOrganization,
  createTestOrgMember,
  createTestOrgPaymentMethod,
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

// グローバルな組織メンバーロール状態（モック用）
let mockOrgRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null = 'OWNER';

/**
 * テスト用認証設定関数
 */
function setTestAuth(user: AuthUser | null) {
  mockAuthUser = user;
}

function clearTestAuth() {
  mockAuthUser = null;
}

/**
 * テストユーザーを認証状態に設定するヘルパー
 */
function authenticateAs(
  user: Awaited<ReturnType<typeof createTestUser>>,
  overrides: { plan?: string } = {}
) {
  setTestAuth({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    plan: overrides.plan ?? user.plan,
    createdAt: user.createdAt,
  });
}

/**
 * テスト用組織ロールを設定
 */
function setTestOrgRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | null) {
  mockOrgRole = role;
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
  requireOrgRole: (allowedRoles: string[]) => (_req: any, res: any, next: any) => {
    if (!mockOrgRole) {
      return res.status(403).json({ error: '組織メンバーではありません' });
    }
    if (!allowedRoles.includes(mockOrgRole)) {
      return res.status(403).json({ error: '権限がありません' });
    }
    next();
  },
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

describe('Organization Billing API Integration Tests', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testOrg: Awaited<ReturnType<typeof createTestOrganization>>;
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
    setTestOrgRole('OWNER');

    // テストユーザー・組織を作成
    testUser = await createTestUser({
      email: 'org-billing-test@example.com',
      name: 'Org Billing Test User',
      plan: 'FREE',
    });
    testOrg = await createTestOrganization(testUser.id, {
      name: 'Test Org',
    });
  });

  // ============================================
  // GET /api/organizations/:orgId/subscription
  // ============================================

  describe('GET /api/organizations/:orgId/subscription', () => {
    it('サブスクリプションがない場合はnullを返す', async () => {
      authenticateAs(testUser);

      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/subscription`);

      expect(response.status).toBe(200);
      expect(response.body.subscription).toBeNull();
    });

    it('TEAMプランのサブスクリプションを取得できる', async () => {
      await createTestSubscription({
        organizationId: testOrg.id,
        plan: 'TEAM',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
      });

      authenticateAs(testUser);

      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/subscription`);

      expect(response.status).toBe(200);
      expect(response.body.subscription).toBeDefined();
      expect(response.body.subscription.plan).toBe('TEAM');
      expect(response.body.subscription.billingCycle).toBe('MONTHLY');
      expect(response.body.subscription.quantity).toBe(1); // OWNERが1人
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/subscription`);

      expect(response.status).toBe(401);
    });

    it('MEMBERロールの場合は403エラー', async () => {
      authenticateAs(testUser);
      setTestOrgRole('MEMBER');

      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/subscription`);

      expect(response.status).toBe(403);
    });
  });

  // ============================================
  // POST /api/organizations/:orgId/subscription
  // ============================================

  describe('POST /api/organizations/:orgId/subscription', () => {
    it('TEAMプラン契約開始に成功する', async () => {
      // 支払い方法を作成
      const paymentMethod = await createTestOrgPaymentMethod(testOrg.id, {
        isDefault: true,
      });

      // 組織にpaymentCustomerIdを設定
      await prisma.organization.update({
        where: { id: testOrg.id },
        data: {
          paymentCustomerId: 'cus_test_123',
          billingEmail: testUser.email,
        },
      });

      await mockGateway.createCustomer(testUser.email, { organizationId: testOrg.id });
      authenticateAs(testUser);

      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/subscription`)
        .send({
          billingCycle: 'MONTHLY',
          paymentMethodId: paymentMethod.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.subscription).toBeDefined();
      expect(response.body.subscription.plan).toBe('TEAM');
      expect(response.body.subscription.billingCycle).toBe('MONTHLY');
      expect(response.body.subscription.cancelAtPeriodEnd).toBe(false);
    });

    it('年額プランで契約開始に成功する', async () => {
      const paymentMethod = await createTestOrgPaymentMethod(testOrg.id, {
        isDefault: true,
      });

      await prisma.organization.update({
        where: { id: testOrg.id },
        data: {
          paymentCustomerId: 'cus_test_123',
          billingEmail: testUser.email,
        },
      });

      await mockGateway.createCustomer(testUser.email, { organizationId: testOrg.id });
      authenticateAs(testUser);

      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/subscription`)
        .send({
          billingCycle: 'YEARLY',
          paymentMethodId: paymentMethod.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.subscription.billingCycle).toBe('YEARLY');
    });

    it('メンバー数がquantityに反映される', async () => {
      // 追加メンバーを作成
      const member2 = await createTestUser({ email: 'member2@example.com' });
      const member3 = await createTestUser({ email: 'member3@example.com' });
      await createTestOrgMember(testOrg.id, member2.id, 'ADMIN');
      await createTestOrgMember(testOrg.id, member3.id, 'MEMBER');

      const paymentMethod = await createTestOrgPaymentMethod(testOrg.id, {
        isDefault: true,
      });

      await prisma.organization.update({
        where: { id: testOrg.id },
        data: {
          paymentCustomerId: 'cus_test_123',
          billingEmail: testUser.email,
        },
      });

      await mockGateway.createCustomer(testUser.email, { organizationId: testOrg.id });
      authenticateAs(testUser);

      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/subscription`)
        .send({
          billingCycle: 'MONTHLY',
          paymentMethodId: paymentMethod.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.subscription.quantity).toBe(3);
    });

    it('支払い方法がない場合は404エラー', async () => {
      authenticateAs(testUser);

      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/subscription`)
        .send({
          billingCycle: 'MONTHLY',
          paymentMethodId: '00000000-0000-0000-0000-000000000000',
        });

      expect(response.status).toBe(404);
    });
  });

  // ============================================
  // PUT /api/organizations/:orgId/subscription
  // ============================================

  describe('PUT /api/organizations/:orgId/subscription', () => {
    it('請求サイクル変更に成功する', async () => {
      // サブスクリプションを作成
      const subscription = await createTestSubscription({
        organizationId: testOrg.id,
        plan: 'TEAM',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
      });

      // externalIdを設定
      const customer = await mockGateway.createCustomer(testUser.email);
      const gatewaySub = await mockGateway.createOrgSubscription({
        customerId: customer.id,
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_test',
        quantity: 1,
      });

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { externalId: gatewaySub.id },
      });

      authenticateAs(testUser);

      const response = await request(app)
        .put(`/api/organizations/${testOrg.id}/subscription`)
        .send({
          billingCycle: 'YEARLY',
        });

      expect(response.status).toBe(200);
      expect(response.body.subscription.billingCycle).toBe('YEARLY');
    });
  });

  // ============================================
  // DELETE /api/organizations/:orgId/subscription
  // ============================================

  describe('DELETE /api/organizations/:orgId/subscription', () => {
    it('キャンセル予約成功', async () => {
      const subscription = await createTestSubscription({
        organizationId: testOrg.id,
        plan: 'TEAM',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      });

      const customer = await mockGateway.createCustomer(testUser.email);
      const gatewaySub = await mockGateway.createOrgSubscription({
        customerId: customer.id,
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_test',
        quantity: 1,
      });

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { externalId: gatewaySub.id },
      });

      authenticateAs(testUser);

      const response = await request(app)
        .delete(`/api/organizations/${testOrg.id}/subscription`);

      expect(response.status).toBe(200);
      expect(response.body.subscription.cancelAtPeriodEnd).toBe(true);
    });

    it('既にキャンセル済みの場合は400エラー', async () => {
      await createTestSubscription({
        organizationId: testOrg.id,
        plan: 'TEAM',
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
      });

      authenticateAs(testUser);

      const response = await request(app)
        .delete(`/api/organizations/${testOrg.id}/subscription`);

      expect(response.status).toBe(400);
    });
  });

  // ============================================
  // POST /api/organizations/:orgId/subscription/reactivate
  // ============================================

  describe('POST /api/organizations/:orgId/subscription/reactivate', () => {
    it('キャンセル予約解除成功', async () => {
      const subscription = await createTestSubscription({
        organizationId: testOrg.id,
        plan: 'TEAM',
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
      });

      const customer = await mockGateway.createCustomer(testUser.email);
      const gatewaySub = await mockGateway.createOrgSubscription({
        customerId: customer.id,
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_test',
        quantity: 1,
      });
      await mockGateway.cancelSubscription(gatewaySub.id, true);

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { externalId: gatewaySub.id },
      });

      authenticateAs(testUser);

      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/subscription/reactivate`);

      expect(response.status).toBe(200);
      expect(response.body.subscription.cancelAtPeriodEnd).toBe(false);
    });
  });

  // ============================================
  // Payment Methods
  // ============================================

  describe('Payment Methods', () => {
    describe('GET /api/organizations/:orgId/payment-methods', () => {
      it('一覧取得', async () => {
        await createTestOrgPaymentMethod(testOrg.id, {
          brand: 'visa',
          last4: '4242',
          isDefault: true,
        });
        await createTestOrgPaymentMethod(testOrg.id, {
          brand: 'mastercard',
          last4: '5555',
          isDefault: false,
        });

        authenticateAs(testUser);

        const response = await request(app)
          .get(`/api/organizations/${testOrg.id}/payment-methods`);

        expect(response.status).toBe(200);
        expect(response.body.paymentMethods).toHaveLength(2);
        expect(response.body.paymentMethods[0].isDefault).toBe(true);
      });
    });

    describe('POST /api/organizations/:orgId/payment-methods', () => {
      it('追加（最初はデフォルト）', async () => {
        const customer = await mockGateway.createCustomer(testUser.email, { organizationId: testOrg.id });
        await prisma.organization.update({
          where: { id: testOrg.id },
          data: { paymentCustomerId: customer.id },
        });

        authenticateAs(testUser);

        const response = await request(app)
          .post(`/api/organizations/${testOrg.id}/payment-methods`)
          .send({ token: 'tok_visa' });

        expect(response.status).toBe(201);
        expect(response.body.paymentMethod).toBeDefined();
        expect(response.body.paymentMethod.brand).toBe('visa');
        expect(response.body.paymentMethod.isDefault).toBe(true);
      });
    });

    describe('DELETE /api/organizations/:orgId/payment-methods/:paymentMethodId', () => {
      it('削除', async () => {
        await createTestOrgPaymentMethod(testOrg.id, { isDefault: true });
        const paymentMethod = await createTestOrgPaymentMethod(testOrg.id, { isDefault: false });

        authenticateAs(testUser);

        const response = await request(app)
          .delete(`/api/organizations/${testOrg.id}/payment-methods/${paymentMethod.id}`);

        expect(response.status).toBe(204);

        const remaining = await prisma.paymentMethod.findMany({
          where: { organizationId: testOrg.id },
        });
        expect(remaining).toHaveLength(1);
      });
    });

    describe('PUT /api/organizations/:orgId/payment-methods/:paymentMethodId/default', () => {
      it('デフォルト設定', async () => {
        const customer = await mockGateway.createCustomer(testUser.email, { organizationId: testOrg.id });
        await prisma.organization.update({
          where: { id: testOrg.id },
          data: { paymentCustomerId: customer.id },
        });

        const gatewayPm1 = await mockGateway.attachPaymentMethod(customer.id, 'tok_visa');
        const gatewayPm2 = await mockGateway.attachPaymentMethod(customer.id, 'tok_mastercard');

        await createTestOrgPaymentMethod(testOrg.id, {
          externalId: gatewayPm1.id,
          isDefault: true,
        });
        const newDefault = await createTestOrgPaymentMethod(testOrg.id, {
          externalId: gatewayPm2.id,
          isDefault: false,
        });

        authenticateAs(testUser);

        const response = await request(app)
          .put(`/api/organizations/${testOrg.id}/payment-methods/${newDefault.id}/default`);

        expect(response.status).toBe(200);
        expect(response.body.paymentMethod.isDefault).toBe(true);
      });
    });

    describe('POST /api/organizations/:orgId/payment-methods/setup-intent', () => {
      it('SetupIntent作成', async () => {
        const customer = await mockGateway.createCustomer(testUser.email, { organizationId: testOrg.id });
        await prisma.organization.update({
          where: { id: testOrg.id },
          data: { paymentCustomerId: customer.id },
        });

        authenticateAs(testUser);

        const response = await request(app)
          .post(`/api/organizations/${testOrg.id}/payment-methods/setup-intent`);

        expect(response.status).toBe(200);
        expect(response.body.setupIntent).toBeDefined();
        expect(response.body.setupIntent.clientSecret).toBeDefined();
      });
    });
  });

  // ============================================
  // GET /api/organizations/:orgId/invoices
  // ============================================

  describe('GET /api/organizations/:orgId/invoices', () => {
    it('請求書一覧取得・ページネーション', async () => {
      // サブスクリプションを作成
      const subscription = await createTestSubscription({
        organizationId: testOrg.id,
        plan: 'TEAM',
        status: 'ACTIVE',
      });

      // 請求書を作成
      await prisma.invoice.createMany({
        data: [
          {
            subscriptionId: subscription.id,
            invoiceNumber: 'INV-ORG-001',
            amount: 4500,
            currency: 'JPY',
            status: 'PAID',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            dueDate: new Date(),
          },
          {
            subscriptionId: subscription.id,
            invoiceNumber: 'INV-ORG-002',
            amount: 4500,
            currency: 'JPY',
            status: 'PAID',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            dueDate: new Date(),
          },
        ],
      });

      authenticateAs(testUser);

      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/invoices`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      // レスポンス構造: { invoices: [], total, page, limit, totalPages }
      expect(response.body.invoices).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });
  });

  // ============================================
  // E2E: 組織課金フロー
  // ============================================

  describe('E2E: 組織課金フロー', () => {
    it('組織作成→支払い方法登録→TEAM契約→メンバー追加→数量同期→キャンセル', async () => {
      // 1. 支払い方法を登録
      const customer = await mockGateway.createCustomer(testUser.email, { organizationId: testOrg.id });
      await prisma.organization.update({
        where: { id: testOrg.id },
        data: {
          paymentCustomerId: customer.id,
          billingEmail: testUser.email,
        },
      });

      authenticateAs(testUser);

      const pmResponse = await request(app)
        .post(`/api/organizations/${testOrg.id}/payment-methods`)
        .send({ token: 'tok_visa' });

      expect(pmResponse.status).toBe(201);
      const paymentMethodId = pmResponse.body.paymentMethod.id;

      // 2. TEAMプラン契約
      const subResponse = await request(app)
        .post(`/api/organizations/${testOrg.id}/subscription`)
        .send({
          billingCycle: 'MONTHLY',
          paymentMethodId,
        });

      expect(subResponse.status).toBe(201);
      expect(subResponse.body.subscription.plan).toBe('TEAM');
      expect(subResponse.body.subscription.quantity).toBe(1);

      // 3. メンバー追加
      const member2 = await createTestUser({ email: 'e2e-member@example.com' });
      await createTestOrgMember(testOrg.id, member2.id, 'MEMBER');

      // 4. サブスクリプション取得（quantity確認）
      const getSubResponse = await request(app)
        .get(`/api/organizations/${testOrg.id}/subscription`);

      expect(getSubResponse.status).toBe(200);
      expect(getSubResponse.body.subscription.quantity).toBe(2);

      // 5. キャンセル予約
      const cancelResponse = await request(app)
        .delete(`/api/organizations/${testOrg.id}/subscription`);

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.subscription.cancelAtPeriodEnd).toBe(true);

      // 6. キャンセル予約解除
      const reactivateResponse = await request(app)
        .post(`/api/organizations/${testOrg.id}/subscription/reactivate`);

      expect(reactivateResponse.status).toBe(200);
      expect(reactivateResponse.body.subscription.cancelAtPeriodEnd).toBe(false);
    });
  });
});
