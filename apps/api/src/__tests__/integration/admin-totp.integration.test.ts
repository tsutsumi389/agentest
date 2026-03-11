import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import bcryptjs from 'bcryptjs';
import { generateSync } from 'otplib';
import { prisma } from '@agentest/db';
import {
  createTestAdminUser,
  cleanupTestData,
} from './test-helpers.js';
import { createApp } from '../../app.js';

// テスト用のOriginヘッダー（CSRF保護対策）
const ADMIN_ORIGIN = 'http://localhost:5174';

describe('Admin TOTP API Integration Tests', () => {
  let app: Express;
  let testAdminUser: Awaited<ReturnType<typeof createTestAdminUser>>;
  const testPassword = 'TestPassword123!';
  let sessionCookie: string;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();

    // テスト用の管理者ユーザーを作成
    const passwordHash = bcryptjs.hashSync(testPassword, 12);
    testAdminUser = await createTestAdminUser({
      email: 'admin@example.com',
      name: 'Test Admin',
      passwordHash,
    });

    // ログインしてセッションクッキーを取得
    const loginResponse = await request(app)
      .post('/admin/auth/login')
      .set('Origin', ADMIN_ORIGIN)
      .send({
        email: 'admin@example.com',
        password: testPassword,
      });

    const cookies = loginResponse.headers['set-cookie'];
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    sessionCookie = cookieArray.find((c: string) =>
      c.startsWith('admin_session=')
    ) as string;
  });

  describe('POST /admin/auth/2fa/setup', () => {
    it('TOTPセットアップ情報を取得できる', async () => {
      const response = await request(app)
        .post('/admin/auth/2fa/setup')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie);

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
        .post('/admin/auth/2fa/setup')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie);

      const logs = await prisma.adminAuditLog.findMany({
        where: {
          adminUserId: testAdminUser.id,
          action: 'TOTP_SETUP_INITIATED',
        },
      });

      expect(logs.length).toBe(1);
    });

    it('未認証の場合は401エラー', async () => {
      const response = await request(app)
        .post('/admin/auth/2fa/setup')
        .set('Origin', ADMIN_ORIGIN);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /admin/auth/2fa/enable', () => {
    it('正しいコードでTOTPを有効化できる', async () => {
      // セットアップ
      const setupResponse = await request(app)
        .post('/admin/auth/2fa/setup')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie);

      const { secret } = setupResponse.body;

      // 正しいTOTPコードを生成
      const validCode = generateSync({ secret });

      // 有効化
      const response = await request(app)
        .post('/admin/auth/2fa/enable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: validCode });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('2要素認証が有効になりました');

      // DBで確認（暗号化されて保存されるため、平文とは一致しない）
      const user = await prisma.adminUser.findUnique({
        where: { id: testAdminUser.id },
      });

      expect(user?.totpEnabled).toBe(true);
      expect(user?.totpSecret).toBeDefined();
      expect(user?.totpSecret).not.toBe(secret); // 暗号化されているため平文とは異なる
      expect(user?.totpSecret).toMatch(/^enc:v1:/); // 暗号化プレフィックスを確認
    });

    it('監査ログが記録される', async () => {
      const setupResponse = await request(app)
        .post('/admin/auth/2fa/setup')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie);

      const validCode = generateSync({ secret: setupResponse.body.secret });

      await request(app)
        .post('/admin/auth/2fa/enable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: validCode });

      const logs = await prisma.adminAuditLog.findMany({
        where: {
          adminUserId: testAdminUser.id,
          action: 'TOTP_ENABLED',
        },
      });

      expect(logs.length).toBe(1);
    });

    it('不正なコードで400エラー', async () => {
      // セットアップ
      await request(app)
        .post('/admin/auth/2fa/setup')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie);

      // 不正なコード
      const response = await request(app)
        .post('/admin/auth/2fa/enable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: '000000' });

      expect(response.status).toBe(400);
    });

    it('セットアップなしで有効化しようとすると400エラー', async () => {
      const response = await request(app)
        .post('/admin/auth/2fa/enable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('有効期限');
    });

    it('コード形式が不正な場合は400エラー', async () => {
      const response = await request(app)
        .post('/admin/auth/2fa/enable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: '12345' }); // 5桁

      expect(response.status).toBe(400);
    });

    it('未認証の場合は401エラー', async () => {
      const response = await request(app)
        .post('/admin/auth/2fa/enable')
        .set('Origin', ADMIN_ORIGIN)
        .send({ code: '123456' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /admin/auth/2fa/verify', () => {
    let totpSecret: string;

    beforeEach(async () => {
      // TOTPを有効化
      const setupResponse = await request(app)
        .post('/admin/auth/2fa/setup')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie);

      totpSecret = setupResponse.body.secret;
      const validCode = generateSync({ secret: totpSecret });

      await request(app)
        .post('/admin/auth/2fa/enable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: validCode });
    });

    it('正しいコードで検証成功', async () => {
      // 新しいコードを生成（有効化時に使用したコードは使用済み）
      const validCode = generateSync({ secret: totpSecret });

      const response = await request(app)
        .post('/admin/auth/2fa/verify')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: validCode });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('2要素認証に成功しました');
      expect(response.body.verified).toBe(true);
    });

    it('監査ログが記録される', async () => {
      const validCode = generateSync({ secret: totpSecret });

      await request(app)
        .post('/admin/auth/2fa/verify')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: validCode });

      const logs = await prisma.adminAuditLog.findMany({
        where: {
          adminUserId: testAdminUser.id,
          action: 'TOTP_VERIFY_SUCCESS',
        },
      });

      expect(logs.length).toBe(1);
    });

    it('不正なコードで401エラー', async () => {
      const response = await request(app)
        .post('/admin/auth/2fa/verify')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: '000000' });

      expect(response.status).toBe(401);
    });

    it('同じコードを2回使用するとリプレイ攻撃として拒否される', async () => {
      const validCode = generateSync({ secret: totpSecret });

      // 1回目は成功
      const response1 = await request(app)
        .post('/admin/auth/2fa/verify')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: validCode });

      expect(response1.status).toBe(200);

      // 2回目は同じコードでリプレイ攻撃として拒否
      const response2 = await request(app)
        .post('/admin/auth/2fa/verify')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: validCode });

      expect(response2.status).toBe(401);
      expect(response2.body.error.message).toContain('既に使用');

      // 監査ログで拒否が記録されていることを確認
      const logs = await prisma.adminAuditLog.findMany({
        where: {
          adminUserId: testAdminUser.id,
          action: 'TOTP_VERIFY_FAILED',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(logs.length).toBeGreaterThan(0);
      const latestLog = logs[0];
      expect(latestLog.details).toEqual({ reason: 'code_already_used' });
    });

    it('TOTP未設定の場合は401エラー', async () => {
      // TOTPを無効化
      await prisma.adminUser.update({
        where: { id: testAdminUser.id },
        data: { totpEnabled: false, totpSecret: null },
      });

      const response = await request(app)
        .post('/admin/auth/2fa/verify')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: '123456' });

      expect(response.status).toBe(401);
    });

    it('未認証の場合は401エラー', async () => {
      const response = await request(app)
        .post('/admin/auth/2fa/verify')
        .set('Origin', ADMIN_ORIGIN)
        .send({ code: '123456' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /admin/auth/2fa/disable', () => {
    beforeEach(async () => {
      // TOTPを有効化
      const setupResponse = await request(app)
        .post('/admin/auth/2fa/setup')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie);

      const totpSecret = setupResponse.body.secret;
      const validCode = generateSync({ secret: totpSecret });

      await request(app)
        .post('/admin/auth/2fa/enable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: validCode });

      // TOTP検証を完了（requireAdminAuthでTOTP検証済みが必要なため）
      const verifyCode = generateSync({ secret: totpSecret });
      await request(app)
        .post('/admin/auth/2fa/verify')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: verifyCode });
    });

    it('正しいパスワードでTOTPを無効化できる', async () => {
      const response = await request(app)
        .post('/admin/auth/2fa/disable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ password: testPassword });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('2要素認証が無効になりました');

      // DBで確認
      const user = await prisma.adminUser.findUnique({
        where: { id: testAdminUser.id },
      });

      expect(user?.totpEnabled).toBe(false);
      expect(user?.totpSecret).toBeNull();
    });

    it('監査ログが記録される', async () => {
      await request(app)
        .post('/admin/auth/2fa/disable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ password: testPassword });

      const logs = await prisma.adminAuditLog.findMany({
        where: {
          adminUserId: testAdminUser.id,
          action: 'TOTP_DISABLED',
        },
      });

      expect(logs.length).toBe(1);
    });

    it('不正なパスワードで401エラー', async () => {
      const response = await request(app)
        .post('/admin/auth/2fa/disable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ password: 'wrong-password' });

      expect(response.status).toBe(401);
    });

    it('パスワードが空の場合は400エラー', async () => {
      const response = await request(app)
        .post('/admin/auth/2fa/disable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ password: '' });

      expect(response.status).toBe(400);
    });

    it('未認証の場合は401エラー', async () => {
      const response = await request(app)
        .post('/admin/auth/2fa/disable')
        .set('Origin', ADMIN_ORIGIN)
        .send({ password: testPassword });

      expect(response.status).toBe(401);
    });
  });

  describe('完全フロー: セットアップ → 有効化 → 検証 → 無効化', () => {
    it('TOTPの完全なライフサイクルをテスト', async () => {
      // 1. セットアップ
      const setupResponse = await request(app)
        .post('/admin/auth/2fa/setup')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie);

      expect(setupResponse.status).toBe(200);
      const { secret } = setupResponse.body;

      // 2. 有効化
      const enableCode = generateSync({ secret });
      const enableResponse = await request(app)
        .post('/admin/auth/2fa/enable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: enableCode });

      expect(enableResponse.status).toBe(200);

      // 3. 検証
      const verifyCode = generateSync({ secret });
      const verifyResponse = await request(app)
        .post('/admin/auth/2fa/verify')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ code: verifyCode });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.verified).toBe(true);

      // 4. 無効化
      const disableResponse = await request(app)
        .post('/admin/auth/2fa/disable')
        .set('Origin', ADMIN_ORIGIN)
        .set('Cookie', sessionCookie)
        .send({ password: testPassword });

      expect(disableResponse.status).toBe(200);

      // 最終確認
      const user = await prisma.adminUser.findUnique({
        where: { id: testAdminUser.id },
      });

      expect(user?.totpEnabled).toBe(false);
      expect(user?.totpSecret).toBeNull();
    });
  });
});
