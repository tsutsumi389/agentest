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
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError } from '@agentest/shared';
import { createApp } from '../../app.js';

// グローバルな認証状態（モック用）
let mockAuthUser: { id: string; email: string } | null = null;
let mockProjectRole: string | null = null;
let mockTestSuiteRole: string | null = null;

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

// requireTestSuiteRoleのモック
vi.mock('../../middleware/require-test-suite-role.js', () => ({
  requireTestSuiteRole: (roles: string[]) => (_req: any, _res: any, next: any) => {
    if (!mockTestSuiteRole || !roles.includes(mockTestSuiteRole)) {
      return next(new AuthorizationError('権限がありません'));
    }
    next();
  },
}));

// テスト用認証設定関数
function setTestAuth(
  user: { id: string; email: string } | null,
  projectRole: string | null = null,
  testSuiteRole: string | null = null
) {
  mockAuthUser = user;
  mockProjectRole = projectRole;
  mockTestSuiteRole = testSuiteRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockProjectRole = null;
  mockTestSuiteRole = null;
}

describe('Suggestion API Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
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
    reader = await createTestUser({ email: 'reader@example.com', name: 'Reader' });

    // プロジェクトを作成
    project = await createTestProject(owner.id, {
      name: 'Test Project',
      description: 'Test description',
    });

    // メンバーを追加
    await createTestProjectMember(project.id, reader.id, 'READ');

    // テストスイートを作成
    testSuite = await createTestSuite(project.id, {
      name: 'Main Test Suite',
      description: 'Main suite description',
    });

    // デフォルトでオーナーとして認証
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN', 'ADMIN');
  });

  // ============================================================
  // GET /api/projects/:projectId/suggestions/test-suites
  // ============================================================
  describe('GET /api/projects/:projectId/suggestions/test-suites', () => {
    beforeEach(async () => {
      // テストスイートを追加作成
      await createTestSuite(project.id, {
        name: 'Login Test Suite',
        description: 'Tests for login functionality',
      });
      await createTestSuite(project.id, {
        name: 'Payment Suite',
        description: 'Payment processing tests',
      });
    });

    it('テストスイートサジェストを取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .get(`/api/projects/${project.id}/suggestions/test-suites`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(3);
      // 必要なフィールドのみ返される
      expect(response.body.suggestions[0]).toHaveProperty('id');
      expect(response.body.suggestions[0]).toHaveProperty('name');
      expect(response.body.suggestions[0]).toHaveProperty('description');
      expect(response.body.suggestions[0]).toHaveProperty('status');
      // 余分なフィールドは含まれない
      expect(response.body.suggestions[0]).not.toHaveProperty('createdAt');
      expect(response.body.suggestions[0]).not.toHaveProperty('projectId');
    });

    it('クエリで絞り込みできる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/suggestions/test-suites?q=Login`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(1);
      expect(response.body.suggestions[0].name).toBe('Login Test Suite');
    });

    it('大文字小文字を区別しない検索ができる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/suggestions/test-suites?q=login`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(1);
      expect(response.body.suggestions[0].name).toBe('Login Test Suite');
    });

    it('descriptionでも検索できる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/suggestions/test-suites?q=payment`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(1);
      expect(response.body.suggestions[0].name).toBe('Payment Suite');
    });

    it('limitで取得件数を制限できる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/suggestions/test-suites?limit=2`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(2);
    });

    it('削除済みエンティティは含まれない', async () => {
      // 1つのスイートを削除
      await prisma.testSuite.update({
        where: { id: testSuite.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}/suggestions/test-suites`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(2);
      expect(response.body.suggestions.find((s: any) => s.id === testSuite.id)).toBeUndefined();
    });

    it('READロールでもアクセスできる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      await request(app).get(`/api/projects/${project.id}/suggestions/test-suites`).expect(200);
    });

    it('未認証は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/projects/${project.id}/suggestions/test-suites`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('権限なしは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, null, null);

      const response = await request(app)
        .get(`/api/projects/${project.id}/suggestions/test-suites`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('存在しないプロジェクトIDは404エラー', async () => {
      const response = await request(app)
        .get('/api/projects/00000000-0000-0000-0000-000000000000/suggestions/test-suites')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('limit=0は無効で400エラー', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/suggestions/test-suites?limit=0`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('limit=51（上限超過）は400エラー', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/suggestions/test-suites?limit=51`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('q=101文字は400エラー', async () => {
      const tooLongQuery = 'a'.repeat(101);
      const response = await request(app)
        .get(`/api/projects/${project.id}/suggestions/test-suites?q=${tooLongQuery}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('デフォルトでlimit=10が適用される', async () => {
      // 15件のテストスイートを作成
      for (let i = 0; i < 15; i++) {
        await createTestSuite(project.id, { name: `Suite ${i}` });
      }

      const response = await request(app)
        .get(`/api/projects/${project.id}/suggestions/test-suites`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(10);
    });
  });

  // ============================================================
  // GET /api/test-suites/:testSuiteId/suggestions/test-cases
  // ============================================================
  describe('GET /api/test-suites/:testSuiteId/suggestions/test-cases', () => {
    beforeEach(async () => {
      // テストケースを作成
      await createTestCase(testSuite.id, {
        title: 'Login Success Test',
        description: 'Test successful login flow',
        priority: 'HIGH',
      });
      await createTestCase(testSuite.id, {
        title: 'Login Failure Test',
        description: 'Test failed login attempt',
        priority: 'MEDIUM',
      });
      await createTestCase(testSuite.id, {
        title: 'Password Reset',
        description: 'Test password reset flow',
        priority: 'LOW',
      });
    });

    it('テストケースサジェストを取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(3);
      // 必要なフィールドのみ返される
      expect(response.body.suggestions[0]).toHaveProperty('id');
      expect(response.body.suggestions[0]).toHaveProperty('title');
      expect(response.body.suggestions[0]).toHaveProperty('description');
      expect(response.body.suggestions[0]).toHaveProperty('priority');
      expect(response.body.suggestions[0]).toHaveProperty('status');
      // 余分なフィールドは含まれない
      expect(response.body.suggestions[0]).not.toHaveProperty('createdAt');
      expect(response.body.suggestions[0]).not.toHaveProperty('testSuiteId');
    });

    it('クエリで絞り込みできる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases?q=Success`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(1);
      expect(response.body.suggestions[0].title).toBe('Login Success Test');
    });

    it('大文字小文字を区別しない検索ができる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases?q=login`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(2); // Login Success Test, Login Failure Test
    });

    it('descriptionでも検索できる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases?q=reset`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(1);
      expect(response.body.suggestions[0].title).toBe('Password Reset');
    });

    it('limitで取得件数を制限できる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases?limit=2`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(2);
    });

    it('削除済みエンティティは含まれない', async () => {
      // 1つのテストケースを削除
      const testCase = await prisma.testCase.findFirst({
        where: { title: 'Login Success Test' },
      });
      await prisma.testCase.update({
        where: { id: testCase!.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(2);
      expect(
        response.body.suggestions.find((s: any) => s.title === 'Login Success Test')
      ).toBeUndefined();
    });

    it('READロールでもアクセスできる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      await request(app).get(`/api/test-suites/${testSuite.id}/suggestions/test-cases`).expect(200);
    });

    it('未認証は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('権限なしは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, null, null);

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('存在しないテストスイートIDは404エラー', async () => {
      const response = await request(app)
        .get('/api/test-suites/00000000-0000-0000-0000-000000000000/suggestions/test-cases')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('limit=0は無効で400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases?limit=0`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('limit=51（上限超過）は400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases?limit=51`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('q=101文字は400エラー', async () => {
      const tooLongQuery = 'a'.repeat(101);
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases?q=${tooLongQuery}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('デフォルトでlimit=10が適用される', async () => {
      // 15件のテストケースを作成
      for (let i = 0; i < 15; i++) {
        await createTestCase(testSuite.id, { title: `Test Case ${i}` });
      }

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases`)
        .expect(200);

      expect(response.body.suggestions).toHaveLength(10);
    });
  });

  // ============================================================
  // 権限マトリクステスト
  // ============================================================
  describe('Permission Matrix', () => {
    describe('テストスイートサジェスト（READ以上）', () => {
      it('ADMINはテストスイートサジェストを取得できる', async () => {
        setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN', 'ADMIN');

        await request(app).get(`/api/projects/${project.id}/suggestions/test-suites`).expect(200);
      });

      it('WRITEはテストスイートサジェストを取得できる', async () => {
        setTestAuth({ id: owner.id, email: owner.email }, 'WRITE', 'WRITE');

        await request(app).get(`/api/projects/${project.id}/suggestions/test-suites`).expect(200);
      });

      it('READはテストスイートサジェストを取得できる', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

        await request(app).get(`/api/projects/${project.id}/suggestions/test-suites`).expect(200);
      });
    });

    describe('テストケースサジェスト（READ以上）', () => {
      it('ADMINはテストケースサジェストを取得できる', async () => {
        setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN', 'ADMIN');

        await request(app)
          .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases`)
          .expect(200);
      });

      it('WRITEはテストケースサジェストを取得できる', async () => {
        setTestAuth({ id: owner.id, email: owner.email }, 'WRITE', 'WRITE');

        await request(app)
          .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases`)
          .expect(200);
      });

      it('READはテストケースサジェストを取得できる', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

        await request(app)
          .get(`/api/test-suites/${testSuite.id}/suggestions/test-cases`)
          .expect(200);
      });
    });
  });
});
