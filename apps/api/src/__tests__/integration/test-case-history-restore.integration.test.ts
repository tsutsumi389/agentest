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
  createTestCaseHistory,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError } from '@agentest/shared';

/**
 * グループ化されたレスポンスから履歴を平坦化するヘルパー
 * categorizedHistoriesの全カテゴリから履歴を抽出
 */
function flattenHistories(items: { categorizedHistories: { basicInfo: unknown[]; preconditions: unknown[]; steps: unknown[]; expectedResults: unknown[] } }[]): unknown[] {
  return items.flatMap((item) => [
    ...item.categorizedHistories.basicInfo,
    ...item.categorizedHistories.preconditions,
    ...item.categorizedHistories.steps,
    ...item.categorizedHistories.expectedResults,
  ]);
}
import { createApp } from '../../app.js';

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
  requireProjectRole: (roles: string[], _options?: { allowDeletedProject?: boolean }) => (_req: any, _res: any, next: any) => {
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

// テストケース権限ミドルウェアをモック
vi.mock('../../middleware/require-test-case-role.js', () => ({
  requireTestCaseRole: (roles: string[], _options?: { allowDeletedTestCase?: boolean }) => (_req: any, _res: any, next: any) => {
    if (!mockTestCaseRole || !roles.includes(mockTestCaseRole)) {
      return next(new AuthorizationError('権限がありません'));
    }
    next();
  },
}));

// テスト用認証設定関数
function setTestAuth(
  user: { id: string; email: string } | null,
  projectRole: string | null = null,
  testCaseRole: string | null = null
) {
  mockAuthUser = user;
  mockProjectRole = projectRole;
  mockTestCaseRole = testCaseRole ?? projectRole; // デフォルトでprojectRoleと同じ
}

function clearTestAuth() {
  mockAuthUser = null;
  mockProjectRole = null;
  mockTestCaseRole = null;
}

describe('Test Case History & Restore API Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let writer: Awaited<ReturnType<typeof createTestUser>>;
  let reader: Awaited<ReturnType<typeof createTestUser>>;
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
      description: 'Test suite description',
    });

    // テストケースを作成
    testCase = await createTestCase(testSuite.id, {
      title: 'Test Case',
      description: 'Test case description',
      createdByUserId: owner.id,
    });

    // デフォルトでオーナーとして認証（ADMIN権限相当）
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN');
  });

  // ============================================================
  // GET /api/test-cases/:testCaseId/histories - 履歴一覧取得
  // ============================================================
  describe('GET /api/test-cases/:testCaseId/histories', () => {
    beforeEach(async () => {
      // 履歴を作成
      await createTestCaseHistory(testCase.id, {
        changedByUserId: owner.id,
        changeType: 'CREATE',
        snapshot: { title: 'Test Case', description: null },
        createdAt: new Date('2024-01-01T00:00:00Z'),
      });
      await createTestCaseHistory(testCase.id, {
        changedByUserId: admin.id,
        changeType: 'UPDATE',
        snapshot: {
          before: { title: 'Test Case' },
          after: { title: 'Updated Case' },
        },
        createdAt: new Date('2024-01-02T00:00:00Z'),
      });
    });

    it('履歴一覧を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}/histories`)
        .expect(200);

      const histories = flattenHistories(response.body.items);
      expect(histories).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('履歴は作成日時の降順で返される', async () => {
      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}/histories`)
        .expect(200);

      const histories = flattenHistories(response.body.items) as { changeType: string }[];
      expect(histories[0].changeType).toBe('UPDATE'); // 後に作成された方が先
      expect(histories[1].changeType).toBe('CREATE');
    });

    it('履歴には変更者情報が含まれる', async () => {
      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}/histories`)
        .expect(200);

      const histories = flattenHistories(response.body.items) as { changedBy: { id: string; name: string } }[];
      const updateHistory = histories[0];
      expect(updateHistory.changedBy).toHaveProperty('id', admin.id);
      expect(updateHistory.changedBy).toHaveProperty('name', 'Admin');
    });

    it('limitパラメータで取得件数を制限できる', async () => {
      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}/histories?limit=1`)
        .expect(200);

      // グループ単位でページネーションされるため、items.lengthが1
      expect(response.body.items).toHaveLength(1);
      expect(response.body.total).toBe(2); // totalは全件数
    });

    it('offsetパラメータでスキップできる', async () => {
      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}/histories?offset=1`)
        .expect(200);

      // グループ単位でページネーションされるため、items.lengthが1
      expect(response.body.items).toHaveLength(1);
      const histories = flattenHistories(response.body.items) as { changeType: string }[];
      expect(histories[0].changeType).toBe('CREATE'); // 2番目の履歴
    });

    it('limitとoffsetを組み合わせてページネーションできる', async () => {
      // 追加の履歴を作成
      await createTestCaseHistory(testCase.id, {
        changedByUserId: owner.id,
        changeType: 'DELETE',
        createdAt: new Date('2024-01-03T00:00:00Z'),
      });

      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}/histories?limit=1&offset=1`)
        .expect(200);

      // グループ単位でページネーションされるため、items.lengthが1
      expect(response.body.items).toHaveLength(1);
      const histories = flattenHistories(response.body.items) as { changeType: string }[];
      expect(histories[0].changeType).toBe('UPDATE');
      expect(response.body.total).toBe(3);
    });

    it('削除済みテストケースでも履歴を取得できる', async () => {
      // テストケースを削除
      await prisma.testCase.update({
        where: { id: testCase.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}/histories`)
        .expect(200);

      const histories = flattenHistories(response.body.items);
      expect(histories).toHaveLength(2);
    });

    it('limit=0は無効で400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}/histories?limit=0`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('limit=101（上限超過）は400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}/histories?limit=101`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('offset=-1は400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}/histories?offset=-1`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('存在しないテストケースは404エラー', async () => {
      const response = await request(app)
        .get('/api/test-cases/00000000-0000-0000-0000-000000000000/histories')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}/histories`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  // ============================================================
  // POST /api/test-cases/:testCaseId/restore - テストケース復元
  // ============================================================
  describe('POST /api/test-cases/:testCaseId/restore', () => {
    beforeEach(async () => {
      // テストケースを論理削除状態にする
      await prisma.testCase.update({
        where: { id: testCase.id },
        data: { deletedAt: new Date() },
      });
    });

    it('ADMINが削除済みテストケースを復元できる', async () => {
      const response = await request(app)
        .post(`/api/test-cases/${testCase.id}/restore`)
        .expect(200);

      expect(response.body.testCase).toHaveProperty('id', testCase.id);
      expect(response.body.testCase.deletedAt).toBeNull();

      // DBで確認
      const restoredCase = await prisma.testCase.findUnique({
        where: { id: testCase.id },
      });
      expect(restoredCase?.deletedAt).toBeNull();
    });

    it('復元後に履歴が記録される', async () => {
      await request(app)
        .post(`/api/test-cases/${testCase.id}/restore`)
        .expect(200);

      const history = await prisma.testCaseHistory.findFirst({
        where: {
          testCaseId: testCase.id,
          changeType: 'RESTORE',
        },
      });

      expect(history).not.toBeNull();
      expect(history?.changedByUserId).toBe(owner.id);
      expect(history?.snapshot).toEqual(
        expect.objectContaining({
          title: 'Test Case',
        })
      );
    });

    it('削除されていないテストケースの復元は409エラー', async () => {
      // テストケースを復元状態に戻す
      await prisma.testCase.update({
        where: { id: testCase.id },
        data: { deletedAt: null },
      });

      const response = await request(app)
        .post(`/api/test-cases/${testCase.id}/restore`)
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('30日を超えた古いテストケースの復元は400エラー', async () => {
      // 31日前に削除された状態にする
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 31);
      await prisma.testCase.update({
        where: { id: testCase.id },
        data: { deletedAt },
      });

      const response = await request(app)
        .post(`/api/test-cases/${testCase.id}/restore`)
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(response.body.error.message).toContain('復元期限');
    });

    it('30日以内の削除済みテストケースは復元できる', async () => {
      // 29日前に削除された状態にする
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 29);
      await prisma.testCase.update({
        where: { id: testCase.id },
        data: { deletedAt },
      });

      const response = await request(app)
        .post(`/api/test-cases/${testCase.id}/restore`)
        .expect(200);

      expect(response.body.testCase.deletedAt).toBeNull();
    });

    it('削除済みテストスイートへの復元は400エラー', async () => {
      // テストスイートを削除状態にする
      await prisma.testSuite.update({
        where: { id: testSuite.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .post(`/api/test-cases/${testCase.id}/restore`)
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(response.body.error.message).toContain('削除済みテストスイート');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .post(`/api/test-cases/${testCase.id}/restore`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('存在しないテストケースの復元は404エラー', async () => {
      const response = await request(app)
        .post('/api/test-cases/00000000-0000-0000-0000-000000000000/restore')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('復元後は通常のテストケース操作ができる', async () => {
      // まず復元
      await request(app)
        .post(`/api/test-cases/${testCase.id}/restore`)
        .expect(200);

      // テストケース詳細を取得できる
      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}`)
        .expect(200);

      expect(response.body.testCase.id).toBe(testCase.id);
      expect(response.body.testCase.deletedAt).toBeNull();
    });
  });

  // ============================================================
  // テストケースCRUD時の履歴作成テスト
  // ============================================================
  describe('Test Case CRUD - History Creation', () => {
    it('テストケース更新時に履歴が作成される', async () => {
      await request(app)
        .patch(`/api/test-cases/${testCase.id}`)
        .send({
          title: 'Updated Title',
          description: 'Updated Description',
        })
        .expect(200);

      const history = await prisma.testCaseHistory.findFirst({
        where: {
          testCaseId: testCase.id,
          changeType: 'UPDATE',
        },
      });

      expect(history).not.toBeNull();
      expect(history?.changedByUserId).toBe(owner.id);
    });

    it('テストケース削除時に履歴が作成される', async () => {
      await request(app)
        .delete(`/api/test-cases/${testCase.id}`)
        .expect(204);

      const history = await prisma.testCaseHistory.findFirst({
        where: {
          testCaseId: testCase.id,
          changeType: 'DELETE',
        },
      });

      expect(history).not.toBeNull();
      expect(history?.changedByUserId).toBe(owner.id);
    });
  });

  // ============================================================
  // 権限マトリクステスト
  // ============================================================
  describe('Permission Matrix', () => {
    beforeEach(async () => {
      // 履歴を作成
      await createTestCaseHistory(testCase.id, {
        changedByUserId: owner.id,
        changeType: 'CREATE',
      });
    });

    describe('履歴閲覧（READ以上）', () => {
      it('ADMINは履歴を閲覧できる', async () => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

        await request(app)
          .get(`/api/test-cases/${testCase.id}/histories`)
          .expect(200);
      });

      it('WRITEは履歴を閲覧できる', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

        await request(app)
          .get(`/api/test-cases/${testCase.id}/histories`)
          .expect(200);
      });

      it('READは履歴を閲覧できる', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ');

        await request(app)
          .get(`/api/test-cases/${testCase.id}/histories`)
          .expect(200);
      });
    });

    describe('テストケース復元（WRITE以上）', () => {
      beforeEach(async () => {
        // テストケースを削除状態にする
        await prisma.testCase.update({
          where: { id: testCase.id },
          data: { deletedAt: new Date() },
        });
      });

      it('ADMINはテストケースを復元できる', async () => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

        await request(app)
          .post(`/api/test-cases/${testCase.id}/restore`)
          .expect(200);
      });

      it('WRITEはテストケースを復元できる', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

        await request(app)
          .post(`/api/test-cases/${testCase.id}/restore`)
          .expect(200);
      });

      it('READはテストケースを復元できない', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ');

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/restore`)
          .expect(403);

        expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
      });
    });
  });
});
