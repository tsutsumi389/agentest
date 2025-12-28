import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestSession,
  createTestAccount,
  createTestOrganization,
  createTestOrgMember,
  createTestProject,
  createTestProjectMember,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError } from '@agentest/shared';
import { createApp } from '../../app.js';

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
function setTestAuth(user: { id: string; email: string } | null) {
  mockAuthUser = user;
}

function clearTestAuth() {
  mockAuthUser = null;
}

describe('Users API Integration Tests', () => {
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
    // テストデータをクリーンアップ
    await cleanupTestData();

    // テストユーザーを作成
    testUser = await createTestUser({
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.png',
    });

    // 認証状態を設定
    setTestAuth({ id: testUser.id, email: testUser.email });
  });

  describe('GET /api/users/:userId', () => {
    it('ユーザー情報を取得できる', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.id}`)
        .expect(200);

      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.name).toBe('Test User');
      expect(response.body.user.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('存在しないユーザーは404エラー', async () => {
      const response = await request(app)
        .get('/api/users/non-existent-user-id')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/users/${testUser.id}`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('PATCH /api/users/:userId', () => {
    it('名前を更新できる', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUser.id}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.user.name).toBe('Updated Name');

      // データベースで確認
      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(user?.name).toBe('Updated Name');
    });

    it('アバターURLを更新できる', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUser.id}`)
        .send({ avatarUrl: 'https://example.com/new-avatar.png' })
        .expect(200);

      expect(response.body.user.avatarUrl).toBe('https://example.com/new-avatar.png');
    });

    it('アバターURLをnullに設定できる', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUser.id}`)
        .send({ avatarUrl: null })
        .expect(200);

      expect(response.body.user.avatarUrl).toBeNull();
    });

    it('名前とアバターを同時に更新できる', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUser.id}`)
        .send({
          name: 'New Name',
          avatarUrl: 'https://example.com/new.png',
        })
        .expect(200);

      expect(response.body.user.name).toBe('New Name');
      expect(response.body.user.avatarUrl).toBe('https://example.com/new.png');
    });

    it('空の名前はバリデーションエラー', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUser.id}`)
        .send({ name: '' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('不正なアバターURLはバリデーションエラー', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUser.id}`)
        .send({ avatarUrl: 'not-a-valid-url' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('他のユーザーのプロフィールは更新できない', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });

      const response = await request(app)
        .patch(`/api/users/${otherUser.id}`)
        .send({ name: 'Hacked Name' })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');

      // データベースで変更されていないことを確認
      const user = await prisma.user.findUnique({ where: { id: otherUser.id } });
      expect(user?.name).not.toBe('Hacked Name');
    });

    it('存在しないユーザーは404エラー', async () => {
      // 自分自身を削除（テストのため）
      await prisma.user.delete({ where: { id: testUser.id } });

      const response = await request(app)
        .patch(`/api/users/${testUser.id}`)
        .send({ name: 'New Name' })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/users/:userId', () => {
    it('自分のアカウントを論理削除できる', async () => {
      const response = await request(app)
        .delete(`/api/users/${testUser.id}`)
        .expect(204);

      // データベースで論理削除を確認
      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(user?.deletedAt).not.toBeNull();
    });

    it('他のユーザーのアカウントは削除できない', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });

      const response = await request(app)
        .delete(`/api/users/${otherUser.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');

      // データベースで削除されていないことを確認
      const user = await prisma.user.findUnique({ where: { id: otherUser.id } });
      expect(user?.deletedAt).toBeNull();
    });
  });

  describe('GET /api/users/:userId/accounts', () => {
    it('OAuth連携一覧を取得できる', async () => {
      // OAuth連携を作成
      await createTestAccount(testUser.id, { provider: 'github' });
      await createTestAccount(testUser.id, { provider: 'google' });

      const response = await request(app)
        .get(`/api/users/${testUser.id}/accounts`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.map((a: any) => a.provider)).toContain('github');
      expect(response.body.data.map((a: any) => a.provider)).toContain('google');
    });

    it('連携がない場合は空配列', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.id}/accounts`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });

    it('他のユーザーの連携は取得できない', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      await createTestAccount(otherUser.id, { provider: 'github' });

      const response = await request(app)
        .get(`/api/users/${otherUser.id}/accounts`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('DELETE /api/users/:userId/accounts/:provider', () => {
    it('OAuth連携を解除できる（複数連携がある場合）', async () => {
      // 2つの連携を作成
      await createTestAccount(testUser.id, { provider: 'github' });
      await createTestAccount(testUser.id, { provider: 'google' });

      const response = await request(app)
        .delete(`/api/users/${testUser.id}/accounts/github`)
        .expect(200);

      expect(response.body.data.success).toBe(true);

      // データベースで確認
      const accounts = await prisma.account.findMany({
        where: { userId: testUser.id },
      });
      expect(accounts).toHaveLength(1);
      expect(accounts[0].provider).toBe('google');
    });

    it('最後の連携は解除できない', async () => {
      // 1つだけの連携を作成
      await createTestAccount(testUser.id, { provider: 'github' });

      const response = await request(app)
        .delete(`/api/users/${testUser.id}/accounts/github`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('最低1つ');
    });

    it('存在しない連携は404エラー', async () => {
      await createTestAccount(testUser.id, { provider: 'github' });

      const response = await request(app)
        .delete(`/api/users/${testUser.id}/accounts/google`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('他のユーザーの連携は解除できない', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      await createTestAccount(otherUser.id, { provider: 'github' });
      await createTestAccount(otherUser.id, { provider: 'google' });

      const response = await request(app)
        .delete(`/api/users/${otherUser.id}/accounts/github`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('GET /api/users/:userId/organizations', () => {
    it('所属組織一覧を取得できる', async () => {
      // 組織を作成
      const org1 = await createTestOrganization(testUser.id, { name: 'Org 1', slug: 'org-1' });
      const org2 = await createTestOrganization(testUser.id, { name: 'Org 2', slug: 'org-2' });

      const response = await request(app)
        .get(`/api/users/${testUser.id}/organizations`)
        .expect(200);

      expect(response.body.organizations).toHaveLength(2);
      const orgNames = response.body.organizations.map((o: any) => o.organization.name);
      expect(orgNames).toContain('Org 1');
      expect(orgNames).toContain('Org 2');
    });

    it('組織にメンバー数が含まれる', async () => {
      // 組織を作成（オーナーは自動追加される）
      const org = await createTestOrganization(testUser.id, { name: 'Member Count Org' });

      // 追加メンバーを作成
      const member1 = await createTestUser({ email: 'member1@example.com' });
      const member2 = await createTestUser({ email: 'member2@example.com' });
      await createTestOrgMember(org.id, member1.id, 'MEMBER');
      await createTestOrgMember(org.id, member2.id, 'ADMIN');

      const response = await request(app)
        .get(`/api/users/${testUser.id}/organizations`)
        .expect(200);

      expect(response.body.organizations).toHaveLength(1);
      // オーナー1人 + メンバー2人 = 3人
      expect(response.body.organizations[0].organization._count.members).toBe(3);
    });

    it('ロールが正しく返される', async () => {
      // 自分がオーナーの組織
      await createTestOrganization(testUser.id, { name: 'Owner Org', slug: 'owner-org' });

      // 他のユーザーがオーナーで、自分がメンバーの組織
      const otherUser = await createTestUser({ email: 'owner@example.com' });
      const memberOrg = await createTestOrganization(otherUser.id, { name: 'Member Org', slug: 'member-org' });
      await createTestOrgMember(memberOrg.id, testUser.id, 'MEMBER');

      const response = await request(app)
        .get(`/api/users/${testUser.id}/organizations`)
        .expect(200);

      expect(response.body.organizations).toHaveLength(2);

      const ownerOrgData = response.body.organizations.find(
        (o: any) => o.organization.name === 'Owner Org'
      );
      const memberOrgData = response.body.organizations.find(
        (o: any) => o.organization.name === 'Member Org'
      );

      expect(ownerOrgData.role).toBe('OWNER');
      expect(memberOrgData.role).toBe('MEMBER');
    });

    it('所属組織がない場合は空配列', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.id}/organizations`)
        .expect(200);

      expect(response.body.organizations).toHaveLength(0);
    });

    it('他のユーザーの組織一覧は取得できない', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      await createTestOrganization(otherUser.id, { name: 'Other Org' });

      const response = await request(app)
        .get(`/api/users/${otherUser.id}/organizations`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/users/${testUser.id}/organizations`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('GET /api/users/:userId/projects', () => {
    it('所属プロジェクト一覧を取得できる', async () => {
      // 個人プロジェクト
      await createTestProject(testUser.id, { name: 'Personal Project' });

      // 組織プロジェクト
      const org = await createTestOrganization(testUser.id, { name: 'Test Org', slug: 'test-org' });
      await createTestProject(testUser.id, { name: 'Org Project', organizationId: org.id });

      const response = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .expect(200);

      expect(response.body.projects).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);

      const projectNames = response.body.projects.map((p: any) => p.name);
      expect(projectNames).toContain('Personal Project');
      expect(projectNames).toContain('Org Project');
    });

    it('オーナーとメンバーのプロジェクトを両方取得できる', async () => {
      // 自分がオーナーのプロジェクト
      await createTestProject(testUser.id, { name: 'Owner Project' });

      // 他のユーザーがオーナーで、自分がメンバーのプロジェクト
      const otherUser = await createTestUser({ email: 'owner@example.com' });
      const memberProject = await createTestProject(otherUser.id, { name: 'Member Project' });
      await createTestProjectMember(memberProject.id, testUser.id, 'WRITE');

      const response = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .expect(200);

      expect(response.body.projects).toHaveLength(2);

      const ownerProjectData = response.body.projects.find((p: any) => p.name === 'Owner Project');
      const memberProjectData = response.body.projects.find((p: any) => p.name === 'Member Project');

      expect(ownerProjectData.role).toBe('OWNER');
      expect(memberProjectData.role).toBe('WRITE');
    });

    it('名前で検索できる（qパラメータ）', async () => {
      await createTestProject(testUser.id, { name: 'Alpha Project' });
      await createTestProject(testUser.id, { name: 'Beta Project' });
      await createTestProject(testUser.id, { name: 'Gamma Test' });

      const response = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .query({ q: 'project' })
        .expect(200);

      expect(response.body.projects).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
      const projectNames = response.body.projects.map((p: any) => p.name);
      expect(projectNames).toContain('Alpha Project');
      expect(projectNames).toContain('Beta Project');
    });

    it('名前検索は大文字小文字を区別しない', async () => {
      await createTestProject(testUser.id, { name: 'UPPERCASE Project' });

      const response = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .query({ q: 'uppercase' })
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].name).toBe('UPPERCASE Project');
    });

    it('組織でフィルタできる（organizationIdパラメータ）', async () => {
      // 個人プロジェクト
      await createTestProject(testUser.id, { name: 'Personal' });

      // 組織Aのプロジェクト
      const orgA = await createTestOrganization(testUser.id, { name: 'Org A', slug: 'org-a' });
      await createTestProject(testUser.id, { name: 'OrgA Project', organizationId: orgA.id });

      // 組織Bのプロジェクト
      const orgB = await createTestOrganization(testUser.id, { name: 'Org B', slug: 'org-b' });
      await createTestProject(testUser.id, { name: 'OrgB Project', organizationId: orgB.id });

      // 組織Aでフィルタ
      const response = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .query({ organizationId: orgA.id })
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].name).toBe('OrgA Project');
    });

    it('個人プロジェクトのみフィルタできる（organizationId=null）', async () => {
      // 個人プロジェクト
      await createTestProject(testUser.id, { name: 'Personal' });

      // 組織プロジェクト
      const org = await createTestOrganization(testUser.id, { name: 'Org', slug: 'org' });
      await createTestProject(testUser.id, { name: 'Org Project', organizationId: org.id });

      const response = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .query({ organizationId: 'null' })
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].name).toBe('Personal');
    });

    it('削除済みプロジェクトはデフォルトで含まれない', async () => {
      await createTestProject(testUser.id, { name: 'Active Project' });

      // 削除済みプロジェクトを作成
      const deletedProject = await createTestProject(testUser.id, { name: 'Deleted Project' });
      await prisma.project.update({
        where: { id: deletedProject.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].name).toBe('Active Project');
    });

    it('削除済みプロジェクトを含めて取得できる（includeDeleted=true）', async () => {
      await createTestProject(testUser.id, { name: 'Active Project' });

      // 削除済みプロジェクトを作成
      const deletedProject = await createTestProject(testUser.id, { name: 'Deleted Project' });
      await prisma.project.update({
        where: { id: deletedProject.id },
        data: { deletedAt: new Date() },
      });

      const response = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .query({ includeDeleted: 'true' })
        .expect(200);

      expect(response.body.projects).toHaveLength(2);
      const projectNames = response.body.projects.map((p: any) => p.name);
      expect(projectNames).toContain('Active Project');
      expect(projectNames).toContain('Deleted Project');
    });

    it('ページネーションが動作する', async () => {
      // 5つのプロジェクトを作成
      for (let i = 0; i < 5; i++) {
        await createTestProject(testUser.id, { name: `Project ${i}` });
      }

      // limit=2で取得
      const response1 = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .query({ limit: '2', offset: '0' })
        .expect(200);

      expect(response1.body.projects).toHaveLength(2);
      expect(response1.body.pagination.total).toBe(5);
      expect(response1.body.pagination.limit).toBe(2);
      expect(response1.body.pagination.offset).toBe(0);
      expect(response1.body.pagination.hasMore).toBe(true);

      // offset=2で次のページを取得
      const response2 = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .query({ limit: '2', offset: '2' })
        .expect(200);

      expect(response2.body.projects).toHaveLength(2);
      expect(response2.body.pagination.offset).toBe(2);
      expect(response2.body.pagination.hasMore).toBe(true);

      // offset=4で最後のページを取得
      const response3 = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .query({ limit: '2', offset: '4' })
        .expect(200);

      expect(response3.body.projects).toHaveLength(1);
      expect(response3.body.pagination.hasMore).toBe(false);
    });

    it('更新日時の降順でソートされる', async () => {
      // プロジェクトを作成（順序を明示的に制御）
      const project1 = await createTestProject(testUser.id, { name: 'Old Project' });
      await prisma.project.update({
        where: { id: project1.id },
        data: { updatedAt: new Date('2024-01-01') },
      });

      const project2 = await createTestProject(testUser.id, { name: 'New Project' });
      await prisma.project.update({
        where: { id: project2.id },
        data: { updatedAt: new Date('2024-06-01') },
      });

      const response = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .expect(200);

      expect(response.body.projects).toHaveLength(2);
      // 新しいものが先
      expect(response.body.projects[0].name).toBe('New Project');
      expect(response.body.projects[1].name).toBe('Old Project');
    });

    it('プロジェクトがない場合は空配列', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .expect(200);

      expect(response.body.projects).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });

    it('他のユーザーのプロジェクト一覧は取得できない', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      await createTestProject(otherUser.id, { name: 'Other Project' });

      const response = await request(app)
        .get(`/api/users/${otherUser.id}/projects`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/users/${testUser.id}/projects`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    describe('複合条件フィルタ', () => {
      it('名前検索と組織フィルタを組み合わせて検索できる', async () => {
        // 組織を作成
        const org = await createTestOrganization(testUser.id, { name: 'Test Org', slug: 'test-org' });

        // 様々なプロジェクトを作成
        await createTestProject(testUser.id, { name: 'Alpha Personal' });
        await createTestProject(testUser.id, { name: 'Alpha Org', organizationId: org.id });
        await createTestProject(testUser.id, { name: 'Beta Org', organizationId: org.id });

        // 名前検索 + 組織フィルタ
        const response = await request(app)
          .get(`/api/users/${testUser.id}/projects`)
          .query({ q: 'alpha', organizationId: org.id })
          .expect(200);

        expect(response.body.projects).toHaveLength(1);
        expect(response.body.projects[0].name).toBe('Alpha Org');
        expect(response.body.pagination.total).toBe(1);
      });

      it('名前検索と削除済みフラグを組み合わせて検索できる', async () => {
        // アクティブなプロジェクト
        await createTestProject(testUser.id, { name: 'Active Alpha' });
        await createTestProject(testUser.id, { name: 'Active Beta' });

        // 削除済みプロジェクト
        const deletedAlpha = await createTestProject(testUser.id, { name: 'Deleted Alpha' });
        await prisma.project.update({
          where: { id: deletedAlpha.id },
          data: { deletedAt: new Date() },
        });

        const deletedBeta = await createTestProject(testUser.id, { name: 'Deleted Beta' });
        await prisma.project.update({
          where: { id: deletedBeta.id },
          data: { deletedAt: new Date() },
        });

        // Alphaで検索 + 削除済み含む
        const response = await request(app)
          .get(`/api/users/${testUser.id}/projects`)
          .query({ q: 'alpha', includeDeleted: 'true' })
          .expect(200);

        expect(response.body.projects).toHaveLength(2);
        const projectNames = response.body.projects.map((p: any) => p.name);
        expect(projectNames).toContain('Active Alpha');
        expect(projectNames).toContain('Deleted Alpha');
      });

      it('組織フィルタと削除済みフラグを組み合わせて検索できる', async () => {
        const org = await createTestOrganization(testUser.id, { name: 'Test Org', slug: 'test-org' });

        // 組織のアクティブなプロジェクト
        await createTestProject(testUser.id, { name: 'Active Org Project', organizationId: org.id });

        // 組織の削除済みプロジェクト
        const deletedOrgProject = await createTestProject(testUser.id, { name: 'Deleted Org Project', organizationId: org.id });
        await prisma.project.update({
          where: { id: deletedOrgProject.id },
          data: { deletedAt: new Date() },
        });

        // 個人の削除済みプロジェクト（フィルタされるべき）
        const deletedPersonal = await createTestProject(testUser.id, { name: 'Deleted Personal' });
        await prisma.project.update({
          where: { id: deletedPersonal.id },
          data: { deletedAt: new Date() },
        });

        // 組織フィルタ + 削除済み含む
        const response = await request(app)
          .get(`/api/users/${testUser.id}/projects`)
          .query({ organizationId: org.id, includeDeleted: 'true' })
          .expect(200);

        expect(response.body.projects).toHaveLength(2);
        const projectNames = response.body.projects.map((p: any) => p.name);
        expect(projectNames).toContain('Active Org Project');
        expect(projectNames).toContain('Deleted Org Project');
        expect(projectNames).not.toContain('Deleted Personal');
      });

      it('全条件を組み合わせて検索できる', async () => {
        const org = await createTestOrganization(testUser.id, { name: 'Test Org', slug: 'test-org' });

        // 様々なパターンのプロジェクトを作成
        await createTestProject(testUser.id, { name: 'Target Active', organizationId: org.id });

        const targetDeleted = await createTestProject(testUser.id, { name: 'Target Deleted', organizationId: org.id });
        await prisma.project.update({
          where: { id: targetDeleted.id },
          data: { deletedAt: new Date() },
        });

        await createTestProject(testUser.id, { name: 'Other Active', organizationId: org.id });
        await createTestProject(testUser.id, { name: 'Target Personal' });

        // 全条件（名前 + 組織 + 削除済み含む）
        const response = await request(app)
          .get(`/api/users/${testUser.id}/projects`)
          .query({ q: 'target', organizationId: org.id, includeDeleted: 'true' })
          .expect(200);

        expect(response.body.projects).toHaveLength(2);
        const projectNames = response.body.projects.map((p: any) => p.name);
        expect(projectNames).toContain('Target Active');
        expect(projectNames).toContain('Target Deleted');
        expect(projectNames).not.toContain('Other Active');
        expect(projectNames).not.toContain('Target Personal');
      });

      it('個人プロジェクトフィルタと名前検索を組み合わせられる', async () => {
        const org = await createTestOrganization(testUser.id, { name: 'Test Org', slug: 'test-org' });

        await createTestProject(testUser.id, { name: 'Alpha Personal' });
        await createTestProject(testUser.id, { name: 'Beta Personal' });
        await createTestProject(testUser.id, { name: 'Alpha Org', organizationId: org.id });

        // 個人プロジェクト + 名前検索
        const response = await request(app)
          .get(`/api/users/${testUser.id}/projects`)
          .query({ q: 'alpha', organizationId: 'null' })
          .expect(200);

        expect(response.body.projects).toHaveLength(1);
        expect(response.body.projects[0].name).toBe('Alpha Personal');
      });
    });

    describe('ページネーション境界テスト', () => {
      it('limit=1で1件ずつ取得できる', async () => {
        await createTestProject(testUser.id, { name: 'Project 1' });
        await createTestProject(testUser.id, { name: 'Project 2' });
        await createTestProject(testUser.id, { name: 'Project 3' });

        const response = await request(app)
          .get(`/api/users/${testUser.id}/projects`)
          .query({ limit: '1' })
          .expect(200);

        expect(response.body.projects).toHaveLength(1);
        expect(response.body.pagination.total).toBe(3);
        expect(response.body.pagination.hasMore).toBe(true);
      });

      it('大きなoffsetで空配列を返す', async () => {
        await createTestProject(testUser.id, { name: 'Project 1' });

        const response = await request(app)
          .get(`/api/users/${testUser.id}/projects`)
          .query({ offset: '1000' })
          .expect(200);

        expect(response.body.projects).toHaveLength(0);
        expect(response.body.pagination.total).toBe(1);
        expect(response.body.pagination.hasMore).toBe(false);
      });
    });
  });
});
