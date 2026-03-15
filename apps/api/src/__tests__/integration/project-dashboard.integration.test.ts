import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestProjectMember,
  createTestSuite,
  createTestCase,
  createTestExecutionTestSuite,
  createTestExecutionTestCase,
  createTestExecutionTestCaseExpectedResult,
  createTestExecutionExpectedResult,
  createTestCaseHistory,
  createTestReview,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError } from '@agentest/shared';
import { createApp } from '../../app.js';

// グローバルな認証状態（モック用）
let mockAuthUser: { id: string; email: string } | null = null;
let mockProjectRole: string | null = null;

// 認証ミドルウェアをモック
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
  requireProjectRole: (roles: string[]) => (_req: any, _res: any, next: any) => {
    if (!mockProjectRole || !roles.includes(mockProjectRole)) {
      return next(new AuthorizationError('権限がありません'));
    }
    next();
  },
  authenticate:
    (_options: { optional?: boolean } = {}) =>
    (req: any, _res: any, next: any) => {
      if (mockAuthUser) req.user = mockAuthUser;
      next();
    },
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

// テスト用認証設定関数
function setTestAuth(
  user: { id: string; email: string } | null,
  projectRole: string | null = null
) {
  mockAuthUser = user;
  mockProjectRole = projectRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockProjectRole = null;
}

