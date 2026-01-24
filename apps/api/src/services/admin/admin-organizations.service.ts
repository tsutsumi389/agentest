import { prisma, type Prisma } from '@agentest/db';
import type {
  AdminOrganizationListResponse,
  AdminOrganizationListItem,
  AdminOrganizationSearchParams,
} from '@agentest/shared';
import {
  getAdminOrganizationsCache,
  setAdminOrganizationsCache,
} from '../../lib/redis-store.js';

// キャッシュ有効期限（秒）
const CACHE_TTL_SECONDS = 60;

/**
 * 管理者組織一覧サービス
 */
export class AdminOrganizationsService {
  /**
   * 組織一覧を取得
   */
  async findOrganizations(params: AdminOrganizationSearchParams): Promise<AdminOrganizationListResponse> {
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
    const cached = await getAdminOrganizationsCache<AdminOrganizationListResponse>(cacheParams);
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
    // _countを使用して効率的にカウント（全件取得を避ける）
    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              // 削除済みユーザーを除外してメンバー数をカウント
              members: {
                where: { user: { deletedAt: null } },
              },
              projects: {
                where: { deletedAt: null },
              },
            },
          },
          // オーナー情報を取得
          members: {
            where: { role: 'OWNER' },
            take: 1,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    // レスポンス形式に変換
    const organizationItems: AdminOrganizationListItem[] = organizations.map((org) => {
      // オーナーを取得（membersの中からrole='OWNER'を取得）
      const ownerMember = org.members[0];
      const owner = ownerMember?.user
        ? {
            id: ownerMember.user.id,
            name: ownerMember.user.name,
            email: ownerMember.user.email,
            avatarUrl: ownerMember.user.avatarUrl,
          }
        : null;

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        avatarUrl: org.avatarUrl,
        plan: org.plan,
        billingEmail: org.billingEmail,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
        deletedAt: org.deletedAt?.toISOString() ?? null,
        stats: {
          memberCount: org._count.members,
          projectCount: org._count.projects,
        },
        owner,
      };
    });

    const response: AdminOrganizationListResponse = {
      organizations: organizationItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // キャッシュに保存
    await setAdminOrganizationsCache(cacheParams, response, CACHE_TTL_SECONDS);

    return response;
  }

  /**
   * WHERE句を構築
   */
  private buildWhereClause(params: {
    q?: string;
    plan?: ('TEAM' | 'ENTERPRISE')[];
    status?: string;
    createdFrom?: string;
    createdTo?: string;
  }): Prisma.OrganizationWhereInput {
    const { q, plan, status, createdFrom, createdTo } = params;
    const where: Prisma.OrganizationWhereInput = {};

    // 検索クエリ（OR条件：名前、スラグで部分一致）
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
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
  ): Prisma.OrganizationOrderByWithRelationInput {
    switch (sortBy) {
      case 'name':
        return { name: sortOrder };
      case 'plan':
        return { plan: sortOrder };
      case 'createdAt':
      default:
        return { createdAt: sortOrder };
    }
  }
}
