import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestSuite,
  createTestPrecondition,
  createTestCase,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError, NotFoundError } from '@agentest/shared';
import { createApp } from '../../app.js';

// イベント発行のモック
const mockPublishTestSuiteUpdated = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockPublishTestCaseUpdated = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../lib/events.js', () => ({
  publishTestSuiteUpdated: mockPublishTestSuiteUpdated,
  publishTestCaseUpdated: mockPublishTestCaseUpdated,
}));

// ダッシュボード更新のモック
vi.mock('../../lib/redis-publisher.js', () => ({
  publishDashboardUpdated: vi.fn().mockResolvedValue(undefined),
}));

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

// テストスイート権限ミドルウェアをモック
vi.mock('../../middleware/require-test-suite-role.js', () => ({
  requireTestSuiteRole: (roles: string[], _options?: { allowDeletedSuite?: boolean }) => async (req: any, _res: any, next: any) => {
    if (!mockTestSuiteRole || !roles.includes(mockTestSuiteRole)) {
      return next(new AuthorizationError('権限がありません'));
    }
    const testSuiteId = req.params.testSuiteId;
    if (testSuiteId) {
      const testSuite = await prisma.testSuite.findUnique({ where: { id: testSuiteId } });
      if (!testSuite) {
        return next(new NotFoundError('TestSuite', testSuiteId));
      }
    }
    next();
  },
}));

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

