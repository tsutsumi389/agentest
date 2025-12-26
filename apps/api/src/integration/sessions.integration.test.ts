import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestSession,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError } from '@agentest/shared';
import { createApp } from '../app.js';

// グローバルな認証状態（モック用）
let mockAuthUser: { id: string; email: string } | null = null;
let mockSessionId: string | null = null;

// 認証ミドルウェアをモック
vi.mock('@agentest/auth', () => ({
  requireAuth: () => (req: any, _res: any, next: any) => {
    if (!mockAuthUser) {
      return next(new AuthenticationError('認証が必要です'));
    }
    req.user = mockAuthUser;
    req.sessionId = mockSessionId;
    next();
  },
  optionalAuth: () => (_req: any, _res: any, next: any) => next(),
  requireOrgRole: () => (_req: any, _res: any, next: any) => next(),
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
function setTestAuth(user: { id: string; email: string } | null, sessionId: string | null = null) {
  mockAuthUser = user;
  mockSessionId = sessionId;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockSessionId = null;
}

describe('Sessions API Integration Tests', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let currentSession: Awaited<ReturnType<typeof createTestSession>>;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // テストデータをクリーンアップ
    await cleanupTestData();

    // テストユーザーを作成
    testUser = await createTestUser();

    // 現在のセッションを作成
    currentSession = await createTestSession(testUser.id);

    // 認証状態を設定
    setTestAuth({ id: testUser.id, email: testUser.email }, currentSession.id);
  });

  describe('GET /api/sessions', () => {
    it('セッション一覧を取得できる', async () => {
      // 追加のセッションを作成
      await createTestSession(testUser.id, { userAgent: 'Firefox' });
      await createTestSession(testUser.id, { userAgent: 'Safari' });

      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('userAgent');
      expect(response.body.data[0]).toHaveProperty('ipAddress');
      expect(response.body.data[0]).toHaveProperty('lastActiveAt');
      expect(response.body.data[0]).toHaveProperty('isCurrent');
    });

    it('現在のセッションにisCurrentがtrueで返される', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      const current = response.body.data.find((s: any) => s.id === currentSession.id);
      expect(current.isCurrent).toBe(true);
    });

    it('失効済みセッションは一覧に含まれない', async () => {
      // 失効済みセッションを作成
      await createTestSession(testUser.id, {
        userAgent: 'Revoked Browser',
        revokedAt: new Date(),
      });

      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      const revokedSession = response.body.data.find(
        (s: any) => s.userAgent === 'Revoked Browser'
      );
      expect(revokedSession).toBeUndefined();
    });

    it('期限切れセッションは一覧に含まれない', async () => {
      // 期限切れセッションを作成
      await createTestSession(testUser.id, {
        userAgent: 'Expired Browser',
        expiresAt: new Date(Date.now() - 1000),
      });

      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      const expiredSession = response.body.data.find(
        (s: any) => s.userAgent === 'Expired Browser'
      );
      expect(expiredSession).toBeUndefined();
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get('/api/sessions')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('GET /api/sessions/count', () => {
    it('有効なセッション数を取得できる', async () => {
      // 追加のセッションを作成
      await createTestSession(testUser.id);
      await createTestSession(testUser.id);

      const response = await request(app)
        .get('/api/sessions/count')
        .expect(200);

      expect(response.body.data.count).toBe(3);
    });

    it('失効・期限切れセッションはカウントされない', async () => {
      // 失効済みセッション
      await createTestSession(testUser.id, { revokedAt: new Date() });
      // 期限切れセッション
      await createTestSession(testUser.id, { expiresAt: new Date(Date.now() - 1000) });

      const response = await request(app)
        .get('/api/sessions/count')
        .expect(200);

      // 現在のセッションのみ
      expect(response.body.data.count).toBe(1);
    });
  });

  describe('DELETE /api/sessions/:sessionId', () => {
    it('特定のセッションを終了できる', async () => {
      // 終了対象のセッションを作成
      const targetSession = await createTestSession(testUser.id, {
        userAgent: 'Target Browser',
      });

      const response = await request(app)
        .delete(`/api/sessions/${targetSession.id}`)
        .expect(200);

      expect(response.body.data.success).toBe(true);

      // データベースで失効を確認
      const session = await prisma.session.findUnique({
        where: { id: targetSession.id },
      });
      expect(session?.revokedAt).not.toBeNull();
    });

    it('現在のセッションは終了できない（バリデーションエラー）', async () => {
      const response = await request(app)
        .delete(`/api/sessions/${currentSession.id}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('現在使用中のセッション');
    });

    it('存在しないセッションは404エラー', async () => {
      const response = await request(app)
        .delete('/api/sessions/non-existent-session-id')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('他のユーザーのセッションは終了できない', async () => {
      // 別のユーザーを作成
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const otherSession = await createTestSession(otherUser.id);

      const response = await request(app)
        .delete(`/api/sessions/${otherSession.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('既に失効済みのセッションは404エラー', async () => {
      // 失効済みセッションを作成
      const revokedSession = await createTestSession(testUser.id, {
        revokedAt: new Date(),
      });

      const response = await request(app)
        .delete(`/api/sessions/${revokedSession.id}`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/sessions', () => {
    it('他の全セッションを終了できる', async () => {
      // 追加のセッションを作成
      const session1 = await createTestSession(testUser.id);
      const session2 = await createTestSession(testUser.id);

      const response = await request(app)
        .delete('/api/sessions')
        .expect(200);

      expect(response.body.data.success).toBe(true);
      expect(response.body.data.revokedCount).toBe(2);

      // 現在のセッションは有効のまま
      const current = await prisma.session.findUnique({
        where: { id: currentSession.id },
      });
      expect(current?.revokedAt).toBeNull();

      // 他のセッションは失効
      const s1 = await prisma.session.findUnique({ where: { id: session1.id } });
      const s2 = await prisma.session.findUnique({ where: { id: session2.id } });
      expect(s1?.revokedAt).not.toBeNull();
      expect(s2?.revokedAt).not.toBeNull();
    });

    it('他にセッションがない場合はrevokedCount: 0', async () => {
      const response = await request(app)
        .delete('/api/sessions')
        .expect(200);

      expect(response.body.data.revokedCount).toBe(0);
    });
  });
});
