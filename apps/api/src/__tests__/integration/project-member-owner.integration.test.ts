import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestProjectMember,
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
    // OWNERは全権限を持つ
    if (mockProjectRole === 'OWNER') {
      return next();
    }
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

// テスト用認証設定関数
function setTestAuth(user: { id: string; email: string } | null, projectRole: string | null = null) {
  mockAuthUser = user;
  mockProjectRole = projectRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockProjectRole = null;
}

/**
 * プロジェクトメンバー OWNER保護 統合テスト
 *
 * OWNERロールの保護に関するテスト:
 * - OWNERは削除できない
 * - OWNERのロールは変更できない
 * - APIからOWNERロールで追加できない
 */
describe('Project Member OWNER Protection Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
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
    member = await createTestUser({ email: 'member@example.com', name: 'Member' });

    // プロジェクトを作成（オーナーはProjectMemberにOWNERロールで登録される）
    project = await createTestProject(owner.id, {
      name: 'Test Project',
      description: 'Test description',
    });

    // 他のメンバーを追加
    await createTestProjectMember(project.id, admin.id, 'ADMIN');
    await createTestProjectMember(project.id, member.id, 'READ');

    clearTestAuth();
  });

  describe('OWNER削除の禁止', () => {
    it('OWNERを削除しようとするとエラーになる', async () => {
      setTestAuth(admin, 'ADMIN');

      const response = await request(app)
        .delete(`/api/projects/${project.id}/members/${owner.id}`)
        .expect(409);

      expect(response.body.error.message).toBe('プロジェクトオーナーは削除できません');

      // オーナーがまだ存在することを確認
      const ownerMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: owner.id } },
      });
      expect(ownerMember).not.toBeNull();
      expect(ownerMember?.role).toBe('OWNER');
    });

    it('OWNER自身でも自分を削除できない', async () => {
      setTestAuth(owner, 'OWNER');

      const response = await request(app)
        .delete(`/api/projects/${project.id}/members/${owner.id}`)
        .expect(409);

      expect(response.body.error.message).toBe('プロジェクトオーナーは削除できません');
    });
  });

  describe('OWNERロール変更の禁止', () => {
    it('OWNERのロールを変更しようとするとエラーになる', async () => {
      setTestAuth(owner, 'OWNER');

      const response = await request(app)
        .patch(`/api/projects/${project.id}/members/${owner.id}`)
        .send({ role: 'ADMIN' })
        .expect(409);

      expect(response.body.error.message).toBe('オーナーのロールは変更できません');

      // ロールが変わっていないことを確認
      const ownerMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: owner.id } },
      });
      expect(ownerMember?.role).toBe('OWNER');
    });

    it('他のメンバーをOWNERに変更しようとするとバリデーションエラーになる', async () => {
      setTestAuth(owner, 'OWNER');

      const response = await request(app)
        .patch(`/api/projects/${project.id}/members/${member.id}`)
        .send({ role: 'OWNER' })
        .expect(400);

      // zodスキーマでOWNERが許可されていないためバリデーションエラー
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      // メンバーのロールが変わっていないことを確認
      const memberRecord = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: member.id } },
      });
      expect(memberRecord?.role).toBe('READ');
    });
  });

  describe('API経由でのOWNER追加の禁止', () => {
    it('OWNERロールでメンバーを追加しようとするとバリデーションエラーになる', async () => {
      setTestAuth(owner, 'OWNER');
      const newUser = await createTestUser({ email: 'new@example.com', name: 'New User' });

      const response = await request(app)
        .post(`/api/projects/${project.id}/members`)
        .send({ userId: newUser.id, role: 'OWNER' })
        .expect(400);

      // バリデーションエラー（zodで'OWNER'が許可されていない）
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      // メンバーが追加されていないことを確認
      const newMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: newUser.id } },
      });
      expect(newMember).toBeNull();
    });
  });

  describe('通常のメンバー操作は正常に動作する', () => {
    it('ADMINは通常メンバーのロールを変更できる', async () => {
      setTestAuth(admin, 'ADMIN');

      const response = await request(app)
        .patch(`/api/projects/${project.id}/members/${member.id}`)
        .send({ role: 'WRITE' })
        .expect(200);

      expect(response.body.member.role).toBe('WRITE');
    });

    it('OWNERは通常メンバーを削除できる', async () => {
      setTestAuth(owner, 'OWNER');

      await request(app)
        .delete(`/api/projects/${project.id}/members/${member.id}`)
        .expect(204);

      // メンバーが削除されていることを確認
      const deletedMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: member.id } },
      });
      expect(deletedMember).toBeNull();
    });

    it('ADMINは新しいメンバーを追加できる', async () => {
      setTestAuth(admin, 'ADMIN');
      const newUser = await createTestUser({ email: 'new@example.com', name: 'New User' });

      const response = await request(app)
        .post(`/api/projects/${project.id}/members`)
        .send({ userId: newUser.id, role: 'READ' })
        .expect(201);

      expect(response.body.member.role).toBe('READ');
      expect(response.body.member.userId).toBe(newUser.id);
    });
  });

  describe('メンバー一覧取得でOWNERが含まれる', () => {
    it('メンバー一覧にOWNERが含まれている', async () => {
      setTestAuth(owner, 'OWNER');

      const response = await request(app)
        .get(`/api/projects/${project.id}/members`)
        .expect(200);

      const members = response.body.members;
      expect(members.length).toBe(3);

      // OWNERが含まれていることを確認
      const ownerMember = members.find((m: any) => m.userId === owner.id);
      expect(ownerMember).toBeDefined();
      expect(ownerMember.role).toBe('OWNER');
    });
  });
});
