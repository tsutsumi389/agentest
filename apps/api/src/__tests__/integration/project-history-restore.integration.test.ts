import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestProjectMember,
  createTestProjectHistory,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError } from '@agentest/shared';
import { createApp } from '../../app.js';

// グローバルな認証状態（モック用）
let mockAuthUser: { id: string; email: string } | null = null;
let mockProjectRole: string | null = null;
let _mockAllowDeletedProject: boolean = false;

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
  // allowDeletedProjectオプションを考慮したモック
  requireProjectRole: (roles: string[], _options?: { allowDeletedProject?: boolean }) => (req: any, _res: any, next: any) => {
    // allowDeletedProjectオプションが設定されている場合は削除済みプロジェクトへのアクセスを許可
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
function setTestAuth(
  user: { id: string; email: string } | null,
  projectRole: string | null = null,
  allowDeletedProject: boolean = false
) {
  mockAuthUser = user;
  mockProjectRole = projectRole;
  _mockAllowDeletedProject = allowDeletedProject;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockProjectRole = null;
  _mockAllowDeletedProject = false;
}

describe('Project History & Restore API Integration Tests', () => {
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
  // GET /api/projects/:projectId/histories - 履歴一覧取得
  // ============================================================
  describe('GET /api/projects/:projectId/histories', () => {
    beforeEach(async () => {
      // 履歴を作成
      await createTestProjectHistory(project.id, {
        changedByUserId: owner.id,
        changeType: 'CREATE',
        snapshot: { name: 'Test Project', description: null },
        createdAt: new Date('2024-01-01T00:00:00Z'),
      });
      await createTestProjectHistory(project.id, {
        changedByUserId: admin.id,
        changeType: 'UPDATE',
        snapshot: {
          before: { name: 'Test Project' },
          after: { name: 'Updated Project' },
        },
        createdAt: new Date('2024-01-02T00:00:00Z'),
      });
    });

    it('履歴一覧を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .get(`/api/projects/${project.id}/histories`)
        .expect(200);

      expect(response.body.histories).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('履歴は作成日時の降順で返される', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/histories`)
        .expect(200);

      expect(response.body.histories[0].changeType).toBe('UPDATE'); // 後に作成された方が先
      expect(response.body.histories[1].changeType).toBe('CREATE');
    });

    it('履歴には変更者情報が含まれる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/histories`)
        .expect(200);

      const updateHistory = response.body.histories[0];
      expect(updateHistory.changedBy).toHaveProperty('id', admin.id);
      expect(updateHistory.changedBy).toHaveProperty('name', 'Admin');
    });

    it('limitパラメータで取得件数を制限できる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/histories?limit=1`)
        .expect(200);

      expect(response.body.histories).toHaveLength(1);
      expect(response.body.total).toBe(2); // totalは全件数
    });

    it('offsetパラメータでスキップできる', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/histories?offset=1`)
        .expect(200);

      expect(response.body.histories).toHaveLength(1);
      expect(response.body.histories[0].changeType).toBe('CREATE'); // 2番目の履歴
    });

    it('limitとoffsetを組み合わせてページネーションできる', async () => {
      // 追加の履歴を作成
      await createTestProjectHistory(project.id, {
        changedByUserId: owner.id,
        changeType: 'DELETE',
        createdAt: new Date('2024-01-03T00:00:00Z'),
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}/histories?limit=1&offset=1`)
        .expect(200);

      expect(response.body.histories).toHaveLength(1);
      expect(response.body.histories[0].changeType).toBe('UPDATE');
      expect(response.body.total).toBe(3);
    });

    it('削除済みプロジェクトでも履歴を取得できる', async () => {
      // プロジェクトを削除
      await prisma.project.update({
        where: { id: project.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}/histories`)
        .expect(200);

      expect(response.body.histories).toHaveLength(2);
    });

    it('limit=0は無効で400エラー', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/histories?limit=0`)
        .expect(400);

      expect(response.body.error).toContain('limit');
    });

    it('limit=101（上限超過）は400エラー', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/histories?limit=101`)
        .expect(400);

      expect(response.body.error).toContain('limit');
    });

    it('offset=-1は400エラー', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/histories?offset=-1`)
        .expect(400);

      expect(response.body.error).toContain('offset');
    });

    it('存在しないプロジェクトは404エラー', async () => {
      const response = await request(app)
        .get('/api/projects/00000000-0000-0000-0000-000000000000/histories')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/projects/${project.id}/histories`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('権限がない場合は403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, null);

      const response = await request(app)
        .get(`/api/projects/${project.id}/histories`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // POST /api/projects/:projectId/restore - プロジェクト復元
  // ============================================================
  describe('POST /api/projects/:projectId/restore', () => {
    beforeEach(async () => {
      // プロジェクトを論理削除状態にする
      await prisma.project.update({
        where: { id: project.id },
        data: { deletedAt: new Date() },
      });
    });

    it('ADMINが削除済みプロジェクトを復元できる', async () => {
      const response = await request(app)
        .post(`/api/projects/${project.id}/restore`)
        .expect(200);

      expect(response.body.project).toHaveProperty('id', project.id);
      expect(response.body.project.deletedAt).toBeNull();

      // DBで確認
      const restoredProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(restoredProject?.deletedAt).toBeNull();
    });

    it('復元後に履歴が記録される', async () => {
      await request(app)
        .post(`/api/projects/${project.id}/restore`)
        .expect(200);

      const history = await prisma.projectHistory.findFirst({
        where: {
          projectId: project.id,
          changeType: 'RESTORE',
        },
      });

      expect(history).not.toBeNull();
      expect(history?.changedByUserId).toBe(owner.id);
      expect(history?.snapshot).toEqual(
        expect.objectContaining({
          name: 'Test Project',
        })
      );
    });

    it('削除されていないプロジェクトの復元は404エラー', async () => {
      // プロジェクトを復元状態に戻す
      await prisma.project.update({
        where: { id: project.id },
        data: { deletedAt: null },
      });

      const response = await request(app)
        .post(`/api/projects/${project.id}/restore`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('猶予期間（30日）を過ぎたプロジェクトの復元は400エラー', async () => {
      // 31日前に削除された状態にする
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 31);
      await prisma.project.update({
        where: { id: project.id },
        data: { deletedAt },
      });

      const response = await request(app)
        .post(`/api/projects/${project.id}/restore`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('30日');
    });

    it('猶予期間内（29日目）のプロジェクトは復元できる', async () => {
      // 29日前に削除された状態にする
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 29);
      await prisma.project.update({
        where: { id: project.id },
        data: { deletedAt },
      });

      const response = await request(app)
        .post(`/api/projects/${project.id}/restore`)
        .expect(200);

      expect(response.body.project.deletedAt).toBeNull();
    });

    it('猶予期間境界（30日目）のプロジェクトは復元できる', async () => {
      // ちょうど30日前に削除された状態にする
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 30);
      await prisma.project.update({
        where: { id: project.id },
        data: { deletedAt },
      });

      const response = await request(app)
        .post(`/api/projects/${project.id}/restore`)
        .expect(200);

      expect(response.body.project.deletedAt).toBeNull();
    });

    it('WRITE権限ではプロジェクトを復元できない', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .post(`/api/projects/${project.id}/restore`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('READ権限ではプロジェクトを復元できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .post(`/api/projects/${project.id}/restore`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .post(`/api/projects/${project.id}/restore`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('存在しないプロジェクトの復元は404エラー', async () => {
      const response = await request(app)
        .post('/api/projects/00000000-0000-0000-0000-000000000000/restore')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('復元後は通常のプロジェクト操作ができる', async () => {
      // まず復元
      await request(app)
        .post(`/api/projects/${project.id}/restore`)
        .expect(200);

      // プロジェクト詳細を取得できる
      const response = await request(app)
        .get(`/api/projects/${project.id}`)
        .expect(200);

      expect(response.body.project.id).toBe(project.id);
      expect(response.body.project.deletedAt).toBeNull();
    });
  });

  // ============================================================
  // プロジェクトCRUD時の履歴作成テスト
  // ============================================================
  describe('Project CRUD - History Creation', () => {
    it('プロジェクト作成時に履歴が作成される', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          name: 'New Project',
          description: 'New Description',
        })
        .expect(201);

      const projectId = response.body.project.id;

      const history = await prisma.projectHistory.findFirst({
        where: {
          projectId,
          changeType: 'CREATE',
        },
      });

      expect(history).not.toBeNull();
      expect(history?.changedByUserId).toBe(owner.id);
      expect(history?.snapshot).toEqual(
        expect.objectContaining({
          name: 'New Project',
          description: 'New Description',
        })
      );
    });

    it('プロジェクト更新時に履歴が作成される', async () => {
      await request(app)
        .patch(`/api/projects/${project.id}`)
        .send({
          name: 'Updated Name',
          description: 'Updated Description',
        })
        .expect(200);

      const history = await prisma.projectHistory.findFirst({
        where: {
          projectId: project.id,
          changeType: 'UPDATE',
        },
      });

      expect(history).not.toBeNull();
      expect(history?.changedByUserId).toBe(owner.id);
      expect(history?.snapshot).toEqual({
        before: {
          name: 'Test Project',
          description: 'Test description',
        },
        after: {
          name: 'Updated Name',
          description: 'Updated Description',
        },
      });
    });

    it('プロジェクト削除時に履歴が作成される', async () => {
      await request(app)
        .delete(`/api/projects/${project.id}`)
        .expect(204);

      const history = await prisma.projectHistory.findFirst({
        where: {
          projectId: project.id,
          changeType: 'DELETE',
        },
      });

      expect(history).not.toBeNull();
      expect(history?.changedByUserId).toBe(owner.id);
      expect(history?.snapshot).toEqual(
        expect.objectContaining({
          name: 'Test Project',
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
      await createTestProjectHistory(project.id, {
        changedByUserId: owner.id,
        changeType: 'CREATE',
      });
    });

    describe('履歴閲覧（READ以上）', () => {
      it('ADMINは履歴を閲覧できる', async () => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

        await request(app)
          .get(`/api/projects/${project.id}/histories`)
          .expect(200);
      });

      it('WRITEは履歴を閲覧できる', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

        await request(app)
          .get(`/api/projects/${project.id}/histories`)
          .expect(200);
      });

      it('READは履歴を閲覧できる', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ');

        await request(app)
          .get(`/api/projects/${project.id}/histories`)
          .expect(200);
      });
    });

    describe('プロジェクト復元（ADMIN以上）', () => {
      beforeEach(async () => {
        // プロジェクトを削除状態にする
        await prisma.project.update({
          where: { id: project.id },
          data: { deletedAt: new Date() },
        });
      });

      it('ADMINはプロジェクトを復元できる', async () => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

        await request(app)
          .post(`/api/projects/${project.id}/restore`)
          .expect(200);
      });

      it('WRITEはプロジェクトを復元できない', async () => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

        await request(app)
          .post(`/api/projects/${project.id}/restore`)
          .expect(403);
      });

      it('READはプロジェクトを復元できない', async () => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ');

        await request(app)
          .post(`/api/projects/${project.id}/restore`)
          .expect(403);
      });
    });
  });
});
