import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import bcryptjs from 'bcryptjs';
import { prisma } from '@agentest/db';
import {
  createTestAdminUser,
  createTestAdminSession,
  createTestUser,
  createTestSession,
  createTestActiveUserMetric,
  cleanupTestData,
} from './test-helpers.js';
import { createApp } from '../../app.js';
import { hashToken } from '../../utils/pkce.js';

describe('Admin Metrics API Integration Tests', () => {
  let app: Express;
  let testAdminUser: Awaited<ReturnType<typeof createTestAdminUser>>;
  let rawSessionToken: string;
  const testPassword = 'TestPassword123!';
  // bcryptは意図的に遅いため、beforeAllで一度だけ計算してキャッシュ
  let cachedPasswordHash: string;

  beforeAll(async () => {
    app = createApp();
    cachedPasswordHash = bcryptjs.hashSync(testPassword, 12);
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();

    // テスト用の管理者ユーザーとセッションを作成
    testAdminUser = await createTestAdminUser({
      email: 'admin@example.com',
      name: 'Test Admin',
      passwordHash: cachedPasswordHash,
    });

    // 生トークンを生成し、ハッシュ化してDBに保存
    rawSessionToken = 'test-admin-session-token';
    await createTestAdminSession(testAdminUser.id, {
      tokenHash: hashToken(rawSessionToken),
    });
  });

  describe('GET /admin/metrics/active-users', () => {
    it('認証済み管理者はアクセスできる', async () => {
      const response = await request(app)
        .get('/admin/metrics/active-users')
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('granularity');
      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
      expect(response.body).toHaveProperty('timezone');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('fetchedAt');
    });

    it('未認証の場合は401を返す', async () => {
      const response = await request(app)
        .get('/admin/metrics/active-users');

      expect(response.status).toBe(401);
    });

    it('デフォルトで日次粒度のデータを取得する', async () => {
      const response = await request(app)
        .get('/admin/metrics/active-users')
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.granularity).toBe('day');
      expect(response.body.timezone).toBe('Asia/Tokyo');
    });

    it('週次粒度でデータを取得できる', async () => {
      const response = await request(app)
        .get('/admin/metrics/active-users?granularity=week')
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.granularity).toBe('week');
    });

    it('月次粒度でデータを取得できる', async () => {
      const response = await request(app)
        .get('/admin/metrics/active-users?granularity=month')
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.granularity).toBe('month');
    });

    it('パラメータバリデーションが正しく動作する（無効な粒度）', async () => {
      const response = await request(app)
        .get('/admin/metrics/active-users?granularity=invalid')
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(400);
    });

    it('期間超過時は400を返す', async () => {
      const startDate = new Date('2020-01-01').toISOString();
      const endDate = new Date('2025-12-31').toISOString();

      const response = await request(app)
        .get(`/admin/metrics/active-users?startDate=${startDate}&endDate=${endDate}`)
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(400);
    });

    it('startDateがendDateより後の場合は400を返す', async () => {
      const startDate = new Date('2026-02-01').toISOString();
      const endDate = new Date('2026-01-01').toISOString();

      const response = await request(app)
        .get(`/admin/metrics/active-users?startDate=${startDate}&endDate=${endDate}`)
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(400);
    });

    it('無効なタイムゾーン形式の場合は400を返す', async () => {
      const response = await request(app)
        .get('/admin/metrics/active-users?timezone=InvalidTimezone')
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(400);
    });

    it('集計済みデータを正しく取得できる', async () => {
      // テスト用のメトリクスデータを作成
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      await createTestActiveUserMetric({
        granularity: 'DAY',
        periodStart: twoDaysAgo,
        userCount: 100,
      });
      await createTestActiveUserMetric({
        granularity: 'DAY',
        periodStart: yesterday,
        userCount: 150,
      });

      const response = await request(app)
        .get('/admin/metrics/active-users')
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('サマリーが正しく計算される', async () => {
      // テスト用のメトリクスデータを作成
      // 固定の日付範囲を使用して、当日データの影響を排除
      const baseDate = new Date('2026-01-10');
      baseDate.setHours(0, 0, 0, 0);

      // userCount: 10, 20, 30, 40, 50 を作成
      // 期待値: average = (10+20+30+40+50)/5 = 30, max = 50, min = 10
      const testCounts = [10, 20, 30, 40, 50];
      for (let i = 0; i < testCounts.length; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() - i);
        await createTestActiveUserMetric({
          granularity: 'DAY',
          periodStart: date,
          userCount: testCounts[i],
        });
      }

      // 固定期間を指定してリクエスト（当日データの影響を排除）
      const startDate = new Date('2026-01-06').toISOString();
      const endDate = new Date('2026-01-10').toISOString();

      const response = await request(app)
        .get(`/admin/metrics/active-users?startDate=${startDate}&endDate=${endDate}`)
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.summary.average).toBe(30);
      expect(response.body.summary.max).toBe(50);
      expect(response.body.summary.min).toBe(10);
      expect(response.body.summary).toHaveProperty('changeRate');
    });

    it('VIEWERロールの管理者もアクセスできる', async () => {
      // VIEWERロールの管理者を作成（キャッシュされたパスワードハッシュを使用）
      const viewerAdmin = await createTestAdminUser({
        email: 'viewer@example.com',
        name: 'Viewer Admin',
        passwordHash: cachedPasswordHash,
        role: 'VIEWER',
      });
      const rawViewerToken = 'viewer-session-token';
      await createTestAdminSession(viewerAdmin.id, {
        tokenHash: hashToken(rawViewerToken),
      });

      const response = await request(app)
        .get('/admin/metrics/active-users')
        .set('Cookie', `admin_session=${rawViewerToken}`);

      expect(response.status).toBe(200);
    });

    it('当日のリアルタイムデータが取得される', async () => {
      // アクティブなユーザーとセッションを作成
      const user = await createTestUser();
      await createTestSession(user.id, {
        tokenHash: hashToken('test-session-token'),
        lastActiveAt: new Date(),
        revokedAt: null,
      });

      const response = await request(app)
        .get('/admin/metrics/active-users')
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      // 当日データは data 配列に含まれるはず
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('fetchedAtがISO 8601形式で返される', async () => {
      const response = await request(app)
        .get('/admin/metrics/active-users')
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      // ISO 8601形式のチェック
      const fetchedAt = new Date(response.body.fetchedAt);
      expect(fetchedAt.toISOString()).toBe(response.body.fetchedAt);
    });

    it('カスタム期間でデータを取得できる', async () => {
      // 日次粒度ではstartDateはそのまま返される
      const startDate = new Date('2026-01-01T00:00:00.000Z');
      const endDate = new Date('2026-01-31T00:00:00.000Z');

      const response = await request(app)
        .get(`/admin/metrics/active-users?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Cookie', `admin_session=${rawSessionToken}`);

      expect(response.status).toBe(200);
      // 日次粒度の場合、startDateは00:00:00に調整されてそのまま返される
      expect(response.body.startDate).toBe(startDate.toISOString());
      expect(response.body.endDate).toBe(endDate.toISOString());
      expect(response.body.granularity).toBe('day');
    });
  });
});
