import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import bcryptjs from 'bcryptjs';
import { generateSync } from 'otplib';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  cleanupTestData,
} from './test-helpers.js';
import { createApp } from '../../app.js';
import { clearRateLimitKeys } from '../../lib/redis-store.js';

describe('User TOTP API Integration Tests', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  const testPassword = 'TestPassword123!';
  let accessTokenCookie: string;
  let refreshTokenCookie: string;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();
    // テスト間でレート制限カウンターが蓄積しないようクリア
    await clearRateLimitKeys();

    // テスト用ユーザーを作成（パスワード付き）
    const passwordHash = bcryptjs.hashSync(testPassword, 12);
    testUser = await createTestUser({
      email: 'user-totp@example.com',
      name: 'TOTP Test User',
      passwordHash,
    });

    // テスト用ログインでトークンを取得
    const loginResponse = await request(app)
      .post('/api/auth/test-login')
      .send({ email: 'user-totp@example.com' });

    const cookies = loginResponse.headers['set-cookie'];
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    accessTokenCookie = cookieArray.find((c: string) =>
      c.startsWith('access_token=')
    ) as string;
    refreshTokenCookie = cookieArray.find((c: string) =>
      c.startsWith('refresh_token=')
    ) as string;
  });

  describe('GET /api/auth/2fa/status', () => {
    it('2FAステータスを取得できる（デフォルトは無効）', async () => {
      const response = await request(app)
        .get('/api/auth/2fa/status')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      expect(response.status).toBe(200);
      expect(response.body.totpEnabled).toBe(false);
    });

    it('未認証の場合は401エラー', async () => {
      const response = await request(app).get('/api/auth/2fa/status');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/2fa/setup', () => {
    it('TOTPセットアップ情報を取得できる', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      expect(response.status).toBe(200);
      expect(response.body.secret).toBeDefined();
      expect(response.body.secret.length).toBeGreaterThan(0);
      expect(response.body.qrCodeDataUrl).toBeDefined();
      expect(response.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(response.body.otpauthUrl).toBeDefined();
      expect(response.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    });

    it('監査ログが記録される', async () => {
      await request(app)
        .post('/api/auth/2fa/setup')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      const logs = await prisma.auditLog.findMany({
        where: {
          userId: testUser.id,
          action: 'TOTP_SETUP_INITIATED',
        },
      });

      expect(logs.length).toBe(1);
    });

    it('未認証の場合は401エラー', async () => {
      const response = await request(app).post('/api/auth/2fa/setup');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/2fa/enable', () => {
    it('正しいコードでTOTPを有効化できる', async () => {
      // セットアップ
      const setupResponse = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      const { secret } = setupResponse.body;

      // 正しいTOTPコードを生成
      const validCode = generateSync({ secret });

      // 有効化
      const response = await request(app)
        .post('/api/auth/2fa/enable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: validCode });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('2要素認証が有効になりました');

      // DBで確認（暗号化されて保存される）
      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(user?.totpEnabled).toBe(true);
      expect(user?.totpSecret).toBeDefined();
      expect(user?.totpSecret).not.toBe(secret); // 暗号化されている
    });

    it('監査ログが記録される', async () => {
      const setupResponse = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      const validCode = generateSync({ secret: setupResponse.body.secret });

      await request(app)
        .post('/api/auth/2fa/enable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: validCode });

      const logs = await prisma.auditLog.findMany({
        where: {
          userId: testUser.id,
          action: 'TOTP_ENABLED',
        },
      });

      expect(logs.length).toBe(1);
    });

    it('不正なコードで400エラー', async () => {
      // セットアップ
      await request(app)
        .post('/api/auth/2fa/setup')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      // 不正なコード
      const response = await request(app)
        .post('/api/auth/2fa/enable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: '000000' });

      expect(response.status).toBe(400);
    });

    it('セットアップなしで有効化しようとすると400エラー', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/enable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('有効期限');
    });

    it('コード形式が不正な場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/enable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: '12345' }); // 5桁

      expect(response.status).toBe(400);
    });

    it('未認証の場合は401エラー', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/enable')
        .send({ code: '123456' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/2fa/verify', () => {
    let totpSecret: string;

    beforeEach(async () => {
      // TOTPを有効化
      const setupResponse = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      totpSecret = setupResponse.body.secret;
      const validCode = generateSync({ secret: totpSecret });

      await request(app)
        .post('/api/auth/2fa/enable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: validCode });
    });

    it('正しいコードで検証成功', async () => {
      const validCode = generateSync({ secret: totpSecret });

      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: validCode });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('2要素認証に成功しました');
      expect(response.body.verified).toBe(true);
    });

    it('監査ログが記録される', async () => {
      const validCode = generateSync({ secret: totpSecret });

      await request(app)
        .post('/api/auth/2fa/verify')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: validCode });

      const logs = await prisma.auditLog.findMany({
        where: {
          userId: testUser.id,
          action: 'TOTP_VERIFY_SUCCESS',
        },
      });

      expect(logs.length).toBe(1);
    });

    it('不正なコードで401エラー', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: '000000' });

      expect(response.status).toBe(401);
    });

    it('同じコードを2回使用するとリプレイ攻撃として拒否される', async () => {
      const validCode = generateSync({ secret: totpSecret });

      // 1回目は成功
      const response1 = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: validCode });

      expect(response1.status).toBe(200);

      // 2回目は同じコードでリプレイ攻撃として拒否
      const response2 = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: validCode });

      expect(response2.status).toBe(401);
      expect(response2.body.error.message).toContain('既に使用');

      // 監査ログで拒否が記録されていることを確認
      const logs = await prisma.auditLog.findMany({
        where: {
          userId: testUser.id,
          action: 'TOTP_VERIFY_FAILED',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(logs.length).toBeGreaterThan(0);
    });

    it('TOTP未設定の場合は401エラー', async () => {
      // TOTPを無効化
      await prisma.user.update({
        where: { id: testUser.id },
        data: { totpEnabled: false, totpSecret: null },
      });

      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: '123456' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/2fa/disable', () => {
    beforeEach(async () => {
      // TOTPを有効化
      const setupResponse = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      const validCode = generateSync({ secret: setupResponse.body.secret });

      await request(app)
        .post('/api/auth/2fa/enable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: validCode });
    });

    it('正しいパスワードでTOTPを無効化できる', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ password: testPassword });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('2要素認証が無効になりました');

      // DBで確認
      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(user?.totpEnabled).toBe(false);
      expect(user?.totpSecret).toBeNull();
    });

    it('監査ログが記録される', async () => {
      await request(app)
        .post('/api/auth/2fa/disable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ password: testPassword });

      const logs = await prisma.auditLog.findMany({
        where: {
          userId: testUser.id,
          action: 'TOTP_DISABLED',
        },
      });

      expect(logs.length).toBe(1);
    });

    it('不正なパスワードで401エラー', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ password: 'wrong-password' });

      expect(response.status).toBe(401);
    });

    it('パスワードが空の場合は400エラー', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ password: '' });

      expect(response.status).toBe(400);
    });

    it('未認証の場合は401エラー', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/disable')
        .send({ password: testPassword });

      expect(response.status).toBe(401);
    });
  });

  describe('レート制限', () => {
    it('setupエンドポイントが3回/分のレート制限を適用する', async () => {
      // 4回連続でリクエスト（制限は3回/分）
      const responses = [];
      for (let i = 0; i < 4; i++) {
        responses.push(
          await request(app)
            .post('/api/auth/2fa/setup')
            .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        );
      }

      // 最初の3回は成功
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
      expect(responses[2].status).toBe(200);

      // 4回目はレート制限
      expect(responses[3].status).toBe(429);
      expect(responses[3].body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(responses[3].headers['retry-after']).toBeDefined();
    });

    it('レート制限ヘッダーが設定される', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      expect(response.headers['x-ratelimit-limit']).toBe('3');
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('完全フロー: セットアップ → 有効化 → 検証 → 無効化', () => {
    it('TOTPの完全なライフサイクルをテスト', async () => {
      // 1. ステータス確認（無効）
      const statusResponse1 = await request(app)
        .get('/api/auth/2fa/status')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      expect(statusResponse1.status).toBe(200);
      expect(statusResponse1.body.totpEnabled).toBe(false);

      // 2. セットアップ
      const setupResponse = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      expect(setupResponse.status).toBe(200);
      const { secret } = setupResponse.body;

      // 3. 有効化
      const enableCode = generateSync({ secret });
      const enableResponse = await request(app)
        .post('/api/auth/2fa/enable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: enableCode });

      expect(enableResponse.status).toBe(200);

      // 4. ステータス確認（有効）
      const statusResponse2 = await request(app)
        .get('/api/auth/2fa/status')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      expect(statusResponse2.status).toBe(200);
      expect(statusResponse2.body.totpEnabled).toBe(true);

      // 5. 検証
      const verifyCode = generateSync({ secret });
      const verifyResponse = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ code: verifyCode });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.verified).toBe(true);

      // 6. 無効化
      const disableResponse = await request(app)
        .post('/api/auth/2fa/disable')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie])
        .send({ password: testPassword });

      expect(disableResponse.status).toBe(200);

      // 7. 最終ステータス確認（無効）
      const statusResponse3 = await request(app)
        .get('/api/auth/2fa/status')
        .set('Cookie', [accessTokenCookie, refreshTokenCookie]);

      expect(statusResponse3.status).toBe(200);
      expect(statusResponse3.body.totpEnabled).toBe(false);

      // 最終DB確認
      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(user?.totpEnabled).toBe(false);
      expect(user?.totpSecret).toBeNull();
    });
  });
});
