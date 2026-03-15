import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestProjectMember,
  createTestOrganization,
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

// テスト用認証設定関数
function setTestAuth(
  user: { id: string; email: string } | null,
  projectRole: string | null = null
) {
  mockAuthUser = user;
  mockProjectRole = projectRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockProjectRole = null;
}

describe('Project CRUD API 統合テスト', () => {
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

    // プロジェクトを作成（オーナーはProjectMemberにOWNERロールで登録される）
    project = await createTestProject(owner.id, {
      name: 'Test Project',
      description: 'テスト用プロジェクト',
    });

    // メンバーを追加
    await createTestProjectMember(project.id, admin.id, 'ADMIN');
    await createTestProjectMember(project.id, writer.id, 'WRITE');
    await createTestProjectMember(project.id, reader.id, 'READ');

    // デフォルトでADMIN権限で認証
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN');
  });

  // ============================================================
  // POST /api/projects - プロジェクト作成
  // ============================================================
  describe('POST /api/projects', () => {
    it('プロジェクトを作成できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN');

      const response = await request(app)
        .post('/api/projects')
        .send({
          name: '新規プロジェクト',
          description: 'プロジェクトの説明文',
        })
        .expect(201);

      expect(response.body.project).toHaveProperty('id');
      expect(response.body.project).toHaveProperty('name', '新規プロジェクト');
      expect(response.body.project).toHaveProperty('description', 'プロジェクトの説明文');
      expect(response.body.project).toHaveProperty('createdAt');
    });

    it('組織関連プロジェクトを作成できる', async () => {
      // 組織を作成
      const organization = await createTestOrganization(owner.id, {
        name: 'テスト組織',
      });

      const response = await request(app)
        .post('/api/projects')
        .send({
          name: '組織プロジェクト',
          description: '組織に紐づくプロジェクト',
          organizationId: organization.id,
        })
        .expect(201);

      expect(response.body.project).toHaveProperty('name', '組織プロジェクト');
      expect(response.body.project).toHaveProperty('organizationId', organization.id);
    });

    it('名前なしは400エラー', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          description: '名前のないプロジェクト',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('名前が長すぎる場合は400エラー', async () => {
      // 101文字の名前を生成
      const longName = 'あ'.repeat(101);

      const response = await request(app)
        .post('/api/projects')
        .send({
          name: longName,
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('未認証は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .post('/api/projects')
        .send({
          name: '未認証プロジェクト',
        })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  // ============================================================
  // GET /api/projects/:projectId - プロジェクト詳細取得
  // ============================================================
  describe('GET /api/projects/:projectId', () => {
    it('プロジェクト詳細を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).get(`/api/projects/${project.id}`).expect(200);

      expect(response.body.project).toHaveProperty('id', project.id);
      expect(response.body.project).toHaveProperty('name', 'Test Project');
      expect(response.body.project).toHaveProperty('description', 'テスト用プロジェクト');
    });

    it('存在しないプロジェクトは404エラー', async () => {
      const response = await request(app)
        .get('/api/projects/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証は401エラー', async () => {
      clearTestAuth();

      const response = await request(app).get(`/api/projects/${project.id}`).expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('権限なしは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, null);

      const response = await request(app).get(`/api/projects/${project.id}`).expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // PATCH /api/projects/:projectId - プロジェクト更新
  // ============================================================
  describe('PATCH /api/projects/:projectId', () => {
    it('プロジェクト名を更新できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/projects/${project.id}`)
        .send({
          name: '更新後のプロジェクト名',
        })
        .expect(200);

      expect(response.body.project).toHaveProperty('name', '更新後のプロジェクト名');
    });

    it('説明を更新できる', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      const response = await request(app)
        .patch(`/api/projects/${project.id}`)
        .send({
          description: '更新後の説明',
        })
        .expect(200);

      expect(response.body.project).toHaveProperty('description', '更新後の説明');
    });

    it('未認証は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .patch(`/api/projects/${project.id}`)
        .send({
          name: '更新テスト',
        })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('READロールは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .patch(`/api/projects/${project.id}`)
        .send({
          name: '更新テスト',
        })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // DELETE /api/projects/:projectId - プロジェクト削除
  // ============================================================
  describe('DELETE /api/projects/:projectId', () => {
    it('プロジェクトを削除できる', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      await request(app).delete(`/api/projects/${project.id}`).expect(204);
    });

    it('削除後にdeletedAtが設定されていることを確認', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      await request(app).delete(`/api/projects/${project.id}`).expect(204);

      // 論理削除されたプロジェクトを直接DBから確認
      const deletedProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(deletedProject).not.toBeNull();
      expect(deletedProject?.deletedAt).not.toBeNull();
    });

    it('未認証は401エラー', async () => {
      clearTestAuth();

      const response = await request(app).delete(`/api/projects/${project.id}`).expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('WRITE/READロールは403エラー', async () => {
      // WRITEロールで試す
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const writeResponse = await request(app).delete(`/api/projects/${project.id}`).expect(403);

      expect(writeResponse.body.error.code).toBe('AUTHORIZATION_ERROR');

      // READロールで試す
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const readResponse = await request(app).delete(`/api/projects/${project.id}`).expect(403);

      expect(readResponse.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // GET /api/projects/:projectId/members - メンバー一覧取得
  // ============================================================
  describe('GET /api/projects/:projectId/members', () => {
    it('メンバー一覧を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).get(`/api/projects/${project.id}/members`).expect(200);

      // owner, admin, writer, readerの4名
      expect(response.body.members).toHaveLength(4);
      expect(response.body.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: owner.id,
            role: 'OWNER',
          }),
          expect.objectContaining({
            userId: admin.id,
            role: 'ADMIN',
          }),
          expect.objectContaining({
            userId: writer.id,
            role: 'WRITE',
          }),
          expect.objectContaining({
            userId: reader.id,
            role: 'READ',
          }),
        ])
      );
    });

    it('メンバー情報にユーザー詳細が含まれる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).get(`/api/projects/${project.id}/members`).expect(200);

      const ownerMember = response.body.members.find((m: any) => m.userId === owner.id);
      expect(ownerMember.user).toHaveProperty('id', owner.id);
      expect(ownerMember.user).toHaveProperty('email', 'owner@example.com');
      expect(ownerMember.user).toHaveProperty('name', 'Owner');
    });
  });

  // ============================================================
  // POST /api/projects/:projectId/members - メンバー追加
  // ============================================================
  describe('POST /api/projects/:projectId/members', () => {
    it('メンバーを追加できる', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      const newUser = await createTestUser({ email: 'new-member@example.com', name: 'New Member' });

      const response = await request(app)
        .post(`/api/projects/${project.id}/members`)
        .send({
          email: newUser.email,
        })
        .expect(201);

      expect(response.body.member).toHaveProperty('userId', newUser.id);
      // デフォルトロールはREAD
      expect(response.body.member).toHaveProperty('role', 'READ');
    });

    it('ロールを指定してメンバーを追加できる', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      const newUser = await createTestUser({ email: 'new-writer@example.com', name: 'New Writer' });

      const response = await request(app)
        .post(`/api/projects/${project.id}/members`)
        .send({
          email: newUser.email,
          role: 'WRITE',
        })
        .expect(201);

      expect(response.body.member).toHaveProperty('userId', newUser.id);
      expect(response.body.member).toHaveProperty('role', 'WRITE');
    });
  });

  // ============================================================
  // PATCH /api/projects/:projectId/members/:userId - メンバーロール更新
  // ============================================================
  describe('PATCH /api/projects/:projectId/members/:userId', () => {
    it('メンバーのロールを更新できる', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      const response = await request(app)
        .patch(`/api/projects/${project.id}/members/${reader.id}`)
        .send({
          role: 'WRITE',
        })
        .expect(200);

      expect(response.body.member).toHaveProperty('role', 'WRITE');

      // DBでも確認
      const updatedMember = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId: reader.id,
          },
        },
      });
      expect(updatedMember?.role).toBe('WRITE');
    });
  });

  // ============================================================
  // DELETE /api/projects/:projectId/members/:userId - メンバー削除
  // ============================================================
  describe('DELETE /api/projects/:projectId/members/:userId', () => {
    it('メンバーを削除できる', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      await request(app).delete(`/api/projects/${project.id}/members/${reader.id}`).expect(204);

      // DBでメンバーが削除されていることを確認
      const deletedMember = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId: reader.id,
          },
        },
      });
      expect(deletedMember).toBeNull();
    });
  });
});
