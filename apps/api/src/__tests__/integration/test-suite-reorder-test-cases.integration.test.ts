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
  requireProjectRole: (roles: string[]) => (_req: any, _res: any, next: any) => {
    if (!mockProjectRole || !roles.includes(mockProjectRole)) {
      return next(new AuthorizationError('権限がありません'));
    }
    next();
  },
  authenticate: (options: { optional?: boolean } = {}) => (req: any, _res: any, next: any) => { if (mockAuthUser) req.user = mockAuthUser; next(); },
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
  requireTestSuiteRole:
    (roles: string[], _options?: { allowDeletedSuite?: boolean }) =>
    async (req: any, _res: any, next: any) => {
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
        if (testSuite.deletedAt) {
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

describe('Test Suite Reorder Test Cases API Integration Tests', () => {
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
  // POST /api/test-suites/:testSuiteId/test-cases/reorder
  // ============================================================
  describe('POST /api/test-suites/:testSuiteId/test-cases/reorder', () => {
    let testCase1: Awaited<ReturnType<typeof createTestCase>>;
    let testCase2: Awaited<ReturnType<typeof createTestCase>>;
    let testCase3: Awaited<ReturnType<typeof createTestCase>>;

    beforeEach(async () => {
      testCase1 = await createTestCase(testSuite.id, {
        title: 'First Test Case',
        orderKey: '00001',
        createdByUserId: owner.id,
      });
      testCase2 = await createTestCase(testSuite.id, {
        title: 'Second Test Case',
        orderKey: '00002',
        createdByUserId: owner.id,
      });
      testCase3 = await createTestCase(testSuite.id, {
        title: 'Third Test Case',
        orderKey: '00003',
        createdByUserId: owner.id,
      });
    });

    // ============================================================
    // 正常系
    // ============================================================
    describe('正常系', () => {
      it('テストケースを並び替えできる', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');

        const response = await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase3.id, testCase1.id, testCase2.id],
          })
          .expect(200);

        expect(response.body.testCases).toHaveLength(3);
        // orderKeyが更新されて、指定した順序になっている
        const orderedTitles = response.body.testCases.map((tc: any) => tc.title);
        expect(orderedTitles).toEqual(['Third Test Case', 'First Test Case', 'Second Test Case']);
      });

      it('並び替え後のorderKeyが正しく反映されている', async () => {
        await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase3.id, testCase1.id, testCase2.id],
          })
          .expect(200);

        // DBから直接確認
        const testCases = await prisma.testCase.findMany({
          where: { testSuiteId: testSuite.id, deletedAt: null },
          orderBy: { orderKey: 'asc' },
        });

        expect(testCases[0].id).toBe(testCase3.id);
        expect(testCases[0].orderKey).toBe('00001');
        expect(testCases[1].id).toBe(testCase1.id);
        expect(testCases[1].orderKey).toBe('00002');
        expect(testCases[2].id).toBe(testCase2.id);
        expect(testCases[2].orderKey).toBe('00003');
      });

      it('並び替え後の一覧取得で順序が反映されている', async () => {
        await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase3.id, testCase1.id, testCase2.id],
          })
          .expect(200);

        // 一覧取得で確認
        const response = await request(app)
          .get(`/api/test-suites/${testSuite.id}/test-cases`)
          .expect(200);

        const titles = response.body.testCases.map((tc: any) => tc.title);
        expect(titles).toEqual(['Third Test Case', 'First Test Case', 'Second Test Case']);
      });

      it('履歴が作成される', async () => {
        await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase3.id, testCase1.id, testCase2.id],
          })
          .expect(200);

        const history = await prisma.testSuiteHistory.findFirst({
          where: {
            testSuiteId: testSuite.id,
            changeType: 'UPDATE',
          },
          orderBy: { createdAt: 'desc' },
        });

        expect(history).not.toBeNull();
        expect(history?.changedByUserId).toBe(owner.id);
        expect(history?.snapshot).toEqual(
          expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'TEST_CASE_REORDER',
              before: [testCase1.id, testCase2.id, testCase3.id],
              after: [testCase3.id, testCase1.id, testCase2.id],
            }),
          })
        );
      });
    });

    // ============================================================
    // バリデーションエラー
    // ============================================================
    describe('バリデーションエラー', () => {
      it('testCaseIdsが空配列は400エラー', async () => {
        const response = await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [],
          })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('testCaseIdsにUUID以外は400エラー', async () => {
        const response = await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase1.id, 'invalid-uuid', testCase3.id],
          })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('重複したIDは400エラー', async () => {
        const response = await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase1.id, testCase1.id, testCase2.id],
          })
          .expect(400);

        expect(response.body.error.code).toBe('BAD_REQUEST');
        expect(response.body.error.message).toContain('重複');
      });

      it('存在しないテストケースIDは400エラー', async () => {
        const response = await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase1.id, testCase2.id, '00000000-0000-0000-0000-000000000000'],
          })
          .expect(400);

        expect(response.body.error.code).toBe('BAD_REQUEST');
        expect(response.body.error.message).toContain('存在しない');
      });

      it('一部のテストケースのみ指定は400エラー', async () => {
        const response = await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase1.id, testCase2.id],
          })
          .expect(400);

        expect(response.body.error.code).toBe('BAD_REQUEST');
        expect(response.body.error.message).toContain('すべて');
      });
    });

    // ============================================================
    // エラーケース
    // ============================================================
    describe('エラーケース', () => {
      it('存在しないテストスイートは404エラー', async () => {
        const response = await request(app)
          .post('/api/test-suites/00000000-0000-0000-0000-000000000000/test-cases/reorder')
          .send({
            testCaseIds: [testCase1.id, testCase2.id, testCase3.id],
          })
          .expect(404);

        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('削除済みテストスイートは404エラー', async () => {
        // テストスイートを削除
        await prisma.testSuite.update({
          where: { id: testSuite.id },
          data: { deletedAt: new Date() },
        });

        const response = await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase1.id, testCase2.id, testCase3.id],
          })
          .expect(404);

        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });

    // ============================================================
    // 認証・認可
    // ============================================================
    describe('認証・認可', () => {
      it('未認証は401エラー', async () => {
        clearTestAuth();

        const response = await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase1.id, testCase2.id, testCase3.id],
          })
          .expect(401);

        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });

      it('ADMINは並び替え可能', async () => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN', 'ADMIN');

        await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase3.id, testCase1.id, testCase2.id],
          })
          .expect(200);
      });

      it('WRITEは並び替え可能', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');

        await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase3.id, testCase1.id, testCase2.id],
          })
          .expect(200);
      });

      it('READは並び替え不可（403エラー）', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

        const response = await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase3.id, testCase1.id, testCase2.id],
          })
          .expect(403);

        expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
      });
    });

    // ============================================================
    // エッジケース
    // ============================================================
    describe('エッジケース', () => {
      // Note: 空配列はバリデーションで400エラーとなるため、
      // テストケース0件のケースは「バリデーションエラー」セクションでテスト済み

      it('順序が変わらない場合も200で返す', async () => {
        const response = await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase1.id, testCase2.id, testCase3.id],
          })
          .expect(200);

        expect(response.body.testCases).toHaveLength(3);
        // 順序は変わらない
        const orderedTitles = response.body.testCases.map((tc: any) => tc.title);
        expect(orderedTitles).toEqual(['First Test Case', 'Second Test Case', 'Third Test Case']);
      });

      it('削除済みテストケースは並び替え対象外', async () => {
        // testCase2を削除
        await prisma.testCase.update({
          where: { id: testCase2.id },
          data: { deletedAt: new Date() },
        });

        // 残りの2件のみで並び替え
        const response = await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase3.id, testCase1.id],
          })
          .expect(200);

        expect(response.body.testCases).toHaveLength(2);
        const orderedTitles = response.body.testCases.map((tc: any) => tc.title);
        expect(orderedTitles).toEqual(['Third Test Case', 'First Test Case']);
      });

      it('別のテストスイートのテストケースを含む場合は400エラー', async () => {
        // 別のテストスイートを作成
        const anotherSuite = await createTestSuite(project.id, { name: 'Another Suite' });
        const anotherTestCase = await createTestCase(anotherSuite.id, {
          title: 'Another Test Case',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-suites/${testSuite.id}/test-cases/reorder`)
          .send({
            testCaseIds: [testCase1.id, anotherTestCase.id],
          })
          .expect(400);

        expect(response.body.error.code).toBe('BAD_REQUEST');
      });
    });
  });
});
