import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
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
  authenticate: (_options: { optional?: boolean } = {}) => (req: any, _res: any, next: any) => { if (mockAuthUser) req.user = mockAuthUser; next(); },
  configurePassport: vi.fn(),
  passport: { initialize: vi.fn(), authenticate: vi.fn() },
  generateTokens: vi.fn().mockImplementation(() => {
    const id = Date.now() + '-' + Math.random();
    return {
      accessToken: `mock-access-token-${id}`,
      refreshToken: `mock-refresh-token-${id}`,
    };
  }),
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

// テスト用パスワード（バリデーション要件を満たす）
const VALID_PASSWORD = 'TestPass1!';
const VALID_PASSWORD_2 = 'NewPass2@';

describe('User Password API Integration Tests', () => {
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

    // テストユーザーを作成（OAuthのみ = パスワードなし）
    testUser = await createTestUser({
      email: 'test@example.com',
      name: 'Test User',
    });

    setTestAuth({ id: testUser.id, email: testUser.email });
  });

  describe('GET /api/users/:userId/password/status', () => {
    it('パスワード未設定の場合 hasPassword: false', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.id}/password/status`)
        .expect(200);

      expect(response.body.hasPassword).toBe(false);
    });

    it('パスワード設定済みの場合 hasPassword: true', async () => {
      // パスワードを設定
      await prisma.user.update({
        where: { id: testUser.id },
        data: { passwordHash: await bcrypt.hash(VALID_PASSWORD, 12) },
      });

      const response = await request(app)
        .get(`/api/users/${testUser.id}/password/status`)
        .expect(200);

      expect(response.body.hasPassword).toBe(true);
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/users/${testUser.id}/password/status`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('他のユーザーの場合は403エラー', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });

      const response = await request(app)
        .get(`/api/users/${otherUser.id}/password/status`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('POST /api/users/:userId/password', () => {
    it('OAuthユーザーがパスワードを初回設定できる', async () => {
      const response = await request(app)
        .post(`/api/users/${testUser.id}/password`)
        .send({ password: VALID_PASSWORD })
        .expect(201);

      expect(response.body.message).toContain('設定');

      // DBでパスワードが設定されている
      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(user!.passwordHash).not.toBeNull();
      const isMatch = await bcrypt.compare(VALID_PASSWORD, user!.passwordHash!);
      expect(isMatch).toBe(true);
    });

    it('既にパスワード設定済みの場合は409エラー', async () => {
      // パスワードを先に設定
      await prisma.user.update({
        where: { id: testUser.id },
        data: { passwordHash: await bcrypt.hash(VALID_PASSWORD, 12) },
      });

      const response = await request(app)
        .post(`/api/users/${testUser.id}/password`)
        .send({ password: VALID_PASSWORD_2 })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('パスワードが弱い場合はバリデーションエラー', async () => {
      const response = await request(app)
        .post(`/api/users/${testUser.id}/password`)
        .send({ password: 'weak' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('パスワードに数字がない場合はバリデーションエラー', async () => {
      const response = await request(app)
        .post(`/api/users/${testUser.id}/password`)
        .send({ password: 'TestPass!' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('パスワードに記号がない場合はバリデーションエラー', async () => {
      const response = await request(app)
        .post(`/api/users/${testUser.id}/password`)
        .send({ password: 'TestPass1' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .post(`/api/users/${testUser.id}/password`)
        .send({ password: VALID_PASSWORD })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('他のユーザーの場合は403エラー', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });

      const response = await request(app)
        .post(`/api/users/${otherUser.id}/password`)
        .send({ password: VALID_PASSWORD })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('PUT /api/users/:userId/password', () => {
    beforeEach(async () => {
      // パスワードを設定済みにする
      await prisma.user.update({
        where: { id: testUser.id },
        data: { passwordHash: await bcrypt.hash(VALID_PASSWORD, 12) },
      });
    });

    it('正しい現在のパスワードで変更できる', async () => {
      const response = await request(app)
        .put(`/api/users/${testUser.id}/password`)
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: VALID_PASSWORD_2,
        })
        .expect(200);

      expect(response.body.message).toContain('変更');

      // 新しいパスワードが設定されている
      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      const isMatch = await bcrypt.compare(VALID_PASSWORD_2, user!.passwordHash!);
      expect(isMatch).toBe(true);
    });

    it('現在のパスワードが不正な場合は401エラー', async () => {
      const response = await request(app)
        .put(`/api/users/${testUser.id}/password`)
        .send({
          currentPassword: 'WrongPass1!',
          newPassword: VALID_PASSWORD_2,
        })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('パスワード変更後に他のセッションが無効化される', async () => {
      // 複数のセッションを作成
      await createTestSession(testUser.id);
      await createTestSession(testUser.id);
      await createTestRefreshToken(testUser.id);
      await createTestRefreshToken(testUser.id);

      // 現在のセッションのリフレッシュトークンをクッキーに設定
      const currentToken = 'current-session-token';
      const currentTokenHash = hashToken(currentToken);
      await createTestSession(testUser.id, { tokenHash: currentTokenHash });
      await createTestRefreshToken(testUser.id, { tokenHash: currentTokenHash });

      await request(app)
        .put(`/api/users/${testUser.id}/password`)
        .set('Cookie', `refresh_token=${currentToken}`)
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: VALID_PASSWORD_2,
        })
        .expect(200);

      // 現在のセッション以外が無効化されている
      const activeSessions = await prisma.session.findMany({
        where: { userId: testUser.id, revokedAt: null },
      });
      // 現在のセッション（currentTokenHash）のみが残る
      expect(activeSessions.length).toBe(1);
      expect(activeSessions[0].tokenHash).toBe(currentTokenHash);

      const activeRefreshTokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id, revokedAt: null },
      });
      expect(activeRefreshTokens.length).toBe(1);
      expect(activeRefreshTokens[0].tokenHash).toBe(currentTokenHash);
    });

    it('パスワード未設定ユーザーは400エラー', async () => {
      // パスワード未設定のユーザーを作成
      const oauthUser = await createTestUser({ email: 'oauth@example.com' });
      setTestAuth({ id: oauthUser.id, email: oauthUser.email });

      const response = await request(app)
        .put(`/api/users/${oauthUser.id}/password`)
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: VALID_PASSWORD_2,
        })
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('新パスワードが現在のパスワードと同じ場合はバリデーションエラー', async () => {
      const response = await request(app)
        .put(`/api/users/${testUser.id}/password`)
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: VALID_PASSWORD,
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('新パスワードが弱い場合はバリデーションエラー', async () => {
      const response = await request(app)
        .put(`/api/users/${testUser.id}/password`)
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: 'weak',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .put(`/api/users/${testUser.id}/password`)
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: VALID_PASSWORD_2,
        })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('他のユーザーの場合は403エラー', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });

      const response = await request(app)
        .put(`/api/users/${otherUser.id}/password`)
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: VALID_PASSWORD_2,
        })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('完全フロー: パスワード設定 → 変更 → 状態確認', () => {
    it('OAuthユーザーがパスワードを設定→変更→状態確認できる', async () => {
      // 1. パスワード未設定状態を確認
      const statusBefore = await request(app)
        .get(`/api/users/${testUser.id}/password/status`)
        .expect(200);
      expect(statusBefore.body.hasPassword).toBe(false);

      // 2. パスワードを初回設定
      await request(app)
        .post(`/api/users/${testUser.id}/password`)
        .send({ password: VALID_PASSWORD })
        .expect(201);

      // 3. パスワード設定状態を確認
      const statusAfterSet = await request(app)
        .get(`/api/users/${testUser.id}/password/status`)
        .expect(200);
      expect(statusAfterSet.body.hasPassword).toBe(true);

      // 4. パスワードを変更
      await request(app)
        .put(`/api/users/${testUser.id}/password`)
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: VALID_PASSWORD_2,
        })
        .expect(200);

      // 5. パスワード設定状態を確認（引き続きtrue）
      const statusAfterChange = await request(app)
        .get(`/api/users/${testUser.id}/password/status`)
        .expect(200);
      expect(statusAfterChange.body.hasPassword).toBe(true);
    });
  });
});
