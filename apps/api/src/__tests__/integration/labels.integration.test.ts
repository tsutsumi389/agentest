import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestProjectMember,
  createTestSuite,
  createTestLabel,
  createTestSuiteLabel,
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

describe('Labels API Integration Tests', () => {
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
  // GET /api/projects/:projectId/labels - ラベル一覧取得
  // ============================================================
  describe('GET /api/projects/:projectId/labels', () => {
    it('ラベル一覧を取得できる', async () => {
      await createTestLabel(project.id, { name: 'Bug', color: '#FF0000' });
      await createTestLabel(project.id, { name: 'Feature', color: '#00FF00' });

      const response = await request(app)
        .get(`/api/projects/${project.id}/labels`)
        .expect(200);

      expect(response.body.labels).toHaveLength(2);
    });

    it('空の場合は空配列を返す', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/labels`)
        .expect(200);

      expect(response.body.labels).toEqual([]);
    });

    it('name昇順でソートされる', async () => {
      await createTestLabel(project.id, { name: 'Zzz', color: '#FF0000' });
      await createTestLabel(project.id, { name: 'Aaa', color: '#00FF00' });
      await createTestLabel(project.id, { name: 'Mmm', color: '#0000FF' });

      const response = await request(app)
        .get(`/api/projects/${project.id}/labels`)
        .expect(200);

      const names = response.body.labels.map((l: any) => l.name);
      expect(names).toEqual(['Aaa', 'Mmm', 'Zzz']);
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/projects/${project.id}/labels`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('READ権限で取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');
      await createTestLabel(project.id, { name: 'Bug', color: '#FF0000' });

      const response = await request(app)
        .get(`/api/projects/${project.id}/labels`)
        .expect(200);

      expect(response.body.labels).toHaveLength(1);
    });

    it('権限がない場合は403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, null, null);

      const response = await request(app)
        .get(`/api/projects/${project.id}/labels`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('存在しないプロジェクトは404エラー', async () => {
      const response = await request(app)
        .get('/api/projects/00000000-0000-0000-0000-000000000000/labels')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ============================================================
  // POST /api/projects/:projectId/labels - ラベル作成
  // ============================================================
  describe('POST /api/projects/:projectId/labels', () => {
    it('ラベルを作成できる', async () => {
      const response = await request(app)
        .post(`/api/projects/${project.id}/labels`)
        .send({ name: 'Bug', color: '#FF0000' })
        .expect(201);

      expect(response.body.label.name).toBe('Bug');
      expect(response.body.label.color).toBe('#FF0000');
      expect(response.body.label.projectId).toBe(project.id);
    });

    it('全フィールド指定で作成できる', async () => {
      const response = await request(app)
        .post(`/api/projects/${project.id}/labels`)
        .send({
          name: 'Feature',
          description: 'New features to implement',
          color: '#00FF00',
        })
        .expect(201);

      expect(response.body.label.name).toBe('Feature');
      expect(response.body.label.description).toBe('New features to implement');
      expect(response.body.label.color).toBe('#00FF00');
    });

    it('空のnameはエラー', async () => {
      const response = await request(app)
        .post(`/api/projects/${project.id}/labels`)
        .send({ name: '', color: '#FF0000' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('51文字以上のnameはエラー', async () => {
      const response = await request(app)
        .post(`/api/projects/${project.id}/labels`)
        .send({ name: 'a'.repeat(51), color: '#FF0000' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('201文字以上のdescriptionはエラー', async () => {
      const response = await request(app)
        .post(`/api/projects/${project.id}/labels`)
        .send({ name: 'Bug', description: 'a'.repeat(201), color: '#FF0000' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('無効なcolor形式はエラー', async () => {
      const response = await request(app)
        .post(`/api/projects/${project.id}/labels`)
        .send({ name: 'Bug', color: 'invalid' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('同名ラベルは重複エラー', async () => {
      await createTestLabel(project.id, { name: 'Bug', color: '#FF0000' });

      const response = await request(app)
        .post(`/api/projects/${project.id}/labels`)
        .send({ name: 'Bug', color: '#00FF00' })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('READ権限では作成できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .post(`/api/projects/${project.id}/labels`)
        .send({ name: 'Bug', color: '#FF0000' })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('WRITE権限で作成できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');

      const response = await request(app)
        .post(`/api/projects/${project.id}/labels`)
        .send({ name: 'Bug', color: '#FF0000' })
        .expect(201);

      expect(response.body.label.name).toBe('Bug');
    });

    it('ADMIN権限で作成できる', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN', 'ADMIN');

      const response = await request(app)
        .post(`/api/projects/${project.id}/labels`)
        .send({ name: 'Feature', color: '#00FF00' })
        .expect(201);

      expect(response.body.label.name).toBe('Feature');
    });
  });

  // ============================================================
  // PATCH /api/projects/:projectId/labels/:labelId - ラベル更新
  // ============================================================
  describe('PATCH /api/projects/:projectId/labels/:labelId', () => {
    let label: Awaited<ReturnType<typeof createTestLabel>>;

    beforeEach(async () => {
      label = await createTestLabel(project.id, {
        name: 'Bug',
        description: 'Bug reports',
        color: '#FF0000',
      });
    });

    it('nameを更新できる', async () => {
      const response = await request(app)
        .patch(`/api/projects/${project.id}/labels/${label.id}`)
        .send({ name: 'Updated Bug' })
        .expect(200);

      expect(response.body.label.name).toBe('Updated Bug');
    });

    it('colorを更新できる', async () => {
      const response = await request(app)
        .patch(`/api/projects/${project.id}/labels/${label.id}`)
        .send({ color: '#00FF00' })
        .expect(200);

      expect(response.body.label.color).toBe('#00FF00');
    });

    it('descriptionを更新できる', async () => {
      const response = await request(app)
        .patch(`/api/projects/${project.id}/labels/${label.id}`)
        .send({ description: 'Updated description' })
        .expect(200);

      expect(response.body.label.description).toBe('Updated description');
    });

    it('descriptionをnullに更新できる', async () => {
      const response = await request(app)
        .patch(`/api/projects/${project.id}/labels/${label.id}`)
        .send({ description: null })
        .expect(200);

      expect(response.body.label.description).toBeNull();
    });

    it('部分更新が可能', async () => {
      const response = await request(app)
        .patch(`/api/projects/${project.id}/labels/${label.id}`)
        .send({ color: '#0000FF' })
        .expect(200);

      // 他のフィールドは変更されていない
      expect(response.body.label.name).toBe('Bug');
      expect(response.body.label.color).toBe('#0000FF');
    });

    it('存在しないラベルは404エラー', async () => {
      const response = await request(app)
        .patch(`/api/projects/${project.id}/labels/00000000-0000-0000-0000-000000000000`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('別プロジェクトのラベルは404エラー', async () => {
      // 別のプロジェクトを作成
      const anotherProject = await createTestProject(owner.id, { name: 'Another Project' });
      const anotherLabel = await createTestLabel(anotherProject.id, { name: 'Other', color: '#000000' });

      const response = await request(app)
        .patch(`/api/projects/${project.id}/labels/${anotherLabel.id}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('同名への変更で重複エラー', async () => {
      await createTestLabel(project.id, { name: 'Feature', color: '#00FF00' });

      const response = await request(app)
        .patch(`/api/projects/${project.id}/labels/${label.id}`)
        .send({ name: 'Feature' })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('READ権限では更新できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .patch(`/api/projects/${project.id}/labels/${label.id}`)
        .send({ name: 'Updated' })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('WRITE権限で更新できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');

      const response = await request(app)
        .patch(`/api/projects/${project.id}/labels/${label.id}`)
        .send({ name: 'Updated' })
        .expect(200);

      expect(response.body.label.name).toBe('Updated');
    });
  });

  // ============================================================
  // DELETE /api/projects/:projectId/labels/:labelId - ラベル削除
  // ============================================================
  describe('DELETE /api/projects/:projectId/labels/:labelId', () => {
    let label: Awaited<ReturnType<typeof createTestLabel>>;

    beforeEach(async () => {
      label = await createTestLabel(project.id, { name: 'Bug', color: '#FF0000' });
    });

    it('ラベルを削除できる', async () => {
      await request(app)
        .delete(`/api/projects/${project.id}/labels/${label.id}`)
        .expect(204);
    });

    it('削除後にDBから消えている', async () => {
      await request(app)
        .delete(`/api/projects/${project.id}/labels/${label.id}`)
        .expect(204);

      const deleted = await prisma.label.findUnique({ where: { id: label.id } });
      expect(deleted).toBeNull();
    });

    it('存在しないラベルは404エラー', async () => {
      const response = await request(app)
        .delete(`/api/projects/${project.id}/labels/00000000-0000-0000-0000-000000000000`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('別プロジェクトのラベルは404エラー', async () => {
      // 別のプロジェクトを作成
      const anotherProject = await createTestProject(owner.id, { name: 'Another Project' });
      const anotherLabel = await createTestLabel(anotherProject.id, { name: 'Other', color: '#000000' });

      const response = await request(app)
        .delete(`/api/projects/${project.id}/labels/${anotherLabel.id}`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('READ権限では削除できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .delete(`/api/projects/${project.id}/labels/${label.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('WRITE権限では削除できない', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');

      const response = await request(app)
        .delete(`/api/projects/${project.id}/labels/${label.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('ADMIN権限のみ削除できる', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN', 'ADMIN');

      await request(app)
        .delete(`/api/projects/${project.id}/labels/${label.id}`)
        .expect(204);
    });
  });

  // ============================================================
  // GET /api/test-suites/:testSuiteId/labels - テストスイートのラベル取得
  // ============================================================
  describe('GET /api/test-suites/:testSuiteId/labels', () => {
    it('テストスイートのラベルを取得できる', async () => {
      const label1 = await createTestLabel(project.id, { name: 'Bug', color: '#FF0000' });
      const label2 = await createTestLabel(project.id, { name: 'Feature', color: '#00FF00' });
      await createTestSuiteLabel(testSuite.id, label1.id);
      await createTestSuiteLabel(testSuite.id, label2.id);

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/labels`)
        .expect(200);

      expect(response.body.labels).toHaveLength(2);
    });

    it('ラベルがない場合は空配列', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/labels`)
        .expect(200);

      expect(response.body.labels).toEqual([]);
    });

    it('name昇順でソートされる', async () => {
      const label1 = await createTestLabel(project.id, { name: 'Zzz', color: '#FF0000' });
      const label2 = await createTestLabel(project.id, { name: 'Aaa', color: '#00FF00' });
      const label3 = await createTestLabel(project.id, { name: 'Mmm', color: '#0000FF' });
      await createTestSuiteLabel(testSuite.id, label1.id);
      await createTestSuiteLabel(testSuite.id, label2.id);
      await createTestSuiteLabel(testSuite.id, label3.id);

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/labels`)
        .expect(200);

      const names = response.body.labels.map((l: any) => l.name);
      expect(names).toEqual(['Aaa', 'Mmm', 'Zzz']);
    });

    it('存在しないテストスイートは404エラー', async () => {
      const response = await request(app)
        .get('/api/test-suites/00000000-0000-0000-0000-000000000000/labels')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('READ権限で取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');
      const label = await createTestLabel(project.id, { name: 'Bug', color: '#FF0000' });
      await createTestSuiteLabel(testSuite.id, label.id);

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/labels`)
        .expect(200);

      expect(response.body.labels).toHaveLength(1);
    });
  });

  // ============================================================
  // PUT /api/test-suites/:testSuiteId/labels - テストスイートのラベル更新
  // ============================================================
  describe('PUT /api/test-suites/:testSuiteId/labels', () => {
    it('ラベルを一括更新できる', async () => {
      const label1 = await createTestLabel(project.id, { name: 'Bug', color: '#FF0000' });
      const label2 = await createTestLabel(project.id, { name: 'Feature', color: '#00FF00' });

      const response = await request(app)
        .put(`/api/test-suites/${testSuite.id}/labels`)
        .send({ labelIds: [label1.id, label2.id] })
        .expect(200);

      expect(response.body.labels).toHaveLength(2);
    });

    it('複数ラベルを設定できる', async () => {
      const label1 = await createTestLabel(project.id, { name: 'Bug', color: '#FF0000' });
      const label2 = await createTestLabel(project.id, { name: 'Feature', color: '#00FF00' });
      const label3 = await createTestLabel(project.id, { name: 'Enhancement', color: '#0000FF' });

      const response = await request(app)
        .put(`/api/test-suites/${testSuite.id}/labels`)
        .send({ labelIds: [label1.id, label2.id, label3.id] })
        .expect(200);

      expect(response.body.labels).toHaveLength(3);
    });

    it('空配列で全削除できる', async () => {
      const label = await createTestLabel(project.id, { name: 'Bug', color: '#FF0000' });
      await createTestSuiteLabel(testSuite.id, label.id);

      const response = await request(app)
        .put(`/api/test-suites/${testSuite.id}/labels`)
        .send({ labelIds: [] })
        .expect(200);

      expect(response.body.labels).toEqual([]);
    });

    it('存在しないラベルIDは400エラー', async () => {
      const response = await request(app)
        .put(`/api/test-suites/${testSuite.id}/labels`)
        .send({ labelIds: ['00000000-0000-0000-0000-000000000000'] })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('別プロジェクトのラベルIDは400エラー', async () => {
      // 別のプロジェクトを作成してラベルを追加
      const anotherProject = await createTestProject(owner.id, { name: 'Another Project' });
      const anotherLabel = await createTestLabel(anotherProject.id, { name: 'Other', color: '#000000' });

      const response = await request(app)
        .put(`/api/test-suites/${testSuite.id}/labels`)
        .send({ labelIds: [anotherLabel.id] })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('無効なUUID形式は400エラー', async () => {
      const response = await request(app)
        .put(`/api/test-suites/${testSuite.id}/labels`)
        .send({ labelIds: ['invalid-uuid'] })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('存在しないテストスイートは404エラー', async () => {
      const response = await request(app)
        .put('/api/test-suites/00000000-0000-0000-0000-000000000000/labels')
        .send({ labelIds: [] })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('READ権限では更新できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ');

      const response = await request(app)
        .put(`/api/test-suites/${testSuite.id}/labels`)
        .send({ labelIds: [] })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('WRITE権限で更新できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE');
      const label = await createTestLabel(project.id, { name: 'Bug', color: '#FF0000' });

      const response = await request(app)
        .put(`/api/test-suites/${testSuite.id}/labels`)
        .send({ labelIds: [label.id] })
        .expect(200);

      expect(response.body.labels).toHaveLength(1);
    });
  });
});
