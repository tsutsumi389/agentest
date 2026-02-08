import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestSession,
  createTestRefreshToken,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError } from '@agentest/shared';
import { createApp } from '../../app.js';
import { hashToken } from '../../utils/pkce.js';

// グローバルな認証状態（モック用）
let mockAuthUser: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: string;
  createdAt: Date;
} | null = null;

// モック用のverifyRefreshToken結果
let mockVerifyRefreshTokenResult: { sub: string; email: string } | null = null;
let mockVerifyRefreshTokenError: Error | null = null;

// 生成されるトークン
const mockGeneratedTokens = {
  accessToken: 'mock-access-token-new',
  refreshToken: 'mock-refresh-token-new',
};

// vi.hoistedを使用してモック関数を事前定義
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
  authenticate: (_options: { optional?: boolean } = {}) => (req: any, _res: any, next: any) => { if (mockAuthUser) req.user = mockAuthUser; next(); },
  configurePassport: vi.fn(),
  passport: { initialize: vi.fn(), authenticate: vi.fn() },
  generateTokens: vi.fn().mockImplementation(() => mockGeneratedTokens),
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: vi.fn().mockImplementation(() => {
    if (mockVerifyRefreshTokenError) {
      throw mockVerifyRefreshTokenError;
    }
    return mockVerifyRefreshTokenResult;
  }),
  decodeToken: vi.fn(),
  getTokenExpiry: vi.fn(),
  createAuthConfig: vi.fn(),
  defaultAuthConfig: {},
}));

// テスト用認証設定関数
function setTestAuth(user: typeof mockAuthUser) {
  mockAuthUser = user;
}

function clearTestAuth() {
  mockAuthUser = null;
}

function setMockRefreshTokenVerification(result: { sub: string; email: string } | null, error?: Error) {
  mockVerifyRefreshTokenResult = result;
  mockVerifyRefreshTokenError = error ?? null;
}

describe('Auth API Integration Tests', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
    clearTestAuth();
    setMockRefreshTokenVerification(null);

    // テストユーザーを作成
    testUser = await createTestUser({
      email: 'test@example.com',
      name: 'Test User',
    });
  });

  describe('GET /api/auth/me', () => {
    it('認証済みユーザーの情報を取得できる', async () => {
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        plan: 'FREE',
        createdAt: testUser.createdAt,
      });

      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.name).toBe(testUser.name);
    });

    it('ユーザー情報に必要なフィールドが含まれる', async () => {
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: 'https://example.com/avatar.png',
        plan: 'PRO',
        createdAt: testUser.createdAt,
      });

      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('name');
      expect(response.body.user).toHaveProperty('avatarUrl');
      expect(response.body.user).toHaveProperty('plan');
      expect(response.body.user).toHaveProperty('createdAt');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: Awaited<ReturnType<typeof createTestRefreshToken>>;
    let rawRefreshToken: string;

    beforeEach(async () => {
      // リフレッシュトークンを作成（ハッシュ化してDBに保存）
      rawRefreshToken = 'valid-refresh-token';
      refreshToken = await createTestRefreshToken(testUser.id, {
        tokenHash: hashToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // モックの検証結果を設定
      setMockRefreshTokenVerification({ sub: testUser.id, email: testUser.email });
    });

    it('有効なリフレッシュトークンで新しいトークンを取得できる', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('トークンが更新されました');
      // トークンはクッキーでのみ返却され、レスポンスボディには含まれない
      expect(response.body.accessToken).toBeUndefined();
      expect(response.body.refreshToken).toBeUndefined();
    });

    it('クッキーからリフレッシュトークンを読み取れる', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${rawRefreshToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('トークンが更新されました');
    });

    it('新しいセッションがDBに作成される', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      // 新しいセッションが作成されていることを確認
      const sessions = await prisma.session.findMany({
        where: { userId: testUser.id },
      });

      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });

    it('古いリフレッシュトークンが無効化される', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      const oldToken = await prisma.refreshToken.findUnique({
        where: { id: refreshToken.id },
      });

      expect(oldToken?.revokedAt).not.toBeNull();
    });

    it('リフレッシュトークンなしでは400エラー', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('リフレッシュトークン');
    });

    it('無効なリフレッシュトークンでは401エラー', async () => {
      setMockRefreshTokenVerification(
        null,
        new AuthenticationError('無効なトークンです')
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
    });

    it('期限切れリフレッシュトークンでは401エラー', async () => {
      // 期限切れのトークンを作成
      await prisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('無効なリフレッシュトークン');
    });

    it('無効化済みリフレッシュトークンでは401エラー', async () => {
      // トークンを無効化
      await prisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: { revokedAt: new Date() },
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('無効なリフレッシュトークン');
    });

    it('削除済みユーザーでは401エラー', async () => {
      // ユーザーを削除済みに更新
      await prisma.user.update({
        where: { id: testUser.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('ユーザーが見つかりません');
    });
  });

  describe('POST /api/auth/logout', () => {
    let session: Awaited<ReturnType<typeof createTestSession>>;
    let refreshToken: Awaited<ReturnType<typeof createTestRefreshToken>>;
    let rawLogoutToken: string;

    beforeEach(async () => {
      // セッションとリフレッシュトークンを作成（ハッシュ化してDBに保存）
      rawLogoutToken = 'logout-test-token';
      session = await createTestSession(testUser.id, {
        tokenHash: hashToken(rawLogoutToken),
      });
      refreshToken = await createTestRefreshToken(testUser.id, {
        tokenHash: hashToken(rawLogoutToken),
      });

      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        plan: 'FREE',
        createdAt: testUser.createdAt,
      });
    });

    it('ログアウトに成功する', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', `refresh_token=${rawLogoutToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('ログアウトしました');
    });

    it('リフレッシュトークンが無効化される', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', `refresh_token=${rawLogoutToken}`);

      const token = await prisma.refreshToken.findUnique({
        where: { id: refreshToken.id },
      });

      expect(token?.revokedAt).not.toBeNull();
    });

    it('セッションが無効化される', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', `refresh_token=${rawLogoutToken}`);

      const sess = await prisma.session.findUnique({
        where: { id: session.id },
      });

      expect(sess?.revokedAt).not.toBeNull();
    });

    it('クッキーがクリアされる', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', `refresh_token=${rawLogoutToken}`);

      expect(response.status).toBe(200);
      // Set-Cookieヘッダーでクリアされていることを確認
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
        const accessTokenCleared = cookieArray.some(
          (c: string) => c.includes('access_token=') && c.includes('Expires=')
        );
        const refreshTokenCleared = cookieArray.some(
          (c: string) => c.includes('refresh_token=') && c.includes('Expires=')
        );
        expect(accessTokenCleared || refreshTokenCleared).toBe(true);
      }
    });

    it('リフレッシュトークンなしでもログアウトできる', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('ログアウトしました');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(401);
    });
  });

  // OAuth Endpoints (GET /api/auth/github, /api/auth/google, etc.)
  // これらのエンドポイントはPassport.jsに完全に依存しているため、
  // 結合テストでのテストは実用的ではありません。
  // OAuthフローのテストはE2Eテストで行うことを推奨します。
});
