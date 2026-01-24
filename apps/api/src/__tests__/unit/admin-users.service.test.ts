import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdminUserDetailResponse } from '@agentest/shared';

// Prismaをモック
vi.mock('@agentest/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

// envをモック
vi.mock('../../config/env.js', () => ({
  env: {
    REDIS_URL: undefined,
  },
}));

// redis-storeをモック
vi.mock('../../lib/redis-store.js', () => ({
  getAdminUserDetailCache: vi.fn(),
  setAdminUserDetailCache: vi.fn(),
  getAdminUsersCache: vi.fn(),
  setAdminUsersCache: vi.fn(),
}));

import { AdminUsersService } from '../../services/admin/admin-users.service.js';
import { prisma } from '@agentest/db';
import {
  getAdminUserDetailCache,
  setAdminUserDetailCache,
} from '../../lib/redis-store.js';

describe('AdminUsersService', () => {
  let service: AdminUsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminUsersService();
  });

  describe('findUserById', () => {
    const mockUserId = '550e8400-e29b-41d4-a716-446655440000';

    // モックユーザーデータを生成するヘルパー
    const createMockUserData = (overrides: Partial<{
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      plan: 'FREE' | 'PRO';
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
      sessions: { lastActiveAt: Date | null }[];
      organizationMembers: {
        role: string;
        joinedAt: Date;
        organization: { id: string; name: string };
      }[];
      accounts: { provider: string; createdAt: Date }[];
      subscription: {
        plan: string;
        status: string;
        billingCycle: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        cancelAtPeriodEnd: boolean;
      } | null;
      auditLogs: {
        id: string;
        category: string;
        action: string;
        targetType: string | null;
        targetId: string | null;
        ipAddress: string | null;
        createdAt: Date;
      }[];
      _count: {
        organizationMembers: number;
        projectMembers: number;
        testSuites: number;
        executions: number;
      };
    }> = {}) => ({
      id: mockUserId,
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.png',
      plan: 'PRO' as const,
      createdAt: new Date('2024-01-15T00:00:00.000Z'),
      updatedAt: new Date('2024-01-20T00:00:00.000Z'),
      deletedAt: null,
      sessions: [],
      organizationMembers: [],
      accounts: [],
      subscription: null,
      auditLogs: [],
      _count: {
        organizationMembers: 0,
        projectMembers: 0,
        testSuites: 0,
        executions: 0,
      },
      ...overrides,
    });

    it('キャッシュヒット時はDBアクセスせずキャッシュを返す', async () => {
      const cachedResponse: AdminUserDetailResponse = {
        user: {
          id: mockUserId,
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: 'https://example.com/avatar.png',
          plan: 'PRO',
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-01-20T00:00:00.000Z',
          deletedAt: null,
          activity: { lastActiveAt: null, activeSessionCount: 0 },
          stats: { organizationCount: 0, projectCount: 0, testSuiteCount: 0, executionCount: 0 },
          organizations: [],
          oauthProviders: [],
          subscription: null,
          recentAuditLogs: [],
        },
      };

      vi.mocked(getAdminUserDetailCache).mockResolvedValue(cachedResponse);

      const result = await service.findUserById(mockUserId);

      expect(result).toEqual(cachedResponse);
      expect(getAdminUserDetailCache).toHaveBeenCalledWith(mockUserId);
      // DBはアクセスされない
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('キャッシュミス時はDBから取得してキャッシュに保存する', async () => {
      vi.mocked(getAdminUserDetailCache).mockResolvedValue(null);
      vi.mocked(setAdminUserDetailCache).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(createMockUserData());

      const result = await service.findUserById(mockUserId);

      expect(result).toBeDefined();
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(setAdminUserDetailCache).toHaveBeenCalledTimes(1);
      expect(setAdminUserDetailCache).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ user: expect.any(Object) }),
        30 // DETAIL_CACHE_TTL_SECONDS
      );
    });

    it('存在しないユーザーIDの場合はnullを返す', async () => {
      vi.mocked(getAdminUserDetailCache).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await service.findUserById('nonexistent-id');

      expect(result).toBeNull();
      // キャッシュに保存されない
      expect(setAdminUserDetailCache).not.toHaveBeenCalled();
    });

    it('ユーザー詳細のレスポンス形式が正しい', async () => {
      vi.mocked(getAdminUserDetailCache).mockResolvedValue(null);
      vi.mocked(setAdminUserDetailCache).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(createMockUserData());

      const result = await service.findUserById(mockUserId);

      expect(result).not.toBeNull();
      expect(result!.user).toMatchObject({
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        plan: 'PRO',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        activity: expect.any(Object),
        stats: expect.any(Object),
        organizations: expect.any(Array),
        oauthProviders: expect.any(Array),
        subscription: null,
        recentAuditLogs: expect.any(Array),
      });
    });

    it('activity情報が正しく変換される', async () => {
      const lastActiveAt = new Date('2024-01-20T12:00:00.000Z');
      vi.mocked(getAdminUserDetailCache).mockResolvedValue(null);
      vi.mocked(setAdminUserDetailCache).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        createMockUserData({
          sessions: [
            { lastActiveAt },
            { lastActiveAt: new Date('2024-01-19T12:00:00.000Z') },
            { lastActiveAt: new Date('2024-01-18T12:00:00.000Z') },
          ],
        })
      );

      const result = await service.findUserById(mockUserId);

      expect(result!.user.activity).toEqual({
        lastActiveAt: lastActiveAt.toISOString(),
        activeSessionCount: 3,
      });
    });

    it('セッションがない場合はactivity.lastActiveAtがnullになる', async () => {
      vi.mocked(getAdminUserDetailCache).mockResolvedValue(null);
      vi.mocked(setAdminUserDetailCache).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        createMockUserData({ sessions: [] })
      );

      const result = await service.findUserById(mockUserId);

      expect(result!.user.activity).toEqual({
        lastActiveAt: null,
        activeSessionCount: 0,
      });
    });

    it('stats情報が正しく変換される', async () => {
      vi.mocked(getAdminUserDetailCache).mockResolvedValue(null);
      vi.mocked(setAdminUserDetailCache).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        createMockUserData({
          _count: {
            organizationMembers: 3,
            projectMembers: 5,
            testSuites: 10,
            executions: 50,
          },
        })
      );

      const result = await service.findUserById(mockUserId);

      expect(result!.user.stats).toEqual({
        organizationCount: 3,
        projectCount: 5,
        testSuiteCount: 10,
        executionCount: 50,
      });
    });

    it('organizations情報が正しく変換される', async () => {
      const joinedAt = new Date('2024-01-10T00:00:00.000Z');
      vi.mocked(getAdminUserDetailCache).mockResolvedValue(null);
      vi.mocked(setAdminUserDetailCache).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        createMockUserData({
          organizationMembers: [
            {
              role: 'OWNER',
              joinedAt,
              organization: { id: 'org-1', name: 'Organization 1' },
            },
            {
              role: 'MEMBER',
              joinedAt: new Date('2024-01-15T00:00:00.000Z'),
              organization: { id: 'org-2', name: 'Organization 2' },
            },
          ],
        })
      );

      const result = await service.findUserById(mockUserId);

      expect(result!.user.organizations).toHaveLength(2);
      expect(result!.user.organizations[0]).toEqual({
        id: 'org-1',
        name: 'Organization 1',
        role: 'OWNER',
        joinedAt: joinedAt.toISOString(),
      });
    });

    it('oauthProviders情報が正しく変換される', async () => {
      const createdAt = new Date('2024-01-05T00:00:00.000Z');
      vi.mocked(getAdminUserDetailCache).mockResolvedValue(null);
      vi.mocked(setAdminUserDetailCache).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        createMockUserData({
          accounts: [
            { provider: 'github', createdAt },
            { provider: 'google', createdAt: new Date('2024-01-10T00:00:00.000Z') },
          ],
        })
      );

      const result = await service.findUserById(mockUserId);

      expect(result!.user.oauthProviders).toHaveLength(2);
      expect(result!.user.oauthProviders[0]).toEqual({
        provider: 'github',
        createdAt: createdAt.toISOString(),
      });
    });

    it('subscription情報がnullの場合はnullを返す', async () => {
      vi.mocked(getAdminUserDetailCache).mockResolvedValue(null);
      vi.mocked(setAdminUserDetailCache).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        createMockUserData({ subscription: null })
      );

      const result = await service.findUserById(mockUserId);

      expect(result!.user.subscription).toBeNull();
    });

    it('subscription情報が正しく変換される', async () => {
      const currentPeriodStart = new Date('2024-01-01T00:00:00.000Z');
      const currentPeriodEnd = new Date('2024-02-01T00:00:00.000Z');
      vi.mocked(getAdminUserDetailCache).mockResolvedValue(null);
      vi.mocked(setAdminUserDetailCache).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        createMockUserData({
          subscription: {
            plan: 'PRO',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd: false,
          },
        })
      );

      const result = await service.findUserById(mockUserId);

      expect(result!.user.subscription).toEqual({
        plan: 'PRO',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: currentPeriodStart.toISOString(),
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: false,
      });
    });

    it('recentAuditLogs情報が正しく変換される', async () => {
      const logCreatedAt = new Date('2024-01-20T10:00:00.000Z');
      vi.mocked(getAdminUserDetailCache).mockResolvedValue(null);
      vi.mocked(setAdminUserDetailCache).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        createMockUserData({
          auditLogs: [
            {
              id: 'log-1',
              category: 'AUTH',
              action: 'LOGIN',
              targetType: null,
              targetId: null,
              ipAddress: '192.168.1.1',
              createdAt: logCreatedAt,
            },
            {
              id: 'log-2',
              category: 'PROJECT',
              action: 'CREATE',
              targetType: 'PROJECT',
              targetId: 'proj-1',
              ipAddress: '192.168.1.1',
              createdAt: new Date('2024-01-19T10:00:00.000Z'),
            },
          ],
        })
      );

      const result = await service.findUserById(mockUserId);

      expect(result!.user.recentAuditLogs).toHaveLength(2);
      expect(result!.user.recentAuditLogs[0]).toEqual({
        id: 'log-1',
        category: 'AUTH',
        action: 'LOGIN',
        targetType: null,
        targetId: null,
        ipAddress: '192.168.1.1',
        createdAt: logCreatedAt.toISOString(),
      });
    });

    it('deletedAtがある場合も正しく取得できる', async () => {
      const deletedAt = new Date('2024-01-25T00:00:00.000Z');
      vi.mocked(getAdminUserDetailCache).mockResolvedValue(null);
      vi.mocked(setAdminUserDetailCache).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        createMockUserData({ deletedAt })
      );

      const result = await service.findUserById(mockUserId);

      expect(result!.user.deletedAt).toBe(deletedAt.toISOString());
    });
  });
});
