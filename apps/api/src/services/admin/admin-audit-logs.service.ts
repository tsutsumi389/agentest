import { prisma, type Prisma, type AuditLogCategory } from '@agentest/db';
import type {
  AdminAuditLogSearchParams,
  AdminAuditLogListResponse,
  AdminAuditLogEntry,
} from '@agentest/shared';
import {
  getAdminAuditLogsCache,
  setAdminAuditLogsCache,
} from '../../lib/redis-store.js';

// キャッシュ有効期限（秒）
const CACHE_TTL_SECONDS = 30;

/**
 * 管理者監査ログサービス
 */
export class AdminAuditLogsService {
  /**
   * 監査ログ一覧を取得
   */
  async findAuditLogs(params: AdminAuditLogSearchParams): Promise<AdminAuditLogListResponse> {
    // デフォルト値を設定
    const {
      q,
      category,
      organizationId,
      userId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    // キャッシュパラメータを構築
    const cacheParams = {
      q,
      category,
      organizationId,
      userId,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder,
    };

    // キャッシュをチェック
    const cached = await getAdminAuditLogsCache<AdminAuditLogListResponse>(cacheParams);
    if (cached) {
      return cached;
    }

    // WHERE句を構築
    const where = this.buildWhereClause({
      q,
      category,
      organizationId,
      userId,
      startDate,
      endDate,
    });

    // ORDER BY句を構築
    const orderBy = this.buildOrderBy(sortBy, sortOrder);

    // オフセット計算
    const skip = (page - 1) * limit;

    // 並列でデータを取得
    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // レスポンス形式に変換
    const auditLogItems: AdminAuditLogEntry[] = auditLogs.map((log) => ({
      id: log.id,
      category: log.category as AdminAuditLogEntry['category'],
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details as Record<string, unknown> | null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
      organization: log.organization
        ? {
            id: log.organization.id,
            name: log.organization.name,
          }
        : null,
      user: log.user
        ? {
            id: log.user.id,
            name: log.user.name,
            email: log.user.email,
            avatarUrl: log.user.avatarUrl,
          }
        : null,
    }));

    const response: AdminAuditLogListResponse = {
      auditLogs: auditLogItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // キャッシュに保存
    await setAdminAuditLogsCache(cacheParams, response, CACHE_TTL_SECONDS);

    return response;
  }

  /**
   * WHERE句を構築
   */
  private buildWhereClause(params: {
    q?: string;
    category?: AuditLogCategory[];
    organizationId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Prisma.AuditLogWhereInput {
    const { q, category, organizationId, userId, startDate, endDate } = params;
    const where: Prisma.AuditLogWhereInput = {};

    // 検索クエリ（アクション名で部分一致）
    if (q) {
      where.action = { contains: q, mode: 'insensitive' };
    }

    // カテゴリフィルタ
    if (category && category.length > 0) {
      where.category = { in: category };
    }

    // 組織IDフィルタ
    if (organizationId) {
      where.organizationId = organizationId;
    }

    // ユーザーIDフィルタ
    if (userId) {
      where.userId = userId;
    }

    // 日付フィルタ
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    return where;
  }

  /**
   * ORDER BY句を構築
   */
  private buildOrderBy(
    _sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): Prisma.AuditLogOrderByWithRelationInput {
    // 現時点ではcreatedAtのみサポート（将来的に他のカラムも追加可能）
    return { createdAt: sortOrder };
  }
}
