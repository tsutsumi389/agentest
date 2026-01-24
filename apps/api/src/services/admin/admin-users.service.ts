import { prisma, type Prisma } from '@agentest/db';
import type {
  AdminUserListResponse,
  AdminUserListItem,
  AdminUserSearchParams,
} from '@agentest/shared';
import {
  getAdminUsersCache,
  setAdminUsersCache,
} from '../../lib/redis-store.js';

// キャッシュ有効期限（秒）
const CACHE_TTL_SECONDS = 60;

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
      plan,
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
      plan,
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
      plan,
      status,
      createdFrom,
      createdTo,
    });

    // ORDER BY句を構築
    const orderBy = this.buildOrderBy(sortBy, sortOrder);

    // オフセット計算
    const skip = (page - 1) * limit;

    // 並列でデータを取得
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          organizationMembers: {
            where: {
              organization: { deletedAt: null },
            },
            select: { id: true },
          },
          projectMembers: {
            where: {
              project: { deletedAt: null },
            },
            select: { id: true },
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
      plan: user.plan,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      deletedAt: user.deletedAt?.toISOString() ?? null,
      stats: {
        organizationCount: user.organizationMembers.length,
        projectCount: user.projectMembers.length,
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
    plan?: ('FREE' | 'PRO')[];
    status?: string;
    createdFrom?: string;
    createdTo?: string;
  }): Prisma.UserWhereInput {
    const { q, plan, status, createdFrom, createdTo } = params;
    const where: Prisma.UserWhereInput = {};

    // 検索クエリ（OR条件）
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    // プランフィルタ
    if (plan && plan.length > 0) {
      where.plan = { in: plan };
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
      case 'plan':
        return { plan: sortOrder };
      case 'createdAt':
      default:
        return { createdAt: sortOrder };
    }
  }
}
