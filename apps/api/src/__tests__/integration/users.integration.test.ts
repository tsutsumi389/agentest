import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestSession,
  createTestAccount,
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
});
