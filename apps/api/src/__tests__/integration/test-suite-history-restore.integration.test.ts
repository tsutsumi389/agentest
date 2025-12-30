import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestProjectMember,
  createTestSuite,
  createTestSuiteHistory,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError, NotFoundError } from '@agentest/shared';
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
  requireProjectRole: (roles: string[], _options?: { allowDeletedProject?: boolean }) => (_req: any, _res: any, next: any) => {
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

// テストスイート権限ミドルウェアをモック
vi.mock('../../middleware/require-test-suite-role.js', () => ({
  requireTestSuiteRole: (roles: string[], options?: { allowDeletedSuite?: boolean }) => async (req: any, _res: any, next: any) => {
    if (!mockTestSuiteRole || !roles.includes(mockTestSuiteRole)) {
      return next(new AuthorizationError('権限がありません'));
    }
    // テストスイートの存在チェック
    const testSuiteId = req.params.testSuiteId;
    if (testSuiteId) {
      const testSuite = await prisma.testSuite.findUnique({ where: { id: testSuiteId } });
      if (!testSuite) {
        return next(new NotFoundError('TestSuite', testSuiteId));
      }
      // allowDeletedSuiteオプションのチェック
      if (testSuite.deletedAt && !options?.allowDeletedSuite) {
        return next(new NotFoundError('TestSuite', testSuiteId));
      }
    }
    next();
  },
}));

// テスト用認証設定関数
function setTestAuth(
  user: { id: string; email: string } | null,
  projectRole: string | null = null,
  testSuiteRole: string | null = null,
  _allowDeletedSuite: boolean = false
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

describe('Test Suite History & Restore API Integration Tests', () => {
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
      description: 'Test suite description',
    });

    // デフォルトでオーナーとして認証（ADMIN権限相当）
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN', 'ADMIN');
  });

  // ============================================================
  // GET /api/test-suites/:testSuiteId/histories - 履歴一覧取得
  // ============================================================
  describe('GET /api/test-suites/:testSuiteId/histories', () => {
    beforeEach(async () => {
      // 履歴を作成
      await createTestSuiteHistory(testSuite.id, {
        changedByUserId: owner.id,
        changeType: 'CREATE',
        snapshot: { name: 'Test Suite', description: null },
        createdAt: new Date('2024-01-01T00:00:00Z'),
      });
      await createTestSuiteHistory(testSuite.id, {
        changedByUserId: admin.id,
        changeType: 'UPDATE',
        snapshot: {
          before: { name: 'Test Suite' },
          after: { name: 'Updated Suite' },
        },
        createdAt: new Date('2024-01-02T00:00:00Z'),
      });
    });

    it('履歴一覧を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/histories`)
        .expect(200);

      expect(response.body.histories).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('履歴は作成日時の降順で返される', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/histories`)
        .expect(200);

      expect(response.body.histories[0].changeType).toBe('UPDATE'); // 後に作成された方が先
      expect(response.body.histories[1].changeType).toBe('CREATE');
    });

    it('履歴には変更者情報が含まれる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/histories`)
        .expect(200);

      const updateHistory = response.body.histories[0];
      expect(updateHistory.changedBy).toHaveProperty('id', admin.id);
      expect(updateHistory.changedBy).toHaveProperty('name', 'Admin');
    });

    it('limitパラメータで取得件数を制限できる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/histories?limit=1`)
        .expect(200);

      expect(response.body.histories).toHaveLength(1);
      expect(response.body.total).toBe(2); // totalは全件数
    });

    it('offsetパラメータでスキップできる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/histories?offset=1`)
        .expect(200);

      expect(response.body.histories).toHaveLength(1);
      expect(response.body.histories[0].changeType).toBe('CREATE'); // 2番目の履歴
    });

    it('limitとoffsetを組み合わせてページネーションできる', async () => {
      // 追加の履歴を作成
      await createTestSuiteHistory(testSuite.id, {
        changedByUserId: owner.id,
        changeType: 'DELETE',
        createdAt: new Date('2024-01-03T00:00:00Z'),
      });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/histories?limit=1&offset=1`)
        .expect(200);

      expect(response.body.histories).toHaveLength(1);
      expect(response.body.histories[0].changeType).toBe('UPDATE');
      expect(response.body.total).toBe(3);
    });

    it('削除済みテストスイートでも履歴を取得できる', async () => {
      // テストスイートを削除
      await prisma.testSuite.update({
        where: { id: testSuite.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/histories`)
        .expect(200);

      expect(response.body.histories).toHaveLength(2);
    });

    it('limit=0は無効で400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/histories?limit=0`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('limit=101（上限超過）は400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/histories?limit=101`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('offset=-1は400エラー', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/histories?offset=-1`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('存在しないテストスイートは404エラー', async () => {
      const response = await request(app)
        .get('/api/test-suites/00000000-0000-0000-0000-000000000000/histories')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/histories`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('権限がない場合は403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', null);

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/histories`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // POST /api/test-suites/:testSuiteId/restore - テストスイート復元
  // ============================================================
  describe('POST /api/test-suites/:testSuiteId/restore', () => {
    beforeEach(async () => {
      // テストスイートを論理削除状態にする
      await prisma.testSuite.update({
        where: { id: testSuite.id },
        data: { deletedAt: new Date() },
      });
    });

    it('ADMINが削除済みテストスイートを復元できる', async () => {
      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/restore`)
        .expect(200);

      expect(response.body.testSuite).toHaveProperty('id', testSuite.id);
      expect(response.body.testSuite.deletedAt).toBeNull();

      // DBで確認
      const restoredSuite = await prisma.testSuite.findUnique({
        where: { id: testSuite.id },
      });
      expect(restoredSuite?.deletedAt).toBeNull();
    });

    it('復元後に履歴が記録される', async () => {
      await request(app)
        .post(`/api/test-suites/${testSuite.id}/restore`)
        .expect(200);

      const history = await prisma.testSuiteHistory.findFirst({
        where: {
          testSuiteId: testSuite.id,
          changeType: 'RESTORE',
        },
      });

      expect(history).not.toBeNull();
      expect(history?.changedByUserId).toBe(owner.id);
      expect(history?.snapshot).toEqual(
        expect.objectContaining({
          name: 'Test Suite',
        })
      );
    });

    it('削除されていないテストスイートの復元は409エラー', async () => {
      // テストスイートを復元状態に戻す
      await prisma.testSuite.update({
        where: { id: testSuite.id },
        data: { deletedAt: null },
      });

      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/restore`)
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('期限制限なしで古いテストスイートも復元できる', async () => {
      // 100日前に削除された状態にする
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 100);
      await prisma.testSuite.update({
        where: { id: testSuite.id },
        data: { deletedAt },
      });

      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/restore`)
        .expect(200);

      expect(response.body.testSuite.deletedAt).toBeNull();
    });

    it('WRITE権限ではテストスイートを復元できない', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');

      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/restore`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('READ権限ではテストスイートを復元できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/restore`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/restore`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('存在しないテストスイートの復元は404エラー', async () => {
      const response = await request(app)
        .post('/api/test-suites/00000000-0000-0000-0000-000000000000/restore')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('復元後は通常のテストスイート操作ができる', async () => {
      // まず復元
      await request(app)
        .post(`/api/test-suites/${testSuite.id}/restore`)
        .expect(200);

      // テストスイート詳細を取得できる
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}`)
        .expect(200);

      expect(response.body.testSuite.id).toBe(testSuite.id);
      expect(response.body.testSuite.deletedAt).toBeNull();
    });
  });

  // ============================================================
  // テストスイートCRUD時の履歴作成テスト
  // ============================================================
  describe('Test Suite CRUD - History Creation', () => {
    it('テストスイート更新時に履歴が作成される', async () => {
      await request(app)
        .patch(`/api/test-suites/${testSuite.id}`)
        .send({
          name: 'Updated Name',
          description: 'Updated Description',
        })
        .expect(200);

      const history = await prisma.testSuiteHistory.findFirst({
        where: {
          testSuiteId: testSuite.id,
          changeType: 'UPDATE',
        },
      });

      expect(history).not.toBeNull();
      expect(history?.changedByUserId).toBe(owner.id);
      // 履歴には更新前の状態がスナップショットとして保存される
      expect(history?.snapshot).toEqual(
        expect.objectContaining({
          id: testSuite.id,
          projectId: project.id,
          name: 'Test Suite',
          description: 'Test suite description',
          status: 'DRAFT',
        })
      );
    });

    it('テストスイート削除時に履歴が作成される', async () => {
      await request(app)
        .delete(`/api/test-suites/${testSuite.id}`)
        .expect(204);

      const history = await prisma.testSuiteHistory.findFirst({
        where: {
          testSuiteId: testSuite.id,
          changeType: 'DELETE',
        },
      });

      expect(history).not.toBeNull();
      expect(history?.changedByUserId).toBe(owner.id);
      expect(history?.snapshot).toEqual(
        expect.objectContaining({
          name: 'Test Suite',
        })
      );
    });
  });

  // ============================================================
  // 権限マトリクステスト
  // ============================================================
  describe('Permission Matrix', () => {
    beforeEach(async () => {
      // 履歴を作成
      await createTestSuiteHistory(testSuite.id, {
        changedByUserId: owner.id,
        changeType: 'CREATE',
      });
    });

    describe('履歴閲覧（READ以上）', () => {
      it('ADMINは履歴を閲覧できる', async () => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN', 'ADMIN');

        await request(app)
          .get(`/api/test-suites/${testSuite.id}/histories`)
          .expect(200);
      });

      it('WRITEは履歴を閲覧できる', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');

        await request(app)
          .get(`/api/test-suites/${testSuite.id}/histories`)
          .expect(200);
      });

      it('READは履歴を閲覧できる', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

        await request(app)
          .get(`/api/test-suites/${testSuite.id}/histories`)
          .expect(200);
      });
    });

    describe('テストスイート復元（ADMIN以上）', () => {
      beforeEach(async () => {
        // テストスイートを削除状態にする
        await prisma.testSuite.update({
          where: { id: testSuite.id },
          data: { deletedAt: new Date() },
        });
      });

      it('ADMINはテストスイートを復元できる', async () => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN', 'ADMIN');

        await request(app)
          .post(`/api/test-suites/${testSuite.id}/restore`)
          .expect(200);
      });

      it('WRITEはテストスイートを復元できない', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');

        await request(app)
          .post(`/api/test-suites/${testSuite.id}/restore`)
          .expect(403);
      });

      it('READはテストスイートを復元できない', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

        await request(app)
          .post(`/api/test-suites/${testSuite.id}/restore`)
          .expect(403);
      });
    });
  });
});
