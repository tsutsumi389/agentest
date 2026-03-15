import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestSuite,
  createTestCase,
  createTestCasePrecondition,
  createTestCaseStep,
  createTestCaseExpectedResult,
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
let mockTestCaseRole: string | null = null;

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

// テストケース権限ミドルウェアをモック
vi.mock('../../middleware/require-test-case-role.js', () => ({
  requireTestCaseRole:
    (roles: string[], _options?: { allowDeletedTestCase?: boolean }) =>
    async (req: any, _res: any, next: any) => {
      if (!mockTestCaseRole || !roles.includes(mockTestCaseRole)) {
        return next(new AuthorizationError('権限がありません'));
      }
      const testCaseId = req.params.testCaseId;
      if (testCaseId) {
        const testCase = await prisma.testCase.findUnique({ where: { id: testCaseId } });
        if (!testCase) {
          return next(new NotFoundError('TestCase', testCaseId));
        }
      }
      next();
    },
}));

function setTestAuth(
  user: { id: string; email: string } | null,
  projectRole: string | null = null,
  testCaseRole: string | null = null
) {
  mockAuthUser = user;
  mockProjectRole = projectRole;
  mockTestCaseRole = testCaseRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockProjectRole = null;
  mockTestCaseRole = null;
}

describe('Test Case Events Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let testSuite: Awaited<ReturnType<typeof createTestSuite>>;
  let testCase: Awaited<ReturnType<typeof createTestCase>>;

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

    // テストケースを作成
    testCase = await createTestCase(testSuite.id, {
      title: 'Test Case',
      description: 'Test case description',
    });

    // デフォルトでオーナーとして認証
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN', 'ADMIN');
  });

  // ============================================================
  // 前提条件（Precondition）関連
  // ============================================================
  describe('Preconditions', () => {
    describe('POST /api/test-cases/:testCaseId/preconditions', () => {
      it('前提条件追加時にpublishTestCaseUpdatedが呼ばれる', async () => {
        await request(app)
          .post(`/api/test-cases/${testCase.id}/preconditions`)
          .send({ content: 'New precondition' })
          .expect(201);

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          testCase.id,
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
    });

    describe('PATCH /api/test-cases/:testCaseId/preconditions/:preconditionId', () => {
      let precondition: Awaited<ReturnType<typeof createTestCasePrecondition>>;

      beforeEach(async () => {
        precondition = await createTestCasePrecondition(testCase.id, {
          content: 'Original content',
          orderKey: 'a',
        });
      });

      it('前提条件更新時にpublishTestCaseUpdatedが呼ばれる', async () => {
        await request(app)
          .patch(`/api/test-cases/${testCase.id}/preconditions/${precondition.id}`)
          .send({ content: 'Updated content' })
          .expect(200);

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          testCase.id,
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

    describe('DELETE /api/test-cases/:testCaseId/preconditions/:preconditionId', () => {
      let precondition: Awaited<ReturnType<typeof createTestCasePrecondition>>;

      beforeEach(async () => {
        precondition = await createTestCasePrecondition(testCase.id, {
          content: 'To be deleted',
          orderKey: 'a',
        });
      });

      it('前提条件削除時にpublishTestCaseUpdatedが呼ばれる', async () => {
        await request(app)
          .delete(`/api/test-cases/${testCase.id}/preconditions/${precondition.id}`)
          .expect(204);

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          testCase.id,
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

    describe('POST /api/test-cases/:testCaseId/preconditions/reorder', () => {
      let precondition1: Awaited<ReturnType<typeof createTestCasePrecondition>>;
      let precondition2: Awaited<ReturnType<typeof createTestCasePrecondition>>;

      beforeEach(async () => {
        precondition1 = await createTestCasePrecondition(testCase.id, {
          content: 'First',
          orderKey: 'a',
        });
        precondition2 = await createTestCasePrecondition(testCase.id, {
          content: 'Second',
          orderKey: 'b',
        });
      });

      it('前提条件並び替え時にpublishTestCaseUpdatedが呼ばれる', async () => {
        await request(app)
          .post(`/api/test-cases/${testCase.id}/preconditions/reorder`)
          .send({ preconditionIds: [precondition2.id, precondition1.id] })
          .expect(200);

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          testCase.id,
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
  });

  // ============================================================
  // ステップ（Step）関連
  // ============================================================
  describe('Steps', () => {
    describe('POST /api/test-cases/:testCaseId/steps', () => {
      it('ステップ追加時にpublishTestCaseUpdatedが呼ばれる', async () => {
        await request(app)
          .post(`/api/test-cases/${testCase.id}/steps`)
          .send({ content: 'New step' })
          .expect(201);

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          testCase.id,
          testSuite.id,
          project.id,
          expect.arrayContaining([
            expect.objectContaining({
              field: 'step:add',
              oldValue: null,
            }),
          ]),
          expect.objectContaining({
            type: 'user',
            id: owner.id,
          })
        );
      });
    });

    describe('PATCH /api/test-cases/:testCaseId/steps/:stepId', () => {
      let step: Awaited<ReturnType<typeof createTestCaseStep>>;

      beforeEach(async () => {
        step = await createTestCaseStep(testCase.id, {
          content: 'Original step',
          orderKey: 'a',
        });
      });

      it('ステップ更新時にpublishTestCaseUpdatedが呼ばれる', async () => {
        await request(app)
          .patch(`/api/test-cases/${testCase.id}/steps/${step.id}`)
          .send({ content: 'Updated step' })
          .expect(200);

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          testCase.id,
          testSuite.id,
          project.id,
          expect.arrayContaining([
            expect.objectContaining({
              field: 'step:update',
              oldValue: 'Original step',
              newValue: 'Updated step',
            }),
          ]),
          expect.objectContaining({
            type: 'user',
            id: owner.id,
          })
        );
      });
    });

    describe('DELETE /api/test-cases/:testCaseId/steps/:stepId', () => {
      let step: Awaited<ReturnType<typeof createTestCaseStep>>;

      beforeEach(async () => {
        step = await createTestCaseStep(testCase.id, {
          content: 'To be deleted',
          orderKey: 'a',
        });
      });

      it('ステップ削除時にpublishTestCaseUpdatedが呼ばれる', async () => {
        await request(app).delete(`/api/test-cases/${testCase.id}/steps/${step.id}`).expect(204);

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          testCase.id,
          testSuite.id,
          project.id,
          expect.arrayContaining([
            expect.objectContaining({
              field: 'step:delete',
              oldValue: step.id,
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

    describe('POST /api/test-cases/:testCaseId/steps/reorder', () => {
      let step1: Awaited<ReturnType<typeof createTestCaseStep>>;
      let step2: Awaited<ReturnType<typeof createTestCaseStep>>;

      beforeEach(async () => {
        step1 = await createTestCaseStep(testCase.id, { content: 'Step 1', orderKey: 'a' });
        step2 = await createTestCaseStep(testCase.id, { content: 'Step 2', orderKey: 'b' });
      });

      it('ステップ並び替え時にpublishTestCaseUpdatedが呼ばれる', async () => {
        await request(app)
          .post(`/api/test-cases/${testCase.id}/steps/reorder`)
          .send({ stepIds: [step2.id, step1.id] })
          .expect(200);

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          testCase.id,
          testSuite.id,
          project.id,
          expect.arrayContaining([
            expect.objectContaining({
              field: 'step:reorder',
              oldValue: [step1.id, step2.id],
              newValue: [step2.id, step1.id],
            }),
          ]),
          expect.objectContaining({
            type: 'user',
            id: owner.id,
          })
        );
      });
    });
  });

  // ============================================================
  // 期待結果（Expected Result）関連
  // ============================================================
  describe('Expected Results', () => {
    describe('POST /api/test-cases/:testCaseId/expected-results', () => {
      it('期待結果追加時にpublishTestCaseUpdatedが呼ばれる', async () => {
        await request(app)
          .post(`/api/test-cases/${testCase.id}/expected-results`)
          .send({ content: 'New expected result' })
          .expect(201);

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          testCase.id,
          testSuite.id,
          project.id,
          expect.arrayContaining([
            expect.objectContaining({
              field: 'expectedResult:add',
              oldValue: null,
            }),
          ]),
          expect.objectContaining({
            type: 'user',
            id: owner.id,
          })
        );
      });
    });

    describe('PATCH /api/test-cases/:testCaseId/expected-results/:expectedResultId', () => {
      let expectedResult: Awaited<ReturnType<typeof createTestCaseExpectedResult>>;

      beforeEach(async () => {
        expectedResult = await createTestCaseExpectedResult(testCase.id, {
          content: 'Original expected result',
          orderKey: 'a',
        });
      });

      it('期待結果更新時にpublishTestCaseUpdatedが呼ばれる', async () => {
        await request(app)
          .patch(`/api/test-cases/${testCase.id}/expected-results/${expectedResult.id}`)
          .send({ content: 'Updated expected result' })
          .expect(200);

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          testCase.id,
          testSuite.id,
          project.id,
          expect.arrayContaining([
            expect.objectContaining({
              field: 'expectedResult:update',
              oldValue: 'Original expected result',
              newValue: 'Updated expected result',
            }),
          ]),
          expect.objectContaining({
            type: 'user',
            id: owner.id,
          })
        );
      });
    });

    describe('DELETE /api/test-cases/:testCaseId/expected-results/:expectedResultId', () => {
      let expectedResult: Awaited<ReturnType<typeof createTestCaseExpectedResult>>;

      beforeEach(async () => {
        expectedResult = await createTestCaseExpectedResult(testCase.id, {
          content: 'To be deleted',
          orderKey: 'a',
        });
      });

      it('期待結果削除時にpublishTestCaseUpdatedが呼ばれる', async () => {
        await request(app)
          .delete(`/api/test-cases/${testCase.id}/expected-results/${expectedResult.id}`)
          .expect(204);

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          testCase.id,
          testSuite.id,
          project.id,
          expect.arrayContaining([
            expect.objectContaining({
              field: 'expectedResult:delete',
              oldValue: expectedResult.id,
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

    describe('POST /api/test-cases/:testCaseId/expected-results/reorder', () => {
      let expectedResult1: Awaited<ReturnType<typeof createTestCaseExpectedResult>>;
      let expectedResult2: Awaited<ReturnType<typeof createTestCaseExpectedResult>>;

      beforeEach(async () => {
        expectedResult1 = await createTestCaseExpectedResult(testCase.id, {
          content: 'Result 1',
          orderKey: 'a',
        });
        expectedResult2 = await createTestCaseExpectedResult(testCase.id, {
          content: 'Result 2',
          orderKey: 'b',
        });
      });

      it('期待結果並び替え時にpublishTestCaseUpdatedが呼ばれる', async () => {
        await request(app)
          .post(`/api/test-cases/${testCase.id}/expected-results/reorder`)
          .send({ expectedResultIds: [expectedResult2.id, expectedResult1.id] })
          .expect(200);

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          testCase.id,
          testSuite.id,
          project.id,
          expect.arrayContaining([
            expect.objectContaining({
              field: 'expectedResult:reorder',
              oldValue: [expectedResult1.id, expectedResult2.id],
              newValue: [expectedResult2.id, expectedResult1.id],
            }),
          ]),
          expect.objectContaining({
            type: 'user',
            id: owner.id,
          })
        );
      });
    });
  });

  // ============================================================
  // コピー
  // ============================================================
  describe('POST /api/test-cases/:testCaseId/copy', () => {
    it('テストケースコピー時にpublishTestCaseUpdatedが呼ばれる', async () => {
      const response = await request(app)
        .post(`/api/test-cases/${testCase.id}/copy`)
        .send({})
        .expect(201);

      const newTestCaseId = response.body.testCase.id;

      expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
        newTestCaseId,
        testSuite.id,
        project.id,
        expect.arrayContaining([
          expect.objectContaining({
            field: 'copy',
            oldValue: testCase.id,
            newValue: newTestCaseId,
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
        .post(`/api/test-cases/${testCase.id}/preconditions`)
        .send({ content: 'New precondition' })
        .expect(401);

      expect(mockPublishTestCaseUpdated).not.toHaveBeenCalled();
    });

    it('権限不足時はイベント発行されない', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'READ', 'READ');

      await request(app)
        .post(`/api/test-cases/${testCase.id}/preconditions`)
        .send({ content: 'New precondition' })
        .expect(403);

      expect(mockPublishTestCaseUpdated).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // バリデーションエラー時はイベント発行されない
  // ============================================================
  describe('バリデーションエラー時', () => {
    it('空のcontentではイベント発行されない', async () => {
      await request(app)
        .post(`/api/test-cases/${testCase.id}/preconditions`)
        .send({ content: '' })
        .expect(400);

      expect(mockPublishTestCaseUpdated).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 存在しないリソースへのアクセス時はイベント発行されない
  // ============================================================
  describe('存在しないリソースへのアクセス時', () => {
    it('存在しないテストケースではイベント発行されない', async () => {
      await request(app)
        .post('/api/test-cases/00000000-0000-0000-0000-000000000000/preconditions')
        .send({ content: 'New precondition' })
        .expect(404);

      expect(mockPublishTestCaseUpdated).not.toHaveBeenCalled();
    });
  });
});
