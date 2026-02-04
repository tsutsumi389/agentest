import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestProjectMember,
  createTestSuite,
  createTestCase,
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
  authenticate:
    (_options: { optional?: boolean } = {}) =>
    (req: any, _res: any, next: any) => {
      if (mockAuthUser) req.user = mockAuthUser;
      next();
    },
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

// Redis publisherのモック
vi.mock('../../lib/redis-publisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
  publishDashboardUpdated: vi.fn().mockResolvedValue(undefined),
}));

describe('Edit Locks API 結合テスト', () => {
  let app: Express;
  let user1: Awaited<ReturnType<typeof createTestUser>>;
  let user2: Awaited<ReturnType<typeof createTestUser>>;
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let testSuite: Awaited<ReturnType<typeof createTestSuite>>;
  let testCase: Awaited<ReturnType<typeof createTestCase>>;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await prisma.editLock.deleteMany({});
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.editLock.deleteMany({});
    await cleanupTestData();

    // テストユーザーを作成
    user1 = await createTestUser({ email: 'user1@example.com', name: 'User One' });
    user2 = await createTestUser({ email: 'user2@example.com', name: 'User Two' });
    adminUser = await createTestUser({ email: 'admin@example.com', name: 'Admin User' });

    // プロジェクトを作成
    project = await createTestProject(user1.id, {
      name: 'Lock Test Project',
      description: 'ロックテスト用プロジェクト',
    });

    // メンバーを追加
    await createTestProjectMember(project.id, user2.id, 'WRITE');
    await createTestProjectMember(project.id, adminUser.id, 'ADMIN');

    // テストスイートを作成
    testSuite = await createTestSuite(project.id, {
      name: 'Lock Test Suite',
      description: 'ロックテスト用スイート',
    });

    // テストケースを作成
    testCase = await createTestCase(testSuite.id, {
      title: 'Lock Test Case',
      description: 'ロックテスト用ケース',
    });

    // デフォルトでuser1として認証
    mockAuthUser = { id: user1.id, email: user1.email };
  });

  // ============================================================
  // POST /api/locks - ロック取得
  // ============================================================
  describe('POST /api/locks（ロック取得）', () => {
    it('テストスイートのロックを取得できる', async () => {
      const response = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      expect(response.body.lock).toBeDefined();
      expect(response.body.lock.targetType).toBe('SUITE');
      expect(response.body.lock.targetId).toBe(testSuite.id);
    });

    it('テストケースのロックを取得できる', async () => {
      const response = await request(app)
        .post('/api/locks')
        .send({ targetType: 'CASE', targetId: testCase.id })
        .expect(201);

      expect(response.body.lock).toBeDefined();
      expect(response.body.lock.targetType).toBe('CASE');
      expect(response.body.lock.targetId).toBe(testCase.id);
    });

    it('レスポンスにlockedBy, expiresAt, configが含まれる', async () => {
      const response = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      // lockedBy情報の確認
      expect(response.body.lock.lockedBy).toBeDefined();
      expect(response.body.lock.lockedBy.type).toBe('user');
      expect(response.body.lock.lockedBy.id).toBe(user1.id);
      expect(response.body.lock.lockedBy.name).toBe('User One');

      // expiresAtの確認
      expect(response.body.lock.expiresAt).toBeDefined();
      const expiresAt = new Date(response.body.lock.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

      // config情報の確認
      expect(response.body.config).toBeDefined();
      expect(response.body.config.heartbeatIntervalSeconds).toBe(30);
    });

    it('同一ユーザーで再取得するとロックが更新される', async () => {
      // 最初のロック取得
      const firstResponse = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      const firstExpiresAt = firstResponse.body.lock.expiresAt;

      // 少し待ってから再取得
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 同じユーザーで再取得
      const secondResponse = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      // ロックIDは同じ（更新されている）
      expect(secondResponse.body.lock.id).toBe(firstResponse.body.lock.id);
      // expiresAtが更新されている
      expect(new Date(secondResponse.body.lock.expiresAt).getTime())
        .toBeGreaterThanOrEqual(new Date(firstExpiresAt).getTime());
    });

    it('他ユーザーがロック中の場合は409 Conflictエラー', async () => {
      // user1がロック取得
      await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      // user2でロック取得を試みる
      mockAuthUser = { id: user2.id, email: user2.email };

      const response = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(409);

      expect(response.body.error.code).toBe('LOCK_CONFLICT');
    });

    it('未認証は401エラー', async () => {
      mockAuthUser = null;

      const response = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('無効なtargetTypeは400エラー', async () => {
      const response = await request(app)
        .post('/api/locks')
        .send({ targetType: 'INVALID', targetId: testSuite.id })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ============================================================
  // GET /api/locks - ロック状態確認
  // ============================================================
  describe('GET /api/locks（ロック状態確認）', () => {
    it('ロック中の状態を確認できる（isLocked: true）', async () => {
      // ロックを取得
      await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      // ロック状態を確認
      const response = await request(app)
        .get('/api/locks')
        .query({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(200);

      expect(response.body.isLocked).toBe(true);
      expect(response.body.lock).toBeDefined();
      expect(response.body.lock.targetType).toBe('SUITE');
      expect(response.body.lock.targetId).toBe(testSuite.id);
      expect(response.body.lock.lockedBy).toBeDefined();
      expect(response.body.lock.expiresAt).toBeDefined();
    });

    it('ロックなしの状態を確認できる（isLocked: false）', async () => {
      const response = await request(app)
        .get('/api/locks')
        .query({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(200);

      expect(response.body.isLocked).toBe(false);
      expect(response.body.lock).toBeNull();
    });

    it('未認証は401エラー', async () => {
      mockAuthUser = null;

      const response = await request(app)
        .get('/api/locks')
        .query({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  // ============================================================
  // PATCH /api/locks/:lockId/heartbeat - ハートビート
  // ============================================================
  describe('PATCH /api/locks/:lockId/heartbeat（ハートビート）', () => {
    it('ハートビートでロックの有効期限が延長される', async () => {
      // ロックを取得
      const lockResponse = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      const lockId = lockResponse.body.lock.id;
      const originalExpiresAt = lockResponse.body.lock.expiresAt;

      // 少し待ってからハートビート
      await new Promise((resolve) => setTimeout(resolve, 50));

      const heartbeatResponse = await request(app)
        .patch(`/api/locks/${lockId}/heartbeat`)
        .expect(200);

      expect(heartbeatResponse.body.lock).toBeDefined();
      expect(heartbeatResponse.body.lock.id).toBe(lockId);
      // 有効期限が延長されている
      expect(new Date(heartbeatResponse.body.lock.expiresAt).getTime())
        .toBeGreaterThanOrEqual(new Date(originalExpiresAt).getTime());
    });

    it('ロック所有者以外は403エラー', async () => {
      // user1がロック取得
      const lockResponse = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      const lockId = lockResponse.body.lock.id;

      // user2でハートビートを試みる
      mockAuthUser = { id: user2.id, email: user2.email };

      const response = await request(app)
        .patch(`/api/locks/${lockId}/heartbeat`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('存在しないロックは404エラー', async () => {
      const response = await request(app)
        .patch('/api/locks/00000000-0000-0000-0000-000000000000/heartbeat')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証は401エラー', async () => {
      mockAuthUser = null;

      const response = await request(app)
        .patch('/api/locks/00000000-0000-0000-0000-000000000000/heartbeat')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  // ============================================================
  // DELETE /api/locks/:lockId - ロック解放
  // ============================================================
  describe('DELETE /api/locks/:lockId（ロック解放）', () => {
    it('ロックを解放できる', async () => {
      // ロックを取得
      const lockResponse = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      const lockId = lockResponse.body.lock.id;

      // ロックを解放
      await request(app)
        .delete(`/api/locks/${lockId}`)
        .expect(204);

      // ロックが解放されていることを確認
      const statusResponse = await request(app)
        .get('/api/locks')
        .query({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(200);

      expect(statusResponse.body.isLocked).toBe(false);
      expect(statusResponse.body.lock).toBeNull();
    });

    it('ロック所有者以外は403エラー', async () => {
      // user1がロック取得
      const lockResponse = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      const lockId = lockResponse.body.lock.id;

      // user2で解放を試みる
      mockAuthUser = { id: user2.id, email: user2.email };

      const response = await request(app)
        .delete(`/api/locks/${lockId}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('未認証は401エラー', async () => {
      mockAuthUser = null;

      const response = await request(app)
        .delete('/api/locks/00000000-0000-0000-0000-000000000000')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  // ============================================================
  // DELETE /api/locks/:lockId/force - 強制解放
  // ============================================================
  describe('DELETE /api/locks/:lockId/force（強制解放）', () => {
    it('管理者が強制解放できる', async () => {
      // user1がロック取得
      const lockResponse = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      const lockId = lockResponse.body.lock.id;

      // 管理者ユーザー（プロジェクトADMIN）で強制解放
      mockAuthUser = { id: adminUser.id, email: adminUser.email };

      const response = await request(app)
        .delete(`/api/locks/${lockId}/force`)
        .expect(200);

      expect(response.body.message).toBe('Lock forcibly released');
      expect(response.body.releasedLock).toBeDefined();
      expect(response.body.releasedLock.id).toBe(lockId);
      expect(response.body.releasedLock.targetType).toBe('SUITE');
      expect(response.body.releasedLock.targetId).toBe(testSuite.id);

      // ロックが解放されていることを確認
      mockAuthUser = { id: user1.id, email: user1.email };
      const statusResponse = await request(app)
        .get('/api/locks')
        .query({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(200);

      expect(statusResponse.body.isLocked).toBe(false);
    });

    it('存在しないロックは404エラー', async () => {
      mockAuthUser = { id: adminUser.id, email: adminUser.email };

      const response = await request(app)
        .delete('/api/locks/00000000-0000-0000-0000-000000000000/force')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('未認証は401エラー', async () => {
      mockAuthUser = null;

      const response = await request(app)
        .delete('/api/locks/00000000-0000-0000-0000-000000000000/force')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  // ============================================================
  // ロックの完全フロー
  // ============================================================
  describe('ロックの完全フロー', () => {
    it('ロック取得→ハートビート→解放の一連の操作', async () => {
      // 1. ロック取得
      const acquireResponse = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      const lockId = acquireResponse.body.lock.id;
      expect(acquireResponse.body.lock.lockedBy.id).toBe(user1.id);
      expect(acquireResponse.body.config.heartbeatIntervalSeconds).toBe(30);

      // 2. ロック状態を確認（ロック中）
      const statusResponse1 = await request(app)
        .get('/api/locks')
        .query({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(200);

      expect(statusResponse1.body.isLocked).toBe(true);
      expect(statusResponse1.body.lock.id).toBe(lockId);

      // 3. ハートビートでロックを延長
      const heartbeatResponse = await request(app)
        .patch(`/api/locks/${lockId}/heartbeat`)
        .expect(200);

      expect(heartbeatResponse.body.lock.id).toBe(lockId);

      // 4. ロックを解放
      await request(app)
        .delete(`/api/locks/${lockId}`)
        .expect(204);

      // 5. ロック状態を確認（解放済み）
      const statusResponse2 = await request(app)
        .get('/api/locks')
        .query({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(200);

      expect(statusResponse2.body.isLocked).toBe(false);
      expect(statusResponse2.body.lock).toBeNull();

      // 6. 解放後に別ユーザーがロックを取得できる
      mockAuthUser = { id: user2.id, email: user2.email };

      const reacquireResponse = await request(app)
        .post('/api/locks')
        .send({ targetType: 'SUITE', targetId: testSuite.id })
        .expect(201);

      expect(reacquireResponse.body.lock.lockedBy.id).toBe(user2.id);
    });
  });
});
