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
  createTestCasePrecondition,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError } from '@agentest/shared';
import { createApp } from '../../app.js';

// グローバルな認証状態（モック用）
let mockAuthUser: { id: string; email: string } | null = null;
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
  requireProjectRole: () => (_req: any, _res: any, next: any) => next(),
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
    (req: any, _res: any, next: any) => {
      if (!mockAuthUser) {
        return next(new AuthenticationError('認証が必要です'));
      }
      req.user = mockAuthUser;
      if (!mockTestCaseRole || !roles.includes(mockTestCaseRole)) {
        return next(new AuthorizationError('Insufficient permissions'));
      }
      next();
    },
}));

// テスト用認証設定関数
function setTestAuth(
  user: { id: string; email: string } | null,
  testCaseRole: string | null = 'OWNER'
) {
  mockAuthUser = user;
  mockTestCaseRole = testCaseRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockTestCaseRole = null;
}

describe('テストケース CRUD 結合テスト', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
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
    clearTestAuth();

    // テストユーザーを作成
    owner = await createTestUser({ email: 'owner@example.com', name: 'Owner' });
    writer = await createTestUser({ email: 'writer@example.com', name: 'Writer' });
    reader = await createTestUser({ email: 'reader@example.com', name: 'Reader' });

    // プロジェクトを作成（オーナーはcreateTestProject内で登録）
    project = await createTestProject(owner.id, {
      name: 'Test Project',
      description: 'Test description',
    });

    // メンバーを追加
    await createTestProjectMember(project.id, writer.id, 'WRITE');
    await createTestProjectMember(project.id, reader.id, 'READ');

    // テストスイートを作成
    testSuite = await createTestSuite(project.id, {
      name: 'Test Suite',
      description: 'Test Suite Description',
    });
  });

  // ============================================================
  // POST /api/test-cases - テストケース作成
  // ============================================================
  describe('POST /api/test-cases（テストケース作成）', () => {
    it('テストケースを作成できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .post('/api/test-cases')
        .send({
          testSuiteId: testSuite.id,
          title: '新しいテストケース',
        })
        .expect(201);

      expect(response.body.testCase).toBeDefined();
      expect(response.body.testCase.title).toBe('新しいテストケース');
      expect(response.body.testCase.testSuiteId).toBe(testSuite.id);
    });

    it('優先度を指定して作成できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .post('/api/test-cases')
        .send({
          testSuiteId: testSuite.id,
          title: '高優先度テストケース',
          priority: 'HIGH',
        })
        .expect(201);

      expect(response.body.testCase.priority).toBe('HIGH');
    });

    it('説明付きで作成できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .post('/api/test-cases')
        .send({
          testSuiteId: testSuite.id,
          title: '説明付きテストケース',
          description: 'これはテストケースの説明です',
        })
        .expect(201);

      expect(response.body.testCase.description).toBe('これはテストケースの説明です');
    });

    it('タイトルなしは400エラー', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .post('/api/test-cases')
        .send({
          testSuiteId: testSuite.id,
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('存在しないテストスイートIDはエラー', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app).post('/api/test-cases').send({
        testSuiteId: '00000000-0000-0000-0000-000000000000',
        title: 'テストケース',
      });

      // テストスイートが見つからない場合はエラー（404または400）
      expect([400, 404]).toContain(response.status);
    });

    it('未認証は401エラー', async () => {
      clearTestAuth();

      await request(app)
        .post('/api/test-cases')
        .send({
          testSuiteId: testSuite.id,
          title: 'テストケース',
        })
        .expect(401);
    });

    it('createdByUserが設定される', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .post('/api/test-cases')
        .send({
          testSuiteId: testSuite.id,
          title: 'ユーザー情報テスト',
        })
        .expect(201);

      // DBで直接確認
      const created = await prisma.testCase.findUnique({
        where: { id: response.body.testCase.id },
      });
      expect(created?.createdByUserId).toBe(owner.id);
    });
  });

  // ============================================================
  // GET /api/test-cases/:testCaseId - テストケース詳細取得
  // ============================================================
  describe('GET /api/test-cases/:testCaseId（テストケース詳細取得）', () => {
    let testCase: Awaited<ReturnType<typeof createTestCase>>;

    beforeEach(async () => {
      testCase = await createTestCase(testSuite.id, {
        title: 'テストケース詳細',
        description: 'テストケースの説明',
        priority: 'HIGH',
        createdByUserId: owner.id,
      });

      // ステップ、前提条件、期待結果を追加
      await createTestCaseStep(testCase.id, { content: 'ステップ1', orderKey: '00001' });
      await createTestCaseStep(testCase.id, { content: 'ステップ2', orderKey: '00002' });
      await createTestCasePrecondition(testCase.id, { content: '前提条件1', orderKey: '00001' });
      await createTestCaseExpectedResult(testCase.id, { content: '期待結果1', orderKey: '00001' });
    });

    it('テストケース詳細を取得できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app).get(`/api/test-cases/${testCase.id}`).expect(200);

      expect(response.body.testCase.id).toBe(testCase.id);
      expect(response.body.testCase.title).toBe('テストケース詳細');
      expect(response.body.testCase.description).toBe('テストケースの説明');
      expect(response.body.testCase.priority).toBe('HIGH');
    });

    it('steps, preconditions, expectedResultsが含まれる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app).get(`/api/test-cases/${testCase.id}`).expect(200);

      expect(response.body.testCase.steps).toBeDefined();
      expect(response.body.testCase.steps).toHaveLength(2);
      expect(response.body.testCase.steps[0].content).toBe('ステップ1');
      expect(response.body.testCase.steps[1].content).toBe('ステップ2');

      expect(response.body.testCase.preconditions).toBeDefined();
      expect(response.body.testCase.preconditions).toHaveLength(1);
      expect(response.body.testCase.preconditions[0].content).toBe('前提条件1');

      expect(response.body.testCase.expectedResults).toBeDefined();
      expect(response.body.testCase.expectedResults).toHaveLength(1);
      expect(response.body.testCase.expectedResults[0].content).toBe('期待結果1');
    });

    it('testSuite情報が含まれる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app).get(`/api/test-cases/${testCase.id}`).expect(200);

      expect(response.body.testCase.testSuite).toBeDefined();
      expect(response.body.testCase.testSuite.id).toBe(testSuite.id);
      expect(response.body.testCase.testSuite.name).toBe('Test Suite');
    });

    it('createdByUser情報が含まれる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app).get(`/api/test-cases/${testCase.id}`).expect(200);

      expect(response.body.testCase.createdByUser).toBeDefined();
      expect(response.body.testCase.createdByUser.id).toBe(owner.id);
      expect(response.body.testCase.createdByUser.name).toBe('Owner');
    });

    it('存在しないテストケースは404エラー', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .get('/api/test-cases/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証は401エラー', async () => {
      clearTestAuth();

      await request(app).get(`/api/test-cases/${testCase.id}`).expect(401);
    });

    it('権限なし（mockTestCaseRole=null）は403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, null);

      const response = await request(app).get(`/api/test-cases/${testCase.id}`).expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('READロールで取得可能', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).get(`/api/test-cases/${testCase.id}`).expect(200);

      expect(response.body.testCase.id).toBe(testCase.id);
    });
  });

  // ============================================================
  // PATCH /api/test-cases/:testCaseId - テストケース更新
  // ============================================================
  describe('PATCH /api/test-cases/:testCaseId（テストケース更新）', () => {
    let testCase: Awaited<ReturnType<typeof createTestCase>>;

    beforeEach(async () => {
      testCase = await createTestCase(testSuite.id, {
        title: '更新前のタイトル',
        description: '更新前の説明',
        priority: 'MEDIUM',
        status: 'DRAFT',
        createdByUserId: owner.id,
      });
    });

    it('タイトルを更新できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .patch(`/api/test-cases/${testCase.id}`)
        .send({ title: '更新後のタイトル' })
        .expect(200);

      expect(response.body.testCase.title).toBe('更新後のタイトル');
    });

    it('優先度を更新できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .patch(`/api/test-cases/${testCase.id}`)
        .send({ priority: 'CRITICAL' })
        .expect(200);

      expect(response.body.testCase.priority).toBe('CRITICAL');
    });

    it('ステータスを更新できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .patch(`/api/test-cases/${testCase.id}`)
        .send({ status: 'ACTIVE' })
        .expect(200);

      expect(response.body.testCase.status).toBe('ACTIVE');
    });

    it('説明をnullに更新できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .patch(`/api/test-cases/${testCase.id}`)
        .send({ description: null })
        .expect(200);

      expect(response.body.testCase.description).toBeNull();
    });

    it('READロールは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .patch(`/api/test-cases/${testCase.id}`)
        .send({ title: '更新試行' })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('WRITEロールで更新可能', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/test-cases/${testCase.id}`)
        .send({ title: 'Writer更新' })
        .expect(200);

      expect(response.body.testCase.title).toBe('Writer更新');
    });
  });

  // ============================================================
  // DELETE /api/test-cases/:testCaseId - テストケース削除
  // ============================================================
  describe('DELETE /api/test-cases/:testCaseId（テストケース削除）', () => {
    let testCase: Awaited<ReturnType<typeof createTestCase>>;

    beforeEach(async () => {
      testCase = await createTestCase(testSuite.id, {
        title: '削除対象テストケース',
        createdByUserId: owner.id,
      });
    });

    it('テストケースを論理削除できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      await request(app).delete(`/api/test-cases/${testCase.id}`).expect(204);
    });

    it('deletedAtが設定される', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      await request(app).delete(`/api/test-cases/${testCase.id}`).expect(204);

      // DBで論理削除を確認
      const deleted = await prisma.testCase.findUnique({
        where: { id: testCase.id },
      });
      expect(deleted?.deletedAt).not.toBeNull();
    });

    it('READロールは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      await request(app).delete(`/api/test-cases/${testCase.id}`).expect(403);
    });
  });

  // ============================================================
  // POST /api/test-cases/:testCaseId/restore - テストケース復元
  // ============================================================
  describe('POST /api/test-cases/:testCaseId/restore（テストケース復元）', () => {
    let testCase: Awaited<ReturnType<typeof createTestCase>>;

    beforeEach(async () => {
      testCase = await createTestCase(testSuite.id, {
        title: '復元対象テストケース',
        description: '復元テスト用の説明',
        createdByUserId: owner.id,
      });

      // テストケースを論理削除状態にする
      await prisma.testCase.update({
        where: { id: testCase.id },
        data: { deletedAt: new Date() },
      });
    });

    it('削除されたテストケースを復元できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .post(`/api/test-cases/${testCase.id}/restore`)
        .expect(200);

      expect(response.body.testCase).toBeDefined();
      expect(response.body.testCase.id).toBe(testCase.id);
      expect(response.body.testCase.deletedAt).toBeNull();
    });

    it('deletedAtがnullに戻る', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      await request(app).post(`/api/test-cases/${testCase.id}/restore`).expect(200);

      // DBで確認
      const restored = await prisma.testCase.findUnique({
        where: { id: testCase.id },
      });
      expect(restored?.deletedAt).toBeNull();
    });
  });

  // ============================================================
  // POST /api/test-cases/:testCaseId/steps - ステップ追加
  // ============================================================
  describe('POST /api/test-cases/:testCaseId/steps（ステップ追加）', () => {
    let testCase: Awaited<ReturnType<typeof createTestCase>>;

    beforeEach(async () => {
      testCase = await createTestCase(testSuite.id, {
        title: 'ステップ追加テスト用',
        createdByUserId: owner.id,
      });
    });

    it('ステップを追加できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .post(`/api/test-cases/${testCase.id}/steps`)
        .send({ content: '新しいステップ' })
        .expect(201);

      expect(response.body.step).toBeDefined();
      expect(response.body.step.content).toBe('新しいステップ');
      expect(response.body.step.testCaseId).toBe(testCase.id);
    });

    it('orderKeyが自動計算される', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      // 1つ目のステップを追加
      const response1 = await request(app)
        .post(`/api/test-cases/${testCase.id}/steps`)
        .send({ content: 'ステップ1' })
        .expect(201);

      expect(response1.body.step.orderKey).toBeDefined();

      // 2つ目のステップを追加
      const response2 = await request(app)
        .post(`/api/test-cases/${testCase.id}/steps`)
        .send({ content: 'ステップ2' })
        .expect(201);

      expect(response2.body.step.orderKey).toBeDefined();
      // 2つ目のorderKeyは1つ目より大きい
      expect(response2.body.step.orderKey > response1.body.step.orderKey).toBe(true);
    });

    it('READロールは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      await request(app)
        .post(`/api/test-cases/${testCase.id}/steps`)
        .send({ content: 'ステップ追加試行' })
        .expect(403);
    });
  });

  // ============================================================
  // POST /api/test-cases/:testCaseId/preconditions - 前提条件追加
  // ============================================================
  describe('POST /api/test-cases/:testCaseId/preconditions（前提条件追加）', () => {
    let testCase: Awaited<ReturnType<typeof createTestCase>>;

    beforeEach(async () => {
      testCase = await createTestCase(testSuite.id, {
        title: '前提条件追加テスト用',
        createdByUserId: owner.id,
      });
    });

    it('前提条件を追加できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .post(`/api/test-cases/${testCase.id}/preconditions`)
        .send({ content: '新しい前提条件' })
        .expect(201);

      expect(response.body.precondition).toBeDefined();
      expect(response.body.precondition.content).toBe('新しい前提条件');
      expect(response.body.precondition.testCaseId).toBe(testCase.id);
    });

    it('READロールは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      await request(app)
        .post(`/api/test-cases/${testCase.id}/preconditions`)
        .send({ content: '前提条件追加試行' })
        .expect(403);
    });
  });

  // ============================================================
  // POST /api/test-cases/:testCaseId/expected-results - 期待結果追加
  // ============================================================
  describe('POST /api/test-cases/:testCaseId/expected-results（期待結果追加）', () => {
    let testCase: Awaited<ReturnType<typeof createTestCase>>;

    beforeEach(async () => {
      testCase = await createTestCase(testSuite.id, {
        title: '期待結果追加テスト用',
        createdByUserId: owner.id,
      });
    });

    it('期待結果を追加できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .post(`/api/test-cases/${testCase.id}/expected-results`)
        .send({ content: '新しい期待結果' })
        .expect(201);

      expect(response.body.expectedResult).toBeDefined();
      expect(response.body.expectedResult.content).toBe('新しい期待結果');
      expect(response.body.expectedResult.testCaseId).toBe(testCase.id);
    });

    it('READロールは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      await request(app)
        .post(`/api/test-cases/${testCase.id}/expected-results`)
        .send({ content: '期待結果追加試行' })
        .expect(403);
    });
  });

  // ============================================================
  // 履歴記録テスト
  // ============================================================
  describe('履歴記録', () => {
    it('テストケース作成時にはCREATE履歴は記録されない（履歴はUPDATE/DELETE時のみ）', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .post('/api/test-cases')
        .send({
          testSuiteId: testSuite.id,
          title: '履歴テスト用テストケース',
        })
        .expect(201);

      const testCaseId = response.body.testCase.id;

      // 基本的なテストケース作成ではCREATE履歴は作成されない
      // （CREATE履歴はコピー操作時のみ記録される）
      const history = await prisma.testCaseHistory.findFirst({
        where: {
          testCaseId,
          changeType: 'CREATE',
        },
      });

      expect(history).toBeNull();
    });

    it('テストケース更新時に履歴が記録される', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      // テストケースを作成
      const testCase = await createTestCase(testSuite.id, {
        title: '更新履歴テスト用',
        createdByUserId: owner.id,
      });

      // テストケースを更新
      await request(app)
        .patch(`/api/test-cases/${testCase.id}`)
        .send({ title: '更新後のタイトル' })
        .expect(200);

      // 更新履歴が作成されていることを確認
      const history = await prisma.testCaseHistory.findFirst({
        where: {
          testCaseId: testCase.id,
          changeType: 'UPDATE',
        },
      });

      expect(history).not.toBeNull();
      expect(history?.changedByUserId).toBe(owner.id);
    });
  });
});
