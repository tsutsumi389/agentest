import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '@agentest/db';
import { AdminUserRepository } from '../../repositories/admin-user.repository.js';
import {
  createTestAdminUser,
  cleanupTestData,
} from '../integration/test-helpers.js';

describe('AdminUserRepository', () => {
  let repo: AdminUserRepository;

  beforeAll(() => {
    repo = new AdminUserRepository();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('findByEmailWithPassword', () => {
    it('存在するユーザーを取得できる', async () => {
      const adminUser = await createTestAdminUser({
        email: 'test@example.com',
        name: 'Test Admin',
      });

      const result = await repo.findByEmailWithPassword('test@example.com');

      expect(result).not.toBeNull();
      expect(result?.id).toBe(adminUser.id);
      expect(result?.email).toBe('test@example.com');
      expect(result?.name).toBe('Test Admin');
      expect(result?.passwordHash).toBeDefined();
    });

    it('削除済みユーザーは取得されない', async () => {
      await createTestAdminUser({
        email: 'deleted@example.com',
        deletedAt: new Date(),
      });

      const result = await repo.findByEmailWithPassword('deleted@example.com');

      expect(result).toBeNull();
    });

    it('存在しないユーザーはnullを返す', async () => {
      const result = await repo.findByEmailWithPassword('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('IDでユーザーを取得できる（パスワードなし）', async () => {
      const adminUser = await createTestAdminUser({
        email: 'test@example.com',
        name: 'Test Admin',
      });

      const result = await repo.findById(adminUser.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(adminUser.id);
      expect(result?.email).toBe('test@example.com');
      expect(result?.name).toBe('Test Admin');
      // パスワードハッシュが含まれていないことを確認
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('削除済みユーザーは取得されない', async () => {
      const adminUser = await createTestAdminUser({
        deletedAt: new Date(),
      });

      const result = await repo.findById(adminUser.id);

      expect(result).toBeNull();
    });

    it('存在しないIDはnullを返す', async () => {
      const result = await repo.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('incrementFailedAttempts', () => {
    it('失敗回数をインクリメントできる', async () => {
      const adminUser = await createTestAdminUser({
        failedAttempts: 0,
      });

      const result = await repo.incrementFailedAttempts(adminUser.id);

      expect(result.failedAttempts).toBe(1);

      // 再度インクリメント
      const result2 = await repo.incrementFailedAttempts(adminUser.id);
      expect(result2.failedAttempts).toBe(2);
    });
  });

  describe('lockAccount', () => {
    it('アカウントをロックできる', async () => {
      const adminUser = await createTestAdminUser();
      const lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30分後

      await repo.lockAccount(adminUser.id, lockUntil);

      const updated = await prisma.adminUser.findUnique({
        where: { id: adminUser.id },
      });

      expect(updated?.lockedUntil).not.toBeNull();
      expect(updated?.lockedUntil?.getTime()).toBe(lockUntil.getTime());
    });
  });

  describe('resetFailedAttempts', () => {
    it('失敗回数とロックをリセットできる', async () => {
      const adminUser = await createTestAdminUser({
        failedAttempts: 5,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      });

      await repo.resetFailedAttempts(adminUser.id);

      const updated = await prisma.adminUser.findUnique({
        where: { id: adminUser.id },
      });

      expect(updated?.failedAttempts).toBe(0);
      expect(updated?.lockedUntil).toBeNull();
    });
  });
});
