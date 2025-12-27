import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestOrganization,
  createTestOrgMember,
  createTestAuditLog,
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

describe('Organization Audit Logs API Integration Tests', () => {
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
    });

    // adminとmemberを追加
    await createTestOrgMember(organization.id, admin.id, 'ADMIN');
    await createTestOrgMember(organization.id, member.id, 'MEMBER');

    // デフォルトでオーナーとして認証
    setTestAuth({ id: owner.id, email: owner.email }, 'OWNER');
  });

  describe('GET /api/organizations/:organizationId/audit-logs', () => {
    it('監査ログ一覧を取得できる（OWNER）', async () => {
      // 監査ログを作成
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        category: 'ORGANIZATION',
        action: 'organization.update',
      });
      await createTestAuditLog({
        organizationId: organization.id,
        userId: admin.id,
        category: 'MEMBER',
        action: 'member.add',
      });

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .expect(200);

      expect(response.body.logs).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(50);
      expect(response.body.totalPages).toBe(1);
      expect(response.body.logs[0]).toHaveProperty('id');
      expect(response.body.logs[0]).toHaveProperty('category');
      expect(response.body.logs[0]).toHaveProperty('action');
      expect(response.body.logs[0]).toHaveProperty('createdAt');
      expect(response.body.logs[0]).toHaveProperty('user');
    });

    it('監査ログ一覧を取得できる（ADMIN）', async () => {
      setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        category: 'ORGANIZATION',
        action: 'organization.update',
      });

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .expect(200);

      expect(response.body.logs).toHaveLength(1);
    });

    it('ページネーションが正しく動作する', async () => {
      // 5件の監査ログを作成
      for (let i = 0; i < 5; i++) {
        await createTestAuditLog({
          organizationId: organization.id,
          userId: owner.id,
          category: 'ORGANIZATION',
          action: `test.action.${i}`,
          createdAt: new Date(Date.now() - i * 1000), // 時間順
        });
      }

      // 1ページ目
      const response1 = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response1.body.logs).toHaveLength(2);
      expect(response1.body.total).toBe(5);
      expect(response1.body.page).toBe(1);
      expect(response1.body.limit).toBe(2);
      expect(response1.body.totalPages).toBe(3);

      // 2ページ目
      const response2 = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .query({ page: 2, limit: 2 })
        .expect(200);

      expect(response2.body.logs).toHaveLength(2);
      expect(response2.body.page).toBe(2);

      // 3ページ目
      const response3 = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .query({ page: 3, limit: 2 })
        .expect(200);

      expect(response3.body.logs).toHaveLength(1);
    });

    it('カテゴリでフィルタできる', async () => {
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        category: 'ORGANIZATION',
        action: 'organization.update',
      });
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        category: 'MEMBER',
        action: 'member.add',
      });
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        category: 'MEMBER',
        action: 'member.remove',
      });

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .query({ category: 'MEMBER' })
        .expect(200);

      expect(response.body.logs).toHaveLength(2);
      expect(response.body.total).toBe(2);
      response.body.logs.forEach((log: any) => {
        expect(log.category).toBe('MEMBER');
      });
    });

    it('日付範囲でフィルタできる', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        action: 'today',
        createdAt: now,
      });
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        action: 'yesterday',
        createdAt: yesterday,
      });
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        action: 'three_days_ago',
        createdAt: threeDaysAgo,
      });

      // 2日前から今日まで
      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .query({
          startDate: twoDaysAgo.toISOString(),
          endDate: now.toISOString(),
        })
        .expect(200);

      expect(response.body.logs).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('ユーザー情報が含まれる', async () => {
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        category: 'ORGANIZATION',
        action: 'organization.update',
      });

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .expect(200);

      expect(response.body.logs[0].user).toEqual({
        id: owner.id,
        email: owner.email,
        name: owner.name,
        avatarUrl: null,
      });
    });

    it('他の組織のログは含まれない', async () => {
      // 別の組織を作成
      const otherOrg = await createTestOrganization(owner.id, {
        slug: 'other-org',
      });

      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        action: 'this_org',
      });
      await createTestAuditLog({
        organizationId: otherOrg.id,
        userId: owner.id,
        action: 'other_org',
      });

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .expect(200);

      expect(response.body.logs).toHaveLength(1);
      expect(response.body.logs[0].action).toBe('this_org');
    });

    it('新しい順でソートされている', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        action: 'oldest',
        createdAt: twoHoursAgo,
      });
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        action: 'newest',
        createdAt: now,
      });
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        action: 'middle',
        createdAt: oneHourAgo,
      });

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .expect(200);

      expect(response.body.logs[0].action).toBe('newest');
      expect(response.body.logs[1].action).toBe('middle');
      expect(response.body.logs[2].action).toBe('oldest');
    });

    it('空の結果を正しく返す', async () => {
      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .expect(200);

      expect(response.body.logs).toHaveLength(0);
      expect(response.body.total).toBe(0);
      expect(response.body.totalPages).toBe(0);
    });

    it('MEMBERは監査ログを取得できない', async () => {
      setTestAuth({ id: member.id, email: member.email }, 'MEMBER');

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('不正なページ番号は400エラー', async () => {
      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .query({ page: 0 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('不正なlimitは400エラー', async () => {
      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .query({ limit: 200 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('不正なカテゴリは400エラー', async () => {
      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .query({ category: 'INVALID' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('startDate > endDateは400エラー', async () => {
      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .query({
          startDate: '2024-12-31',
          endDate: '2024-01-01',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('全てのカテゴリでフィルタできる', async () => {
      const categories = ['AUTH', 'USER', 'ORGANIZATION', 'MEMBER', 'PROJECT', 'API_TOKEN', 'BILLING'] as const;

      for (const category of categories) {
        await createTestAuditLog({
          organizationId: organization.id,
          userId: owner.id,
          category,
          action: `${category.toLowerCase()}.test`,
        });
      }

      for (const category of categories) {
        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs`)
          .query({ category })
          .expect(200);

        expect(response.body.logs).toHaveLength(1);
        expect(response.body.logs[0].category).toBe(category);
      }
    });

    it('複合フィルタが正しく動作する', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      // 今日のMEMBERログ
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        category: 'MEMBER',
        action: 'member.today',
        createdAt: now,
      });
      // 昨日のMEMBERログ
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        category: 'MEMBER',
        action: 'member.yesterday',
        createdAt: yesterday,
      });
      // 今日のORGANIZATIONログ
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        category: 'ORGANIZATION',
        action: 'org.today',
        createdAt: now,
      });
      // 2日前のMEMBERログ
      await createTestAuditLog({
        organizationId: organization.id,
        userId: owner.id,
        category: 'MEMBER',
        action: 'member.two_days_ago',
        createdAt: twoDaysAgo,
      });

      // MEMBERカテゴリ + 昨日から今日
      const response = await request(app)
        .get(`/api/organizations/${organization.id}/audit-logs`)
        .query({
          category: 'MEMBER',
          startDate: yesterday.toISOString(),
          endDate: now.toISOString(),
        })
        .expect(200);

      expect(response.body.logs).toHaveLength(2);
      expect(response.body.total).toBe(2);
      response.body.logs.forEach((log: any) => {
        expect(log.category).toBe('MEMBER');
      });
    });
  });
});
