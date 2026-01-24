import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import bcryptjs from 'bcryptjs';
import { prisma } from '@agentest/db';
import { randomUUID } from 'crypto';
import {
  createTestAdminUser,
  createTestUser,
  createTestOrganization,
  createTestProject,
  createTestOrgMember,
  cleanupTestData,
} from './test-helpers.js';
import { createApp } from '../../app.js';

describe('Admin Organizations API Integration Tests', () => {
  let app: Express;
  let sessionCookie: string;
  const testPassword = 'TestPassword123!';
  // ユニークなプレフィックスを使用してテストデータを識別
  let testPrefix: string;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();
    // 各テストで異なるプレフィックスを使用
    testPrefix = `test-${randomUUID().slice(0, 8)}`;

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

  describe('GET /admin/organizations', () => {
    it('認証済みリクエストで組織一覧を取得できる', async () => {
      // テストユーザーと組織を作成
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      await createTestOrganization(testUser.id, {
        name: `${testPrefix}-org`,
        slug: `${testPrefix}-org`,
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.organizations).toHaveLength(1);
    });

    it('未認証リクエストは401エラーを返す', async () => {
      const response = await request(app)
        .get('/admin/organizations');

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('検索クエリ（q）で名前を検索できる', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      await createTestOrganization(testUser.id, {
        name: `${testPrefix}-alpha-org`,
        slug: `${testPrefix}-alpha-org`,
      });
      await createTestOrganization(testUser.id, {
        name: `${testPrefix}-beta-company`,
        slug: `${testPrefix}-beta-company`,
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}-alpha`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(1);
      expect(response.body.organizations[0].name).toBe(`${testPrefix}-alpha-org`);
    });

    it('検索クエリ（q）でスラグを検索できる', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      await createTestOrganization(testUser.id, {
        name: `Org One ${testPrefix}`,
        slug: `${testPrefix}-unique-slug`,
      });
      await createTestOrganization(testUser.id, {
        name: `Org Two ${testPrefix}`,
        slug: `${testPrefix}-another-slug`,
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}-unique`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(1);
      expect(response.body.organizations[0].slug).toBe(`${testPrefix}-unique-slug`);
    });

    it('プランフィルタ（plan）で絞り込みできる', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      await createTestOrganization(testUser.id, {
        name: `${testPrefix}-team-org`,
        slug: `${testPrefix}-team-org`,
        plan: 'TEAM',
      });
      await createTestOrganization(testUser.id, {
        name: `${testPrefix}-enterprise-org`,
        slug: `${testPrefix}-enterprise-org`,
        plan: 'ENTERPRISE',
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}&plan=ENTERPRISE`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(1);
      expect(response.body.organizations[0].plan).toBe('ENTERPRISE');
    });

    it('複数のプランフィルタで絞り込みできる', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      await createTestOrganization(testUser.id, {
        name: `${testPrefix}-team-org`,
        slug: `${testPrefix}-team-org`,
        plan: 'TEAM',
      });
      await createTestOrganization(testUser.id, {
        name: `${testPrefix}-enterprise-org`,
        slug: `${testPrefix}-enterprise-org`,
        plan: 'ENTERPRISE',
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}&plan=TEAM,ENTERPRISE`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(2);
    });

    it('ステータスフィルタ（active）でアクティブな組織のみ取得できる', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      const activeOrg = await createTestOrganization(testUser.id, {
        name: `${testPrefix}-active-org`,
        slug: `${testPrefix}-active-org`,
      });
      const deletedOrg = await createTestOrganization(testUser.id, {
        name: `${testPrefix}-deleted-org`,
        slug: `${testPrefix}-deleted-org`,
      });
      // 組織を論理削除
      await prisma.organization.update({
        where: { id: deletedOrg.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}&status=active`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(1);
      expect(response.body.organizations[0].id).toBe(activeOrg.id);
    });

    it('ステータスフィルタ（deleted）で削除済み組織のみ取得できる', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      await createTestOrganization(testUser.id, {
        name: `${testPrefix}-active-org`,
        slug: `${testPrefix}-active-org`,
      });
      const deletedOrg = await createTestOrganization(testUser.id, {
        name: `${testPrefix}-deleted-org`,
        slug: `${testPrefix}-deleted-org`,
      });
      // 組織を論理削除
      await prisma.organization.update({
        where: { id: deletedOrg.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}&status=deleted`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(1);
      expect(response.body.organizations[0].id).toBe(deletedOrg.id);
      expect(response.body.organizations[0].deletedAt).not.toBeNull();
    });

    it('ステータスフィルタ（all）で全組織を取得できる', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      await createTestOrganization(testUser.id, {
        name: `${testPrefix}-active-org`,
        slug: `${testPrefix}-active-org`,
      });
      const deletedOrg = await createTestOrganization(testUser.id, {
        name: `${testPrefix}-deleted-org`,
        slug: `${testPrefix}-deleted-org`,
      });
      // 組織を論理削除
      await prisma.organization.update({
        where: { id: deletedOrg.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}&status=all`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(2);
    });

    it('ページネーションが正しく動作する', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      // 5つの組織を作成
      for (let i = 0; i < 5; i++) {
        await createTestOrganization(testUser.id, {
          name: `${testPrefix}-org-${i}`,
          slug: `${testPrefix}-org-${i}`,
        });
      }

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}&page=1&limit=2`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
    });

    it('ソート（createdAt desc）が正しく動作する', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      const org1 = await createTestOrganization(testUser.id, {
        name: `${testPrefix}-org-1`,
        slug: `${testPrefix}-org-1`,
      });
      // 少し待ってから2つ目を作成
      await new Promise((resolve) => setTimeout(resolve, 10));
      const org2 = await createTestOrganization(testUser.id, {
        name: `${testPrefix}-org-2`,
        slug: `${testPrefix}-org-2`,
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}&sortBy=createdAt&sortOrder=desc`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations[0].id).toBe(org2.id);
      expect(response.body.organizations[1].id).toBe(org1.id);
    });

    it('ソート（name asc）が正しく動作する', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      await createTestOrganization(testUser.id, {
        name: `${testPrefix}-zebra-org`,
        slug: `${testPrefix}-zebra-org`,
      });
      await createTestOrganization(testUser.id, {
        name: `${testPrefix}-alpha-org`,
        slug: `${testPrefix}-alpha-org`,
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}&sortBy=name&sortOrder=asc`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations[0].name).toBe(`${testPrefix}-alpha-org`);
      expect(response.body.organizations[1].name).toBe(`${testPrefix}-zebra-org`);
    });

    it('レスポンスに基本情報が含まれる', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      const org = await createTestOrganization(testUser.id, {
        name: `${testPrefix}-test-org`,
        slug: `${testPrefix}-test-org`,
        description: 'Test description',
        plan: 'ENTERPRISE',
      });
      // billingEmailを設定
      await prisma.organization.update({
        where: { id: org.id },
        data: { billingEmail: 'billing@example.com' },
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}-test-org`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(1);
      const organization = response.body.organizations[0];
      expect(organization.id).toBe(org.id);
      expect(organization.name).toBe(`${testPrefix}-test-org`);
      expect(organization.slug).toBe(`${testPrefix}-test-org`);
      expect(organization.description).toBe('Test description');
      expect(organization.plan).toBe('ENTERPRISE');
      expect(organization.billingEmail).toBe('billing@example.com');
      expect(organization.createdAt).toBeDefined();
      expect(organization.updatedAt).toBeDefined();
      expect(organization.deletedAt).toBeNull();
    });

    it('レスポンスにstats情報が含まれる', async () => {
      const testUser1 = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      const testUser2 = await createTestUser({
        email: 'member@example.com',
        name: 'Member User',
      });
      const org = await createTestOrganization(testUser1.id, {
        name: `${testPrefix}-stats-org`,
        slug: `${testPrefix}-stats-org`,
      });
      // メンバーを追加
      await createTestOrgMember(org.id, testUser2.id, 'MEMBER');
      // プロジェクトを追加
      await createTestProject(testUser1.id, {
        name: 'Project 1',
        organizationId: org.id,
      });
      await createTestProject(testUser1.id, {
        name: 'Project 2',
        organizationId: org.id,
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}-stats-org`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(1);
      const organization = response.body.organizations[0];
      expect(organization.stats).toBeDefined();
      expect(organization.stats.memberCount).toBe(2); // owner + member
      expect(organization.stats.projectCount).toBe(2);
    });

    it('レスポンスにowner情報が含まれる', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
        avatarUrl: 'https://example.com/avatar.png',
      });
      await createTestOrganization(testUser.id, {
        name: `${testPrefix}-owner-org`,
        slug: `${testPrefix}-owner-org`,
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}-owner-org`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(1);
      const organization = response.body.organizations[0];
      expect(organization.owner).toBeDefined();
      expect(organization.owner.id).toBe(testUser.id);
      expect(organization.owner.name).toBe('Owner User');
      expect(organization.owner.email).toBe('owner@example.com');
      expect(organization.owner.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('日付フィルタ（createdFrom/createdTo）で絞り込みできる', async () => {
      const testUser = await createTestUser({
        email: 'owner@example.com',
        name: 'Owner User',
      });
      // 古い組織
      const oldOrg = await createTestOrganization(testUser.id, {
        name: `${testPrefix}-old-org`,
        slug: `${testPrefix}-old-org`,
      });
      await prisma.organization.update({
        where: { id: oldOrg.id },
        data: { createdAt: new Date('2023-01-01T00:00:00.000Z') },
      });
      // 新しい組織
      const newOrg = await createTestOrganization(testUser.id, {
        name: `${testPrefix}-new-org`,
        slug: `${testPrefix}-new-org`,
      });
      await prisma.organization.update({
        where: { id: newOrg.id },
        data: { createdAt: new Date('2024-06-01T00:00:00.000Z') },
      });

      const response = await request(app)
        .get(`/admin/organizations?q=${testPrefix}&createdFrom=2024-01-01T00:00:00.000Z`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(1);
      expect(response.body.organizations[0].id).toBe(newOrg.id);
    });

    it('不正なクエリパラメータはエラーを返す', async () => {
      const response = await request(app)
        .get('/admin/organizations?plan=INVALID_PLAN')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('不正なページ番号はエラーを返す', async () => {
      const response = await request(app)
        .get('/admin/organizations?page=0')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('不正なリミット値はエラーを返す', async () => {
      const response = await request(app)
        .get('/admin/organizations?limit=101')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('createdFromがcreatedToより後の日付の場合はエラーを返す', async () => {
      const response = await request(app)
        .get('/admin/organizations?createdFrom=2024-12-31T00:00:00.000Z&createdTo=2024-01-01T00:00:00.000Z')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('検索結果がない場合は空配列を返す', async () => {
      // 存在しないプレフィックスで検索
      const response = await request(app)
        .get(`/admin/organizations?q=nonexistent-${randomUUID()}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.organizations).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });
  });
});
