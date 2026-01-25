import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdminOrganizationListResponse } from '@agentest/shared';

// Prismaをモック
vi.mock('@agentest/db', () => ({
  prisma: {
    organization: { findMany: vi.fn(), count: vi.fn() },
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
  getAdminOrganizationsCache: vi.fn(),
  setAdminOrganizationsCache: vi.fn(),
}));

import { AdminOrganizationsService } from '../../services/admin/admin-organizations.service.js';
import { prisma } from '@agentest/db';
import {
  getAdminOrganizationsCache,
  setAdminOrganizationsCache,
} from '../../lib/redis-store.js';

describe('AdminOrganizationsService', () => {
  let service: AdminOrganizationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminOrganizationsService();
  });

  describe('findOrganizations', () => {
    // モック組織データを生成するヘルパー
    const createMockOrganizationData = (overrides: Partial<{
      id: string;
      name: string;
      description: string | null;
      avatarUrl: string | null;
      plan: 'TEAM' | 'ENTERPRISE';
      billingEmail: string | null;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
      _count: { members: number; projects: number };
      members: {
        role: string;
        user: { id: string; name: string; email: string; avatarUrl: string | null };
      }[];
    }> = {}) => ({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Organization',
      description: 'Test description',
      avatarUrl: 'https://example.com/avatar.png',
      plan: 'TEAM' as const,
      billingEmail: 'billing@example.com',
      createdAt: new Date('2024-01-15T00:00:00.000Z'),
      updatedAt: new Date('2024-01-20T00:00:00.000Z'),
      deletedAt: null,
      _count: { members: 5, projects: 3 },
      members: [],
      ...overrides,
    });

    it('キャッシュヒット時はDBアクセスせずキャッシュを返す', async () => {
      const cachedResponse: AdminOrganizationListResponse = {
        organizations: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Organization',
            description: 'Test description',
            avatarUrl: 'https://example.com/avatar.png',
            plan: 'TEAM',
            billingEmail: 'billing@example.com',
            createdAt: '2024-01-15T00:00:00.000Z',
            updatedAt: '2024-01-20T00:00:00.000Z',
            deletedAt: null,
            stats: { memberCount: 5, projectCount: 3 },
            owner: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(cachedResponse);

      const result = await service.findOrganizations({});

      expect(result).toEqual(cachedResponse);
      expect(getAdminOrganizationsCache).toHaveBeenCalled();
      // DBはアクセスされない
      expect(prisma.organization.findMany).not.toHaveBeenCalled();
    });

    it('キャッシュミス時はDBから取得してキャッシュに保存する', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([createMockOrganizationData()]);
      vi.mocked(prisma.organization.count).mockResolvedValue(1);

      const result = await service.findOrganizations({});

      expect(result).toBeDefined();
      expect(prisma.organization.findMany).toHaveBeenCalledTimes(1);
      expect(setAdminOrganizationsCache).toHaveBeenCalledTimes(1);
    });

    it('空の結果を正しく処理する', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      const result = await service.findOrganizations({});

      expect(result.organizations).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('組織一覧のレスポンス形式が正しい', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([createMockOrganizationData()]);
      vi.mocked(prisma.organization.count).mockResolvedValue(1);

      const result = await service.findOrganizations({});

      expect(result.organizations[0]).toMatchObject({
        id: expect.any(String),
        name: 'Test Organization',
        description: 'Test description',
        avatarUrl: 'https://example.com/avatar.png',
        plan: 'TEAM',
        billingEmail: 'billing@example.com',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        stats: { memberCount: 5, projectCount: 3 },
        owner: null,
      });
    });

    it('オーナー情報が正しく変換される', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([
        createMockOrganizationData({
          members: [
            {
              role: 'OWNER',
              user: {
                id: 'user-1',
                name: 'Owner User',
                email: 'owner@example.com',
                avatarUrl: 'https://example.com/owner.png',
              },
            },
          ],
        }),
      ]);
      vi.mocked(prisma.organization.count).mockResolvedValue(1);

      const result = await service.findOrganizations({});

      expect(result.organizations[0].owner).toEqual({
        id: 'user-1',
        name: 'Owner User',
        email: 'owner@example.com',
        avatarUrl: 'https://example.com/owner.png',
      });
    });

    it('ページネーションが正しく計算される', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([createMockOrganizationData()]);
      vi.mocked(prisma.organization.count).mockResolvedValue(45);

      const result = await service.findOrganizations({ page: 2, limit: 20 });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
    });

    it('検索クエリ（q）が正しくWHERE句に変換される', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      await service.findOrganizations({ q: 'test' });

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'test', mode: 'insensitive' },
          }),
        })
      );
    });

    it('プランフィルタが正しくWHERE句に変換される', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      await service.findOrganizations({ plan: ['TEAM', 'ENTERPRISE'] });

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            plan: { in: ['TEAM', 'ENTERPRISE'] },
          }),
        })
      );
    });

    it('ステータス=activeの場合、deletedAt=nullでフィルタされる', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      await service.findOrganizations({ status: 'active' });

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });

    it('ステータス=deletedの場合、deletedAtがnullでないものでフィルタされる', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      await service.findOrganizations({ status: 'deleted' });

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: { not: null },
          }),
        })
      );
    });

    it('ステータス=allの場合、deletedAtの条件が追加されない', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      await service.findOrganizations({ status: 'all' });

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            deletedAt: expect.anything(),
          }),
        })
      );
    });

    it('日付フィルタが正しくWHERE句に変換される', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      const createdFrom = '2024-01-01T00:00:00.000Z';
      const createdTo = '2024-12-31T23:59:59.999Z';

      await service.findOrganizations({ createdFrom, createdTo });

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date(createdFrom),
              lte: new Date(createdTo),
            },
          }),
        })
      );
    });

    it('ソートがcreatedAtで正しく動作する', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      await service.findOrganizations({ sortBy: 'createdAt', sortOrder: 'asc' });

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      );
    });

    it('ソートがnameで正しく動作する', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      await service.findOrganizations({ sortBy: 'name', sortOrder: 'desc' });

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'desc' },
        })
      );
    });

    it('ソートがplanで正しく動作する', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      await service.findOrganizations({ sortBy: 'plan', sortOrder: 'asc' });

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { plan: 'asc' },
        })
      );
    });

    it('削除済み組織のdeletedAtが正しく変換される', async () => {
      const deletedAt = new Date('2024-01-25T00:00:00.000Z');
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([
        createMockOrganizationData({ deletedAt }),
      ]);
      vi.mocked(prisma.organization.count).mockResolvedValue(1);

      const result = await service.findOrganizations({ status: 'all' });

      expect(result.organizations[0].deletedAt).toBe(deletedAt.toISOString());
    });

    it('stats情報が正しく変換される', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([
        createMockOrganizationData({
          _count: { members: 10, projects: 5 },
        }),
      ]);
      vi.mocked(prisma.organization.count).mockResolvedValue(1);

      const result = await service.findOrganizations({});

      expect(result.organizations[0].stats).toEqual({
        memberCount: 10,
        projectCount: 5,
      });
    });

    it('デフォルトパラメータが正しく適用される', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      await service.findOrganizations({});

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
          where: expect.objectContaining({ deletedAt: null }),
          include: expect.objectContaining({
            _count: {
              select: {
                // 削除済みユーザーを除外
                members: { where: { user: { deletedAt: null } } },
                projects: { where: { deletedAt: null } },
              },
            },
          }),
        })
      );
    });

    it('オーナーがいない組織はowner=nullになる', async () => {
      vi.mocked(getAdminOrganizationsCache).mockResolvedValue(null);
      vi.mocked(setAdminOrganizationsCache).mockResolvedValue(true);
      vi.mocked(prisma.organization.findMany).mockResolvedValue([
        createMockOrganizationData({ members: [] }),
      ]);
      vi.mocked(prisma.organization.count).mockResolvedValue(1);

      const result = await service.findOrganizations({});

      expect(result.organizations[0].owner).toBeNull();
    });
  });
});
