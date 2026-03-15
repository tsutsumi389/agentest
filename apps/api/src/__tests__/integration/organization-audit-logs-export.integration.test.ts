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

function clearTestAuth() {
  mockAuthUser = null;
  mockOrgRole = null;
}

describe('Organization Audit Logs Export API Integration Tests', () => {
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

  describe('GET /api/organizations/:organizationId/audit-logs/export', () => {
    describe('認証・認可', () => {
      it('未認証の場合401を返す', async () => {
        clearTestAuth();

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'csv' })
          .expect(401);

        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });

      it('MEMBERは403を返す', async () => {
        setTestAuth({ id: member.id, email: member.email }, 'MEMBER');

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'csv' })
          .expect(403);

        expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
      });

      it('ADMINユーザーはアクセスできる', async () => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');

        await createTestAuditLog({
          organizationId: organization.id,
          userId: owner.id,
          category: 'ORGANIZATION',
          action: 'organization.update',
        });

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'csv' })
          .expect(200);

        expect(response.headers['content-type']).toContain('text/csv');
      });

      it('OWNERユーザーはアクセスできる', async () => {
        await createTestAuditLog({
          organizationId: organization.id,
          userId: owner.id,
          category: 'ORGANIZATION',
          action: 'organization.update',
        });

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'csv' })
          .expect(200);

        expect(response.headers['content-type']).toContain('text/csv');
      });
    });

    describe('CSVエクスポート', () => {
      it('format=csvでCSVファイルをダウンロードできる', async () => {
        await createTestAuditLog({
          organizationId: organization.id,
          userId: owner.id,
          category: 'ORGANIZATION',
          action: 'organization.update',
        });

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'csv' })
          .expect(200);

        expect(response.text).toContain('ID,日時,カテゴリ,アクション,ユーザー');
        expect(response.text).toContain('ORGANIZATION');
        expect(response.text).toContain('organization.update');
      });

      it('Content-Typeがtext/csv; charset=utf-8になる', async () => {
        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'csv' })
          .expect(200);

        expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      });

      it('Content-Dispositionにファイル名が含まれる', async () => {
        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'csv' })
          .expect(200);

        expect(response.headers['content-disposition']).toMatch(
          /^attachment; filename="audit-logs-\d{8}-\d{6}\.csv"$/
        );
      });

      it('BOMが含まれる', async () => {
        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'csv' })
          .expect(200);

        // UTF-8 BOMは\uFEFF（バイト列では EF BB BF）
        const BOM = '\uFEFF';
        expect(response.text.startsWith(BOM)).toBe(true);
      });

      it('データが正しくフォーマットされている', async () => {
        const createdAt = new Date('2024-01-15T10:30:00.000Z');
        await createTestAuditLog({
          organizationId: organization.id,
          userId: owner.id,
          category: 'ORGANIZATION',
          action: 'organization.update',
          targetType: 'organization',
          targetId: organization.id,
          ipAddress: '192.168.1.1',
          details: { name: 'New Name' },
          createdAt,
        });

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'csv' })
          .expect(200);

        // ヘッダー行を確認
        expect(response.text).toContain(
          'ID,日時,カテゴリ,アクション,ユーザー,対象タイプ,対象ID,IPアドレス,詳細'
        );
        // データ行の内容を確認
        expect(response.text).toContain('ORGANIZATION');
        expect(response.text).toContain('organization.update');
        expect(response.text).toContain('owner@example.com');
        expect(response.text).toContain('organization');
        expect(response.text).toContain('192.168.1.1');
      });
    });

    describe('JSONエクスポート', () => {
      it('format=jsonでJSONファイルをダウンロードできる', async () => {
        await createTestAuditLog({
          organizationId: organization.id,
          userId: owner.id,
          category: 'ORGANIZATION',
          action: 'organization.update',
        });

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'json' })
          .expect(200);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(1);
        expect(data[0].category).toBe('ORGANIZATION');
        expect(data[0].action).toBe('organization.update');
      });

      it('Content-Typeがapplication/jsonになる', async () => {
        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'json' })
          .expect(200);

        // supertestがJSONレスポンスに自動でcharset=utf-8を追加するため、containsでチェック
        expect(response.headers['content-type']).toContain('application/json');
      });

      it('有効なJSON形式で出力される', async () => {
        await createTestAuditLog({
          organizationId: organization.id,
          userId: owner.id,
          category: 'ORGANIZATION',
          action: 'organization.update',
          details: { nested: { key: 'value' } },
        });

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'json' })
          .expect(200);

        // JSONとしてパースできること
        expect(() => JSON.parse(response.text)).not.toThrow();

        const data = JSON.parse(response.text);
        expect(data[0]).toHaveProperty('id');
        expect(data[0]).toHaveProperty('createdAt');
        expect(data[0]).toHaveProperty('category');
        expect(data[0]).toHaveProperty('action');
        expect(data[0]).toHaveProperty('user');
        expect(data[0].details).toEqual({ nested: { key: 'value' } });
      });

      it('Content-Dispositionにファイル名が含まれる', async () => {
        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'json' })
          .expect(200);

        expect(response.headers['content-disposition']).toMatch(
          /^attachment; filename="audit-logs-\d{8}-\d{6}\.json"$/
        );
      });
    });

    describe('フィルタリング', () => {
      beforeEach(async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

        await createTestAuditLog({
          organizationId: organization.id,
          userId: owner.id,
          category: 'ORGANIZATION',
          action: 'org.today',
          createdAt: now,
        });
        await createTestAuditLog({
          organizationId: organization.id,
          userId: owner.id,
          category: 'MEMBER',
          action: 'member.yesterday',
          createdAt: yesterday,
        });
        await createTestAuditLog({
          organizationId: organization.id,
          userId: owner.id,
          category: 'MEMBER',
          action: 'member.three_days_ago',
          createdAt: threeDaysAgo,
        });
      });

      it('categoryでフィルタリングできる', async () => {
        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'json', category: 'MEMBER' })
          .expect(200);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(2);
        data.forEach((log: any) => {
          expect(log.category).toBe('MEMBER');
        });
      });

      it('startDateでフィルタリングできる', async () => {
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'json', startDate: twoDaysAgo.toISOString() })
          .expect(200);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(2); // todayとyesterday
      });

      it('endDateでフィルタリングできる', async () => {
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'json', endDate: twoDaysAgo.toISOString() })
          .expect(200);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(1); // three_days_ago
      });

      it('複数フィルタを組み合わせできる', async () => {
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        const now = new Date();

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({
            format: 'json',
            category: 'MEMBER',
            startDate: twoDaysAgo.toISOString(),
            endDate: now.toISOString(),
          })
          .expect(200);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(1); // member.yesterday のみ
        expect(data[0].action).toBe('member.yesterday');
      });
    });

    describe('バリデーション', () => {
      it('formatが未指定の場合400を返す', async () => {
        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('無効なformatの場合400を返す', async () => {
        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'xml' })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('無効なcategoryの場合400を返す', async () => {
        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'csv', category: 'INVALID' })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('startDate > endDateの場合400を返す', async () => {
        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({
            format: 'csv',
            startDate: '2024-12-31',
            endDate: '2024-01-01',
          })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('データ出力', () => {
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
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'json' })
          .expect(200);

        const data = JSON.parse(response.text);
        expect(data[0].action).toBe('newest');
        expect(data[1].action).toBe('middle');
        expect(data[2].action).toBe('oldest');
      });

      it('他の組織のログは含まれない', async () => {
        // 別の組織を作成
        const otherOrg = await createTestOrganization(owner.id, {
          name: 'Other Organization',
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
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'json' })
          .expect(200);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(1);
        expect(data[0].action).toBe('this_org');
      });

      it('ユーザー情報が含まれる', async () => {
        await createTestAuditLog({
          organizationId: organization.id,
          userId: owner.id,
          category: 'ORGANIZATION',
          action: 'organization.update',
        });

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'json' })
          .expect(200);

        const data = JSON.parse(response.text);
        expect(data[0].user).toEqual({
          id: owner.id,
          email: owner.email,
          name: owner.name,
        });
      });

      it('ユーザーがnullの場合も正しく出力される', async () => {
        // userIdなしの監査ログ（システム操作など）
        await createTestAuditLog({
          organizationId: organization.id,
          userId: null,
          category: 'ORGANIZATION',
          action: 'system.action',
        });

        const response = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'json' })
          .expect(200);

        const data = JSON.parse(response.text);
        expect(data[0].user).toBeNull();
      });

      it('空の結果でも正しくエクスポートできる', async () => {
        // CSVの場合
        const csvResponse = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'csv' })
          .expect(200);

        expect(csvResponse.text).toContain('ID,日時,カテゴリ,アクション,ユーザー');

        // JSONの場合
        const jsonResponse = await request(app)
          .get(`/api/organizations/${organization.id}/audit-logs/export`)
          .query({ format: 'json' })
          .expect(200);

        const data = JSON.parse(jsonResponse.text);
        expect(data).toEqual([]);
      });

      it('全てのカテゴリでフィルタできる', async () => {
        const categories = [
          'AUTH',
          'USER',
          'ORGANIZATION',
          'MEMBER',
          'PROJECT',
          'API_TOKEN',
        ] as const;

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
            .get(`/api/organizations/${organization.id}/audit-logs/export`)
            .query({ format: 'json', category })
            .expect(200);

          const data = JSON.parse(response.text);
          expect(data).toHaveLength(1);
          expect(data[0].category).toBe(category);
        }
      });
    });
  });
});
