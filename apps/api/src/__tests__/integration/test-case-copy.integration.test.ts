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
let mockProjectRole: string | null = null;

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

// テスト用認証設定関数
function setTestAuth(user: { id: string; email: string } | null, projectRole: string | null = null) {
  mockAuthUser = user;
  mockProjectRole = projectRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockProjectRole = null;
}

describe('Test Case Copy API Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let writer: Awaited<ReturnType<typeof createTestUser>>;
  let reader: Awaited<ReturnType<typeof createTestUser>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let testSuite: Awaited<ReturnType<typeof createTestSuite>>;
  let targetTestSuite: Awaited<ReturnType<typeof createTestSuite>>;

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
    writer = await createTestUser({ email: 'writer@example.com', name: 'Writer' });
    reader = await createTestUser({ email: 'reader@example.com', name: 'Reader' });

    // プロジェクトを作成
    project = await createTestProject(owner.id, {
      name: 'Test Project',
      description: 'Test description',
    });

    // メンバーを追加
    await createTestProjectMember(project.id, writer.id, 'WRITE');
    await createTestProjectMember(project.id, reader.id, 'READ');

    // テストスイートを作成
    testSuite = await createTestSuite(project.id, {
      name: 'Source Test Suite',
      description: 'Source Test Suite Description',
    });

    // コピー先テストスイートを作成
    targetTestSuite = await createTestSuite(project.id, {
      name: 'Target Test Suite',
      description: 'Target Test Suite Description',
    });

    // デフォルトでオーナーとして認証
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN');
  });

  // ============================================================
  // POST /api/test-cases/:testCaseId/copy - テストケースコピー
  // ============================================================
  describe('POST /api/test-cases/:testCaseId/copy', () => {
    describe('正常系', () => {
      it('201 - テストケースをコピーできる', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          description: 'テストケースの説明',
          priority: 'HIGH',
          status: 'ACTIVE',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({})
          .expect(201);

        expect(response.body.testCase).toBeDefined();
        expect(response.body.testCase.title).toBe('コピー元テストケース (コピー)');
        expect(response.body.testCase.description).toBe('テストケースの説明');
        expect(response.body.testCase.priority).toBe('HIGH');
        expect(response.body.testCase.status).toBe('DRAFT');
        expect(response.body.testCase.testSuiteId).toBe(testSuite.id);
      });

      it('前提条件・ステップ・期待結果が完全にコピーされる', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });
        await createTestCasePrecondition(testCase.id, { content: '前提条件1', orderKey: '00001' });
        await createTestCasePrecondition(testCase.id, { content: '前提条件2', orderKey: '00002' });
        await createTestCaseStep(testCase.id, { content: 'ステップ1', orderKey: '00001' });
        await createTestCaseStep(testCase.id, { content: 'ステップ2', orderKey: '00002' });
        await createTestCaseExpectedResult(testCase.id, { content: '期待結果1', orderKey: '00001' });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({})
          .expect(201);

        expect(response.body.testCase.preconditions).toHaveLength(2);
        expect(response.body.testCase.preconditions[0].content).toBe('前提条件1');
        expect(response.body.testCase.preconditions[1].content).toBe('前提条件2');
        expect(response.body.testCase.steps).toHaveLength(2);
        expect(response.body.testCase.steps[0].content).toBe('ステップ1');
        expect(response.body.testCase.steps[1].content).toBe('ステップ2');
        expect(response.body.testCase.expectedResults).toHaveLength(1);
        expect(response.body.testCase.expectedResults[0].content).toBe('期待結果1');
      });

      it('レスポンスに完全なテストケース詳細が含まれる', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({})
          .expect(201);

        expect(response.body.testCase.id).toBeDefined();
        expect(response.body.testCase.testSuite).toBeDefined();
        expect(response.body.testCase.testSuite.id).toBe(testSuite.id);
        expect(response.body.testCase.testSuite.name).toBe('Source Test Suite');
        expect(response.body.testCase.createdByUser).toBeDefined();
        expect(response.body.testCase.createdByUser.id).toBe(owner.id);
        expect(response.body.testCase.preconditions).toBeDefined();
        expect(response.body.testCase.steps).toBeDefined();
        expect(response.body.testCase.expectedResults).toBeDefined();
      });

      it('別のテストスイートにコピーできる', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({ targetTestSuiteId: targetTestSuite.id })
          .expect(201);

        expect(response.body.testCase.testSuiteId).toBe(targetTestSuite.id);
        expect(response.body.testCase.testSuite.id).toBe(targetTestSuite.id);
        expect(response.body.testCase.testSuite.name).toBe('Target Test Suite');
      });

      it('カスタムタイトルを指定できる', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({ title: 'カスタムタイトル' })
          .expect(201);

        expect(response.body.testCase.title).toBe('カスタムタイトル');
      });

      it('履歴が記録される', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({})
          .expect(201);

        // 履歴を確認
        const history = await prisma.testCaseHistory.findFirst({
          where: { testCaseId: response.body.testCase.id },
        });

        expect(history).toBeDefined();
        expect(history?.changeType).toBe('CREATE');
        expect(history?.changedByUserId).toBe(owner.id);
        const snapshot = history?.snapshot as any;
        expect(snapshot.changeDetail.type).toBe('COPY');
        expect(snapshot.changeDetail.sourceTestCaseId).toBe(testCase.id);
      });
    });

    describe('異常系', () => {
      it('404 - 存在しないテストケース', async () => {
        const response = await request(app)
          .post('/api/test-cases/00000000-0000-0000-0000-000000000000/copy')
          .send({})
          .expect(404);

        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('400 - 削除済みテストケースからのコピー', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });
        await prisma.testCase.update({
          where: { id: testCase.id },
          data: { deletedAt: new Date() },
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({})
          .expect(400);

        expect(response.body.error.code).toBe('BAD_REQUEST');
        expect(response.body.error.message).toBe('削除済みテストケースはコピーできません');
      });

      it('400 - 別プロジェクトへのコピー', async () => {
        // 別プロジェクトを作成
        const otherProject = await createTestProject(owner.id, {
          name: 'Other Project',
        });
        const otherTestSuite = await createTestSuite(otherProject.id, {
          name: 'Other Test Suite',
        });

        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({ targetTestSuiteId: otherTestSuite.id })
          .expect(400);

        expect(response.body.error.code).toBe('BAD_REQUEST');
        expect(response.body.error.message).toBe('異なるプロジェクトへのコピーはできません');
      });

      it('400 - 無効なUUID形式のtargetTestSuiteId', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({ targetTestSuiteId: 'invalid-uuid' })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('404 - 存在しないコピー先テストスイート', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({ targetTestSuiteId: '00000000-0000-0000-0000-000000000000' })
          .expect(404);

        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('404 - 削除済みテストスイートへのコピー', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });

        // コピー先テストスイートを削除
        await prisma.testSuite.update({
          where: { id: targetTestSuite.id },
          data: { deletedAt: new Date() },
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({ targetTestSuiteId: targetTestSuite.id })
          .expect(404);

        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('認証・認可', () => {
      it('401 - 未認証', async () => {
        clearTestAuth();

        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({})
          .expect(401);

        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });

      it('認証済みユーザーはコピー可能', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({})
          .expect(201);

        expect(response.body.testCase).toBeDefined();
        expect(response.body.testCase.createdByUser.id).toBe(writer.id);
      });
    });

    describe('エッジケース', () => {
      it('子エンティティがないテストケースもコピーできる', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({})
          .expect(201);

        expect(response.body.testCase.preconditions).toHaveLength(0);
        expect(response.body.testCase.steps).toHaveLength(0);
        expect(response.body.testCase.expectedResults).toHaveLength(0);
      });

      it('コピー後のステータスは常にDRAFT', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          status: 'ACTIVE',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({})
          .expect(201);

        expect(response.body.testCase.status).toBe('DRAFT');
      });

      it('優先度がコピーされる', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          priority: 'CRITICAL',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({})
          .expect(201);

        expect(response.body.testCase.priority).toBe('CRITICAL');
      });

      it('説明がnullでもコピーできる', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          description: null,
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({})
          .expect(201);

        expect(response.body.testCase.description).toBeNull();
      });

      it('orderKeyが正しく生成される', async () => {
        // 既存のテストケースを作成
        await createTestCase(testSuite.id, {
          title: '既存テストケース1',
          orderKey: '00001',
          createdByUserId: owner.id,
        });
        await createTestCase(testSuite.id, {
          title: '既存テストケース2',
          orderKey: '00002',
          createdByUserId: owner.id,
        });

        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          orderKey: '00003',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({})
          .expect(201);

        expect(response.body.testCase.orderKey).toBe('00004');
      });

      it('空のテストスイートへのコピーでorderKeyが初期値になる', async () => {
        const testCase = await createTestCase(testSuite.id, {
          title: 'コピー元テストケース',
          createdByUserId: owner.id,
        });

        const response = await request(app)
          .post(`/api/test-cases/${testCase.id}/copy`)
          .send({ targetTestSuiteId: targetTestSuite.id })
          .expect(201);

        expect(response.body.testCase.orderKey).toBe('00001');
      });
    });
  });
});
