import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestOrganization,
  createTestOrgMember,
  createTestInvitation,
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
  authenticate: (_options: { optional?: boolean } = {}) => (req: any, _res: any, next: any) => { if (mockAuthUser) req.user = mockAuthUser; next(); },
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

describe('Organization Invitations API Integration Tests', () => {
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
    });

    // adminとmemberを追加
    await createTestOrgMember(organization.id, admin.id, 'ADMIN');
    await createTestOrgMember(organization.id, member.id, 'MEMBER');

    // デフォルトでオーナーとして認証
    setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');
  });

  describe('GET /api/organizations/:organizationId/invitations', () => {
    it('保留中の招待一覧を取得できる（OWNER）', async () => {
      // 招待を作成
      await createTestInvitation(organization.id, owner.id, {
        email: 'invite1@example.com',
        role: 'MEMBER',
      });
      await createTestInvitation(organization.id, owner.id, {
        email: 'invite2@example.com',
        role: 'ADMIN',
      });

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/invitations`)
        .expect(200);

      expect(response.body.invitations).toHaveLength(2);
      expect(response.body.invitations[0]).toHaveProperty('id');
      expect(response.body.invitations[0]).toHaveProperty('email');
      expect(response.body.invitations[0]).toHaveProperty('role');
      expect(response.body.invitations[0]).toHaveProperty('expiresAt');
      expect(response.body.invitations[0]).toHaveProperty('invitedBy');
    });

    it('保留中の招待一覧を取得できる（ADMIN）', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      await createTestInvitation(organization.id, owner.id, {
        email: 'invite1@example.com',
      });

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/invitations`)
        .expect(200);

      expect(response.body.invitations).toHaveLength(1);
    });

    it('期限切れの招待は含まれない', async () => {
      // 有効な招待
      await createTestInvitation(organization.id, owner.id, {
        email: 'valid@example.com',
      });
      // 期限切れの招待
      await createTestInvitation(organization.id, owner.id, {
        email: 'expired@example.com',
        expiresAt: new Date(Date.now() - 1000),
      });

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/invitations`)
        .expect(200);

      expect(response.body.invitations).toHaveLength(1);
      expect(response.body.invitations[0].email).toBe('valid@example.com');
    });

    it('承諾済みの招待は含まれない', async () => {
      await createTestInvitation(organization.id, owner.id, {
        email: 'accepted@example.com',
        acceptedAt: new Date(),
      });

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/invitations`)
        .expect(200);

      expect(response.body.invitations).toHaveLength(0);
    });

    it('辞退済みの招待は含まれない', async () => {
      await createTestInvitation(organization.id, owner.id, {
        email: 'declined@example.com',
        declinedAt: new Date(),
      });

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/invitations`)
        .expect(200);

      expect(response.body.invitations).toHaveLength(0);
    });

    it('MEMBERは招待一覧を取得できない', async () => {
      setTestAuth({ id: member.id, email: member.email }, 'MEMBER');

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/invitations`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/invitations`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('POST /api/organizations/:organizationId/invitations', () => {
    it('新しいユーザーを招待できる', async () => {
      const response = await request(app)
        .post(`/api/organizations/${organization.id}/invitations`)
        .send({ email: 'newuser@example.com', role: 'MEMBER' })
        .expect(201);

      expect(response.body.invitation).toHaveProperty('id');
      expect(response.body.invitation.email).toBe('newuser@example.com');
      expect(response.body.invitation.role).toBe('MEMBER');
      expect(response.body.invitation).toHaveProperty('token');

      // データベースで確認
      const invitation = await prisma.organizationInvitation.findFirst({
        where: { email: 'newuser@example.com' },
      });
      expect(invitation).not.toBeNull();

      // 監査ログが記録されていることを確認
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: organization.id,
          action: 'member.invited',
          targetId: invitation!.id,
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('MEMBER');
      expect(auditLog?.userId).toBe(owner.id);
      expect(auditLog?.details).toEqual(
        expect.objectContaining({ email: 'newuser@example.com', role: 'MEMBER' })
      );
    });

    it('ADMINとして招待できる', async () => {
      const response = await request(app)
        .post(`/api/organizations/${organization.id}/invitations`)
        .send({ email: 'newadmin@example.com', role: 'ADMIN' })
        .expect(201);

      expect(response.body.invitation.role).toBe('ADMIN');
    });

    it('既にメンバーのユーザーは招待できない', async () => {
      const response = await request(app)
        .post(`/api/organizations/${organization.id}/invitations`)
        .send({ email: member.email, role: 'MEMBER' })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('保留中の招待がある場合は招待できない', async () => {
      // 保留中の招待を作成
      await createTestInvitation(organization.id, owner.id, {
        email: 'pending@example.com',
      });

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/invitations`)
        .send({ email: 'pending@example.com', role: 'MEMBER' })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('期限切れの招待がある場合は再招待できる', async () => {
      // 期限切れの招待を作成
      await createTestInvitation(organization.id, owner.id, {
        email: 'expired@example.com',
        expiresAt: new Date(Date.now() - 1000),
      });

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/invitations`)
        .send({ email: 'expired@example.com', role: 'MEMBER' })
        .expect(201);

      expect(response.body.invitation.email).toBe('expired@example.com');
    });

    it('辞退済みの招待がある場合は再招待できる', async () => {
      // 辞退済みの招待を作成
      await createTestInvitation(organization.id, owner.id, {
        email: 'declined@example.com',
        declinedAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/organizations/${organization.id}/invitations`)
        .send({ email: 'declined@example.com', role: 'MEMBER' })
        .expect(201);

      expect(response.body.invitation.email).toBe('declined@example.com');
    });

    it('不正なメールアドレスはバリデーションエラー', async () => {
      const response = await request(app)
        .post(`/api/organizations/${organization.id}/invitations`)
        .send({ email: 'invalid-email', role: 'MEMBER' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('不正なロールはバリデーションエラー', async () => {
      const response = await request(app)
        .post(`/api/organizations/${organization.id}/invitations`)
        .send({ email: 'user@example.com', role: 'OWNER' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/organizations/:organizationId/invitations/:invitationId', () => {
    it('招待を取消できる（OWNER）', async () => {
      const invitation = await createTestInvitation(organization.id, owner.id, {
        email: 'cancel@example.com',
      });

      await request(app)
        .delete(`/api/organizations/${organization.id}/invitations/${invitation.id}`)
        .expect(204);

      // データベースで削除を確認
      const deletedInvitation = await prisma.organizationInvitation.findUnique({
        where: { id: invitation.id },
      });
      expect(deletedInvitation).toBeNull();

      // 監査ログが記録されていることを確認
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: organization.id,
          action: 'member.invitation_cancelled',
          targetId: invitation.id,
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('MEMBER');
      expect(auditLog?.userId).toBe(owner.id);
      expect(auditLog?.details).toEqual(
        expect.objectContaining({ email: 'cancel@example.com' })
      );
    });

    it('招待を取消できる（ADMIN）', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      const invitation = await createTestInvitation(organization.id, owner.id, {
        email: 'cancel@example.com',
      });

      await request(app)
        .delete(`/api/organizations/${organization.id}/invitations/${invitation.id}`)
        .expect(204);
    });

    it('存在しない招待は404エラー', async () => {
      const response = await request(app)
        .delete(`/api/organizations/${organization.id}/invitations/non-existent-id`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('他の組織の招待は取消できない', async () => {
      // 別の組織を作成
      const otherOrg = await createTestOrganization(owner.id, {});
      const invitation = await createTestInvitation(otherOrg.id, owner.id, {
        email: 'other@example.com',
      });

      const response = await request(app)
        .delete(`/api/organizations/${organization.id}/invitations/${invitation.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('既に承諾された招待は取消できない', async () => {
      const invitation = await createTestInvitation(organization.id, owner.id, {
        email: 'accepted@example.com',
        acceptedAt: new Date(),
      });

      const response = await request(app)
        .delete(`/api/organizations/${organization.id}/invitations/${invitation.id}`)
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('既に辞退された招待は取消できない', async () => {
      const invitation = await createTestInvitation(organization.id, owner.id, {
        email: 'declined@example.com',
        declinedAt: new Date(),
      });

      const response = await request(app)
        .delete(`/api/organizations/${organization.id}/invitations/${invitation.id}`)
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('MEMBERは招待を取消できない', async () => {
      setTestAuth({ id: member.id, email: member.email }, 'MEMBER');

      const invitation = await createTestInvitation(organization.id, owner.id, {
        email: 'cancel@example.com',
      });

      const response = await request(app)
        .delete(`/api/organizations/${organization.id}/invitations/${invitation.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('POST /api/organizations/invitations/:token/decline', () => {
    it('招待を辞退できる', async () => {
      // 招待対象のユーザーを作成
      const invitedUser = await createTestUser({ email: 'invited@example.com' });
      const invitation = await createTestInvitation(organization.id, owner.id, {
        email: 'invited@example.com',
        token: 'decline-token',
      });

      setTestAuth({ id: invitedUser.id, email: invitedUser.email }, null);

      const response = await request(app)
        .post('/api/organizations/invitations/decline-token/decline')
        .expect(200);

      expect(response.body.invitation).toHaveProperty('declinedAt');
      expect(response.body.invitation.organization).toHaveProperty('name');

      // データベースで確認
      const declinedInvitation = await prisma.organizationInvitation.findUnique({
        where: { id: invitation.id },
      });
      expect(declinedInvitation?.declinedAt).not.toBeNull();

      // 監査ログが記録されていることを確認
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: organization.id,
          action: 'member.invitation_declined',
          targetId: invitation.id,
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.category).toBe('MEMBER');
      expect(auditLog?.userId).toBe(invitedUser.id);
      expect(auditLog?.details).toEqual(
        expect.objectContaining({ email: 'invited@example.com' })
      );
    });

    it('存在しない招待トークンは404エラー', async () => {
      const response = await request(app)
        .post('/api/organizations/invitations/invalid-token/decline')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('他人宛ての招待は辞退できない', async () => {
      // 招待は別のメールアドレス宛て
      await createTestInvitation(organization.id, owner.id, {
        email: 'other@example.com',
        token: 'other-token',
      });

      // 現在のユーザーは違うメールアドレス
      setTestAuth({ id: owner.id, email: owner.email }, null);

      const response = await request(app)
        .post('/api/organizations/invitations/other-token/decline')
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('既に承諾された招待は辞退できない', async () => {
      const invitedUser = await createTestUser({ email: 'already@example.com' });
      await createTestInvitation(organization.id, owner.id, {
        email: 'already@example.com',
        token: 'accepted-token',
        acceptedAt: new Date(),
      });

      setTestAuth({ id: invitedUser.id, email: invitedUser.email }, null);

      const response = await request(app)
        .post('/api/organizations/invitations/accepted-token/decline')
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('既に辞退された招待は再度辞退できない', async () => {
      const invitedUser = await createTestUser({ email: 'declined@example.com' });
      await createTestInvitation(organization.id, owner.id, {
        email: 'declined@example.com',
        token: 'declined-token',
        declinedAt: new Date(),
      });

      setTestAuth({ id: invitedUser.id, email: invitedUser.email }, null);

      const response = await request(app)
        .post('/api/organizations/invitations/declined-token/decline')
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('期限切れの招待は辞退できない', async () => {
      const invitedUser = await createTestUser({ email: 'expired@example.com' });
      await createTestInvitation(organization.id, owner.id, {
        email: 'expired@example.com',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000),
      });

      setTestAuth({ id: invitedUser.id, email: invitedUser.email }, null);

      const response = await request(app)
        .post('/api/organizations/invitations/expired-token/decline')
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('未認証の場合は401エラー', async () => {
      await createTestInvitation(organization.id, owner.id, {
        email: 'invited@example.com',
        token: 'test-token',
      });

      clearTestAuth();

      const response = await request(app)
        .post('/api/organizations/invitations/test-token/decline')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });
});
