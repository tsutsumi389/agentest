import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '@agentest/db';
import { AdminSessionRepository } from '../../repositories/admin-session.repository.js';
import {
  createTestAdminUser,
  createTestAdminSession,
  cleanupTestData,
} from '../integration/test-helpers.js';

describe('AdminSessionRepository', () => {
  let repo: AdminSessionRepository;
  let testAdminUser: Awaited<ReturnType<typeof createTestAdminUser>>;

  beforeAll(() => {
    repo = new AdminSessionRepository();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();
    testAdminUser = await createTestAdminUser({
      email: 'admin@example.com',
      name: 'Test Admin',
    });
  });

  describe('create', () => {
    it('セッションを作成できる', async () => {
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

      const session = await repo.create({
        adminUserId: testAdminUser.id,
        token: 'test-token-123',
        userAgent: 'Mozilla/5.0 Test',
        ipAddress: '192.168.1.1',
        expiresAt,
      });

      expect(session.id).toBeDefined();
      expect(session.adminUserId).toBe(testAdminUser.id);
      expect(session.token).toBe('test-token-123');
      expect(session.userAgent).toBe('Mozilla/5.0 Test');
      expect(session.ipAddress).toBe('192.168.1.1');
      expect(session.expiresAt.getTime()).toBe(expiresAt.getTime());
      expect(session.revokedAt).toBeNull();
    });
  });

  describe('findByToken', () => {
    it('トークンでセッションを取得できる（adminUser含む）', async () => {
      const session = await createTestAdminSession(testAdminUser.id, {
        token: 'find-by-token-test',
      });

      const result = await repo.findByToken('find-by-token-test');

      expect(result).not.toBeNull();
      expect(result?.id).toBe(session.id);
      expect(result?.token).toBe('find-by-token-test');
      // adminUserが含まれていることを確認
      expect(result?.adminUser).toBeDefined();
      expect(result?.adminUser.id).toBe(testAdminUser.id);
      expect(result?.adminUser.email).toBe(testAdminUser.email);
      expect(result?.adminUser.name).toBe(testAdminUser.name);
    });

    it('存在しないトークンはnullを返す', async () => {
      const result = await repo.findByToken('nonexistent-token');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('IDでセッションを取得できる', async () => {
      const session = await createTestAdminSession(testAdminUser.id);

      const result = await repo.findById(session.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(session.id);
    });

    it('存在しないIDはnullを返す', async () => {
      const result = await repo.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateLastActiveAt', () => {
    it('最終活動時刻を更新できる', async () => {
      const session = await createTestAdminSession(testAdminUser.id);
      const originalLastActiveAt = session.lastActiveAt;

      // 少し待ってから更新
      await new Promise((resolve) => setTimeout(resolve, 10));
      await repo.updateLastActiveAt(session.id);

      const updated = await prisma.adminSession.findUnique({
        where: { id: session.id },
      });

      expect(updated?.lastActiveAt.getTime()).toBeGreaterThan(originalLastActiveAt.getTime());
    });
  });

  describe('extendExpiry', () => {
    it('有効期限を延長できる', async () => {
      const session = await createTestAdminSession(testAdminUser.id);
      const newExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4時間後

      await repo.extendExpiry(session.id, newExpiresAt);

      const updated = await prisma.adminSession.findUnique({
        where: { id: session.id },
      });

      expect(updated?.expiresAt.getTime()).toBe(newExpiresAt.getTime());
    });
  });

  describe('revoke', () => {
    it('IDでセッションを失効できる', async () => {
      const session = await createTestAdminSession(testAdminUser.id);

      await repo.revoke(session.id);

      const revoked = await prisma.adminSession.findUnique({
        where: { id: session.id },
      });

      expect(revoked?.revokedAt).not.toBeNull();
    });
  });

  describe('revokeByToken', () => {
    it('トークンでセッションを失効できる', async () => {
      const session = await createTestAdminSession(testAdminUser.id, {
        token: 'revoke-by-token-test',
      });

      await repo.revokeByToken('revoke-by-token-test');

      const revoked = await prisma.adminSession.findUnique({
        where: { id: session.id },
      });

      expect(revoked?.revokedAt).not.toBeNull();
    });
  });

  describe('revokeAllByUserId', () => {
    it('管理者の全セッションを失効できる', async () => {
      // 複数のセッションを作成
      await createTestAdminSession(testAdminUser.id, { token: 'session-1' });
      await createTestAdminSession(testAdminUser.id, { token: 'session-2' });
      await createTestAdminSession(testAdminUser.id, { token: 'session-3' });

      // 別の管理者のセッション（影響を受けないことを確認用）
      const otherAdmin = await createTestAdminUser({
        email: 'other@example.com',
      });
      await createTestAdminSession(otherAdmin.id, { token: 'other-session' });

      await repo.revokeAllByUserId(testAdminUser.id);

      // テストユーザーのセッションが全て失効していることを確認
      const revokedSessions = await prisma.adminSession.findMany({
        where: { adminUserId: testAdminUser.id },
      });
      expect(revokedSessions.every((s) => s.revokedAt !== null)).toBe(true);

      // 他の管理者のセッションは影響を受けていないことを確認
      const otherSession = await prisma.adminSession.findFirst({
        where: { adminUserId: otherAdmin.id },
      });
      expect(otherSession?.revokedAt).toBeNull();
    });
  });

  describe('deleteExpired', () => {
    it('30日以上経過した期限切れ/失効セッションを削除', async () => {
      const now = new Date();
      const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
      const twentyNineDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

      // 31日前に期限切れのセッション（削除対象）
      await prisma.adminSession.create({
        data: {
          adminUserId: testAdminUser.id,
          token: 'expired-old-session',
          expiresAt: thirtyOneDaysAgo,
        },
      });

      // 31日前に失効したセッション（削除対象）
      await prisma.adminSession.create({
        data: {
          adminUserId: testAdminUser.id,
          token: 'revoked-old-session',
          expiresAt: now,
          revokedAt: thirtyOneDaysAgo,
        },
      });

      // 29日前に期限切れのセッション（保持対象）
      await prisma.adminSession.create({
        data: {
          adminUserId: testAdminUser.id,
          token: 'expired-recent-session',
          expiresAt: twentyNineDaysAgo,
        },
      });

      // 有効なセッション（保持対象）
      await createTestAdminSession(testAdminUser.id, { token: 'valid-session' });

      const result = await repo.deleteExpired();

      expect(result.count).toBe(2);

      // 保持対象のセッションが残っていることを確認
      const remainingSessions = await prisma.adminSession.findMany({
        where: { adminUserId: testAdminUser.id },
      });
      expect(remainingSessions.length).toBe(2);
      expect(remainingSessions.map((s) => s.token).sort()).toEqual([
        'expired-recent-session',
        'valid-session',
      ]);
    });
  });
});
