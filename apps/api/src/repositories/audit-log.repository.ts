import { prisma, type AuditLogCategory, type Prisma } from '@agentest/db';

/** 監査ログ取得のデフォルト件数 */
export const AUDIT_LOG_DEFAULT_LIMIT = 50;

/** 監査ログ取得の上限件数 */
export const AUDIT_LOG_MAX_LIMIT = 100;

/** 監査ログエクスポートの上限件数 */
export const AUDIT_LOG_EXPORT_MAX_LIMIT = 10000;

/**
 * 監査ログのクエリオプション
 */
export interface AuditLogQueryOptions {
  page?: number;
  limit?: number;
  category?: AuditLogCategory;
  startDate?: Date;
  endDate?: Date;
}

/**
 * 監査ログのエクスポートオプション
 */
export interface AuditLogExportOptions {
  category?: AuditLogCategory;
  startDate?: Date;
  endDate?: Date;
}

/**
 * 監査ログの記録パラメータ
 */
export interface AuditLogCreateParams {
  userId?: string;
  organizationId?: string;
  category: AuditLogCategory;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 監査ログリポジトリ
 */
export class AuditLogRepository {
  /**
   * 監査ログを作成
   */
  async create(data: AuditLogCreateParams) {
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
  async findByOrganization(organizationId: string, options: AuditLogQueryOptions = {}) {
    const {
      page = 1,
      limit: requestedLimit = AUDIT_LOG_DEFAULT_LIMIT,
      category,
      startDate,
      endDate,
    } = options;
    const limit = Math.min(requestedLimit, AUDIT_LOG_MAX_LIMIT);
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
  async findByUser(userId: string, options: AuditLogQueryOptions = {}) {
    const {
      page = 1,
      limit: requestedLimit = AUDIT_LOG_DEFAULT_LIMIT,
      category,
      startDate,
      endDate,
    } = options;
    const limit = Math.min(requestedLimit, AUDIT_LOG_MAX_LIMIT);
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
   * エクスポート用に組織の監査ログを取得（上限: 10,000件）
   */
  async findForExport(organizationId: string, options: AuditLogExportOptions = {}) {
    const { category, startDate, endDate } = options;

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

    return prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: AUDIT_LOG_EXPORT_MAX_LIMIT,
    });
  }
}
