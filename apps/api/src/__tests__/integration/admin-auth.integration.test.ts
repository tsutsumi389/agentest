import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import bcryptjs from 'bcryptjs';
import { prisma } from '@agentest/db';
import { createTestAdminUser, cleanupTestData } from './test-helpers.js';
import { createApp } from '../../app.js';
import { hashToken } from '../../utils/pkce.js';

describe('Admin Auth API Integration Tests', () => {
  let app: Express;
  let testAdminUser: Awaited<ReturnType<typeof createTestAdminUser>>;
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();

    // テスト用の管理者ユーザーを作成（パスワードをハッシュ化）
    // bcryptjsを使用（pure JS実装でDockerネイティブモジュール問題を回避）
    const passwordHash = bcryptjs.hashSync(testPassword, 12);
    testAdminUser = await createTestAdminUser({
      email: 'admin@example.com',
      name: 'Test Admin',
      passwordHash,
    });
  });

  describe('POST /admin/auth/login', () => {
    it('正しい認証情報でログインできる', async () => {
      const response = await request(app)
        .post('/admin/auth/login')
        .set('Origin', 'http://localhost:5174')
        .send({
          email: 'admin@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.admin).toBeDefined();
      expect(response.body.admin.id).toBe(testAdminUser.id);
      expect(response.body.admin.email).toBe('admin@example.com');
      expect(response.body.expiresAt).toBeDefined();
    });

    it('セッションクッキーが設定される', async () => {
      const response = await request(app)
        .post('/admin/auth/login')
        .set('Origin', 'http://localhost:5174')
        .send({
          email: 'admin@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(200);
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const sessionCookie = cookieArray.find((c: string) =>
        c.startsWith('admin_session=')
      );
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('Path=/admin');
    });

    it('セッションがDBに作成される', async () => {
      await request(app)
        .post('/admin/auth/login')
        .set('Origin', 'http://localhost:5174')
        .send({
          email: 'admin@example.com',
          password: testPassword,
        });

      const sessions = await prisma.adminSession.findMany({
        where: { adminUserId: testAdminUser.id },
      });

      expect(sessions.length).toBe(1);
      expect(sessions[0].revokedAt).toBeNull();
    });

    it('監査ログが記録される', async () => {
      await request(app)
        .post('/admin/auth/login')
        .set('Origin', 'http://localhost:5174')
        .send({
          email: 'admin@example.com',
          password: testPassword,
        });

      const logs = await prisma.adminAuditLog.findMany({
        where: {
          adminUserId: testAdminUser.id,
          action: 'LOGIN_SUCCESS',
        },
      });

      expect(logs.length).toBe(1);
    });

    it('不正パスワードで401エラー', async () => {
      const response = await request(app)
        .post('/admin/auth/login')
        .set('Origin', 'http://localhost:5174')
        .send({
          email: 'admin@example.com',
          password: 'wrong-password',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('5回失敗でアカウントロック', async () => {
      // 5回失敗させる
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/admin/auth/login')
          .set('Origin', 'http://localhost:5174')
          .send({
            email: 'admin@example.com',
            password: 'wrong-password',
          });
      }

      // アカウントがロックされていることを確認
      const user = await prisma.adminUser.findUnique({
        where: { id: testAdminUser.id },
      });

      expect(user?.lockedUntil).not.toBeNull();
      expect(user?.failedAttempts).toBe(5);
    });

    it('ロック中は正しいパスワードでもログイン不可', async () => {
      // アカウントをロック状態にする
      await prisma.adminUser.update({
        where: { id: testAdminUser.id },
        data: {
          lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30分後
          failedAttempts: 5,
        },
      });

      const response = await request(app)
        .post('/admin/auth/login')
        .set('Origin', 'http://localhost:5174')
        .send({
          email: 'admin@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('ロック');
    });

    it('ロック時間経過後はログイン可能', async () => {
      // ロック時間を過去に設定（ロック解除済み）
      await prisma.adminUser.update({
        where: { id: testAdminUser.id },
        data: {
          lockedUntil: new Date(Date.now() - 1000), // 1秒前
          failedAttempts: 5,
        },
      });

      const response = await request(app)
        .post('/admin/auth/login')
        .set('Origin', 'http://localhost:5174')
        .send({
          email: 'admin@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.admin).toBeDefined();
    });

    it('メール形式不正で400エラー', async () => {
      const response = await request(app)
        .post('/admin/auth/login')
        .set('Origin', 'http://localhost:5174')
        .send({
          email: 'invalid-email',
          password: testPassword,
        });

      expect(response.status).toBe(400);
    });

    it('存在しないユーザーで401エラー', async () => {
      const response = await request(app)
        .post('/admin/auth/login')
        .set('Origin', 'http://localhost:5174')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /admin/auth/logout', () => {
    let sessionToken: string;
    let sessionCookie: string;

    beforeEach(async () => {
      // ログインしてセッショントークンを取得
      const loginResponse = await request(app)
        .post('/admin/auth/login')
        .set('Origin', 'http://localhost:5174')
        .send({
          email: 'admin@example.com',
          password: testPassword,
        });

      const cookies = loginResponse.headers['set-cookie'];
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      sessionCookie = cookieArray.find((c: string) =>
        c.startsWith('admin_session=')
      ) as string;
      sessionToken = sessionCookie.split(';')[0].split('=')[1];
    });

    it('ログアウトに成功する', async () => {
      const response = await request(app)
        .post('/admin/auth/logout')
        .set('Origin', 'http://localhost:5174')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('ログアウトしました');
    });

    it('セッションが失効する', async () => {
      await request(app)
        .post('/admin/auth/logout')
        .set('Origin', 'http://localhost:5174')
        .set('Cookie', sessionCookie);

      const session = await prisma.adminSession.findFirst({
        where: { tokenHash: hashToken(sessionToken) },
      });

      expect(session?.revokedAt).not.toBeNull();
    });

    it('クッキーがクリアされる', async () => {
      const response = await request(app)
        .post('/admin/auth/logout')
        .set('Origin', 'http://localhost:5174')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
        const clearedCookie = cookieArray.find(
          (c: string) => c.includes('admin_session=') && c.includes('Expires=')
        );
        expect(clearedCookie).toBeDefined();
      }
    });

    it('未認証の場合は401エラー', async () => {
      const response = await request(app).post('/admin/auth/logout').set('Origin', 'http://localhost:5174');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /admin/auth/me', () => {
    let sessionCookie: string;

    beforeEach(async () => {
      // ログインしてセッショントークンを取得
      const loginResponse = await request(app)
        .post('/admin/auth/login')
        .set('Origin', 'http://localhost:5174')
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

    it('認証済み管理者情報を取得できる', async () => {
      const response = await request(app)
        .get('/admin/auth/me')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.admin).toBeDefined();
      expect(response.body.admin.id).toBe(testAdminUser.id);
      expect(response.body.admin.email).toBe('admin@example.com');
    });

    it('期限切れセッションで401エラー', async () => {
      // セッションの有効期限を過去に設定
      const session = await prisma.adminSession.findFirst({
        where: { adminUserId: testAdminUser.id },
      });
      await prisma.adminSession.update({
        where: { id: session!.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const response = await request(app)
        .get('/admin/auth/me')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(401);
    });

    it('失効済みセッションで401エラー', async () => {
      // セッションを失効
      const session = await prisma.adminSession.findFirst({
        where: { adminUserId: testAdminUser.id },
      });
      await prisma.adminSession.update({
        where: { id: session!.id },
        data: { revokedAt: new Date() },
      });

      const response = await request(app)
        .get('/admin/auth/me')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(401);
    });

    it('未認証の場合は401エラー', async () => {
      const response = await request(app).get('/admin/auth/me');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /admin/auth/refresh', () => {
    let sessionCookie: string;

    beforeEach(async () => {
      // ログインしてセッショントークンを取得
      const loginResponse = await request(app)
        .post('/admin/auth/login')
        .set('Origin', 'http://localhost:5174')
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

    it('セッション延長に成功する', async () => {
      const response = await request(app)
        .post('/admin/auth/refresh')
        .set('Origin', 'http://localhost:5174')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.expiresAt).toBeDefined();
    });

    it('最大延長期限（8時間）を超えると延長不可', async () => {
      // セッションの作成時刻を8時間以上前に設定
      const session = await prisma.adminSession.findFirst({
        where: { adminUserId: testAdminUser.id },
      });
      await prisma.adminSession.update({
        where: { id: session!.id },
        data: {
          createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000 - 1000), // 8時間1秒前
        },
      });

      const response = await request(app)
        .post('/admin/auth/refresh')
        .set('Origin', 'http://localhost:5174')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('再度ログイン');
    });

    it('未認証の場合は401エラー', async () => {
      const response = await request(app).post('/admin/auth/refresh').set('Origin', 'http://localhost:5174');

      expect(response.status).toBe(401);
    });
  });
});
