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

// generateTokensのモック: 毎回異なるトークンを返す（tokenHash @unique制約対策）
let tokenCounter = 0;
function createMockTokens() {
  tokenCounter++;
  return {
    accessToken: `mock-access-token-${tokenCounter}`,
    refreshToken: `mock-refresh-token-${tokenCounter}`,
  };
}

// グローバルな認証状態（モック用）
let mockAuthUser: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: string;
  createdAt: Date;
} | null = null;

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
  generateTokens: vi.fn().mockImplementation(() => createMockTokens()),
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  decodeToken: vi.fn(),
  getTokenExpiry: vi.fn(),
  createAuthConfig: vi.fn(),
  defaultAuthConfig: {},
}));

// メールサービスをモック
vi.mock('../../services/email.service.js', () => ({
  emailService: {
    send: vi.fn().mockResolvedValue(undefined),
    generatePasswordResetEmail: vi.fn().mockReturnValue({
      subject: 'パスワードリセット',
      text: 'テスト',
      html: '<p>テスト</p>',
    }),
    generateWelcomeEmail: vi.fn().mockReturnValue({
      subject: 'ようこそ',
      text: 'テスト',
      html: '<p>テスト</p>',
    }),
    generateEmailVerificationEmail: vi.fn().mockReturnValue({
      subject: 'メール確認',
      text: 'テスト',
      html: '<p>テスト</p>',
    }),
  },
}));

function clearTestAuth() {
  mockAuthUser = null;
}

// テスト用パスワード（バリデーション要件を満たす）
const VALID_PASSWORD = 'TestPass1!';
const VALID_PASSWORD_2 = 'NewPass2@';

