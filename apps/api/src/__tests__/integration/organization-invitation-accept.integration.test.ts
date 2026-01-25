import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestOrganization,
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

describe('Organization Invitation Accept/Token API Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
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

    // 組織を作成（オーナーで）
    organization = await createTestOrganization(owner.id, {
      name: 'Test Organization',
    });
  });

  // ============================================================
  // GET /api/organizations/invitations/:token - 招待詳細取得
  // ============================================================
  describe('GET /api/organizations/invitations/:token', () => {
    it('認証なしで招待詳細を取得できる', async () => {
      await createTestInvitation(organization.id, owner.id, {
        email: 'invited@example.com',
        role: 'MEMBER',
        token: 'test-token-123',
      });

      clearTestAuth();

      const response = await request(app)
        .get('/api/organizations/invitations/test-token-123')
        .expect(200);

      expect(response.body.invitation).toHaveProperty('id');
      expect(response.body.invitation.email).toBe('invited@example.com');
      expect(response.body.invitation.role).toBe('MEMBER');
      expect(response.body.invitation.status).toBe('pending');
      expect(response.body.invitation.organization).toHaveProperty('name', 'Test Organization');
      expect(response.body.invitation.invitedBy).toHaveProperty('name', 'Owner');
    });

    it('存在しないトークンは404エラー', async () => {
      const response = await request(app)
        .get('/api/organizations/invitations/non-existent-token')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('承諾済みの招待はstatus=acceptedを返す', async () => {
      await createTestInvitation(organization.id, owner.id, {
        email: 'accepted@example.com',
        token: 'accepted-token',
        acceptedAt: new Date(),
      });

      const response = await request(app)
        .get('/api/organizations/invitations/accepted-token')
        .expect(200);

      expect(response.body.invitation.status).toBe('accepted');
    });

    it('辞退済みの招待はstatus=declinedを返す', async () => {
      await createTestInvitation(organization.id, owner.id, {
        email: 'declined@example.com',
        token: 'declined-token',
        declinedAt: new Date(),
      });

      const response = await request(app)
        .get('/api/organizations/invitations/declined-token')
        .expect(200);

      expect(response.body.invitation.status).toBe('declined');
    });

    it('期限切れの招待はstatus=expiredを返す', async () => {
      await createTestInvitation(organization.id, owner.id, {
        email: 'expired@example.com',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000),
      });

      const response = await request(app)
        .get('/api/organizations/invitations/expired-token')
        .expect(200);

      expect(response.body.invitation.status).toBe('expired');
    });
  });

  // ============================================================
  // POST /api/organizations/invitations/:token/accept - 招待承諾
  // ============================================================
  describe('POST /api/organizations/invitations/:token/accept', () => {
    it('招待を承諾してメンバーになれる', async () => {
      const invitedUser = await createTestUser({ email: 'newmember@example.com', name: 'New Member' });
      const invitation = await createTestInvitation(organization.id, owner.id, {
        email: 'newmember@example.com',
        role: 'MEMBER',
        token: 'accept-token',
      });

      setTestAuth({ id: invitedUser.id, email: invitedUser.email }, null);

      const response = await request(app)
        .post('/api/organizations/invitations/accept-token/accept')
        .expect(200);

      expect(response.body.member).toHaveProperty('organization');
      expect(response.body.member.user.email).toBe('newmember@example.com');

      // メンバーとして追加されていることを確認
      const member = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: invitedUser.id,
          },
        },
      });
      expect(member).not.toBeNull();
      expect(member?.role).toBe('MEMBER');

      // 招待が承諾済みになっていることを確認
      const updatedInvitation = await prisma.organizationInvitation.findUnique({
        where: { id: invitation.id },
      });
      expect(updatedInvitation?.acceptedAt).not.toBeNull();
    });

    it('ADMINとして招待された場合はADMINになれる', async () => {
      const invitedUser = await createTestUser({ email: 'newadmin@example.com', name: 'New Admin' });
      await createTestInvitation(organization.id, owner.id, {
        email: 'newadmin@example.com',
        role: 'ADMIN',
        token: 'admin-token',
      });

      setTestAuth({ id: invitedUser.id, email: invitedUser.email }, null);

      await request(app)
        .post('/api/organizations/invitations/admin-token/accept')
        .expect(200);

      // ADMINとして追加されていることを確認
      const member = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: invitedUser.id,
          },
        },
      });
      expect(member?.role).toBe('ADMIN');
    });

    it('存在しないトークンは404エラー', async () => {
      const invitedUser = await createTestUser({ email: 'test@example.com' });
      setTestAuth({ id: invitedUser.id, email: invitedUser.email }, null);

      const response = await request(app)
        .post('/api/organizations/invitations/non-existent-token/accept')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('他人宛ての招待は承諾できない', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      await createTestInvitation(organization.id, owner.id, {
        email: 'target@example.com', // 違うメールアドレス
        token: 'other-user-token',
      });

      setTestAuth({ id: otherUser.id, email: otherUser.email }, null);

      const response = await request(app)
        .post('/api/organizations/invitations/other-user-token/accept')
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('既に承諾された招待は再度承諾できない', async () => {
      const invitedUser = await createTestUser({ email: 'already@example.com' });
      await createTestInvitation(organization.id, owner.id, {
        email: 'already@example.com',
        token: 'already-accepted-token',
        acceptedAt: new Date(),
      });

      setTestAuth({ id: invitedUser.id, email: invitedUser.email }, null);

      const response = await request(app)
        .post('/api/organizations/invitations/already-accepted-token/accept')
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('既に辞退された招待は承諾できない', async () => {
      const invitedUser = await createTestUser({ email: 'declined@example.com' });
      await createTestInvitation(organization.id, owner.id, {
        email: 'declined@example.com',
        token: 'declined-accept-token',
        declinedAt: new Date(),
      });

      setTestAuth({ id: invitedUser.id, email: invitedUser.email }, null);

      const response = await request(app)
        .post('/api/organizations/invitations/declined-accept-token/accept')
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('期限切れの招待は承諾できない', async () => {
      const invitedUser = await createTestUser({ email: 'expired@example.com' });
      await createTestInvitation(organization.id, owner.id, {
        email: 'expired@example.com',
        token: 'expired-accept-token',
        expiresAt: new Date(Date.now() - 1000),
      });

      setTestAuth({ id: invitedUser.id, email: invitedUser.email }, null);

      const response = await request(app)
        .post('/api/organizations/invitations/expired-accept-token/accept')
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('未認証の場合は401エラー', async () => {
      await createTestInvitation(organization.id, owner.id, {
        email: 'unauth@example.com',
        token: 'unauth-token',
      });

      clearTestAuth();

      const response = await request(app)
        .post('/api/organizations/invitations/unauth-token/accept')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('ユーザーが存在しない場合は403エラー', async () => {
      await createTestInvitation(organization.id, owner.id, {
        email: 'nouser@example.com',
        token: 'nouser-token',
      });

      // 存在しないユーザーIDで認証
      setTestAuth({ id: 'non-existent-user-id', email: 'nouser@example.com' }, null);

      const response = await request(app)
        .post('/api/organizations/invitations/nouser-token/accept')
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });
});
