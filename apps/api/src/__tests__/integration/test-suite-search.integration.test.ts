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
  requireProjectRole: (roles: string[]) => (_req: any, _res: any, next: any) => {
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

describe('Test Suite Search API Integration Tests', () => {
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
      description: 'Test description',
    });

    // メンバーを追加
    await createTestProjectMember(project.id, admin.id, 'ADMIN');
    await createTestProjectMember(project.id, writer.id, 'WRITE');
    await createTestProjectMember(project.id, reader.id, 'READ');

    // デフォルトでオーナーとして認証（ADMIN権限相当）
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN');
  });

  // ============================================================
  // GET /api/projects/:projectId/test-suites - テストスイート検索
  // ============================================================
  describe('GET /api/projects/:projectId/test-suites', () => {
    beforeEach(async () => {
      // テストスイートを作成
      await createTestSuite(project.id, {
        name: 'Login Test Suite',
        description: 'Tests for login functionality',
      });
      await createTestSuite(project.id, {
        name: 'Payment Test Suite',
        description: 'Tests for payment processing',
      });
      await createTestSuite(project.id, {
        name: 'User Management Suite',
        description: 'Tests for user management',
      });
    });

    it('テストスイート一覧を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(3);
      expect(response.body.total).toBe(3);
    });

    it('名前で検索できる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?q=Login`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(1);
      expect(response.body.testSuites[0].name).toBe('Login Test Suite');
    });

    it('部分一致で検索できる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?q=Test`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(2); // Login Test Suite, Payment Test Suite
    });

    it('大文字小文字を区別しない検索ができる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?q=login`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(1);
      expect(response.body.testSuites[0].name).toBe('Login Test Suite');
    });

    it('前提条件の内容でも検索できる', async () => {
      // 前提条件を追加
      const suite = await prisma.testSuite.findFirst({
        where: { name: 'Login Test Suite' },
      });
      await createTestPrecondition(suite!.id, { content: 'User must be authenticated' });

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?q=authenticated`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(1);
      expect(response.body.testSuites[0].name).toBe('Login Test Suite');
    });

    it('ステータスでフィルタできる', async () => {
      // 1つのスイートをACTIVEに変更
      const suite = await prisma.testSuite.findFirst({
        where: { name: 'Login Test Suite' },
      });
      await prisma.testSuite.update({
        where: { id: suite!.id },
        data: { status: 'ACTIVE' },
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?status=ACTIVE`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(1);
      expect(response.body.testSuites[0].name).toBe('Login Test Suite');
    });

    it('作成者でフィルタできる', async () => {
      // 別ユーザーでテストスイートを作成（直接DBに）
      await prisma.testSuite.create({
        data: {
          projectId: project.id,
          name: 'Admin Suite',
          createdByUserId: admin.id,
        },
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?createdBy=${admin.id}`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(1);
      expect(response.body.testSuites[0].name).toBe('Admin Suite');
    });

    it('日付範囲でフィルタできる', async () => {
      // 過去のスイートを作成
      const oldDate = new Date('2024-01-01T00:00:00Z');
      await prisma.testSuite.create({
        data: {
          projectId: project.id,
          name: 'Old Suite',
          createdAt: oldDate,
        },
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?from=2024-01-01T00:00:00Z&to=2024-01-02T00:00:00Z`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(1);
      expect(response.body.testSuites[0].name).toBe('Old Suite');
    });

    it('limitパラメータで取得件数を制限できる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?limit=2`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(2);
      expect(response.body.total).toBe(3); // totalは全件数
      expect(response.body.limit).toBe(2);
    });

    it('offsetパラメータでスキップできる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?offset=1`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(2);
      expect(response.body.offset).toBe(1);
    });

    it('名前の昇順でソートできる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?sortBy=name&sortOrder=asc`)
        .expect(200);

      const names = response.body.testSuites.map((s: any) => s.name);
      expect(names).toEqual(['Login Test Suite', 'Payment Test Suite', 'User Management Suite']);
    });

    it('名前の降順でソートできる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?sortBy=name&sortOrder=desc`)
        .expect(200);

      const names = response.body.testSuites.map((s: any) => s.name);
      expect(names).toEqual(['User Management Suite', 'Payment Test Suite', 'Login Test Suite']);
    });

    it('作成日時でソートできる（デフォルト降順）', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?sortBy=createdAt`)
        .expect(200);

      // 最新のものが先頭
      expect(response.body.testSuites[0].name).toBe('User Management Suite');
    });

    it('削除済みスイートはデフォルトで含まれない', async () => {
      // 1つのスイートを削除
      const suite = await prisma.testSuite.findFirst({
        where: { name: 'Login Test Suite' },
      });
      await prisma.testSuite.update({
        where: { id: suite!.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(2);
      expect(response.body.testSuites.find((s: any) => s.name === 'Login Test Suite')).toBeUndefined();
    });

    it('includeDeleted=trueで削除済みスイートも含められる', async () => {
      // 1つのスイートを削除
      const suite = await prisma.testSuite.findFirst({
        where: { name: 'Login Test Suite' },
      });
      await prisma.testSuite.update({
        where: { id: suite!.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?includeDeleted=true`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(3);
    });

    it('複数条件を組み合わせて検索できる', async () => {
      // 1つのスイートをACTIVEに変更
      const suite = await prisma.testSuite.findFirst({
        where: { name: 'Login Test Suite' },
      });
      await prisma.testSuite.update({
        where: { id: suite!.id },
        data: { status: 'ACTIVE' },
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?q=Test&status=ACTIVE`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(1);
      expect(response.body.testSuites[0].name).toBe('Login Test Suite');
    });

    it('検索結果が0件の場合は空配列を返す', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?q=NonExistent`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });

    it('無効なステータスは400エラー', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?status=INVALID`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('無効なUUID（createdBy）は400エラー', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?createdBy=invalid-uuid`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('無効な日付形式は400エラー', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?from=invalid-date`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('limit=0は無効で400エラー', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?limit=0`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('limit=101（上限超過）は400エラー', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?limit=101`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('offset=-1は400エラー', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?offset=-1`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('存在しないプロジェクトは404エラー', async () => {
      const response = await request(app)
        .get('/api/projects/00000000-0000-0000-0000-000000000000/test-suites')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('権限がない場合は403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, null);

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // 権限マトリクステスト
  // ============================================================
  describe('Permission Matrix', () => {
    beforeEach(async () => {
      await createTestSuite(project.id, { name: 'Test Suite' });
    });

    describe('テストスイート検索（READ以上）', () => {
      it('ADMINはテストスイートを検索できる', async () => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

        await request(app)
          .get(`/api/projects/${project.id}/test-suites`)
          .expect(200);
      });

      it('WRITEはテストスイートを検索できる', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

        await request(app)
          .get(`/api/projects/${project.id}/test-suites`)
          .expect(200);
      });

      it('READはテストスイートを検索できる', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ');

        await request(app)
          .get(`/api/projects/${project.id}/test-suites`)
          .expect(200);
      });
    });
  });

  // ============================================================
  // エッジケーステスト
  // ============================================================
  describe('Edge Cases', () => {
    it('q=100文字まで受け付ける', async () => {
      const longQuery = 'a'.repeat(100);
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?q=${longQuery}`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(0);
    });

    it('q=101文字は400エラー', async () => {
      const tooLongQuery = 'a'.repeat(101);
      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?q=${tooLongQuery}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('空のqパラメータは全件取得と同じ', async () => {
      await createTestSuite(project.id, { name: 'Test Suite' });

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?q=`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(1);
    });

    it('特殊文字を含む検索もエスケープされる', async () => {
      await createTestSuite(project.id, { name: 'Test % Suite' });

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites?q=%25`)
        .expect(200);

      expect(response.body.testSuites).toHaveLength(1);
    });

    it('削除済みプロジェクトからは検索できない', async () => {
      await createTestSuite(project.id, { name: 'Test Suite' });

      // プロジェクトを削除
      await prisma.project.update({
        where: { id: project.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}/test-suites`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
