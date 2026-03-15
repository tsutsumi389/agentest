import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import { createTestUser, cleanupTestData } from './test-helpers.js';
import { AuthenticationError } from '@agentest/shared';
import { createApp } from '../../app.js';

// Redis publisherのモック
vi.mock('../../lib/redis-publisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
  publishDashboardUpdated: vi.fn().mockResolvedValue(undefined),
}));

// グローバルな認証状態（モック用）
let mockAuthUser: { id: string; email: string } | null = null;

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
function setTestAuth(user: { id: string; email: string } | null) {
  mockAuthUser = user;
}

function clearTestAuth() {
  mockAuthUser = null;
}

describe('Notifications API Integration Tests', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    app = createApp();
    testUser = await createTestUser({
      email: 'notification-test@example.com',
      name: 'Notification Test User',
    });
  });

  afterAll(async () => {
    // 通知関連データをクリーンアップ
    await prisma.notificationPreference.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.notification.deleteMany({
      where: { userId: testUser.id },
    });
    await cleanupTestData();
  });

  beforeEach(async () => {
    clearTestAuth();
    // テスト用通知を削除
    await prisma.notification.deleteMany({
      where: { userId: testUser.id },
    });
  });

  describe('GET /api/notifications', () => {
    it('認証済みユーザーの通知一覧を取得できる', async () => {
      setTestAuth({ id: testUser.id, email: testUser.email });

      // テスト用通知を作成（順序を明確にするため順番に作成）
      await prisma.notification.create({
        data: {
          userId: testUser.id,
          type: 'ORG_INVITATION',
          title: 'テスト通知1',
          body: '本文1',
        },
      });
      // 明確な順序を確保するため、少し待機してから2つ目を作成
      await new Promise((resolve) => setTimeout(resolve, 10));
      await prisma.notification.create({
        data: {
          userId: testUser.id,
          type: 'TEST_COMPLETED',
          title: 'テスト通知2',
          body: '本文2',
        },
      });

      const response = await request(app).get('/api/notifications');

      expect(response.status).toBe(200);
      expect(response.body.notifications).toHaveLength(2);
      expect(response.body.notifications[0].title).toBe('テスト通知2'); // 新しい順
    });

    it('未認証の場合401エラー', async () => {
      clearTestAuth();

      const response = await request(app).get('/api/notifications');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('未読数を取得できる', async () => {
      setTestAuth({ id: testUser.id, email: testUser.email });

      // 未読と既読の通知を作成
      await prisma.notification.createMany({
        data: [
          {
            userId: testUser.id,
            type: 'ORG_INVITATION',
            title: '未読通知1',
            body: '本文',
          },
          {
            userId: testUser.id,
            type: 'TEST_COMPLETED',
            title: '未読通知2',
            body: '本文',
          },
          {
            userId: testUser.id,
            type: 'REVIEW_COMMENT',
            title: '既読通知',
            body: '本文',
            readAt: new Date(),
          },
        ],
      });

      const response = await request(app).get('/api/notifications/unread-count');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(2);
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('通知を既読にできる', async () => {
      setTestAuth({ id: testUser.id, email: testUser.email });

      const notification = await prisma.notification.create({
        data: {
          userId: testUser.id,
          type: 'ORG_INVITATION',
          title: 'テスト通知',
          body: '本文',
        },
      });

      const response = await request(app).patch(`/api/notifications/${notification.id}/read`);

      expect(response.status).toBe(200);
      expect(response.body.notification.readAt).toBeDefined();
    });

    it('他ユーザーの通知は既読にできない', async () => {
      setTestAuth({ id: testUser.id, email: testUser.email });

      const otherUser = await createTestUser({
        email: 'other-user@example.com',
        name: 'Other User',
      });
      const notification = await prisma.notification.create({
        data: {
          userId: otherUser.id,
          type: 'ORG_INVITATION',
          title: 'テスト通知',
          body: '本文',
        },
      });

      const response = await request(app).patch(`/api/notifications/${notification.id}/read`);

      expect(response.status).toBe(403);

      // クリーンアップ
      await prisma.notification.delete({ where: { id: notification.id } });
      await prisma.account.deleteMany({ where: { userId: otherUser.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('POST /api/notifications/mark-all-read', () => {
    it('全ての通知を既読にできる', async () => {
      setTestAuth({ id: testUser.id, email: testUser.email });

      await prisma.notification.createMany({
        data: [
          { userId: testUser.id, type: 'ORG_INVITATION', title: '通知1', body: '本文' },
          { userId: testUser.id, type: 'TEST_COMPLETED', title: '通知2', body: '本文' },
        ],
      });

      const response = await request(app).post('/api/notifications/mark-all-read');

      expect(response.status).toBe(200);
      expect(response.body.updatedCount).toBe(2);

      // 未読数が0になっていることを確認
      const countResponse = await request(app).get('/api/notifications/unread-count');
      expect(countResponse.body.count).toBe(0);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('通知を削除できる', async () => {
      setTestAuth({ id: testUser.id, email: testUser.email });

      const notification = await prisma.notification.create({
        data: {
          userId: testUser.id,
          type: 'ORG_INVITATION',
          title: 'テスト通知',
          body: '本文',
        },
      });

      const response = await request(app).delete(`/api/notifications/${notification.id}`);

      expect(response.status).toBe(204);

      // 削除されていることを確認
      const deleted = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe('GET /api/notifications/preferences', () => {
    it('通知設定を取得できる', async () => {
      setTestAuth({ id: testUser.id, email: testUser.email });

      const response = await request(app).get('/api/notifications/preferences');

      expect(response.status).toBe(200);
      expect(response.body.preferences).toBeDefined();
      expect(Array.isArray(response.body.preferences)).toBe(true);
    });
  });

  describe('PATCH /api/notifications/preferences/:type', () => {
    it('通知設定を更新できる', async () => {
      setTestAuth({ id: testUser.id, email: testUser.email });

      const response = await request(app)
        .patch('/api/notifications/preferences/ORG_INVITATION')
        .send({ emailEnabled: false });

      expect(response.status).toBe(200);
      expect(response.body.preference.emailEnabled).toBe(false);
    });

    it('無効な通知タイプはエラー', async () => {
      setTestAuth({ id: testUser.id, email: testUser.email });

      const response = await request(app)
        .patch('/api/notifications/preferences/INVALID_TYPE')
        .send({ emailEnabled: false });

      expect(response.status).toBe(400);
    });
  });
});
