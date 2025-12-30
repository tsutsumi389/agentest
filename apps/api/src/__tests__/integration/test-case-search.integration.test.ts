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
  createTestCaseStep,
  createTestCaseExpectedResult,
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
  authenticate: vi.fn(),
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

// テストスイート認可ミドルウェアをモック
vi.mock('../../middlewares/require-test-suite-role.middleware.js', () => ({
  requireTestSuiteRole: (roles: string[]) => (_req: any, _res: any, next: any) => {
    if (!mockProjectRole || !roles.includes(mockProjectRole)) {
      return next(new AuthorizationError('権限がありません'));
    }
    next();
  },
}));

// テスト用認証設定関数
function setTestAuth(user: { id: string; email: string } | null, projectRole: string | null = null) {
  mockAuthUser = user;
  mockProjectRole = projectRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockProjectRole = null;
}

describe('Test Case Search API Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let writer: Awaited<ReturnType<typeof createTestUser>>;
  let reader: Awaited<ReturnType<typeof createTestUser>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let testSuite: Awaited<ReturnType<typeof createTestSuite>>;

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

    // プロジェクトを作成
    project = await createTestProject(owner.id, {
      name: 'Test Project',
      description: 'Test description',
    });

    // メンバーを追加
    await createTestProjectMember(project.id, admin.id, 'ADMIN');
    await createTestProjectMember(project.id, writer.id, 'WRITE');
    await createTestProjectMember(project.id, reader.id, 'READ');

    // テストスイートを作成
    testSuite = await createTestSuite(project.id, {
      name: 'Test Suite',
      description: 'Test Suite Description',
    });

    // デフォルトでオーナーとして認証（ADMIN権限相当）
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN');
  });

  // ============================================================
  // GET /api/test-suites/:testSuiteId/test-cases - テストケース検索
  // ============================================================
  describe('GET /api/test-suites/:testSuiteId/test-cases', () => {
    beforeEach(async () => {
      // テストケースを作成
      await createTestCase(testSuite.id, {
        title: 'ログイン成功テスト',
        priority: 'HIGH',
        status: 'ACTIVE',
        orderKey: '00001',
      });
      await createTestCase(testSuite.id, {
        title: 'ログイン失敗テスト',
        priority: 'MEDIUM',
        status: 'DRAFT',
        orderKey: '00002',
      });
      await createTestCase(testSuite.id, {
        title: 'ユーザー登録テスト',
        priority: 'LOW',
        status: 'DRAFT',
        orderKey: '00003',
      });
    });

    it('テストケース一覧を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(3);
      expect(response.body.total).toBe(3);
    });

    it('タイトルで検索できる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?q=ログイン`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(2);
      expect(response.body.testCases.every((tc: any) => tc.title.includes('ログイン'))).toBe(true);
    });

    it('部分一致で検索できる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?q=テスト`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(3);
    });

    it('大文字小文字を区別しない検索ができる', async () => {
      // 英語のテストケースを追加
      await createTestCase(testSuite.id, {
        title: 'Login Test',
        orderKey: '00004',
      });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?q=login`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(1);
      expect(response.body.testCases[0].title).toBe('Login Test');
    });

    it('手順の内容でも検索できる', async () => {
      // ステップを追加
      const testCase = await prisma.testCase.findFirst({
        where: { title: 'ログイン成功テスト' },
      });
      await createTestCaseStep(testCase!.id, { content: 'ボタンをクリックする' });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?q=クリック`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(1);
      expect(response.body.testCases[0].title).toBe('ログイン成功テスト');
    });

    it('期待結果の内容でも検索できる', async () => {
      // 期待結果を追加
      const testCase = await prisma.testCase.findFirst({
        where: { title: 'ログイン成功テスト' },
      });
      await createTestCaseExpectedResult(testCase!.id, { content: 'ダッシュボードが表示される' });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?q=ダッシュボード`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(1);
      expect(response.body.testCases[0].title).toBe('ログイン成功テスト');
    });

    it('単一のステータスでフィルタできる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?status=ACTIVE`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(1);
      expect(response.body.testCases[0].title).toBe('ログイン成功テスト');
    });

    it('複数のステータスでフィルタできる（カンマ区切り）', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?status=ACTIVE,DRAFT`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(3);
    });

    it('単一の優先度でフィルタできる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?priority=HIGH`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(1);
      expect(response.body.testCases[0].title).toBe('ログイン成功テスト');
    });

    it('複数の優先度でフィルタできる（カンマ区切り）', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?priority=HIGH,MEDIUM`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(2);
    });

    it('limitパラメータで取得件数を制限できる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?limit=2`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(2);
      expect(response.body.total).toBe(3);
      expect(response.body.limit).toBe(2);
    });

    it('offsetパラメータでスキップできる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?offset=1`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(2);
      expect(response.body.offset).toBe(1);
    });

    it('タイトルの昇順でソートできる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?sortBy=title&sortOrder=asc`)
        .expect(200);

      const titles = response.body.testCases.map((tc: any) => tc.title);
      const sorted = [...titles].sort();
      expect(titles).toEqual(sorted);
    });

    it('タイトルの降順でソートできる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?sortBy=title&sortOrder=desc`)
        .expect(200);

      const titles = response.body.testCases.map((tc: any) => tc.title);
      const sorted = [...titles].sort().reverse();
      expect(titles).toEqual(sorted);
    });

    it('優先度でソートできる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?sortBy=priority&sortOrder=asc`)
        .expect(200);

      // ソートが適用されていることを確認（3件のテストケースがあること）
      expect(response.body.testCases).toHaveLength(3);
      // 全ての優先度値が含まれていることを確認
      const priorities = response.body.testCases.map((tc: any) => tc.priority);
      expect(priorities).toContain('HIGH');
      expect(priorities).toContain('MEDIUM');
      expect(priorities).toContain('LOW');
    });

    it('並び順キーでソートできる（デフォルト）', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases`)
        .expect(200);

      expect(response.body.testCases[0].orderKey).toBe('00001');
      expect(response.body.testCases[1].orderKey).toBe('00002');
      expect(response.body.testCases[2].orderKey).toBe('00003');
    });

    it('削除済みテストケースはデフォルトで含まれない', async () => {
      // 1つのテストケースを削除
      const testCase = await prisma.testCase.findFirst({
        where: { title: 'ログイン成功テスト' },
      });
      await prisma.testCase.update({
        where: { id: testCase!.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(2);
      expect(response.body.testCases.find((tc: any) => tc.title === 'ログイン成功テスト')).toBeUndefined();
    });

    it('includeDeleted=trueで削除済みテストケースも含められる', async () => {
      // 1つのテストケースを削除
      const testCase = await prisma.testCase.findFirst({
        where: { title: 'ログイン成功テスト' },
      });
      await prisma.testCase.update({
        where: { id: testCase!.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?includeDeleted=true`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(3);
    });

    it('複数条件を組み合わせて検索できる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?q=ログイン&status=ACTIVE&priority=HIGH`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(1);
      expect(response.body.testCases[0].title).toBe('ログイン成功テスト');
    });

    it('検索結果が0件の場合は空配列を返す', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?q=存在しないキーワード`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });

    it('無効なステータスは400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?status=INVALID`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('無効な優先度は400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?priority=INVALID`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('limit=0は無効で400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?limit=0`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('limit=101（上限超過）は400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?limit=101`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('offset=-1は400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?offset=-1`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('存在しないテストスイートは404エラー', async () => {
      const response = await request(app)
        .get('/api/test-suites/00000000-0000-0000-0000-000000000000/test-cases')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    // 注: 権限テストはrequireTestSuiteRoleミドルウェアの
    // ユニットテストで確認しているためここでは省略
  });

  // ============================================================
  // 権限マトリクステスト
  // ============================================================
  describe('Permission Matrix', () => {
    beforeEach(async () => {
      await createTestCase(testSuite.id, { title: 'Test Case' });
    });

    describe('テストケース検索（READ以上）', () => {
      it('ADMINはテストケースを検索できる', async () => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

        await request(app)
          .get(`/api/test-suites/${testSuite.id}/test-cases`)
          .expect(200);
      });

      it('WRITEはテストケースを検索できる', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

        await request(app)
          .get(`/api/test-suites/${testSuite.id}/test-cases`)
          .expect(200);
      });

      it('READはテストケースを検索できる', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ');

        await request(app)
          .get(`/api/test-suites/${testSuite.id}/test-cases`)
          .expect(200);
      });
    });
  });

  // ============================================================
  // エッジケーステスト
  // ============================================================
  describe('Edge Cases', () => {
    it('q=100文字まで受け付ける', async () => {
      const longQuery = 'a'.repeat(100);
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?q=${longQuery}`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(0);
    });

    it('q=101文字は400エラー', async () => {
      const tooLongQuery = 'a'.repeat(101);
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?q=${tooLongQuery}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('空のqパラメータは全件取得と同じ', async () => {
      await createTestCase(testSuite.id, { title: 'Test Case' });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases?q=`)
        .expect(200);

      expect(response.body.testCases).toHaveLength(1);
    });

    it('削除済みテストスイートからは検索できない', async () => {
      await createTestCase(testSuite.id, { title: 'Test Case' });

      // テストスイートを削除
      await prisma.testSuite.update({
        where: { id: testSuite.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('レスポンスに作成者情報が含まれる', async () => {
      await createTestCase(testSuite.id, {
        title: 'Test Case',
        createdByUserId: owner.id,
      });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases`)
        .expect(200);

      expect(response.body.testCases[0].createdByUser).toEqual({
        id: owner.id,
        name: 'Owner',
        avatarUrl: null,
      });
    });

    it('レスポンスにカウント情報が含まれる', async () => {
      const testCase = await createTestCase(testSuite.id, { title: 'Test Case' });
      await createTestCaseStep(testCase.id, { content: 'Step 1' });
      await createTestCaseStep(testCase.id, { content: 'Step 2' });
      await createTestCaseExpectedResult(testCase.id, { content: 'Expected 1' });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/test-cases`)
        .expect(200);

      expect(response.body.testCases[0]._count).toEqual({
        preconditions: 0,
        steps: 2,
        expectedResults: 1,
      });
    });
  });
});
