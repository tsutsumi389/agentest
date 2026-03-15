import { prisma, type Prisma } from '@agentest/db';
import type {
  AdminOrganizationListResponse,
  AdminOrganizationListItem,
  AdminOrganizationSearchParams,
  AdminOrganizationDetailResponse,
  AdminOrganizationDetail,
} from '@agentest/shared';
import {
  getAdminOrganizationsCache,
  setAdminOrganizationsCache,
  getAdminOrganizationDetailCache,
  setAdminOrganizationDetailCache,
} from '../../lib/redis-store.js';

// キャッシュ有効期限（秒）
const CACHE_TTL_SECONDS = 60;
const DETAIL_CACHE_TTL_SECONDS = 30;

/**
 * 管理者組織一覧サービス
 */
export class AdminOrganizationsService {
  /**
   * 組織一覧を取得
   */
  async findOrganizations(
    params: AdminOrganizationSearchParams
  ): Promise<AdminOrganizationListResponse> {
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
    const cached = await getAdminOrganizationsCache<AdminOrganizationListResponse>(cacheParams);
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
        description: org.description,
        avatarUrl: org.avatarUrl,
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
    status?: string;
    createdFrom?: string;
    createdTo?: string;
  }): Prisma.OrganizationWhereInput {
    const { q, status, createdFrom, createdTo } = params;
    const where: Prisma.OrganizationWhereInput = {};

    // 検索クエリ（名前で部分一致）
    if (q) {
      where.name = { contains: q, mode: 'insensitive' };
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
      case 'createdAt':
      default:
        return { createdAt: sortOrder };
    }
  }

  /**
   * 組織詳細を取得
   */
  async findOrganizationById(
    organizationId: string
  ): Promise<AdminOrganizationDetailResponse | null> {
    // キャッシュをチェック
    const cached =
      await getAdminOrganizationDetailCache<AdminOrganizationDetailResponse>(organizationId);
    if (cached) {
      return cached;
    }

    // Prismaで組織を取得
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        // メンバー一覧（最新20件、削除済みユーザーを除く）
        members: {
          where: { user: { deletedAt: null } },
          orderBy: { joinedAt: 'desc' },
          take: 20,
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
        // プロジェクト一覧（最新10件、削除済みを除く）
        projects: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            _count: {
              select: {
                members: true,
                testSuites: { where: { deletedAt: null } },
              },
            },
          },
        },
        // 監査ログ（最新10件）
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        // 統計用カウント
        _count: {
          select: {
            members: { where: { user: { deletedAt: null } } },
            projects: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!org) {
      return null;
    }

    // テストスイート数と実行数を別途集計
    const [testSuiteCount, executionCount] = await Promise.all([
      prisma.testSuite.count({
        where: {
          project: {
            organizationId: org.id,
            deletedAt: null,
          },
          deletedAt: null,
        },
      }),
      prisma.execution.count({
        where: {
          testSuite: {
            project: {
              organizationId: org.id,
              deletedAt: null,
            },
            deletedAt: null,
          },
        },
      }),
    ]);

    // レスポンス形式に変換
    const orgDetail: AdminOrganizationDetail = {
      id: org.id,
      name: org.name,
      description: org.description,
      avatarUrl: org.avatarUrl,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
      deletedAt: org.deletedAt?.toISOString() ?? null,
      stats: {
        memberCount: org._count.members,
        projectCount: org._count.projects,
        testSuiteCount,
        executionCount,
      },
      members: org.members.map((member) => ({
        id: member.id,
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
      })),
      projects: org.projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        memberCount: project._count.members,
        testSuiteCount: project._count.testSuites,
        createdAt: project.createdAt.toISOString(),
      })),
      recentAuditLogs: org.auditLogs.map((log) => ({
        id: log.id,
        category: log.category,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        user: log.user
          ? {
              id: log.user.id,
              name: log.user.name,
              email: log.user.email,
            }
          : null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
    };

    const response: AdminOrganizationDetailResponse = { organization: orgDetail };

    // キャッシュに保存
    await setAdminOrganizationDetailCache(organizationId, response, DETAIL_CACHE_TTL_SECONDS);

    return response;
  }
}