describe('Auth Password API Integration Tests', () => {
  let app: Express;

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
  });

  describe('POST /api/auth/register', () => {
    it('新規ユーザーを登録できる', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: VALID_PASSWORD,
          name: 'New User',
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.user.name).toBe('New User');
    });

    it('ユーザーがDBに作成される', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'dbcheck@example.com',
          password: VALID_PASSWORD,
          name: 'DB Check User',
        });

      const user = await prisma.user.findFirst({
        where: { email: 'dbcheck@example.com' },
      });
      expect(user).not.toBeNull();
      expect(user!.name).toBe('DB Check User');
      expect(user!.passwordHash).not.toBeNull();
    });

    it('パスワードがbcryptでハッシュ化される', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'hash@example.com',
          password: VALID_PASSWORD,
          name: 'Hash User',
        });

      const user = await prisma.user.findFirst({
        where: { email: 'hash@example.com' },
      });
      // bcryptハッシュは$2b$で始まる
      expect(user!.passwordHash).toMatch(/^\$2[aby]\$/);
      // 元のパスワードと一致する
      const isMatch = await bcrypt.compare(VALID_PASSWORD, user!.passwordHash!);
      expect(isMatch).toBe(true);
    });

    it('メール確認トークンがDBに作成される（セッション/リフレッシュトークンは作成されない）', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'session@example.com',
          password: VALID_PASSWORD,
          name: 'Session User',
        });

      // 非同期メール送信を待つ
      await new Promise(resolve => setTimeout(resolve, 100));

      const user = await prisma.user.findFirst({
        where: { email: 'session@example.com' },
      });

      // メール確認トークンが作成される
      const verificationTokens = await prisma.emailVerificationToken.findMany({
        where: { userId: user!.id },
      });
      expect(verificationTokens).toHaveLength(1);

      // セッション/リフレッシュトークンは作成されない
      const sessions = await prisma.session.findMany({
        where: { userId: user!.id },
      });
      expect(sessions).toHaveLength(0);

      const refreshTokens = await prisma.refreshToken.findMany({
        where: { userId: user!.id },
      });
      expect(refreshTokens).toHaveLength(0);
    });

    it('クッキーは設定されない（メール確認が必要）', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'cookie@example.com',
          password: VALID_PASSWORD,
          name: 'Cookie User',
        });

      const cookies = response.headers['set-cookie'];
      // クッキーは設定されない
      expect(cookies).toBeUndefined();
    });

    it('メールアドレスが重複する場合は409エラー', async () => {
      await createTestUser({ email: 'existing@example.com', passwordHash: await bcrypt.hash(VALID_PASSWORD, 12) });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: VALID_PASSWORD,
          name: 'Duplicate User',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('メールアドレスが大文字でも小文字に正規化される', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'UPPER@EXAMPLE.COM',
          password: VALID_PASSWORD,
          name: 'Upper User',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe('upper@example.com');
    });

    it('パスワードが短すぎる場合はバリデーションエラー', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'short@example.com',
          password: 'Aa1!',
          name: 'Short Password User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('パスワードに大文字がない場合はバリデーションエラー', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'noupper@example.com',
          password: 'testpass1!',
          name: 'No Upper User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('名前が空の場合はバリデーションエラー', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'noname@example.com',
          password: VALID_PASSWORD,
          name: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('メールアドレスが不正な場合はバリデーションエラー', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: VALID_PASSWORD,
          name: 'Invalid Email User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    const testPassword = VALID_PASSWORD;

    beforeEach(async () => {
      const passwordHash = await bcrypt.hash(testPassword, 12);
      testUser = await createTestUser({
        email: 'login@example.com',
        name: 'Login User',
        passwordHash,
      });
    });

    it('正しい認証情報でログインできる', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.email).toBe('login@example.com');
      expect(response.body.user.name).toBe('Login User');
    });

    it('ログイン成功時にクッキーが設定される', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: testPassword,
        });

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const hasAccessToken = cookieArray.some((c: string) => c.includes('access_token='));
      const hasRefreshToken = cookieArray.some((c: string) => c.includes('refresh_token='));
      expect(hasAccessToken).toBe(true);
      expect(hasRefreshToken).toBe(true);
    });

    it('ログイン成功時にセッションとリフレッシュトークンがDBに作成される', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: testPassword,
        });

      const sessions = await prisma.session.findMany({
        where: { userId: testUser.id },
      });
      expect(sessions.length).toBeGreaterThanOrEqual(1);

      const refreshTokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id },
      });
      expect(refreshTokens.length).toBeGreaterThanOrEqual(1);
    });

    it('パスワード不一致で401エラー', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPass1!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('存在しないメールアドレスで401エラー', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('OAuthのみユーザー（passwordHash=null）はログインできない', async () => {
      await createTestUser({
        email: 'oauth-only@example.com',
        name: 'OAuth Only User',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'oauth-only@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('5回連続失敗でアカウントロック', async () => {
      // 5回失敗させる
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'login@example.com',
            password: 'WrongPass1!',
          });
      }

      // 6回目は正しいパスワードでもロック
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('ロック');

      // DBでロック状態を確認
      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(user!.lockedUntil).not.toBeNull();
      expect(user!.failedAttempts).toBe(5);
    });

    it('ロック期間経過後にログイン可能', async () => {
      // ロック状態を設定（過去の日時でロック済み）
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          failedAttempts: 5,
          lockedUntil: new Date(Date.now() - 1000), // 1秒前に期限切れ
        },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(testUser.id);

      // 失敗回数がリセットされている
      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(user!.failedAttempts).toBe(0);
      expect(user!.lockedUntil).toBeNull();
    });

    it('ログイン成功で失敗回数がリセットされる', async () => {
      // 3回失敗させる
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'login@example.com',
            password: 'WrongPass1!',
          });
      }

      // 正しいパスワードでログイン
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: testPassword,
        });

      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(user!.failedAttempts).toBe(0);
    });

    it('メールアドレスが空の場合はバリデーションエラー', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: '',
          password: testPassword,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('削除済みユーザーはログインできない', async () => {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('登録済みメールアドレスでリクエストすると成功メッセージを返す', async () => {
      await createTestUser({
        email: 'reset@example.com',
        passwordHash: await bcrypt.hash(VALID_PASSWORD, 12),
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'reset@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('メール');
    });

    it('存在しないメールアドレスでも成功メッセージを返す（メール存在確認防止）', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('メール');
    });

    it('OAuthのみユーザーでも成功メッセージを返す', async () => {
      await createTestUser({
        email: 'oauth-only@example.com',
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'oauth-only@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('メール');
    });

    it('不正なメールアドレスはバリデーションエラー', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('パスワード設定済みユーザーの場合はリセットトークンがDBに作成される', async () => {
      const user = await createTestUser({
        email: 'token-check@example.com',
        passwordHash: await bcrypt.hash(VALID_PASSWORD, 12),
      });

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'token-check@example.com' });

      // 少し待つ（バックグラウンド処理のため）
      await new Promise((resolve) => setTimeout(resolve, 200));

      const tokens = await prisma.passwordResetToken.findMany({
        where: { userId: user.id },
      });
      expect(tokens.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let rawToken: string;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'resetpw@example.com',
        name: 'Reset User',
        passwordHash: await bcrypt.hash(VALID_PASSWORD, 12),
      });

      // リセットトークンを直接DBに作成
      rawToken = 'test-reset-token-' + Date.now();
      await prisma.passwordResetToken.create({
        data: {
          userId: testUser.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
        },
      });
    });

    it('有効なトークンでパスワードリセットできる', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: VALID_PASSWORD_2,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('リセット');

      // パスワードが更新されている
      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      const isNewPasswordValid = await bcrypt.compare(VALID_PASSWORD_2, user!.passwordHash!);
      expect(isNewPasswordValid).toBe(true);
    });

    it('リセット後にトークンが使用済みになる', async () => {
      await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: VALID_PASSWORD_2,
        });

      const tokens = await prisma.passwordResetToken.findMany({
        where: { userId: testUser.id },
      });
      expect(tokens[0].usedAt).not.toBeNull();
    });

    it('リセット後に全セッションが無効化される', async () => {
      // セッションとリフレッシュトークンを作成
      await createTestSession(testUser.id);
      await createTestRefreshToken(testUser.id);

      await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: VALID_PASSWORD_2,
        });

      // 全セッションが無効化されている
      const sessions = await prisma.session.findMany({
        where: { userId: testUser.id, revokedAt: null },
      });
      expect(sessions).toHaveLength(0);

      const refreshTokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id, revokedAt: null },
      });
      expect(refreshTokens).toHaveLength(0);
    });

    it('リセット後に失敗回数とロックがクリアされる', async () => {
      // ロック状態を設定
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          failedAttempts: 5,
          lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: VALID_PASSWORD_2,
        });

      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(user!.failedAttempts).toBe(0);
      expect(user!.lockedUntil).toBeNull();
    });

    it('無効なトークンで400エラー', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: VALID_PASSWORD_2,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('使用済みトークンで400エラー', async () => {
      // トークンを使用済みにする
      await prisma.passwordResetToken.updateMany({
        where: { userId: testUser.id },
        data: { usedAt: new Date() },
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: VALID_PASSWORD_2,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('使用');
    });

    it('期限切れトークンで400エラー', async () => {
      // トークンの有効期限を過去に更新
      await prisma.passwordResetToken.updateMany({
        where: { userId: testUser.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: VALID_PASSWORD_2,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('期限');
    });

    it('パスワードが弱い場合はバリデーションエラー', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('トークンが空の場合はバリデーションエラー', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: '',
          password: VALID_PASSWORD_2,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('完全フロー: 登録 → メール確認 → ログイン → パスワードリセット', () => {
    it('ユーザー登録後にメール確認し、ログインでき、リセット後に新パスワードでログインできる', async () => {
      // 1. 登録
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'flow@example.com',
          password: VALID_PASSWORD,
          name: 'Flow User',
        });
      expect(registerRes.status).toBe(201);
      expect(registerRes.body.message).toBeDefined();
      const userId = registerRes.body.user.id;

      // 1.5 メール確認前はログインできない
      const preVerifyLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'flow@example.com',
          password: VALID_PASSWORD,
        });
      expect(preVerifyLoginRes.status).toBe(401);
      expect(preVerifyLoginRes.body.error.code).toBe('EMAIL_NOT_VERIFIED');

      // 1.6 メール確認（DBから直接トークンを取得してシミュレート）
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });

      // 2. ログイン
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'flow@example.com',
          password: VALID_PASSWORD,
        });
      expect(loginRes.status).toBe(200);

      // 3. リセットトークン作成
      const rawToken = 'flow-reset-token';
      await prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // 4. パスワードリセット
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: VALID_PASSWORD_2,
        });
      expect(resetRes.status).toBe(200);

      // 5. 旧パスワードではログインできない
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'flow@example.com',
          password: VALID_PASSWORD,
        });
      expect(oldLoginRes.status).toBe(401);

      // 6. 新パスワードでログインできる
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'flow@example.com',
          password: VALID_PASSWORD_2,
        });
      expect(newLoginRes.status).toBe(200);
    });
  });
});
