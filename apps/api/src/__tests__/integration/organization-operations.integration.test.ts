import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestOrganization,
  createTestOrgMember,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError } from '@agentest/shared';
import { createApp } from '../../app.js';

// グローバルな認証状態（モック用）
let mockAuthUser: { id: string; email: string } | null = null;
let mockOrgRole: string | null = null;

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
  requireOrgRole: (roles: string[]) => (req: any, _res: any, next: any) => {
    if (!mockOrgRole || !roles.includes(mockOrgRole)) {
      return next(new AuthorizationError('権限がありません'));
    }
    next();
  },
  requireProjectRole: () => (_req: any, _res: any, next: any) => next(),
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
function setTestAuth(user: { id: string; email: string } | null, orgRole: string | null = null) {
  mockAuthUser = user;
  mockOrgRole = orgRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockOrgRole = null;
}

describe('Organization Operations API Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let organization: Awaited<ReturnType<typeof createTestOrganization>>;

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

    // 組織を作成（オーナーで）
    organization = await createTestOrganization(owner.id, {
      name: 'Test Organization',
      slug: 'test-org',
      description: 'Test description',
    });

    // adminとmemberを追加
    await createTestOrgMember(organization.id, admin.id, 'ADMIN');
    await createTestOrgMember(organization.id, member.id, 'MEMBER');

    // デフォルトでオーナーとして認証
    setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');
  });

  // ============================================================
  // GET /api/organizations/:organizationId - 組織詳細取得
  // ============================================================
  describe('GET /api/organizations/:organizationId', () => {
    it('組織詳細を取得できる', async () => {
      const response = await request(app)
        .get(`/api/organizations/${organization.id}`)
        .expect(200);

      expect(response.body.organization).toHaveProperty('id', organization.id);
      expect(response.body.organization).toHaveProperty('name', 'Test Organization');
      expect(response.body.organization).toHaveProperty('slug', 'test-org');
      expect(response.body.organization).toHaveProperty('description', 'Test description');
    });

    it('存在しない組織は404エラー', async () => {
      const response = await request(app)
        .get('/api/organizations/non-existent-id')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/organizations/${organization.id}`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  // ============================================================
  // GET /api/organizations/:organizationId/members - メンバー一覧取得
  // ============================================================
  describe('GET /api/organizations/:organizationId/members', () => {
    it('メンバー一覧を取得できる', async () => {
      const response = await request(app)
        .get(`/api/organizations/${organization.id}/members`)
        .expect(200);

      expect(response.body.members).toHaveLength(3); // owner, admin, member
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
            userId: member.id,
            role: 'MEMBER',
          }),
        ])
      );
    });

    it('メンバー情報にユーザー詳細が含まれる', async () => {
      const response = await request(app)
        .get(`/api/organizations/${organization.id}/members`)
        .expect(200);

      const ownerMember = response.body.members.find((m: any) => m.userId === owner.id);
      expect(ownerMember.user).toHaveProperty('id', owner.id);
      expect(ownerMember.user).toHaveProperty('email', 'owner@example.com');
      expect(ownerMember.user).toHaveProperty('name', 'Owner');
    });

    it('存在しない組織は404エラー', async () => {
      const response = await request(app)
        .get('/api/organizations/non-existent-id/members')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/members`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  // ============================================================
  // POST /api/organizations/:organizationId/transfer-ownership
  // ============================================================
  describe('POST /api/organizations/:organizationId/transfer-ownership', () => {
    it('オーナー権限を移譲できる', async () => {
      const response = await request(app)
        .post(`/api/organizations/${organization.id}/transfer-ownership`)
        .send({ newOwnerId: admin.id })
        .expect(200);

      expect(response.body.member).toHaveProperty('role', 'OWNER');
      expect(response.body.member.user.id).toBe(admin.id);

      // 新オーナーがOWNERになっていることを確認
      const newOwnerMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: admin.id,
          },
        },
      });
      expect(newOwnerMember?.role).toBe('OWNER');

      // 元オーナーがADMINになっていることを確認
      const previousOwnerMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: owner.id,
          },
        },
      });
      expect(previousOwnerMember?.role).toBe('ADMIN');
    });

    it('MEMBERにもオーナー権限を移譲できる', async () => {
      const response = await request(app)
        .post(`/api/organizations/${organization.id}/transfer-ownership`)
        .send({ newOwnerId: member.id })
        .expect(200);

      expect(response.body.member.role).toBe('OWNER');
      expect(response.body.member.user.id).toBe(member.id);
    });

    it('自分自身への移譲は409エラー', async () => {
      const response = await request(app)
        .post(`/api/organizations/${organization.id}/transfer-ownership`)
        .send({ newOwnerId: owner.id })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('メンバーでないユーザーへの移譲は404エラー', async () => {
      const outsider = await createTestUser({ email: 'outsider@example.com' });

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/transfer-ownership`)
        .send({ newOwnerId: outsider.id })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('存在しないユーザーへの移譲は404エラー', async () => {
      // 有効なUUID形式だが存在しないユーザーID
      const response = await request(app)
        .post(`/api/organizations/${organization.id}/transfer-ownership`)
        .send({ newOwnerId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('無効なUUID形式はバリデーションエラー', async () => {
      const response = await request(app)
        .post(`/api/organizations/${organization.id}/transfer-ownership`)
        .send({ newOwnerId: 'non-existent-user-id' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('ADMINはオーナー権限を移譲できない', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/transfer-ownership`)
        .send({ newOwnerId: member.id })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('MEMBERはオーナー権限を移譲できない', async () => {
      setTestAuth({ id: member.id, email: member.email }, 'MEMBER');

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/transfer-ownership`)
        .send({ newOwnerId: admin.id })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/transfer-ownership`)
        .send({ newOwnerId: admin.id })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('newOwnerIdが指定されていない場合はバリデーションエラー', async () => {
      const response = await request(app)
        .post(`/api/organizations/${organization.id}/transfer-ownership`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('オーナー権限移譲後に監査ログが記録される', async () => {
      await request(app)
        .post(`/api/organizations/${organization.id}/transfer-ownership`)
        .send({ newOwnerId: admin.id })
        .expect(200);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: organization.id,
          action: 'organization.ownership_transferred',
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('ORGANIZATION');
      expect(auditLog?.userId).toBe(owner.id);
      expect(auditLog?.details).toEqual(
        expect.objectContaining({
          previousOwnerId: owner.id,
          newOwnerId: admin.id,
        })
      );
    });
  });

  // ============================================================
  // PATCH /api/organizations/:organizationId/members/:userId - ロール更新
  // ============================================================
  describe('PATCH /api/organizations/:organizationId/members/:userId', () => {
    it('MEMBERをADMINに変更できる', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${organization.id}/members/${member.id}`)
        .send({ role: 'ADMIN' })
        .expect(200);

      expect(response.body.member.role).toBe('ADMIN');
    });

    it('ADMINをMEMBERに変更できる', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${organization.id}/members/${admin.id}`)
        .send({ role: 'MEMBER' })
        .expect(200);

      expect(response.body.member.role).toBe('MEMBER');
    });

    it('OWNERのロールは変更できない', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${organization.id}/members/${owner.id}`)
        .send({ role: 'ADMIN' })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('存在しないメンバーは404エラー', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${organization.id}/members/non-existent-id`)
        .send({ role: 'ADMIN' })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('無効なロールはバリデーションエラー', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${organization.id}/members/${member.id}`)
        .send({ role: 'INVALID' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('OWNERへの変更はバリデーションエラー（transferOwnershipを使用すべき）', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${organization.id}/members/${member.id}`)
        .send({ role: 'OWNER' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('ADMINがロール変更できる', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      const response = await request(app)
        .patch(`/api/organizations/${organization.id}/members/${member.id}`)
        .send({ role: 'ADMIN' })
        .expect(200);

      expect(response.body.member.role).toBe('ADMIN');
    });

    it('MEMBERはロール変更できない', async () => {
      setTestAuth({ id: member.id, email: member.email }, 'MEMBER');

      const anotherMember = await createTestUser({ email: 'another@example.com' });
      await createTestOrgMember(organization.id, anotherMember.id, 'MEMBER');

      const response = await request(app)
        .patch(`/api/organizations/${organization.id}/members/${anotherMember.id}`)
        .send({ role: 'ADMIN' })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // DELETE /api/organizations/:organizationId/members/:userId - メンバー削除
  // ============================================================
  describe('DELETE /api/organizations/:organizationId/members/:userId', () => {
    it('メンバーを削除できる', async () => {
      await request(app)
        .delete(`/api/organizations/${organization.id}/members/${member.id}`)
        .expect(204);

      const deletedMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: member.id,
          },
        },
      });
      expect(deletedMember).toBeNull();
    });

    it('ADMINを削除できる', async () => {
      await request(app)
        .delete(`/api/organizations/${organization.id}/members/${admin.id}`)
        .expect(204);
    });

    it('OWNERは削除できない', async () => {
      const response = await request(app)
        .delete(`/api/organizations/${organization.id}/members/${owner.id}`)
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('存在しないメンバーは404エラー', async () => {
      const response = await request(app)
        .delete(`/api/organizations/${organization.id}/members/non-existent-id`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('ADMINがメンバーを削除できる', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      await request(app)
        .delete(`/api/organizations/${organization.id}/members/${member.id}`)
        .expect(204);
    });

    it('MEMBERはメンバーを削除できない', async () => {
      setTestAuth({ id: member.id, email: member.email }, 'MEMBER');

      const anotherMember = await createTestUser({ email: 'another@example.com' });
      await createTestOrgMember(organization.id, anotherMember.id, 'MEMBER');

      const response = await request(app)
        .delete(`/api/organizations/${organization.id}/members/${anotherMember.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });
});
