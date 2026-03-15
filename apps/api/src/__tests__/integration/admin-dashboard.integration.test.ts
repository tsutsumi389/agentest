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
  cleanupTestData,
} from './test-helpers.js';
import { createApp } from '../../app.js';
import { invalidateAdminDashboardCache } from '../../lib/redis-store.js';
import { hashToken } from '../../utils/pkce.js';

describe('Admin Dashboard API Integration Tests', () => {
  let app: Express;
  let testAdminUser: Awaited<ReturnType<typeof createTestAdminUser>>;
  let rawSessionToken: string;
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

    // 生トークンを生成し、ハッシュ化してDBに保存
    rawSessionToken = 'test-admin-session-token';
    await createTestAdminSession(testAdminUser.id, {
      tokenHash: hashToken(rawSessionToken),
    });
  });

  describe('GET /admin/dashboard', () => {
    it('認証済みの管理者がダッシュボード統計を取得できる', async () => {
      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('organizations');
      expect(response.body).toHaveProperty('executions');
      expect(response.body).not.toHaveProperty('systemHealth');
      expect(response.body).toHaveProperty('fetchedAt');
    });

    it('未認証の場合は401エラーを返す', async () => {
      const response = await request(app).get('/admin/dashboard');

      expect(response.status).toBe(401);
    });

    it('ユーザー統計が正しく集計される', async () => {
      // テストユーザーを作成
      const user1 = await createTestUser();
      await createTestUser();
      await createTestUser();

      // アクティブセッションを作成（30日以内）
      await prisma.session.create({
        data: {
          userId: user1.id,
          tokenHash: hashToken('test-token-1'),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          lastActiveAt: new Date(), // 今日
        },
      });

      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.total).toBe(3);
      expect(response.body.users.activeUsers).toBe(1);
    });

    it('組織統計が正しく集計される', async () => {
      // テストユーザーを作成
      const user = await createTestUser();

      // テスト組織を作成
      await createTestOrganization(user.id);
      await createTestOrganization(user.id);

      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.organizations.total).toBe(2);
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
      const executionTestSuite = await createTestExecutionTestSuite(execution.id, testSuite.id);
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
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.executions.totalThisMonth).toBe(2);
      expect(response.body.executions.passCount).toBe(1);
      expect(response.body.executions.failCount).toBe(1);
      expect(response.body.executions.passRate).toBe(50);
    });

    it('fetchedAtがISO 8601形式で返される', async () => {
      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${rawSessionToken}`);

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
      const rawViewerToken = 'viewer-session-token';
      await createTestAdminSession(viewerAdmin.id, {
        tokenHash: hashToken(rawViewerToken),
      });

      const response = await request(app)
        .get('/admin/dashboard')
        .set('Cookie', `admin_session=${rawViewerToken}`);

      expect(response.status).toBe(200);
    });
  });
});
