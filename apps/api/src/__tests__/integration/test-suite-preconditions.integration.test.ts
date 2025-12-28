import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestProjectMember,
  createTestSuite,
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
  requireProjectRole: (roles: string[]) => (req: any, _res: any, next: any) => {
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
  requireTestSuiteRole: (roles: string[], _options?: { allowDeletedSuite?: boolean }) => async (req: any, _res: any, next: any) => {
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

describe('Test Suite Preconditions API Integration Tests', () => {
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
  // GET /api/test-suites/:testSuiteId/preconditions - 前提条件一覧取得
  // ============================================================
  describe('GET /api/test-suites/:testSuiteId/preconditions', () => {
    beforeEach(async () => {
      // 前提条件を作成
      await createTestPrecondition(testSuite.id, { content: 'First precondition', orderKey: 'a' });
      await createTestPrecondition(testSuite.id, { content: 'Second precondition', orderKey: 'b' });
    });

    it('前提条件一覧を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/preconditions`)
        .expect(200);

      expect(response.body.preconditions).toHaveLength(2);
    });

    it('orderKeyの昇順で返される', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/preconditions`)
        .expect(200);

      expect(response.body.preconditions[0].content).toBe('First precondition');
      expect(response.body.preconditions[1].content).toBe('Second precondition');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/preconditions`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('権限がない場合は403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', null);

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/preconditions`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('存在しないテストスイートは404エラー', async () => {
      const response = await request(app)
        .get('/api/test-suites/00000000-0000-0000-0000-000000000000/preconditions')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ============================================================
  // POST /api/test-suites/:testSuiteId/preconditions - 前提条件追加
  // ============================================================
  describe('POST /api/test-suites/:testSuiteId/preconditions', () => {
    it('前提条件を追加できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');

      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions`)
        .send({
          content: 'New precondition',
        })
        .expect(201);

      expect(response.body.precondition.content).toBe('New precondition');
      expect(response.body.precondition.testSuiteId).toBe(testSuite.id);
    });

    it('orderKeyを指定して追加できる', async () => {
      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions`)
        .send({
          content: 'New precondition',
          orderKey: 'custom-key',
        })
        .expect(201);

      expect(response.body.precondition.orderKey).toBe('custom-key');
    });

    it('空のcontentは400エラー', async () => {
      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions`)
        .send({
          content: '',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('contentがない場合は400エラー', async () => {
      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('READ権限では追加できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions`)
        .send({
          content: 'New precondition',
        })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('存在しないテストスイートには追加できない', async () => {
      const response = await request(app)
        .post('/api/test-suites/00000000-0000-0000-0000-000000000000/preconditions')
        .send({
          content: 'New precondition',
        })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ============================================================
  // PATCH /api/test-suites/:testSuiteId/preconditions/:preconditionId - 前提条件更新
  // ============================================================
  describe('PATCH /api/test-suites/:testSuiteId/preconditions/:preconditionId', () => {
    let precondition: Awaited<ReturnType<typeof createTestPrecondition>>;

    beforeEach(async () => {
      precondition = await createTestPrecondition(testSuite.id, {
        content: 'Original content',
        orderKey: 'a',
      });
    });

    it('前提条件を更新できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');

      const response = await request(app)
        .patch(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
        .send({
          content: 'Updated content',
        })
        .expect(200);

      expect(response.body.precondition.content).toBe('Updated content');
    });

    it('空のcontentへの更新は400エラー', async () => {
      const response = await request(app)
        .patch(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
        .send({
          content: '',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('存在しない前提条件は404エラー', async () => {
      const response = await request(app)
        .patch(`/api/test-suites/${testSuite.id}/preconditions/00000000-0000-0000-0000-000000000000`)
        .send({
          content: 'Updated content',
        })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('別のテストスイートの前提条件は更新できない', async () => {
      // 別のテストスイートを作成
      const anotherSuite = await createTestSuite(project.id, { name: 'Another Suite' });
      const anotherPrecondition = await createTestPrecondition(anotherSuite.id, {
        content: 'Another precondition',
      });

      const response = await request(app)
        .patch(`/api/test-suites/${testSuite.id}/preconditions/${anotherPrecondition.id}`)
        .send({
          content: 'Updated content',
        })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('READ権限では更新できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .patch(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
        .send({
          content: 'Updated content',
        })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // DELETE /api/test-suites/:testSuiteId/preconditions/:preconditionId - 前提条件削除
  // ============================================================
  describe('DELETE /api/test-suites/:testSuiteId/preconditions/:preconditionId', () => {
    let precondition: Awaited<ReturnType<typeof createTestPrecondition>>;

    beforeEach(async () => {
      precondition = await createTestPrecondition(testSuite.id, {
        content: 'To be deleted',
        orderKey: 'a',
      });
    });

    it('前提条件を削除できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');

      await request(app)
        .delete(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
        .expect(204);

      // DBから削除されていることを確認
      const deleted = await prisma.testSuitePrecondition.findUnique({
        where: { id: precondition.id },
      });
      expect(deleted).toBeNull();
    });

    it('存在しない前提条件は404エラー', async () => {
      const response = await request(app)
        .delete(`/api/test-suites/${testSuite.id}/preconditions/00000000-0000-0000-0000-000000000000`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('別のテストスイートの前提条件は削除できない', async () => {
      // 別のテストスイートを作成
      const anotherSuite = await createTestSuite(project.id, { name: 'Another Suite' });
      const anotherPrecondition = await createTestPrecondition(anotherSuite.id, {
        content: 'Another precondition',
      });

      const response = await request(app)
        .delete(`/api/test-suites/${testSuite.id}/preconditions/${anotherPrecondition.id}`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('READ権限では削除できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .delete(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // POST /api/test-suites/:testSuiteId/preconditions/reorder - 前提条件並替
  // ============================================================
  describe('POST /api/test-suites/:testSuiteId/preconditions/reorder', () => {
    let precondition1: Awaited<ReturnType<typeof createTestPrecondition>>;
    let precondition2: Awaited<ReturnType<typeof createTestPrecondition>>;
    let precondition3: Awaited<ReturnType<typeof createTestPrecondition>>;

    beforeEach(async () => {
      precondition1 = await createTestPrecondition(testSuite.id, { content: 'First', orderKey: 'a' });
      precondition2 = await createTestPrecondition(testSuite.id, { content: 'Second', orderKey: 'b' });
      precondition3 = await createTestPrecondition(testSuite.id, { content: 'Third', orderKey: 'c' });
    });

    it('前提条件の並び順を変更できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');

      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions/reorder`)
        .send({
          preconditionIds: [precondition3.id, precondition1.id, precondition2.id],
        })
        .expect(200);

      expect(response.body.preconditions).toHaveLength(3);
      // orderKeyが更新されて、指定した順序になっている
      const orderedContents = response.body.preconditions.map((p: any) => p.content);
      expect(orderedContents).toEqual(['Third', 'First', 'Second']);
    });

    it('一部の前提条件のみ指定した場合は400エラー', async () => {
      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions/reorder`)
        .send({
          preconditionIds: [precondition2.id, precondition1.id],
        })
        .expect(400);

      // 全件指定が必要
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('存在しない前提条件IDを含む場合は400エラー', async () => {
      // 全件数が一致しないため、まず400エラーになる
      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions/reorder`)
        .send({
          preconditionIds: [precondition1.id, '00000000-0000-0000-0000-000000000000'],
        })
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('無効なUUID形式はバリデーションエラー', async () => {
      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions/reorder`)
        .send({
          preconditionIds: [precondition1.id, 'invalid-uuid'],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('空の配列は400エラー', async () => {
      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions/reorder`)
        .send({
          preconditionIds: [],
        })
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('別のテストスイートの前提条件を含む場合は400エラー', async () => {
      // 別のテストスイートを作成
      const anotherSuite = await createTestSuite(project.id, { name: 'Another Suite' });
      const anotherPrecondition = await createTestPrecondition(anotherSuite.id, {
        content: 'Another precondition',
      });

      // 全件数が一致しないため、まず400エラーになる
      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions/reorder`)
        .send({
          preconditionIds: [precondition1.id, anotherPrecondition.id],
        })
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('READ権限では並替できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/preconditions/reorder`)
        .send({
          preconditionIds: [precondition2.id, precondition1.id],
        })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // 権限マトリクステスト
  // ============================================================
  describe('Permission Matrix', () => {
    let precondition: Awaited<ReturnType<typeof createTestPrecondition>>;

    beforeEach(async () => {
      precondition = await createTestPrecondition(testSuite.id, { content: 'Test precondition' });
    });

    describe('ADMIN role', () => {
      beforeEach(() => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN', 'ADMIN');
      });

      it('前提条件一覧を取得できる', async () => {
        await request(app)
          .get(`/api/test-suites/${testSuite.id}/preconditions`)
          .expect(200);
      });

      it('前提条件を追加できる', async () => {
        await request(app)
          .post(`/api/test-suites/${testSuite.id}/preconditions`)
          .send({ content: 'New' })
          .expect(201);
      });

      it('前提条件を更新できる', async () => {
        await request(app)
          .patch(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
          .send({ content: 'Updated' })
          .expect(200);
      });

      it('前提条件を削除できる', async () => {
        await request(app)
          .delete(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
          .expect(204);
      });

      it('前提条件を並替できる', async () => {
        const another = await createTestPrecondition(testSuite.id, { content: 'Another' });
        await request(app)
          .post(`/api/test-suites/${testSuite.id}/preconditions/reorder`)
          .send({ preconditionIds: [another.id, precondition.id] })
          .expect(200);
      });
    });

    describe('WRITE role', () => {
      beforeEach(() => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');
      });

      it('前提条件一覧を取得できる', async () => {
        await request(app)
          .get(`/api/test-suites/${testSuite.id}/preconditions`)
          .expect(200);
      });

      it('前提条件を追加できる', async () => {
        await request(app)
          .post(`/api/test-suites/${testSuite.id}/preconditions`)
          .send({ content: 'New' })
          .expect(201);
      });

      it('前提条件を更新できる', async () => {
        await request(app)
          .patch(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
          .send({ content: 'Updated' })
          .expect(200);
      });

      it('前提条件を削除できる', async () => {
        await request(app)
          .delete(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
          .expect(204);
      });

      it('前提条件を並替できる', async () => {
        const another = await createTestPrecondition(testSuite.id, { content: 'Another' });
        await request(app)
          .post(`/api/test-suites/${testSuite.id}/preconditions/reorder`)
          .send({ preconditionIds: [another.id, precondition.id] })
          .expect(200);
      });
    });

    describe('READ role', () => {
      beforeEach(() => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');
      });

      it('前提条件一覧を取得できる', async () => {
        await request(app)
          .get(`/api/test-suites/${testSuite.id}/preconditions`)
          .expect(200);
      });

      it('前提条件を追加できない', async () => {
        await request(app)
          .post(`/api/test-suites/${testSuite.id}/preconditions`)
          .send({ content: 'New' })
          .expect(403);
      });

      it('前提条件を更新できない', async () => {
        await request(app)
          .patch(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
          .send({ content: 'Updated' })
          .expect(403);
      });

      it('前提条件を削除できない', async () => {
        await request(app)
          .delete(`/api/test-suites/${testSuite.id}/preconditions/${precondition.id}`)
          .expect(403);
      });

      it('前提条件を並替できない', async () => {
        const another = await createTestPrecondition(testSuite.id, { content: 'Another' });
        await request(app)
          .post(`/api/test-suites/${testSuite.id}/preconditions/reorder`)
          .send({ preconditionIds: [another.id, precondition.id] })
          .expect(403);
      });
    });
  });
});
