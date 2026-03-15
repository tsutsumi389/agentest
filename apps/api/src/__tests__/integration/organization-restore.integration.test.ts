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
  // allowDeletedOrgオプションを考慮したモック
  requireOrgRole:
    (roles: string[], _options?: { allowDeletedOrg?: boolean }) =>
    (_req: any, _res: any, next: any) => {
      if (!mockOrgRole || !roles.includes(mockOrgRole)) {
        return next(new AuthorizationError('権限がありません'));
      }
      next();
    },
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

// テスト用認証設定関数
function setTestAuth(user: { id: string; email: string } | null, orgRole: string | null = null) {
  mockAuthUser = user;
  mockOrgRole = orgRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockOrgRole = null;
}

describe('Organization Restore API Integration Tests', () => {
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
      description: 'Test description',
    });

    // adminとmemberを追加
    await createTestOrgMember(organization.id, admin.id, 'ADMIN');
    await createTestOrgMember(organization.id, member.id, 'MEMBER');

    // デフォルトでオーナーとして認証
    setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');
  });

  // ============================================================
  // POST /api/organizations/:organizationId/restore - 組織復元
  // ============================================================
  describe('POST /api/organizations/:organizationId/restore', () => {
    beforeEach(async () => {
      // 組織を論理削除状態にする
      await prisma.organization.update({
        where: { id: organization.id },
        data: { deletedAt: new Date() },
      });
    });

    it('OWNERが削除済み組織を復元できる', async () => {
      const response = await request(app)
        .post(`/api/organizations/${organization.id}/restore`)
        .expect(200);

      expect(response.body.organization).toHaveProperty('id', organization.id);
      expect(response.body.organization.deletedAt).toBeNull();

      // DBで確認
      const restoredOrg = await prisma.organization.findUnique({
        where: { id: organization.id },
      });
      expect(restoredOrg?.deletedAt).toBeNull();
    });

    it('復元後に監査ログが記録される', async () => {
      await request(app).post(`/api/organizations/${organization.id}/restore`).expect(200);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: organization.id,
          action: 'organization.restored',
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('ORGANIZATION');
      expect(auditLog?.userId).toBe(owner.id);
      expect(auditLog?.details).toEqual(
        expect.objectContaining({
          name: 'Test Organization',
        })
      );
    });

    it('削除されていない組織の復元は404エラー', async () => {
      // 組織を復元状態に戻す
      await prisma.organization.update({
        where: { id: organization.id },
        data: { deletedAt: null },
      });

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/restore`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('猶予期間（30日）を過ぎた組織の復元は409エラー', async () => {
      // 31日前に削除された状態にする
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 31);
      await prisma.organization.update({
        where: { id: organization.id },
        data: { deletedAt },
      });

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/restore`)
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
      expect(response.body.error.message).toContain('復元期間');
    });

    it('猶予期間内（29日目）の組織は復元できる', async () => {
      // 29日前に削除された状態にする
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 29);
      await prisma.organization.update({
        where: { id: organization.id },
        data: { deletedAt },
      });

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/restore`)
        .expect(200);

      expect(response.body.organization.deletedAt).toBeNull();
    });

    it('ADMINは組織を復元できない', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/restore`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('MEMBERは組織を復元できない', async () => {
      setTestAuth({ id: member.id, email: member.email }, 'MEMBER');

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/restore`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/restore`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('存在しない組織の復元は404エラー', async () => {
      const response = await request(app)
        .post('/api/organizations/non-existent-id/restore')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('復元後は通常の組織操作ができる', async () => {
      // まず復元
      await request(app).post(`/api/organizations/${organization.id}/restore`).expect(200);

      // 組織詳細を取得できる
      const response = await request(app).get(`/api/organizations/${organization.id}`).expect(200);

      expect(response.body.organization.id).toBe(organization.id);
      expect(response.body.organization.deletedAt).toBeNull();
    });
  });
});
