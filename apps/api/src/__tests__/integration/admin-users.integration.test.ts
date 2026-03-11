import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import bcryptjs from 'bcryptjs';
import { prisma } from '@agentest/db';
import {
  createTestAdminUser,
  createTestUser,
  createTestSession,
  createTestOrganization,
  createTestProject,
  createTestSuite,
  createTestAccount,
  createTestAuditLog,
  cleanupTestData,
} from './test-helpers.js';
import { createApp } from '../../app.js';

describe('Admin Users API Integration Tests', () => {
  let app: Express;
  let sessionCookie: string;
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

    // テスト用の管理者ユーザーを作成
    const passwordHash = bcryptjs.hashSync(testPassword, 12);
    await createTestAdminUser({
      email: 'admin@example.com',
      name: 'Test Admin',
      passwordHash,
    });

    // ログインしてセッションを取得
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

  describe('GET /admin/users/:id', () => {
    it('認証済みリクエストでユーザー詳細を取得できる', async () => {
      // テストユーザーを作成
      const testUser = await createTestUser({
        email: 'target@example.com',
        name: 'Target User',
      });

      const response = await request(app)
        .get(`/admin/users/${testUser.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.email).toBe('target@example.com');
    });

    it('未認証リクエストはエラーを返す', async () => {
      const testUser = await createTestUser({
        email: 'target@example.com',
        name: 'Target User',
      });

      const response = await request(app)
        .get(`/admin/users/${testUser.id}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('無効なUUID形式はエラーを返す', async () => {
      const response = await request(app)
        .get('/admin/users/invalid-uuid')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('存在しないユーザーIDはエラーを返す', async () => {
      const nonexistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/admin/users/${nonexistentId}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });

    it('削除済みユーザーの詳細も取得できる', async () => {
      // 削除済みユーザーを作成
      const testUser = await createTestUser({
        email: 'deleted@example.com',
        name: 'Deleted User',
      });
      // ユーザーを論理削除
      await prisma.user.update({
        where: { id: testUser.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/admin/users/${testUser.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.deletedAt).not.toBeNull();
    });

    it('レスポンスに基本情報が含まれる', async () => {
      const testUser = await createTestUser({
        email: 'basic@example.com',
        name: 'Basic User',
        avatarUrl: 'https://example.com/avatar.png',
      });

      const response = await request(app)
        .get(`/admin/users/${testUser.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      const user = response.body.user;
      expect(user.id).toBe(testUser.id);
      expect(user.email).toBe('basic@example.com');
      expect(user.name).toBe('Basic User');
      expect(user.avatarUrl).toBe('https://example.com/avatar.png');
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
      expect(user.deletedAt).toBeNull();
    });

    it('レスポンスにactivity情報が含まれる', async () => {
      const testUser = await createTestUser({
        email: 'activity@example.com',
        name: 'Activity User',
      });

      // アクティブセッションを作成
      const lastActiveAt = new Date();
      await createTestSession(testUser.id, {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
      });
      // lastActiveAtを更新
      await prisma.session.updateMany({
        where: { userId: testUser.id },
        data: { lastActiveAt },
      });

      const response = await request(app)
        .get(`/admin/users/${testUser.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      const activity = response.body.user.activity;
      expect(activity).toBeDefined();
      expect(activity.lastActiveAt).toBeDefined();
      expect(activity.activeSessionCount).toBe(1);
    });

    it('レスポンスにstats情報が含まれる', async () => {
      const testUser = await createTestUser({
        email: 'stats@example.com',
        name: 'Stats User',
      });

      // 組織を作成してメンバーに追加
      const org = await createTestOrganization(testUser.id, {
        name: 'Test Org',
      });

      // プロジェクトを作成
      const project = await createTestProject(testUser.id, {
        name: 'Test Project',
        organizationId: org.id,
      });

      // テストスイートを作成（createdByUserIdは削除されたのでuserIdを使用しない）
      await createTestSuite(project.id, {
        name: 'Test Suite 1',
      });

      // テストスイートをユーザーと関連付け（testSuitesリレーション経由）
      // 注: 現在のスキーマではTestSuiteにcreatedByUserIdがないため、
      // _countでカウントされる方法は別（例：TestSuiteがuserIdを持つ場合のみ）
      // 実際の実装に合わせて調整

      const response = await request(app)
        .get(`/admin/users/${testUser.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      const stats = response.body.user.stats;
      expect(stats).toBeDefined();
      expect(typeof stats.organizationCount).toBe('number');
      expect(typeof stats.projectCount).toBe('number');
      expect(typeof stats.testSuiteCount).toBe('number');
      expect(typeof stats.executionCount).toBe('number');
    });

    it('レスポンスにorganizations情報が含まれる', async () => {
      const testUser = await createTestUser({
        email: 'orgs@example.com',
        name: 'Orgs User',
      });

      // 組織を作成（ユーザーが自動的にOWNERになる）
      const org = await createTestOrganization(testUser.id, {
        name: 'My Organization',
      });

      const response = await request(app)
        .get(`/admin/users/${testUser.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      const organizations = response.body.user.organizations;
      expect(organizations).toBeDefined();
      expect(organizations).toHaveLength(1);
      expect(organizations[0].id).toBe(org.id);
      expect(organizations[0].name).toBe('My Organization');
      expect(organizations[0].role).toBe('OWNER');
      expect(organizations[0].joinedAt).toBeDefined();
    });

    it('レスポンスにoauthProviders情報が含まれる', async () => {
      const testUser = await createTestUser({
        email: 'oauth@example.com',
        name: 'OAuth User',
      });

      // OAuthアカウントを作成
      await createTestAccount(testUser.id, { provider: 'github' });
      await createTestAccount(testUser.id, { provider: 'google' });

      const response = await request(app)
        .get(`/admin/users/${testUser.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      const oauthProviders = response.body.user.oauthProviders;
      expect(oauthProviders).toBeDefined();
      expect(oauthProviders).toHaveLength(2);
      expect(oauthProviders.map((p: { provider: string }) => p.provider).sort()).toEqual(['github', 'google']);
      expect(oauthProviders[0].createdAt).toBeDefined();
    });

    it('レスポンスにrecentAuditLogs情報が含まれる', async () => {
      const testUser = await createTestUser({
        email: 'auditlog@example.com',
        name: 'AuditLog User',
      });

      // 監査ログを作成
      await createTestAuditLog({
        userId: testUser.id,
        category: 'AUTH',
        action: 'LOGIN',
        ipAddress: '192.168.1.1',
      });
      await createTestAuditLog({
        userId: testUser.id,
        category: 'PROJECT',
        action: 'CREATE',
        targetType: 'PROJECT',
        targetId: 'proj-123',
      });

      const response = await request(app)
        .get(`/admin/users/${testUser.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      const recentAuditLogs = response.body.user.recentAuditLogs;
      expect(recentAuditLogs).toBeDefined();
      expect(recentAuditLogs.length).toBeLessThanOrEqual(10);
      if (recentAuditLogs.length > 0) {
        expect(recentAuditLogs[0].id).toBeDefined();
        expect(recentAuditLogs[0].category).toBeDefined();
        expect(recentAuditLogs[0].action).toBeDefined();
        expect(recentAuditLogs[0].createdAt).toBeDefined();
      }
    });

    it('完全なユーザー詳細データが取得できる', async () => {
      // 全ての関連データを持つユーザーを作成
      const testUser = await createTestUser({
        email: 'complete@example.com',
        name: 'Complete User',
        avatarUrl: 'https://example.com/avatar.png',
      });

      // セッション
      await createTestSession(testUser.id, {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      await prisma.session.updateMany({
        where: { userId: testUser.id },
        data: { lastActiveAt: new Date() },
      });

      // 組織
      const org = await createTestOrganization(testUser.id, {
        name: 'Complete Org',
      });

      // プロジェクト
      await createTestProject(testUser.id, {
        name: 'Complete Project',
        organizationId: org.id,
      });

      // OAuthアカウント
      await createTestAccount(testUser.id, { provider: 'github' });

      // 監査ログ
      await createTestAuditLog({
        userId: testUser.id,
        category: 'AUTH',
        action: 'LOGIN',
      });

      const response = await request(app)
        .get(`/admin/users/${testUser.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      const user = response.body.user;

      // 基本情報
      expect(user.id).toBe(testUser.id);
      expect(user.email).toBe('complete@example.com');
      expect(user.name).toBe('Complete User');

      // activity
      expect(user.activity.activeSessionCount).toBeGreaterThanOrEqual(1);
      expect(user.activity.lastActiveAt).toBeDefined();

      // stats
      expect(user.stats.organizationCount).toBe(1);
      expect(user.stats.projectCount).toBe(1);

      // organizations
      expect(user.organizations).toHaveLength(1);
      expect(user.organizations[0].name).toBe('Complete Org');

      // oauthProviders
      expect(user.oauthProviders).toHaveLength(1);
      expect(user.oauthProviders[0].provider).toBe('github');

      // recentAuditLogs
      expect(user.recentAuditLogs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