describe('Project Dashboard API Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let writer: Awaited<ReturnType<typeof createTestUser>>;
  let reader: Awaited<ReturnType<typeof createTestUser>>;
  let nonMember: Awaited<ReturnType<typeof createTestUser>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();

    // テストユーザーを作成
    owner = await createTestUser({ email: 'owner@example.com', name: 'Owner' });
    admin = await createTestUser({ email: 'admin@example.com', name: 'Admin' });
    writer = await createTestUser({ email: 'writer@example.com', name: 'Writer' });
    reader = await createTestUser({ email: 'reader@example.com', name: 'Reader' });
    nonMember = await createTestUser({ email: 'nonmember@example.com', name: 'Non Member' });

    // プロジェクトを作成
    project = await createTestProject(owner.id, {
      name: 'Test Project',
      description: 'Test description',
    });

    // メンバーを追加
    await createTestProjectMember(project.id, admin.id, 'ADMIN');
    await createTestProjectMember(project.id, writer.id, 'WRITE');
    await createTestProjectMember(project.id, reader.id, 'READ');

    // デフォルトでオーナーとして認証（ADMIN権限相当）
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN');
  });

  // ============================================================
  // 認証・認可
  // ============================================================
  describe('Authentication & Authorization', () => {
    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app).get(`/api/projects/${project.id}/dashboard`).expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('プロジェクトメンバーでない場合は403エラー', async () => {
      setTestAuth({ id: nonMember.id, email: nonMember.email }, null);

      const response = await request(app).get(`/api/projects/${project.id}/dashboard`).expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('READ権限でダッシュボードを取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).get(`/api/projects/${project.id}/dashboard`).expect(200);

      expect(response.body.dashboard).toBeDefined();
    });

    it('WRITE権限でダッシュボードを取得できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app).get(`/api/projects/${project.id}/dashboard`).expect(200);

      expect(response.body.dashboard).toBeDefined();
    });

    it('ADMIN権限でダッシュボードを取得できる', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      const response = await request(app).get(`/api/projects/${project.id}/dashboard`).expect(200);

      expect(response.body.dashboard).toBeDefined();
    });
  });

  // ============================================================
  // 正常系
  // ============================================================
  describe('Normal Cases', () => {
    it('空のプロジェクトでダッシュボードを取得（全て0/空）', async () => {
      const response = await request(app).get(`/api/projects/${project.id}/dashboard`).expect(200);

      const { dashboard } = response.body;
      expect(dashboard.summary.totalTestSuites).toBe(0);
      expect(dashboard.summary.totalTestCases).toBe(0);
      expect(dashboard.summary.totalExpectedResults).toBe(0);
      expect(dashboard.resultDistribution).toEqual({
        pass: 0,
        fail: 0,
        skipped: 0,
        pending: 0,
      });
      expect(dashboard.recentActivities).toEqual([]);
    });

    it('テストケースがある場合にサマリーを取得', async () => {
      const testSuite = await createTestSuite(project.id, { name: 'Test Suite' });
      const tc1 = await createTestCase(testSuite.id, { title: 'Test Case 1' });
      const tc2 = await createTestCase(testSuite.id, { title: 'Test Case 2' });
      await createTestCase(testSuite.id, { title: 'Test Case 3' });

      // 期待結果を追加
      await prisma.testCaseExpectedResult.create({
        data: { testCaseId: tc1.id, content: 'Expected 1', orderKey: 'a' },
      });
      await prisma.testCaseExpectedResult.create({
        data: { testCaseId: tc2.id, content: 'Expected 2', orderKey: 'a' },
      });

      const response = await request(app).get(`/api/projects/${project.id}/dashboard`).expect(200);

      expect(response.body.dashboard.summary.totalTestSuites).toBe(1);
      expect(response.body.dashboard.summary.totalTestCases).toBe(3);
      expect(response.body.dashboard.summary.totalExpectedResults).toBe(2);
    });

    it('実行結果分布を取得', async () => {
      const testSuite = await createTestSuite(project.id);
      const testCase1 = await createTestCase(testSuite.id);
      const testCase2 = await createTestCase(testSuite.id);
      const expectedResult1 = await prisma.testCaseExpectedResult.create({
        data: { testCaseId: testCase1.id, content: 'Expected 1', orderKey: 'a' },
      });
      const expectedResult2 = await prisma.testCaseExpectedResult.create({
        data: { testCaseId: testCase2.id, content: 'Expected 2', orderKey: 'b' },
      });

      const env = await prisma.projectEnvironment.create({
        data: {
          projectId: project.id,
          name: 'Test Env',
          isDefault: true,
          sortOrder: 0,
        },
      });

      const execution = await prisma.execution.create({
        data: {
          testSuiteId: testSuite.id,
          environmentId: env.id,
        },
      });

      const execTestSuite = await createTestExecutionTestSuite(execution.id, testSuite.id);
      const execTestCase1 = await createTestExecutionTestCase(execTestSuite.id, testCase1.id);
      const execTestCase2 = await createTestExecutionTestCase(execTestSuite.id, testCase2.id);
      const execExpectedResult1 = await createTestExecutionTestCaseExpectedResult(
        execTestCase1.id,
        expectedResult1.id
      );
      const execExpectedResult2 = await createTestExecutionTestCaseExpectedResult(
        execTestCase2.id,
        expectedResult2.id
      );

      await createTestExecutionExpectedResult(
        execution.id,
        execTestCase1.id,
        execExpectedResult1.id,
        { status: 'PASS' }
      );
      await createTestExecutionExpectedResult(
        execution.id,
        execTestCase2.id,
        execExpectedResult2.id,
        { status: 'FAIL' }
      );

      const response = await request(app).get(`/api/projects/${project.id}/dashboard`).expect(200);

      expect(response.body.dashboard.resultDistribution.pass).toBe(1);
      expect(response.body.dashboard.resultDistribution.fail).toBe(1);
    });

    it('最近の活動一覧を取得', async () => {
      const testSuite = await createTestSuite(project.id, { name: 'Suite 1' });
      const testCase = await createTestCase(testSuite.id, { title: 'Test Case 1' });

      // テストケース更新履歴を作成
      await createTestCaseHistory(testCase.id, {
        changedByUserId: owner.id,
        changeType: 'UPDATE',
        createdAt: new Date(),
      });

      // レビューを作成
      await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'SUBMITTED',
        verdict: 'APPROVED',
        submittedAt: new Date(),
      });

      const response = await request(app).get(`/api/projects/${project.id}/dashboard`).expect(200);

      expect(response.body.dashboard.recentActivities.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 境界値
  // ============================================================
  describe('Boundary Cases', () => {
    it('31日前の実行は結果分布に含まれない', async () => {
      const testSuite = await createTestSuite(project.id);
      const testCase = await createTestCase(testSuite.id);
      const expectedResult = await prisma.testCaseExpectedResult.create({
        data: { testCaseId: testCase.id, content: 'Expected', orderKey: 'a' },
      });

      const env = await prisma.projectEnvironment.create({
        data: {
          projectId: project.id,
          name: 'Test Env',
          isDefault: true,
          sortOrder: 0,
        },
      });

      // 31日前の実行を作成
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      const execution = await prisma.execution.create({
        data: {
          testSuiteId: testSuite.id,
          environmentId: env.id,
          createdAt: thirtyOneDaysAgo,
        },
      });

      const execTestSuite = await createTestExecutionTestSuite(execution.id, testSuite.id);
      const execTestCase = await createTestExecutionTestCase(execTestSuite.id, testCase.id);
      const execExpectedResult = await createTestExecutionTestCaseExpectedResult(
        execTestCase.id,
        expectedResult.id
      );
      await createTestExecutionExpectedResult(
        execution.id,
        execTestCase.id,
        execExpectedResult.id,
        { status: 'PASS' }
      );

      const response = await request(app).get(`/api/projects/${project.id}/dashboard`).expect(200);

      // 31日前の実行は過去30日間の統計に含まれない
      expect(response.body.dashboard.resultDistribution.pass).toBe(0);
    });
  });

  // ============================================================
  // 異常系
  // ============================================================
  describe('Error Cases', () => {
    it('存在しないプロジェクトIDは404エラー', async () => {
      const response = await request(app)
        .get('/api/projects/non-existent-project-id/dashboard')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('削除済みプロジェクトは404エラー', async () => {
      // プロジェクトを削除
      await prisma.project.update({
        where: { id: project.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app).get(`/api/projects/${project.id}/dashboard`).expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
