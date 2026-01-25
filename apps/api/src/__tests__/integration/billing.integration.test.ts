import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestPaymentMethod,
  createTestSubscription,
  cleanupTestData,
} from './test-helpers.js';
import { AuthenticationError } from '@agentest/shared';
// 注意: createAppは動的インポートを使用（サービス初期化前にMockGatewayを設定するため）
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
 * @param user テストユーザー
 * @param overrides プランなどのオーバーライド
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

describe('Billing API Integration Tests', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let mockGateway: MockGateway;

  beforeAll(async () => {
    // モックゲートウェイを設定（createApp前に呼び出す必要がある）
    // サービスのコンストラクタでゲートウェイが取得されるため
    mockGateway = new MockGateway();
    setPaymentGateway(mockGateway);
    // 動的インポートでアプリを作成（モックゲートウェイが設定された後）
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

    // テストユーザーを作成
    testUser = await createTestUser({
      email: 'billing-test@example.com',
      name: 'Billing Test User',
      plan: 'FREE',
    });
  });

  describe('GET /api/users/:userId/subscription', () => {
    it('サブスクリプションがない場合はnullを返す', async () => {
      authenticateAs(testUser);

      const response = await request(app).get(`/api/users/${testUser.id}/subscription`);

      expect(response.status).toBe(200);
      expect(response.body.subscription).toBeNull();
    });

    it('PROプランのサブスクリプションを取得できる', async () => {
      await createTestSubscription({
        userId: testUser.id,
        plan: 'PRO',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
      });

      authenticateAs(testUser, { plan: 'PRO' });

      const response = await request(app).get(`/api/users/${testUser.id}/subscription`);

      expect(response.status).toBe(200);
      expect(response.body.subscription).toBeDefined();
      expect(response.body.subscription.plan).toBe('PRO');
      expect(response.body.subscription.billingCycle).toBe('MONTHLY');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app).get(`/api/users/${testUser.id}/subscription`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/users/:userId/subscription', () => {
    it('FREE→PROへのアップグレードに成功する', async () => {
      const paymentMethod = await createTestPaymentMethod(testUser.id, {
        isDefault: true,
      });

      await prisma.user.update({
        where: { id: testUser.id },
        data: { paymentCustomerId: 'cus_test_123' },
      });

      await mockGateway.createCustomer(testUser.email, { userId: testUser.id });
      authenticateAs(testUser);

      const response = await request(app)
        .post(`/api/users/${testUser.id}/subscription`)
        .send({
          plan: 'PRO',
          billingCycle: 'MONTHLY',
          paymentMethodId: paymentMethod.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.subscription).toBeDefined();
      expect(response.body.subscription.plan).toBe('PRO');
      expect(response.body.subscription.billingCycle).toBe('MONTHLY');
      expect(response.body.subscription.cancelAtPeriodEnd).toBe(false);
    });

    it('年額プランでアップグレードに成功する', async () => {
      const paymentMethod = await createTestPaymentMethod(testUser.id, {
        isDefault: true,
      });

      await prisma.user.update({
        where: { id: testUser.id },
        data: { paymentCustomerId: 'cus_test_123' },
      });

      await mockGateway.createCustomer(testUser.email, { userId: testUser.id });
      authenticateAs(testUser);

      const response = await request(app)
        .post(`/api/users/${testUser.id}/subscription`)
        .send({
          plan: 'PRO',
          billingCycle: 'YEARLY',
          paymentMethodId: paymentMethod.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.subscription.billingCycle).toBe('YEARLY');
    });

    it('支払い方法がない場合は404エラー', async () => {
      authenticateAs(testUser);

      const response = await request(app)
        .post(`/api/users/${testUser.id}/subscription`)
        .send({
          plan: 'PRO',
          billingCycle: 'MONTHLY',
          paymentMethodId: '00000000-0000-0000-0000-000000000000',
        });

      expect(response.status).toBe(404);
    });

    it('既にPROプランの場合は400エラー', async () => {
      await createTestSubscription({
        userId: testUser.id,
        plan: 'PRO',
        status: 'ACTIVE',
      });

      const paymentMethod = await createTestPaymentMethod(testUser.id);
      authenticateAs(testUser, { plan: 'PRO' });

      const response = await request(app)
        .post(`/api/users/${testUser.id}/subscription`)
        .send({
          plan: 'PRO',
          billingCycle: 'MONTHLY',
          paymentMethodId: paymentMethod.id,
        });

      expect(response.status).toBe(400);
    });

    it('無効なプランを指定した場合は400エラー', async () => {
      const paymentMethod = await createTestPaymentMethod(testUser.id);
      authenticateAs(testUser);

      const response = await request(app)
        .post(`/api/users/${testUser.id}/subscription`)
        .send({
          plan: 'INVALID',
          billingCycle: 'MONTHLY',
          paymentMethodId: paymentMethod.id,
        });

      expect(response.status).toBe(400);
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .post(`/api/users/${testUser.id}/subscription`)
        .send({
          plan: 'PRO',
          billingCycle: 'MONTHLY',
          paymentMethodId: '00000000-0000-0000-0000-000000000000',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/users/:userId/subscription', () => {
    it('PRO→FREEへのダウングレード予約に成功する', async () => {
      const subscription = await createTestSubscription({
        userId: testUser.id,
        plan: 'PRO',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      });

      const customer = await mockGateway.createCustomer(testUser.email);
      const gatewaySub = await mockGateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_test',
      });

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { externalId: gatewaySub.id },
      });

      authenticateAs(testUser, { plan: 'PRO' });

      const response = await request(app).delete(`/api/users/${testUser.id}/subscription`);

      expect(response.status).toBe(200);
      expect(response.body.subscription.cancelAtPeriodEnd).toBe(true);
    });

    it('FREEプランはキャンセルできない', async () => {
      await createTestSubscription({
        userId: testUser.id,
        plan: 'FREE',
        status: 'ACTIVE',
      });

      authenticateAs(testUser);

      const response = await request(app).delete(`/api/users/${testUser.id}/subscription`);

      expect(response.status).toBe(400);
    });

    it('既にキャンセル予約されている場合は400エラー', async () => {
      await createTestSubscription({
        userId: testUser.id,
        plan: 'PRO',
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
      });

      authenticateAs(testUser, { plan: 'PRO' });

      const response = await request(app).delete(`/api/users/${testUser.id}/subscription`);

      expect(response.status).toBe(400);
    });

    it('サブスクリプションがない場合は404エラー', async () => {
      authenticateAs(testUser);

      const response = await request(app).delete(`/api/users/${testUser.id}/subscription`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/users/:userId/subscription/reactivate', () => {
    it('ダウングレード予約のキャンセルに成功する', async () => {
      const subscription = await createTestSubscription({
        userId: testUser.id,
        plan: 'PRO',
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
      });

      const customer = await mockGateway.createCustomer(testUser.email);
      const gatewaySub = await mockGateway.createSubscription({
        customerId: customer.id,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        paymentMethodId: 'pm_test',
      });
      await mockGateway.cancelSubscription(gatewaySub.id, true);

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { externalId: gatewaySub.id },
      });

      authenticateAs(testUser, { plan: 'PRO' });

      const response = await request(app).post(`/api/users/${testUser.id}/subscription/reactivate`);

      expect(response.status).toBe(200);
      expect(response.body.subscription.cancelAtPeriodEnd).toBe(false);
    });

    it('キャンセル予約されていない場合は400エラー', async () => {
      await createTestSubscription({
        userId: testUser.id,
        plan: 'PRO',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      });

      authenticateAs(testUser, { plan: 'PRO' });

      const response = await request(app).post(`/api/users/${testUser.id}/subscription/reactivate`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/users/:userId/payment-methods', () => {
    it('支払い方法一覧を取得できる', async () => {
      await createTestPaymentMethod(testUser.id, {
        brand: 'visa',
        last4: '4242',
        isDefault: true,
      });
      await createTestPaymentMethod(testUser.id, {
        brand: 'mastercard',
        last4: '5555',
        isDefault: false,
      });

      authenticateAs(testUser);

      const response = await request(app).get(`/api/users/${testUser.id}/payment-methods`);

      expect(response.status).toBe(200);
      expect(response.body.paymentMethods).toHaveLength(2);
      expect(response.body.paymentMethods[0].isDefault).toBe(true);
    });

    it('支払い方法がない場合は空配列を返す', async () => {
      authenticateAs(testUser);

      const response = await request(app).get(`/api/users/${testUser.id}/payment-methods`);

      expect(response.status).toBe(200);
      expect(response.body.paymentMethods).toEqual([]);
    });
  });

  describe('POST /api/users/:userId/payment-methods', () => {
    it('支払い方法を追加できる', async () => {
      const customer = await mockGateway.createCustomer(testUser.email, { userId: testUser.id });
      await prisma.user.update({
        where: { id: testUser.id },
        data: { paymentCustomerId: customer.id },
      });

      authenticateAs(testUser);

      const response = await request(app)
        .post(`/api/users/${testUser.id}/payment-methods`)
        .send({ token: 'tok_visa' });

      expect(response.status).toBe(201);
      expect(response.body.paymentMethod).toBeDefined();
      expect(response.body.paymentMethod.brand).toBe('visa');
      expect(response.body.paymentMethod.last4).toBe('4242');
      expect(response.body.paymentMethod.isDefault).toBe(true);
    });

    it('2番目以降の支払い方法はデフォルトにならない', async () => {
      await createTestPaymentMethod(testUser.id, { isDefault: true });

      const customer = await mockGateway.createCustomer(testUser.email, { userId: testUser.id });
      await prisma.user.update({
        where: { id: testUser.id },
        data: { paymentCustomerId: customer.id },
      });

      authenticateAs(testUser);

      const response = await request(app)
        .post(`/api/users/${testUser.id}/payment-methods`)
        .send({ token: 'tok_mastercard' });

      expect(response.status).toBe(201);
      expect(response.body.paymentMethod.isDefault).toBe(false);
    });

    it('トークンがない場合は400エラー', async () => {
      authenticateAs(testUser);

      const response = await request(app)
        .post(`/api/users/${testUser.id}/payment-methods`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/users/:userId/payment-methods/:paymentMethodId', () => {
    it('支払い方法を削除できる', async () => {
      await createTestPaymentMethod(testUser.id, { isDefault: true });
      const paymentMethod = await createTestPaymentMethod(testUser.id, { isDefault: false });

      authenticateAs(testUser);

      const response = await request(app)
        .delete(`/api/users/${testUser.id}/payment-methods/${paymentMethod.id}`);

      expect(response.status).toBe(204);

      const remaining = await prisma.paymentMethod.findMany({
        where: { userId: testUser.id },
      });
      expect(remaining).toHaveLength(1);
    });

    it('他に支払い方法がある場合デフォルトは削除できない', async () => {
      const defaultMethod = await createTestPaymentMethod(testUser.id, { isDefault: true });
      await createTestPaymentMethod(testUser.id, { isDefault: false });

      authenticateAs(testUser);

      const response = await request(app)
        .delete(`/api/users/${testUser.id}/payment-methods/${defaultMethod.id}`);

      expect(response.status).toBe(400);
    });

    it('唯一の支払い方法（デフォルト）は削除できる', async () => {
      const paymentMethod = await createTestPaymentMethod(testUser.id, { isDefault: true });

      authenticateAs(testUser);

      const response = await request(app)
        .delete(`/api/users/${testUser.id}/payment-methods/${paymentMethod.id}`);

      expect(response.status).toBe(204);
    });

    it('存在しない支払い方法は404エラー', async () => {
      authenticateAs(testUser);

      const response = await request(app)
        .delete(`/api/users/${testUser.id}/payment-methods/00000000-0000-0000-0000-000000000000`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/users/:userId/payment-methods/:paymentMethodId/default', () => {
    it('デフォルト支払い方法を設定できる', async () => {
      const customer = await mockGateway.createCustomer(testUser.email, { userId: testUser.id });
      await prisma.user.update({
        where: { id: testUser.id },
        data: { paymentCustomerId: customer.id },
      });

      const gatewayPm1 = await mockGateway.attachPaymentMethod(customer.id, 'tok_visa');
      const gatewayPm2 = await mockGateway.attachPaymentMethod(customer.id, 'tok_mastercard');

      await createTestPaymentMethod(testUser.id, {
        externalId: gatewayPm1.id,
        isDefault: true,
      });
      const newDefault = await createTestPaymentMethod(testUser.id, {
        externalId: gatewayPm2.id,
        isDefault: false,
      });

      authenticateAs(testUser);

      const response = await request(app)
        .put(`/api/users/${testUser.id}/payment-methods/${newDefault.id}/default`);

      expect(response.status).toBe(200);
      expect(response.body.paymentMethod.isDefault).toBe(true);

      const methods = await prisma.paymentMethod.findMany({
        where: { userId: testUser.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(methods[0].isDefault).toBe(false);
      expect(methods[1].isDefault).toBe(true);
    });

    it('存在しない支払い方法は404エラー', async () => {
      authenticateAs(testUser);

      const response = await request(app)
        .put(`/api/users/${testUser.id}/payment-methods/00000000-0000-0000-0000-000000000000/default`);

      expect(response.status).toBe(404);
    });
  });
});
