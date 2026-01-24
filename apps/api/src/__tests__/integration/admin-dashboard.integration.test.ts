import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import bcryptjs from 'bcryptjs';
import { prisma } from '@agentest/db';
import {
  createTestAdminUser,
  createTestAdminSession,
  createTestUser,
  createTestOrganization,
  createTestProject,
  createTestSuite,
  createTestEnvironment,
  createTestExecution,
  createTestCase,
  createTestExecutionTestSuite,
  createTestExecutionTestCase,
  createTestExecutionTestCaseExpectedResult,
  createTestCaseExpectedResult,
  createTestExecutionExpectedResult,
  createTestSubscription,
  createTestInvoice,
  cleanupTestData,
} from './test-helpers.js';
import { createApp } from '../../app.js';
import { invalidateAdminDashboardCache } from '../../lib/redis-store.js';

describe('Admin Dashboard API Integration Tests', () => {
  let app: Express;
  let testAdminUser: Awaited<ReturnType<typeof createTestAdminUser>>;
  let testAdminSession: Awaited<ReturnType<typeof createTestAdminSession>>;
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();
    // ダッシュボードキャッシュをクリア
    await invalidateAdminDashboardCache();

    // テスト用の管理者ユーザーとセッションを作成
    const passwordHash = bcryptjs.hashSync(testPassword, 12);
    testAdminUser = await createTestAdminUser({
      email: 'admin@example.com',
      name: 'Test Admin',
      passwordHash,
    });

    testAdminSession = await createTestAdminSession(testAdminUser.id, {
      token: 'test-admin-session-token',
    });
  });

  describe('GET /admin/dashboard', () => {
    it('認証済みの管理者がダッシュボード統計を取得できる', async () => {
      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${testAdminSession.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('organizations');
      expect(response.body).toHaveProperty('executions');
      expect(response.body).toHaveProperty('revenue');
      expect(response.body).toHaveProperty('systemHealth');
      expect(response.body).toHaveProperty('fetchedAt');
    });

    it('未認証の場合は401エラーを返す', async () => {
      const response = await request(app)
        .get('/admin/dashboard');

      expect(response.status).toBe(401);
    });

    it('ユーザー統計が正しく集計される', async () => {
      // テストユーザーを作成
      const user1 = await createTestUser({ plan: 'FREE' });
      await createTestUser({ plan: 'PRO' });
      await createTestUser({ plan: 'FREE' });

      // アクティブセッションを作成（30日以内）
      await prisma.session.create({
        data: {
          userId: user1.id,
          token: 'test-token-1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          lastActiveAt: new Date(), // 今日
        },
      });

      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${testAdminSession.token}`);

      expect(response.status).toBe(200);
      expect(response.body.users.total).toBe(3);
      expect(response.body.users.byPlan.free).toBe(2);
      expect(response.body.users.byPlan.pro).toBe(1);
      expect(response.body.users.activeUsers).toBe(1);
    });

    it('組織統計が正しく集計される', async () => {
      // テストユーザーを作成
      const user = await createTestUser();

      // テスト組織を作成
      await createTestOrganization(user.id, { plan: 'TEAM' });
      await createTestOrganization(user.id, { plan: 'ENTERPRISE' });

      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${testAdminSession.token}`);

      expect(response.status).toBe(200);
      expect(response.body.organizations.total).toBe(2);
      expect(response.body.organizations.byPlan.team).toBe(1);
      expect(response.body.organizations.byPlan.enterprise).toBe(1);
    });

    it('テスト実行統計が正しく集計される', async () => {
      // テストユーザーとプロジェクトを作成
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const testSuite = await createTestSuite(project.id);
      const testCase = await createTestCase(testSuite.id);
      const expectedResult = await createTestCaseExpectedResult(testCase.id);
      const environment = await createTestEnvironment(project.id);
      const execution = await createTestExecution(environment.id, testSuite.id);

      // 実行スナップショットを作成
      const executionTestSuite = await createTestExecutionTestSuite(
        execution.id,
        testSuite.id
      );
      const executionTestCase = await createTestExecutionTestCase(
        executionTestSuite.id,
        testCase.id
      );
      const executionExpectedResult = await createTestExecutionTestCaseExpectedResult(
        executionTestCase.id,
        expectedResult.id
      );

      // 実行結果を作成（1つPASS、1つFAIL）
      await createTestExecutionExpectedResult(
        execution.id,
        executionTestCase.id,
        executionExpectedResult.id,
        { status: 'PASS' }
      );

      // もう1件実行結果を作成
      const testCase2 = await createTestCase(testSuite.id);
      const expectedResult2 = await createTestCaseExpectedResult(testCase2.id);
      const executionTestCase2 = await createTestExecutionTestCase(
        executionTestSuite.id,
        testCase2.id
      );
      const executionExpectedResult2 = await createTestExecutionTestCaseExpectedResult(
        executionTestCase2.id,
        expectedResult2.id
      );
      await createTestExecutionExpectedResult(
        execution.id,
        executionTestCase2.id,
        executionExpectedResult2.id,
        { status: 'FAIL' }
      );

      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${testAdminSession.token}`);

      expect(response.status).toBe(200);
      expect(response.body.executions.totalThisMonth).toBe(2);
      expect(response.body.executions.passCount).toBe(1);
      expect(response.body.executions.failCount).toBe(1);
      expect(response.body.executions.passRate).toBe(50);
    });

    it('収益統計が正しく集計される', async () => {
      // テストユーザーを作成
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // サブスクリプションを作成
      const sub1 = await createTestSubscription({
        userId: user1.id,
        plan: 'PRO',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
      });
      const sub2 = await createTestSubscription({
        userId: user2.id,
        plan: 'TEAM',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
      });

      // インボイスを作成
      await createTestInvoice(sub1.id, { status: 'PAID' });
      await createTestInvoice(sub1.id, { status: 'PENDING' });
      await createTestInvoice(sub2.id, { status: 'FAILED' });

      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${testAdminSession.token}`);

      expect(response.status).toBe(200);
      // MRRの計算: PRO(980) + TEAM(4980) = 5960
      expect(response.body.revenue.mrr).toBe(5960);
      expect(response.body.revenue.invoices.paid).toBe(1);
      expect(response.body.revenue.invoices.pending).toBe(1);
      expect(response.body.revenue.invoices.failed).toBe(1);
    });

    it('システムヘルスにAPIとデータベースが含まれる', async () => {
      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${testAdminSession.token}`);

      expect(response.status).toBe(200);
      expect(response.body.systemHealth.api.status).toBe('healthy');
      expect(response.body.systemHealth.database.status).toBe('healthy');
      // Redis/MinIOはnot_configuredの場合もある
      expect(['healthy', 'unhealthy', 'not_configured']).toContain(
        response.body.systemHealth.redis.status
      );
      expect(['healthy', 'unhealthy', 'not_configured']).toContain(
        response.body.systemHealth.minio.status
      );
    });

    it('fetchedAtがISO 8601形式で返される', async () => {
      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${testAdminSession.token}`);

      expect(response.status).toBe(200);
      // ISO 8601形式のチェック
      const fetchedAt = new Date(response.body.fetchedAt);
      expect(fetchedAt.toISOString()).toBe(response.body.fetchedAt);
    });

    it('VIEWERロールの管理者もアクセスできる', async () => {
      // VIEWERロールの管理者を作成
      const passwordHash = bcryptjs.hashSync(testPassword, 12);
      const viewerAdmin = await createTestAdminUser({
        email: 'viewer@example.com',
        name: 'Viewer Admin',
        passwordHash,
        role: 'VIEWER',
      });
      const viewerSession = await createTestAdminSession(viewerAdmin.id, {
        token: 'viewer-session-token',
      });

      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${viewerSession.token}`);

      expect(response.status).toBe(200);
    });
  });
});
