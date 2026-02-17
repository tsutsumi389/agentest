import { prisma, type Prisma } from '@agentest/db';
import type {
  AdminUserListResponse,
  AdminUserListItem,
  AdminUserSearchParams,
  AdminUserDetailResponse,
  AdminUserDetail,
} from '@agentest/shared';
import {
  getAdminUsersCache,
  setAdminUsersCache,
  getAdminUserDetailCache,
  setAdminUserDetailCache,
} from '../../lib/redis-store.js';

// キャッシュ有効期限（秒）
const CACHE_TTL_SECONDS = 60;
const DETAIL_CACHE_TTL_SECONDS = 30;

/**
 * 管理者ユーザー一覧サービス
 */
export class AdminUsersService {
  /**
   * ユーザー一覧を取得
   */
  async findUsers(params: AdminUserSearchParams): Promise<AdminUserListResponse> {
    // デフォルト値を設定
    const {
      q,
      status = 'active',
      createdFrom,
      createdTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    // キャッシュパラメータを構築
    const cacheParams = {
      q,
      status,
      createdFrom,
      createdTo,
      page,
      limit,
      sortBy,
      sortOrder,
    };

    // キャッシュをチェック
    const cached = await getAdminUsersCache<AdminUserListResponse>(cacheParams);
    if (cached) {
      return cached;
    }

    // WHERE句を構築
    const where = this.buildWhereClause({
      q,
      status,
      createdFrom,
      createdTo,
    });

    // ORDER BY句を構築
    const orderBy = this.buildOrderBy(sortBy, sortOrder);

    // オフセット計算
    const skip = (page - 1) * limit;

    // 並列でデータを取得
    // _countを使用して効率的にカウント（全件取得を避ける）
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              organizationMembers: {
                where: { organization: { deletedAt: null } },
              },
              projectMembers: {
                where: { project: { deletedAt: null } },
              },
            },
          },
          sessions: {
            where: { revokedAt: null },
            orderBy: { lastActiveAt: 'desc' },
            take: 1,
            select: { lastActiveAt: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // レスポンス形式に変換
    const userItems: AdminUserListItem[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      deletedAt: user.deletedAt?.toISOString() ?? null,
      stats: {
        organizationCount: user._count.organizationMembers,
        projectCount: user._count.projectMembers,
        lastActiveAt: user.sessions[0]?.lastActiveAt?.toISOString() ?? null,
      },
    }));

    const response: AdminUserListResponse = {
      users: userItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // キャッシュに保存
    await setAdminUsersCache(cacheParams, response, CACHE_TTL_SECONDS);

    return response;
  }

  /**
   * WHERE句を構築
   */
  private buildWhereClause(params: {
    q?: string;
    status?: string;
    createdFrom?: string;
    createdTo?: string;
  }): Prisma.UserWhereInput {
    const { q, status, createdFrom, createdTo } = params;
    const where: Prisma.UserWhereInput = {};

    // 検索クエリ（OR条件）
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    // ステータスフィルタ
    if (status === 'active') {
      where.deletedAt = null;
    } else if (status === 'deleted') {
      where.deletedAt = { not: null };
    }
    // status === 'all' の場合は条件追加なし

    // 日付フィルタ
    if (createdFrom || createdTo) {
      where.createdAt = {};
      if (createdFrom) {
        where.createdAt.gte = new Date(createdFrom);
      }
      if (createdTo) {
        where.createdAt.lte = new Date(createdTo);
      }
    }

    return where;
  }

  /**
   * ORDER BY句を構築
   */
  private buildOrderBy(
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): Prisma.UserOrderByWithRelationInput {
    switch (sortBy) {
      case 'name':
        return { name: sortOrder };
      case 'email':
        return { email: sortOrder };
      case 'createdAt':
      default:
        return { createdAt: sortOrder };
    }
  }

  /**
   * ユーザー詳細を取得
   */
  async findUserById(userId: string): Promise<AdminUserDetailResponse | null> {
    // キャッシュをチェック
    const cached = await getAdminUserDetailCache<AdminUserDetailResponse>(userId);
    if (cached) {
      return cached;
    }

    // Prismaでユーザーを取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sessions: {
          where: {
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { lastActiveAt: 'desc' },
          select: { lastActiveAt: true },
        },
        organizationMembers: {
          where: { organization: { deletedAt: null } },
          include: {
            organization: { select: { id: true, name: true } },
          },
        },
        accounts: {
          select: { provider: true, createdAt: true },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            category: true,
            action: true,
            targetType: true,
            targetId: true,
            ipAddress: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            organizationMembers: {
              where: { organization: { deletedAt: null } },
            },
            projectMembers: {
              where: { project: { deletedAt: null } },
            },
            testSuites: {
              where: { deletedAt: null },
            },
            executions: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // レスポンス形式に変換
    const userDetail: AdminUserDetail = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      deletedAt: user.deletedAt?.toISOString() ?? null,
      activity: {
        lastActiveAt: user.sessions[0]?.lastActiveAt?.toISOString() ?? null,
        activeSessionCount: user.sessions.length,
      },
      stats: {
        organizationCount: user._count.organizationMembers,
        projectCount: user._count.projectMembers,
        testSuiteCount: user._count.testSuites,
        executionCount: user._count.executions,
      },
      organizations: user.organizationMembers.map((member) => ({
        id: member.organization.id,
        name: member.organization.name,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
      })),
      oauthProviders: user.accounts.map((account) => ({
        provider: account.provider,
        createdAt: account.createdAt.toISOString(),
      })),
      recentAuditLogs: user.auditLogs.map((log) => ({
        id: log.id,
        category: log.category,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
    };

    const response: AdminUserDetailResponse = { user: userDetail };

    // キャッシュに保存
    await setAdminUserDetailCache(userId, response, DETAIL_CACHE_TTL_SECONDS);

    return response;
  }
}
