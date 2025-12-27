import { prisma, type AuditLogCategory, type Prisma } from '@agentest/db';

/**
 * 監査ログリポジトリ
 */
export class AuditLogRepository {
  /**
   * 監査ログを作成
   */
  async create(data: {
    userId?: string;
    organizationId?: string;
    category: AuditLogCategory;
    action: string;
    targetType?: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        category: data.category,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        details: data.details as Prisma.JsonObject | undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  /**
   * 組織の監査ログを取得（ページネーション対応）
   */
  async findByOrganization(
    organizationId: string,
    options: {
      page?: number;
      limit?: number;
      category?: AuditLogCategory;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const { page = 1, limit = 50, category, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(category && { category }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * ユーザーの監査ログを取得（ページネーション対応）
   */
  async findByUser(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      category?: AuditLogCategory;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const { page = 1, limit = 50, category, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      userId,
      organizationId: null, // 個人の監査ログのみ
      ...(category && { category }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}