describe('Test Suite Events Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
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
    vi.clearAllMocks();

    // テストユーザーを作成
    owner = await createTestUser({ email: 'owner@example.com', name: 'Owner' });

    // プロジェクトを作成
    project = await createTestProject(owner.id, {
      name: 'Test Project',
      description: 'Test description',
    });

    // テストスイートを作成
    testSuite = await createTestSuite(project.id, {
      name: 'Test Suite',
      description: 'Test suite description',
    });

    // デフォルトでオーナーとして認証
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN', 'ADMIN');
  });

  // ============================================================
  // POST /api/test-suites/:id/preconditions - 前提条件追加時のイベント
  // ============================================================
  describe('POST /api/test-suites/:testSuiteId/preconditions', () => {
    it('前提条件追加時にpublishTestSuiteUpdatedが呼ばれる', async () => {
      await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions`)
        .send({ content: 'New precondition' })
        .expect(201);

      expect(mockPublishTestSuiteUpdated).toHaveBeenCalledWith(
        testSuite.id,
        project.id,
        expect.arrayContaining([
          expect.objectContaining({
            field: 'precondition:add',
            oldValue: null,
          }),
        ]),
        expect.objectContaining({
          type: 'user',
          id: owner.id,
        })
      );
    });

    it('イベント発行引数のnewValueに作成された前提条件IDが含まれる', async () => {
      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions`)
        .send({ content: 'New precondition' })
        .expect(201);

      const createdId = response.body.precondition.id;
      const callArgs = mockPublishTestSuiteUpdated.mock.calls[0];
      const changes = callArgs[2];

      expect(changes[0].newValue).toBe(createdId);
    });
  });

  // ============================================================
  // PATCH /api/test-suites/:id/preconditions/:id - 前提条件更新時のイベント
  // ============================================================
  describe('PATCH /api/test-suites/:testSuiteId/preconditions/:preconditionId', () => {
    let precondition: Awaited<ReturnType<typeof createTestPrecondition>>;

    beforeEach(async () => {
      precondition = await createTestPrecondition(testSuite.id, {
        content: 'Original content',
        orderKey: 'a',
      });
    });

    it('前提条件更新時にpublishTestSuiteUpdatedが呼ばれる', async () => {
      await request(app)
        .patch(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
        .send({ content: 'Updated content' })
        .expect(200);

      expect(mockPublishTestSuiteUpdated).toHaveBeenCalledWith(
        testSuite.id,
        project.id,
        expect.arrayContaining([
          expect.objectContaining({
            field: 'precondition:update',
            oldValue: 'Original content',
            newValue: 'Updated content',
          }),
        ]),
        expect.objectContaining({
          type: 'user',
          id: owner.id,
        })
      );
    });
  });

  // ============================================================
  // DELETE /api/test-suites/:id/preconditions/:id - 前提条件削除時のイベント
  // ============================================================
  describe('DELETE /api/test-suites/:testSuiteId/preconditions/:preconditionId', () => {
    let precondition: Awaited<ReturnType<typeof createTestPrecondition>>;

    beforeEach(async () => {
      precondition = await createTestPrecondition(testSuite.id, {
        content: 'To be deleted',
        orderKey: 'a',
      });
    });

    it('前提条件削除時にpublishTestSuiteUpdatedが呼ばれる', async () => {
      await request(app)
        .delete(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
        .expect(204);

      expect(mockPublishTestSuiteUpdated).toHaveBeenCalledWith(
        testSuite.id,
        project.id,
        expect.arrayContaining([
          expect.objectContaining({
            field: 'precondition:delete',
            oldValue: precondition.id,
            newValue: null,
          }),
        ]),
        expect.objectContaining({
          type: 'user',
          id: owner.id,
        })
      );
    });
  });

  // ============================================================
  // POST /api/test-suites/:id/preconditions/reorder - 前提条件並び替え時のイベント
  // ============================================================
  describe('POST /api/test-suites/:testSuiteId/preconditions/reorder', () => {
    let precondition1: Awaited<ReturnType<typeof createTestPrecondition>>;
    let precondition2: Awaited<ReturnType<typeof createTestPrecondition>>;

    beforeEach(async () => {
      precondition1 = await createTestPrecondition(testSuite.id, { content: 'First', orderKey: 'a' });
      precondition2 = await createTestPrecondition(testSuite.id, { content: 'Second', orderKey: 'b' });
    });

    it('前提条件並び替え時にpublishTestSuiteUpdatedが呼ばれる', async () => {
      await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions/reorder`)
        .send({ preconditionIds: [precondition2.id, precondition1.id] })
        .expect(200);

      expect(mockPublishTestSuiteUpdated).toHaveBeenCalledWith(
        testSuite.id,
        project.id,
        expect.arrayContaining([
          expect.objectContaining({
            field: 'precondition:reorder',
            oldValue: [precondition1.id, precondition2.id],
            newValue: [precondition2.id, precondition1.id],
          }),
        ]),
        expect.objectContaining({
          type: 'user',
          id: owner.id,
        })
      );
    });
  });

  // ============================================================
  // POST /api/test-suites/:id/test-cases/reorder - テストケース並び替え時のイベント
  // ============================================================
  describe('POST /api/test-suites/:testSuiteId/test-cases/reorder', () => {
    let testCase1: Awaited<ReturnType<typeof createTestCase>>;
    let testCase2: Awaited<ReturnType<typeof createTestCase>>;

    beforeEach(async () => {
      testCase1 = await createTestCase(testSuite.id, { title: 'Case 1', orderKey: 'a' });
      testCase2 = await createTestCase(testSuite.id, { title: 'Case 2', orderKey: 'b' });
    });

    it('テストケース並び替え時にpublishTestSuiteUpdatedが呼ばれる', async () => {
      await request(app)
        .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
        .send({ testCaseIds: [testCase2.id, testCase1.id] })
        .expect(200);

      expect(mockPublishTestSuiteUpdated).toHaveBeenCalledWith(
        testSuite.id,
        project.id,
        expect.arrayContaining([
          expect.objectContaining({
            field: 'testCases:reorder',
            oldValue: [testCase1.id, testCase2.id],
            newValue: [testCase2.id, testCase1.id],
          }),
        ]),
        expect.objectContaining({
          type: 'user',
          id: owner.id,
        })
      );
    });
  });

  // ============================================================
  // 認証エラー時はイベント発行されない
  // ============================================================
  describe('認証エラー時', () => {
    it('未認証時はイベント発行されない', async () => {
      clearTestAuth();

      await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions`)
        .send({ content: 'New precondition' })
        .expect(401);

      expect(mockPublishTestSuiteUpdated).not.toHaveBeenCalled();
    });

    it('権限不足時はイベント発行されない', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'READ', 'READ');

      await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions`)
        .send({ content: 'New precondition' })
        .expect(403);

      expect(mockPublishTestSuiteUpdated).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // バリデーションエラー時はイベント発行されない
  // ============================================================
  describe('バリデーションエラー時', () => {
    it('空のcontentではイベント発行されない', async () => {
      await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions`)
        .send({ content: '' })
        .expect(400);

      expect(mockPublishTestSuiteUpdated).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 存在しないリソースへのアクセス時はイベント発行されない
  // ============================================================
  describe('存在しないリソースへのアクセス時', () => {
    it('存在しないテストスイートではイベント発行されない', async () => {
      await request(app)
        .post('/api/test-suites/00000000-0000-0000-0000-000000000000/preconditions')
        .send({ content: 'New precondition' })
        .expect(404);

      expect(mockPublishTestSuiteUpdated).not.toHaveBeenCalled();
    });
  });
});
