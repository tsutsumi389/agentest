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
  createTestPrecondition,
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
  requireProjectRole: (roles: string[], _options?: any) => (_req: any, _res: any, next: any) => {
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

describe('テストスイートCRUD統合テスト', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let writer: Awaited<ReturnType<typeof createTestUser>>;
  let reader: Awaited<ReturnType<typeof createTestUser>>;
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

    // プロジェクトを作成
    project = await createTestProject(owner.id, {
      name: 'Test Project',
      description: 'テスト用プロジェクト',
    });

    // メンバーを追加
    await createTestProjectMember(project.id, admin.id, 'ADMIN');
    await createTestProjectMember(project.id, writer.id, 'WRITE');
    await createTestProjectMember(project.id, reader.id, 'READ');

    // デフォルトでオーナーとして認証（ADMIN権限相当）
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN', 'ADMIN');
  });

  // ============================================================
  // POST /api/test-suites - テストスイート作成
  // ============================================================
  describe('POST /api/test-suites（作成）', () => {
    it('テストスイートを作成できる', async () => {
      const response = await request(app)
        .post('/api/test-suites')
        .send({
          projectId: project.id,
          name: '新しいテストスイート',
          description: 'テストスイートの説明',
        })
        .expect(201);

      expect(response.body.testSuite).toBeDefined();
      expect(response.body.testSuite.name).toBe('新しいテストスイート');
      expect(response.body.testSuite.description).toBe('テストスイートの説明');
      expect(response.body.testSuite.status).toBe('DRAFT');
    });

    it('ステータスを指定して作成できる', async () => {
      const response = await request(app)
        .post('/api/test-suites')
        .send({
          projectId: project.id,
          name: 'ACTIVEテストスイート',
          status: 'ACTIVE',
        })
        .expect(201);

      expect(response.body.testSuite.status).toBe('ACTIVE');
    });

    it('名前なしは400エラー', async () => {
      const response = await request(app)
        .post('/api/test-suites')
        .send({
          projectId: project.id,
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('存在しないプロジェクトIDは404エラー', async () => {
      const response = await request(app)
        .post('/api/test-suites')
        .send({
          projectId: '00000000-0000-0000-0000-000000000000',
          name: 'テストスイート',
        })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .post('/api/test-suites')
        .send({
          projectId: project.id,
          name: 'テストスイート',
        })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('READロールは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .post('/api/test-suites')
        .send({
          projectId: project.id,
          name: 'テストスイート',
        })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // GET /api/projects/:projectId/test-suites - テストスイート一覧取得
  // ============================================================
  describe('GET /api/projects/:projectId/test-suites（一覧取得）', () => {
    it('テストスイート一覧を取得できる', async () => {
      // テストスイートを複数作成（searchSchemaのデフォルトstatusがACTIVEのため、ACTIVEで作成）
      await createTestSuite(project.id, { name: 'テストスイート1', status: 'ACTIVE' });
      await createTestSuite(project.id, { name: 'テストスイート2', status: 'ACTIVE' });
      await createTestSuite(project.id, { name: 'テストスイート3', status: 'ACTIVE' });

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites`)
        .expect(200);

      expect(response.body.testSuites).toBeDefined();
      expect(response.body.testSuites.length).toBe(3);
    });

    it('空の一覧を取得できる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites`)
        .expect(200);

      expect(response.body.testSuites).toBeDefined();
      expect(response.body.testSuites.length).toBe(0);
    });

    it('未認証は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  // ============================================================
  // GET /api/test-suites/:testSuiteId - テストスイート詳細取得
  // ============================================================
  describe('GET /api/test-suites/:testSuiteId（詳細取得）', () => {
    let testSuite: Awaited<ReturnType<typeof createTestSuite>>;

    beforeEach(async () => {
      testSuite = await createTestSuite(project.id, {
        name: '詳細取得用テストスイート',
        description: 'テストスイートの説明文',
      });
    });

    it('テストスイート詳細を取得できる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}`)
        .expect(200);

      expect(response.body.testSuite).toBeDefined();
      expect(response.body.testSuite.id).toBe(testSuite.id);
      expect(response.body.testSuite.name).toBe('詳細取得用テストスイート');
      expect(response.body.testSuite.description).toBe('テストスイートの説明文');
    });

    it('前提条件とテストケースの件数が含まれる', async () => {
      // 前提条件を追加
      await createTestPrecondition(testSuite.id, { content: '前提条件1', orderKey: 'a' });
      await createTestPrecondition(testSuite.id, { content: '前提条件2', orderKey: 'b' });

      // テストケースを追加
      await createTestCase(testSuite.id, { title: 'テストケース1', orderKey: '00001' });
      await createTestCase(testSuite.id, { title: 'テストケース2', orderKey: '00002' });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}`)
        .expect(200);

      // findByIdは_countでpreconditionsとtestCasesの件数を返す（リレーション自体は含まない）
      expect(response.body.testSuite._count).toBeDefined();
      expect(response.body.testSuite._count.preconditions).toBe(2);
      expect(response.body.testSuite._count.testCases).toBe(2);
    });

    it('存在しないテストスイートは404エラー', async () => {
      const response = await request(app)
        .get('/api/test-suites/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('権限なし（mockTestSuiteRole=null）は403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', null);

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // PATCH /api/test-suites/:testSuiteId - テストスイート更新
  // ============================================================
  describe('PATCH /api/test-suites/:testSuiteId（更新）', () => {
    let testSuite: Awaited<ReturnType<typeof createTestSuite>>;

    beforeEach(async () => {
      testSuite = await createTestSuite(project.id, {
        name: '更新前のテストスイート',
        description: '更新前の説明',
        status: 'DRAFT',
      });
    });

    it('名前を更新できる', async () => {
      const response = await request(app)
        .patch(`/api/test-suites/${testSuite.id}`)
        .send({ name: '更新後のテストスイート' })
        .expect(200);

      expect(response.body.testSuite.name).toBe('更新後のテストスイート');
    });

    it('ステータスをDRAFTからACTIVEに変更できる', async () => {
      const response = await request(app)
        .patch(`/api/test-suites/${testSuite.id}`)
        .send({ status: 'ACTIVE' })
        .expect(200);

      expect(response.body.testSuite.status).toBe('ACTIVE');
    });

    it('ステータスをACTIVEからARCHIVEDに変更できる', async () => {
      // まずACTIVEに変更
      await prisma.testSuite.update({
        where: { id: testSuite.id },
        data: { status: 'ACTIVE' },
      });

      const response = await request(app)
        .patch(`/api/test-suites/${testSuite.id}`)
        .send({ status: 'ARCHIVED' })
        .expect(200);

      expect(response.body.testSuite.status).toBe('ARCHIVED');
    });

    it('説明を更新できる', async () => {
      const response = await request(app)
        .patch(`/api/test-suites/${testSuite.id}`)
        .send({ description: '更新後の説明' })
        .expect(200);

      expect(response.body.testSuite.description).toBe('更新後の説明');
    });

    it('READロールは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .patch(`/api/test-suites/${testSuite.id}`)
        .send({ name: '更新しようとするテストスイート' })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // DELETE /api/test-suites/:testSuiteId - テストスイート削除
  // ============================================================
  describe('DELETE /api/test-suites/:testSuiteId（削除）', () => {
    let testSuite: Awaited<ReturnType<typeof createTestSuite>>;

    beforeEach(async () => {
      testSuite = await createTestSuite(project.id, {
        name: '削除用テストスイート',
        description: '削除テスト用の説明',
      });
    });

    it('テストスイートを論理削除できる', async () => {
      await request(app)
        .delete(`/api/test-suites/${testSuite.id}`)
        .expect(204);

      // DBで論理削除されていることを確認
      const deletedSuite = await prisma.testSuite.findUnique({
        where: { id: testSuite.id },
      });
      expect(deletedSuite).not.toBeNull();
      expect(deletedSuite?.deletedAt).not.toBeNull();
    });

    it('削除後にdeletedAtが設定されていることを確認', async () => {
      const beforeDelete = new Date();

      await request(app)
        .delete(`/api/test-suites/${testSuite.id}`)
        .expect(204);

      const deletedSuite = await prisma.testSuite.findUnique({
        where: { id: testSuite.id },
      });
      expect(deletedSuite?.deletedAt).not.toBeNull();
      expect(new Date(deletedSuite!.deletedAt!).getTime()).toBeGreaterThanOrEqual(beforeDelete.getTime());
    });

    it('READロールは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .delete(`/api/test-suites/${testSuite.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('未認証は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .delete(`/api/test-suites/${testSuite.id}`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  // ============================================================
  // POST /api/test-suites/:testSuiteId/restore - テストスイート復元
  // ============================================================
  describe('POST /api/test-suites/:testSuiteId/restore（復元）', () => {
    let testSuite: Awaited<ReturnType<typeof createTestSuite>>;

    beforeEach(async () => {
      testSuite = await createTestSuite(project.id, {
        name: '復元用テストスイート',
        description: '復元テスト用の説明',
      });

      // テストスイートを論理削除状態にする
      await prisma.testSuite.update({
        where: { id: testSuite.id },
        data: { deletedAt: new Date() },
      });
    });

    it('削除されたテストスイートを復元できる', async () => {
      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/restore`)
        .expect(200);

      expect(response.body.testSuite).toBeDefined();
      expect(response.body.testSuite.id).toBe(testSuite.id);
      expect(response.body.testSuite.deletedAt).toBeNull();
    });

    it('復元後にdeletedAtがnullであることを確認', async () => {
      await request(app)
        .post(`/api/test-suites/${testSuite.id}/restore`)
        .expect(200);

      // DBで確認
      const restoredSuite = await prisma.testSuite.findUnique({
        where: { id: testSuite.id },
      });
      expect(restoredSuite).not.toBeNull();
      expect(restoredSuite?.deletedAt).toBeNull();
    });
  });

  // ============================================================
  // ロール別アクセステスト
  // ============================================================
  describe('ロール別アクセス', () => {
    let testSuite: Awaited<ReturnType<typeof createTestSuite>>;

    beforeEach(async () => {
      testSuite = await createTestSuite(project.id, {
        name: '権限テスト用テストスイート',
        description: '権限テスト用の説明',
      });
    });

    describe('OWNER/ADMINはすべて操作可能', () => {
      beforeEach(() => {
        setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN', 'ADMIN');
      });

      it('テストスイートを作成できる', async () => {
        await request(app)
          .post('/api/test-suites')
          .send({
            projectId: project.id,
            name: 'ADMIN作成テストスイート',
          })
          .expect(201);
      });

      it('テストスイート一覧を取得できる', async () => {
        await request(app)
          .get(`/api/projects/${project.id}/test-suites`)
          .expect(200);
      });

      it('テストスイート詳細を取得できる', async () => {
        await request(app)
          .get(`/api/test-suites/${testSuite.id}`)
          .expect(200);
      });

      it('テストスイートを更新できる', async () => {
        await request(app)
          .patch(`/api/test-suites/${testSuite.id}`)
          .send({ name: 'ADMIN更新テストスイート' })
          .expect(200);
      });

      it('テストスイートを削除できる', async () => {
        await request(app)
          .delete(`/api/test-suites/${testSuite.id}`)
          .expect(204);
      });

      it('テストスイートを復元できる', async () => {
        // まず削除
        await prisma.testSuite.update({
          where: { id: testSuite.id },
          data: { deletedAt: new Date() },
        });

        await request(app)
          .post(`/api/test-suites/${testSuite.id}/restore`)
          .expect(200);
      });
    });

    describe('WRITEは作成・更新・削除可能', () => {
      beforeEach(() => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');
      });

      it('テストスイートを作成できる', async () => {
        await request(app)
          .post('/api/test-suites')
          .send({
            projectId: project.id,
            name: 'WRITE作成テストスイート',
          })
          .expect(201);
      });

      it('テストスイート一覧を取得できる', async () => {
        await request(app)
          .get(`/api/projects/${project.id}/test-suites`)
          .expect(200);
      });

      it('テストスイート詳細を取得できる', async () => {
        await request(app)
          .get(`/api/test-suites/${testSuite.id}`)
          .expect(200);
      });

      it('テストスイートを更新できる', async () => {
        await request(app)
          .patch(`/api/test-suites/${testSuite.id}`)
          .send({ name: 'WRITE更新テストスイート' })
          .expect(200);
      });

      it('テストスイートの削除は403エラー（ADMINのみ）', async () => {
        await request(app)
          .delete(`/api/test-suites/${testSuite.id}`)
          .expect(403);
      });

      it('テストスイートの復元は403エラー（ADMINのみ）', async () => {
        // まず削除
        await prisma.testSuite.update({
          where: { id: testSuite.id },
          data: { deletedAt: new Date() },
        });

        await request(app)
          .post(`/api/test-suites/${testSuite.id}/restore`)
          .expect(403);
      });
    });

    describe('READは閲覧のみ可能', () => {
      beforeEach(() => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');
      });

      it('テストスイートの作成は403エラー', async () => {
        await request(app)
          .post('/api/test-suites')
          .send({
            projectId: project.id,
            name: 'READ作成テストスイート',
          })
          .expect(403);
      });

      it('テストスイート一覧を取得できる', async () => {
        await request(app)
          .get(`/api/projects/${project.id}/test-suites`)
          .expect(200);
      });

      it('テストスイート詳細を取得できる', async () => {
        await request(app)
          .get(`/api/test-suites/${testSuite.id}`)
          .expect(200);
      });

      it('テストスイートの更新は403エラー', async () => {
        await request(app)
          .patch(`/api/test-suites/${testSuite.id}`)
          .send({ name: 'READ更新テストスイート' })
          .expect(403);
      });

      it('テストスイートの削除は403エラー', async () => {
        await request(app)
          .delete(`/api/test-suites/${testSuite.id}`)
          .expect(403);
      });

      it('テストスイートの復元は403エラー', async () => {
        // まず削除
        await prisma.testSuite.update({
          where: { id: testSuite.id },
          data: { deletedAt: new Date() },
        });

        await request(app)
          .post(`/api/test-suites/${testSuite.id}/restore`)
          .expect(403);
      });
    });
  });
});
