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
  requireOrgRole: (roles: string[]) => (_req: any, _res: any, next: any) => {
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

describe('Organization CRUD Audit Logs Integration Tests', () => {
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

    // デフォルトでオーナーとして認証
    setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');
  });

  describe('POST /api/organizations - 組織作成', () => {
    it('組織作成時に監査ログが記録される', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'New Organization', description: 'Test description' })
        .expect(201);

      const orgId = response.body.organization.id;

      // 監査ログが記録されていることを確認
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: orgId,
          action: 'organization.created',
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('ORGANIZATION');
      expect(auditLog?.userId).toBe(owner.id);
      expect(auditLog?.targetType).toBe('Organization');
      expect(auditLog?.targetId).toBe(orgId);
      expect(auditLog?.details).toEqual(expect.objectContaining({ name: 'New Organization' }));
    });
  });

  describe('PATCH /api/organizations/:organizationId - 組織更新', () => {
    beforeEach(async () => {
      // 組織を作成（オーナーで）
      organization = await createTestOrganization(owner.id, {
        name: 'Test Organization',
      });
    });

    it('組織更新時に監査ログが記録される', async () => {
      await request(app)
        .patch(`/api/organizations/${organization.id}`)
        .send({ name: 'Updated Organization', description: 'Updated description' })
        .expect(200);

      // 監査ログが記録されていることを確認
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: organization.id,
          action: 'organization.updated',
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('ORGANIZATION');
      expect(auditLog?.userId).toBe(owner.id);
      expect(auditLog?.targetType).toBe('Organization');
      expect(auditLog?.targetId).toBe(organization.id);
      expect(auditLog?.details).toEqual(expect.objectContaining({ name: 'Updated Organization' }));
    });
  });

  describe('DELETE /api/organizations/:organizationId - 組織削除', () => {
    beforeEach(async () => {
      // 組織を作成（オーナーで）
      organization = await createTestOrganization(owner.id, {
        name: 'Test Organization',
      });
    });

    it('組織削除時に監査ログが記録される', async () => {
      await request(app).delete(`/api/organizations/${organization.id}`).expect(204);

      // 監査ログが記録されていることを確認
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: organization.id,
          action: 'organization.deleted',
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('ORGANIZATION');
      expect(auditLog?.userId).toBe(owner.id);
      expect(auditLog?.targetType).toBe('Organization');
      expect(auditLog?.targetId).toBe(organization.id);
      expect(auditLog?.details).toEqual(expect.objectContaining({ name: 'Test Organization' }));
    });
  });

  describe('PATCH /api/organizations/:organizationId/members/:userId - ロール変更', () => {
    beforeEach(async () => {
      // 組織を作成（オーナーで）
      organization = await createTestOrganization(owner.id, {
        name: 'Test Organization',
      });

      // メンバーを追加
      await createTestOrgMember(organization.id, member.id, 'MEMBER');
    });

    it('ロール変更時に監査ログが記録される', async () => {
      await request(app)
        .patch(`/api/organizations/${organization.id}/members/${member.id}`)
        .send({ role: 'ADMIN' })
        .expect(200);

      // 監査ログが記録されていることを確認
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: organization.id,
          action: 'member.role_updated',
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('MEMBER');
      expect(auditLog?.userId).toBe(owner.id);
      expect(auditLog?.targetType).toBe('OrganizationMember');
      expect(auditLog?.details).toEqual(
        expect.objectContaining({
          targetUserId: member.id,
          previousRole: 'MEMBER',
          newRole: 'ADMIN',
        })
      );
    });
  });

  describe('DELETE /api/organizations/:organizationId/members/:userId - メンバー削除', () => {
    beforeEach(async () => {
      // 組織を作成（オーナーで）
      organization = await createTestOrganization(owner.id, {
        name: 'Test Organization',
      });

      // メンバーを追加
      await createTestOrgMember(organization.id, member.id, 'MEMBER');
    });

    it('メンバー削除時に監査ログが記録される', async () => {
      await request(app)
        .delete(`/api/organizations/${organization.id}/members/${member.id}`)
        .expect(204);

      // 監査ログが記録されていることを確認
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: organization.id,
          action: 'member.removed',
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('MEMBER');
      expect(auditLog?.userId).toBe(owner.id);
      expect(auditLog?.targetType).toBe('OrganizationMember');
      expect(auditLog?.details).toEqual(
        expect.objectContaining({
          targetUserId: member.id,
          email: member.email,
          role: 'MEMBER',
        })
      );
    });
  });

  describe('POST /api/organizations/:organizationId/transfer-ownership - オーナー権限移譲', () => {
    beforeEach(async () => {
      // 組織を作成（オーナーで）
      organization = await createTestOrganization(owner.id, {
        name: 'Test Organization',
      });

      // Adminを追加
      await createTestOrgMember(organization.id, admin.id, 'ADMIN');
    });

    it('オーナー権限移譲時に監査ログが記録される', async () => {
      await request(app)
        .post(`/api/organizations/${organization.id}/transfer-ownership`)
        .send({ newOwnerId: admin.id })
        .expect(200);

      // 監査ログが記録されていることを確認
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: organization.id,
          action: 'organization.ownership_transferred',
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('ORGANIZATION');
      expect(auditLog?.userId).toBe(owner.id);
      expect(auditLog?.targetType).toBe('Organization');
      expect(auditLog?.targetId).toBe(organization.id);
      expect(auditLog?.details).toEqual(
        expect.objectContaining({
          previousOwnerId: owner.id,
          newOwnerId: admin.id,
          newOwnerEmail: admin.email,
        })
      );
    });
  });

  describe('POST /api/organizations/invitations/:token/accept - 招待承認', () => {
    beforeEach(async () => {
      // 組織を作成（オーナーで）
      organization = await createTestOrganization(owner.id, {
        name: 'Test Organization',
      });
    });

    it('招待承認時に監査ログが記録される', async () => {
      // 招待対象のユーザーを作成
      const invitedUser = await createTestUser({ email: 'newmember@example.com' });

      // 招待を作成
      await prisma.organizationInvitation.create({
        data: {
          organizationId: organization.id,
          email: 'newmember@example.com',
          role: 'MEMBER',
          token: 'accept-token',
          invitedByUserId: owner.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      setTestAuth({ id: invitedUser.id, email: invitedUser.email }, null);

      await request(app).post('/api/organizations/invitations/accept-token/accept').expect(200);

      // 監査ログが記録されていることを確認
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: organization.id,
          action: 'member.invitation_accepted',
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('MEMBER');
      expect(auditLog?.userId).toBe(invitedUser.id);
      expect(auditLog?.targetType).toBe('OrganizationMember');
      expect(auditLog?.details).toEqual(
        expect.objectContaining({
          email: 'newmember@example.com',
          role: 'MEMBER',
        })
      );
    });
  });
});
