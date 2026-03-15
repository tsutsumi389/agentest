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
// 結合テストではロールベースのアクセス制御パターンをテスト
// 実際のDB権限チェックはユニットテストでカバー
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

describe('Test Case Authorization Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let writer: Awaited<ReturnType<typeof createTestUser>>;
  let reader: Awaited<ReturnType<typeof createTestUser>>;
  let nonMember: Awaited<ReturnType<typeof createTestUser>>;
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
    clearTestAuth();

    // テストユーザーを作成
    owner = await createTestUser({ email: 'owner@example.com', name: 'Owner' });
    admin = await createTestUser({ email: 'admin@example.com', name: 'Admin' });
    writer = await createTestUser({ email: 'writer@example.com', name: 'Writer' });
    reader = await createTestUser({ email: 'reader@example.com', name: 'Reader' });
    nonMember = await createTestUser({ email: 'nonmember@example.com', name: 'Non Member' });

    // プロジェクトを作成（オーナーはcreateTestProject内で登録）
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

    // テストケースを作成
    testCase = await createTestCase(testSuite.id, {
      title: 'Test Case',
      description: 'Test Case Description',
      createdByUserId: owner.id,
    });
  });

  // ============================================================
  // 読み取り操作のテスト
  // ============================================================
  describe('読み取り操作（GET）', () => {
    describe('GET /api/test-cases/:testCaseId', () => {
      it('401 - 未認証ユーザーは拒否', async () => {
        clearTestAuth();

        await request(app).get(`/api/test-cases/${testCase.id}`).expect(401);
      });

      it('403 - 権限のないユーザーは拒否', async () => {
        setTestAuth({ id: nonMember.id, email: nonMember.email }, null);

        const response = await request(app).get(`/api/test-cases/${testCase.id}`).expect(403);

        expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
        expect(response.body.error.message).toBe('Insufficient permissions');
      });

      it('200 - READロールで読み取り可能', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ');

        const response = await request(app).get(`/api/test-cases/${testCase.id}`).expect(200);

        expect(response.body.testCase.id).toBe(testCase.id);
      });

      it('200 - WRITEロールで読み取り可能', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

        const response = await request(app).get(`/api/test-cases/${testCase.id}`).expect(200);

        expect(response.body.testCase.id).toBe(testCase.id);
      });

      it('200 - ADMINロールで読み取り可能', async () => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

        const response = await request(app).get(`/api/test-cases/${testCase.id}`).expect(200);

        expect(response.body.testCase.id).toBe(testCase.id);
      });

      it('200 - OWNERロールで読み取り可能', async () => {
        setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

        const response = await request(app).get(`/api/test-cases/${testCase.id}`).expect(200);

        expect(response.body.testCase.id).toBe(testCase.id);
      });
    });

    describe('GET /api/test-cases/:testCaseId/preconditions', () => {
      it('403 - 権限のないユーザーは拒否', async () => {
        setTestAuth({ id: nonMember.id, email: nonMember.email }, null);

        await request(app).get(`/api/test-cases/${testCase.id}/preconditions`).expect(403);
      });

      it('200 - READロールで読み取り可能', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ');

        await request(app).get(`/api/test-cases/${testCase.id}/preconditions`).expect(200);
      });
    });
  });

  // ============================================================
  // 書き込み操作のテスト
  // ============================================================
  describe('書き込み操作（PATCH/POST/DELETE）', () => {
    describe('PATCH /api/test-cases/:testCaseId', () => {
      it('403 - READロールは書き込み拒否', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ');

        const response = await request(app)
          .patch(`/api/test-cases/${testCase.id}`)
          .send({ title: 'Updated Title' })
          .expect(403);

        expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
        expect(response.body.error.message).toBe('Insufficient permissions');
      });

      it('200 - WRITEロールで更新可能', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

        const response = await request(app)
          .patch(`/api/test-cases/${testCase.id}`)
          .send({ title: 'Updated Title' })
          .expect(200);

        expect(response.body.testCase.title).toBe('Updated Title');
      });

      it('200 - ADMINロールで更新可能', async () => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

        const response = await request(app)
          .patch(`/api/test-cases/${testCase.id}`)
          .send({ title: 'Admin Updated' })
          .expect(200);

        expect(response.body.testCase.title).toBe('Admin Updated');
      });

      it('200 - OWNERロールで更新可能', async () => {
        setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

        const response = await request(app)
          .patch(`/api/test-cases/${testCase.id}`)
          .send({ title: 'Owner Updated' })
          .expect(200);

        expect(response.body.testCase.title).toBe('Owner Updated');
      });
    });

    describe('DELETE /api/test-cases/:testCaseId', () => {
      it('403 - READロールは削除拒否', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ');

        await request(app).delete(`/api/test-cases/${testCase.id}`).expect(403);
      });

      it('204 - WRITEロールで削除可能', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

        await request(app).delete(`/api/test-cases/${testCase.id}`).expect(204);

        // 論理削除を確認
        const deleted = await prisma.testCase.findUnique({
          where: { id: testCase.id },
        });
        expect(deleted?.deletedAt).not.toBeNull();
      });
    });

    describe('POST /api/test-cases/:testCaseId/steps', () => {
      it('403 - READロールはステップ追加拒否', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ');

        await request(app)
          .post(`/api/test-cases/${testCase.id}/steps`)
          .send({ content: 'New Step' })
          .expect(403);
      });

      it('201 - WRITEロールでステップ追加可能', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/steps`)
          .send({ content: 'New Step' })
          .expect(201);

        expect(response.body.step.content).toBe('New Step');
      });
    });
  });

  // ============================================================
  // テストケース作成時の認可テスト（サービス層で認可）
  // ============================================================
  describe('POST /api/test-cases（作成時の認可）', () => {
    it('401 - 未認証ユーザーは作成拒否', async () => {
      clearTestAuth();

      await request(app)
        .post('/api/test-cases')
        .send({
          testSuiteId: testSuite.id,
          title: 'New Test Case',
        })
        .expect(401);
    });

    it('201 - WRITEロールで作成可能', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .post('/api/test-cases')
        .send({
          testSuiteId: testSuite.id,
          title: 'New Test Case',
        })
        .expect(201);

      expect(response.body.testCase.title).toBe('New Test Case');
    });

    it('201 - ADMINロールで作成可能', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      const response = await request(app)
        .post('/api/test-cases')
        .send({
          testSuiteId: testSuite.id,
          title: 'Admin Created',
        })
        .expect(201);

      expect(response.body.testCase.title).toBe('Admin Created');
    });

    it('201 - OWNERロールで作成可能', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');

      const response = await request(app)
        .post('/api/test-cases')
        .send({
          testSuiteId: testSuite.id,
          title: 'Owner Created',
        })
        .expect(201);

      expect(response.body.testCase.title).toBe('Owner Created');
    });
  });
});
