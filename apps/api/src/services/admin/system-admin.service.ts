import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma, type Prisma, AdminRoleType } from '@agentest/db';
import type {
  SystemAdminSearchParams,
  SystemAdminListResponse,
  SystemAdminListItem,
  SystemAdminDetailResponse,
  SystemAdminDetail,
  SystemAdminInviteRequest,
  SystemAdminInviteResponse,
  SystemAdminUpdateRequest,
  SystemAdminUpdateResponse,
  SystemAdminDeleteResponse,
  SystemAdminUnlockResponse,
  SystemAdminReset2FAResponse,
  SystemAdminRole,
  AdminInvitationResponse,
  AcceptInvitationResponse,
} from '@agentest/shared';
import {
  getSystemAdminsCache,
  setSystemAdminsCache,
  getSystemAdminDetailCache,
  setSystemAdminDetailCache,
  invalidateSystemAdminsCache,
  invalidateSystemAdminDetailCache,
} from '../../lib/redis-store.js';
import { BusinessError, NotFoundError } from '@agentest/shared';
import { emailService } from '../email.service.js';
import { env } from '../../config/env.js';

// キャッシュ有効期限（秒）
const CACHE_TTL_SECONDS = 60;
const DETAIL_CACHE_TTL_SECONDS = 30;

// 招待トークン有効期限（24時間）
const INVITATION_EXPIRES_HOURS = 24;

/**
 * システム管理者管理サービス
 */
export class SystemAdminService {
  /**
   * システム管理者一覧を取得
   */
  async findAdminUsers(params: SystemAdminSearchParams): Promise<SystemAdminListResponse> {
    const {
      q,
      role,
      status = 'active',
      totpEnabled,
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
      role,
      status,
      totpEnabled,
      createdFrom,
      createdTo,
      page,
      limit,
      sortBy,
      sortOrder,
    };

    // キャッシュをチェック
    const cached = await getSystemAdminsCache<SystemAdminListResponse>(cacheParams);
    if (cached) {
      return cached;
    }

    // WHERE句を構築
    const where = this.buildWhereClause({
      q,
      role,
      status,
      totpEnabled,
      createdFrom,
      createdTo,
    });

    // ORDER BY句を構築
    const orderBy = this.buildOrderBy(sortBy, sortOrder);

    // オフセット計算
    const skip = (page - 1) * limit;

    // 並列でデータを取得
    const [adminUsers, total] = await Promise.all([
      prisma.adminUser.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          sessions: {
            where: {
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            orderBy: { lastActiveAt: 'desc' },
            take: 1,
            select: { lastActiveAt: true },
          },
          _count: {
            select: {
              sessions: {
                where: {
                  revokedAt: null,
                  expiresAt: { gt: new Date() },
                },
              },
            },
          },
        },
      }),
      prisma.adminUser.count({ where }),
    ]);

    // レスポンス形式に変換
    let adminUserItems: SystemAdminListItem[] = adminUsers.map((admin) => ({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role as SystemAdminRole,
      totpEnabled: admin.totpEnabled,
      failedAttempts: admin.failedAttempts,
      lockedUntil: admin.lockedUntil?.toISOString() ?? null,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
      deletedAt: admin.deletedAt?.toISOString() ?? null,
      activity: {
        lastLoginAt: admin.sessions[0]?.lastActiveAt?.toISOString() ?? null,
        activeSessionCount: admin._count.sessions,
      },
    }));

    // lastLoginAtでソートする場合はJS側で再ソート
    // （Prismaではリレーション先のフィールドでのソートがサポートされないため）
    if (sortBy === 'lastLoginAt') {
      adminUserItems = adminUserItems.sort((a, b) => {
        const aTime = a.activity.lastLoginAt ? new Date(a.activity.lastLoginAt).getTime() : 0;
        const bTime = b.activity.lastLoginAt ? new Date(b.activity.lastLoginAt).getTime() : 0;
        return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
      });
    }

    const response: SystemAdminListResponse = {
      adminUsers: adminUserItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // キャッシュに保存
    await setSystemAdminsCache(cacheParams, response, CACHE_TTL_SECONDS);

    return response;
  }

  /**
   * WHERE句を構築
   */
  private buildWhereClause(params: {
    q?: string;
    role?: SystemAdminRole[];
    status?: string;
    totpEnabled?: boolean;
    createdFrom?: string;
    createdTo?: string;
  }): Prisma.AdminUserWhereInput {
    const { q, role, status, totpEnabled, createdFrom, createdTo } = params;
    const where: Prisma.AdminUserWhereInput = {};

    // 検索クエリ（OR条件）
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    // ロールフィルタ
    if (role && role.length > 0) {
      where.role = { in: role as AdminRoleType[] };
    }

    // ステータスフィルタ
    if (status === 'active') {
      // アクティブ = 削除されておらず、ロックもされていない
      where.deletedAt = null;
      const andConditions = Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : []);
      where.AND = [
        ...andConditions,
        {
          OR: [
            { lockedUntil: null },
            { lockedUntil: { lt: new Date() } },
          ],
        },
      ];
    } else if (status === 'deleted') {
      where.deletedAt = { not: null };
    } else if (status === 'locked') {
      // ロック中 = 削除されておらず、lockedUntilが未来日
      where.deletedAt = null;
      where.lockedUntil = { gt: new Date() };
    }
    // status === 'all' の場合は条件追加なし

    // 2FA有効状態フィルタ
    if (totpEnabled !== undefined) {
      where.totpEnabled = totpEnabled;
    }

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
  ): Prisma.AdminUserOrderByWithRelationInput | Prisma.AdminUserOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'name':
        return { name: sortOrder };
      case 'email':
        return { email: sortOrder };
      case 'role':
        return { role: sortOrder };
      case 'lastLoginAt':
        // lastLoginAtソートはPrismaで直接サポートされないため、
        // createdAtでソートし、取得後にJSで再ソートする（buildOrderByの呼び出し元で処理）
        return { createdAt: sortOrder };
      case 'createdAt':
      default:
        return { createdAt: sortOrder };
    }
  }

  /**
   * システム管理者詳細を取得
   */
  async findAdminUserById(adminUserId: string): Promise<SystemAdminDetailResponse | null> {
    // キャッシュをチェック
    const cached = await getSystemAdminDetailCache<SystemAdminDetailResponse>(adminUserId);
    if (cached) {
      return cached;
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: adminUserId },
      include: {
        sessions: {
          where: {
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { lastActiveAt: 'desc' },
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            lastActiveAt: true,
            createdAt: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            action: true,
            targetType: true,
            targetId: true,
            ipAddress: true,
            createdAt: true,
          },
        },
      },
    });

    if (!adminUser) {
      return null;
    }

    // 最終ログイン日時を取得
    const lastLoginAt = adminUser.sessions[0]?.lastActiveAt ?? null;

    const adminUserDetail: SystemAdminDetail = {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role as SystemAdminRole,
      totpEnabled: adminUser.totpEnabled,
      failedAttempts: adminUser.failedAttempts,
      lockedUntil: adminUser.lockedUntil?.toISOString() ?? null,
      createdAt: adminUser.createdAt.toISOString(),
      updatedAt: adminUser.updatedAt.toISOString(),
      deletedAt: adminUser.deletedAt?.toISOString() ?? null,
      activity: {
        lastLoginAt: lastLoginAt?.toISOString() ?? null,
        activeSessionCount: adminUser.sessions.length,
        currentSessions: adminUser.sessions.map((session) => ({
          id: session.id,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          lastActiveAt: session.lastActiveAt.toISOString(),
          createdAt: session.createdAt.toISOString(),
        })),
      },
      recentAuditLogs: adminUser.auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
    };

    const response: SystemAdminDetailResponse = { adminUser: adminUserDetail };

    // キャッシュに保存
    await setSystemAdminDetailCache(adminUserId, response, DETAIL_CACHE_TTL_SECONDS);

    return response;
  }

  /**
   * システム管理者を招待（招待メール送信）
   */
  async inviteAdminUser(
    request: SystemAdminInviteRequest,
    currentAdminId: string
  ): Promise<SystemAdminInviteResponse> {
    const { email, name, role } = request;

    // 既存のアクティブなメールアドレスをチェック
    const existingUser = await prisma.adminUser.findUnique({
      where: { email },
      select: { id: true, deletedAt: true },
    });

    if (existingUser && !existingUser.deletedAt) {
      throw new BusinessError('ADMIN_USER_ALREADY_EXISTS', 'このメールアドレスは既に登録されています');
    }

    // 既存の未使用招待をチェック
    const existingInvitation = await prisma.adminInvitation.findFirst({
      where: {
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      throw new BusinessError('INVITATION_ALREADY_EXISTS', '有効な招待が既に存在します');
    }

    // 招待者情報を取得
    const inviter = await prisma.adminUser.findUnique({
      where: { id: currentAdminId },
      select: { name: true },
    });

    if (!inviter) {
      throw new NotFoundError('招待者情報が見つかりません');
    }

    // 招待トークンを生成
    const token = crypto.randomUUID();

    // 有効期限を設定（24時間）
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITATION_EXPIRES_HOURS);

    // 招待を作成
    const invitation = await prisma.adminInvitation.create({
      data: {
        email,
        name,
        role: role as AdminRoleType,
        token,
        invitedById: currentAdminId,
        expiresAt,
      },
    });

    // 監査ログを記録
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: currentAdminId,
        action: 'ADMIN_USER_INVITE',
        targetType: 'AdminInvitation',
        targetId: invitation.id,
        details: { email, name, role },
      },
    });

    // 招待メールを送信
    let invitationSent = false;
    try {
      // 管理画面のベースURLを取得（環境変数がない場合はAPIのURLから推測）
      const adminBaseUrl = env.FRONTEND_URL.replace(':5173', ':5174');
      const invitationUrl = `${adminBaseUrl}/invitation/${token}`;

      const emailContent = emailService.generateAdminInvitationEmail({
        name,
        inviterName: inviter.name,
        role,
        invitationUrl,
        expiresAt,
      });

      await emailService.send({
        to: email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      });

      invitationSent = true;
    } catch (error) {
      // メール送信失敗してもエラーにはしない（招待自体は作成済み）
      console.error('招待メール送信失敗:', error);
    }

    return {
      adminUser: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role as SystemAdminRole,
        totpEnabled: false,
        createdAt: invitation.createdAt.toISOString(),
      },
      invitationSent,
    };
  }

  /**
   * 招待情報を取得
   */
  async getInvitation(token: string): Promise<AdminInvitationResponse> {
    const invitation = await prisma.adminInvitation.findUnique({
      where: { token },
      include: {
        invitedBy: {
          select: { name: true },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundError('招待が見つかりません');
    }

    // 既に受諾済みかチェック
    if (invitation.acceptedAt) {
      throw new BusinessError('INVITATION_ALREADY_ACCEPTED', 'この招待は既に受諾されています');
    }

    // 有効期限をチェック
    if (invitation.expiresAt < new Date()) {
      throw new BusinessError('INVITATION_EXPIRED', 'この招待は有効期限が切れています');
    }

    return {
      email: invitation.email,
      name: invitation.name,
      role: invitation.role as SystemAdminRole,
      invitedBy: invitation.invitedBy.name,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /**
   * 招待を受諾してパスワードを設定
   */
  async acceptInvitation(token: string, password: string): Promise<AcceptInvitationResponse> {
    const invitation = await prisma.adminInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundError('招待が見つかりません');
    }

    // 既に受諾済みかチェック
    if (invitation.acceptedAt) {
      throw new BusinessError('INVITATION_ALREADY_ACCEPTED', 'この招待は既に受諾されています');
    }

    // 有効期限をチェック
    if (invitation.expiresAt < new Date()) {
      throw new BusinessError('INVITATION_EXPIRED', 'この招待は有効期限が切れています');
    }

    // パスワードをハッシュ化
    const passwordHash = await bcrypt.hash(password, 12);

    // 既存の削除済みアカウントをチェック
    const existingUser = await prisma.adminUser.findUnique({
      where: { email: invitation.email },
      select: { id: true, deletedAt: true },
    });

    let adminUser;

    // トランザクションで処理
    if (existingUser) {
      // 削除済みアカウントを復元
      [adminUser] = await prisma.$transaction([
        prisma.adminUser.update({
          where: { id: existingUser.id },
          data: {
            name: invitation.name,
            role: invitation.role,
            passwordHash,
            totpEnabled: false,
            totpSecret: null,
            failedAttempts: 0,
            lockedUntil: null,
            deletedAt: null,
          },
        }),
        prisma.adminInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        }),
        prisma.adminAuditLog.create({
          data: {
            adminUserId: existingUser.id,
            action: 'ADMIN_USER_ACTIVATE',
            targetType: 'AdminUser',
            targetId: existingUser.id,
            details: { restoredFromDeleted: true },
          },
        }),
      ]);
    } else {
      // 新規作成
      adminUser = await prisma.adminUser.create({
        data: {
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          passwordHash,
        },
      });

      await prisma.$transaction([
        prisma.adminInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        }),
        prisma.adminAuditLog.create({
          data: {
            adminUserId: adminUser.id,
            action: 'ADMIN_USER_ACTIVATE',
            targetType: 'AdminUser',
            targetId: adminUser.id,
            details: { invitationId: invitation.id },
          },
        }),
      ]);
    }

    // キャッシュを無効化
    await invalidateSystemAdminsCache();

    return {
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role as SystemAdminRole,
      },
      message: 'アカウントが有効化されました。ログインしてください。',
    };
  }

  /**
   * システム管理者を更新
   */
  async updateAdminUser(
    adminUserId: string,
    request: SystemAdminUpdateRequest,
    currentAdminId: string
  ): Promise<SystemAdminUpdateResponse> {
    const { name, role } = request;

    // 対象の管理者を取得
    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: { id: true, name: true, role: true, deletedAt: true },
    });

    if (!targetAdmin) {
      throw new NotFoundError('管理者が見つかりません');
    }

    if (targetAdmin.deletedAt) {
      throw new NotFoundError('管理者が見つかりません');
    }

    // ロール変更時のビジネスルールチェック
    if (role && role !== targetAdmin.role) {
      // 自分自身のロール変更は禁止
      if (adminUserId === currentAdminId) {
        throw new BusinessError('CANNOT_EDIT_SELF_ROLE', '自分自身のロールは変更できません');
      }

      // 最後のSUPER_ADMINの降格は禁止
      if (targetAdmin.role === 'SUPER_ADMIN') {
        const superAdminCount = await prisma.adminUser.count({
          where: {
            role: 'SUPER_ADMIN',
            deletedAt: null,
          },
        });
        if (superAdminCount <= 1) {
          throw new BusinessError(
            'CANNOT_DEMOTE_LAST_SUPER_ADMIN',
            '最後のSUPER_ADMINのロールは変更できません'
          );
        }
      }
    }

    // 更新データを構築
    const updateData: Prisma.AdminUserUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role as AdminRoleType;

    // 更新
    const updatedAdmin = await prisma.adminUser.update({
      where: { id: adminUserId },
      data: updateData,
    });

    // 監査ログを記録
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: currentAdminId,
        action: 'ADMIN_USER_UPDATE',
        targetType: 'AdminUser',
        targetId: adminUserId,
        details: {
          before: { name: targetAdmin.name, role: targetAdmin.role },
          after: { name: updatedAdmin.name, role: updatedAdmin.role },
        },
      },
    });

    // キャッシュを無効化
    await Promise.all([
      invalidateSystemAdminsCache(),
      invalidateSystemAdminDetailCache(adminUserId),
    ]);

    return {
      adminUser: {
        id: updatedAdmin.id,
        email: updatedAdmin.email,
        name: updatedAdmin.name,
        role: updatedAdmin.role as SystemAdminRole,
        totpEnabled: updatedAdmin.totpEnabled,
        createdAt: updatedAdmin.createdAt.toISOString(),
        updatedAt: updatedAdmin.updatedAt.toISOString(),
      },
    };
  }

  /**
   * システム管理者を削除（論理削除）
   */
  async deleteAdminUser(
    adminUserId: string,
    currentAdminId: string
  ): Promise<SystemAdminDeleteResponse> {
    // 自分自身の削除は禁止
    if (adminUserId === currentAdminId) {
      throw new BusinessError('CANNOT_DELETE_SELF', '自分自身は削除できません');
    }

    // 対象の管理者を取得
    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: { id: true, role: true, deletedAt: true },
    });

    if (!targetAdmin) {
      throw new NotFoundError('管理者が見つかりません');
    }

    if (targetAdmin.deletedAt) {
      throw new NotFoundError('管理者が見つかりません');
    }

    // 最後のSUPER_ADMINの削除は禁止
    if (targetAdmin.role === 'SUPER_ADMIN') {
      const superAdminCount = await prisma.adminUser.count({
        where: {
          role: 'SUPER_ADMIN',
          deletedAt: null,
        },
      });
      if (superAdminCount <= 1) {
        throw new BusinessError(
          'CANNOT_DELETE_LAST_SUPER_ADMIN',
          '最後のSUPER_ADMINは削除できません'
        );
      }
    }

    // 論理削除 & セッション無効化 & 監査ログ記録（トランザクション内）
    const now = new Date();
    await prisma.$transaction([
      prisma.adminUser.update({
        where: { id: adminUserId },
        data: { deletedAt: now },
      }),
      prisma.adminSession.updateMany({
        where: { adminUserId, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.adminAuditLog.create({
        data: {
          adminUserId: currentAdminId,
          action: 'ADMIN_USER_DELETE',
          targetType: 'AdminUser',
          targetId: adminUserId,
        },
      }),
    ]);

    // キャッシュを無効化
    await Promise.all([
      invalidateSystemAdminsCache(),
      invalidateSystemAdminDetailCache(adminUserId),
    ]);

    return {
      message: '管理者を削除しました',
      deletedAt: now.toISOString(),
    };
  }

  /**
   * アカウントロックを解除
   */
  async unlockAdminUser(
    adminUserId: string,
    currentAdminId: string
  ): Promise<SystemAdminUnlockResponse> {
    // 対象の管理者を取得
    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: { id: true, lockedUntil: true, deletedAt: true },
    });

    if (!targetAdmin) {
      throw new NotFoundError('管理者が見つかりません');
    }

    if (targetAdmin.deletedAt) {
      throw new NotFoundError('管理者が見つかりません');
    }

    // ロック解除
    await prisma.adminUser.update({
      where: { id: adminUserId },
      data: {
        lockedUntil: null,
        failedAttempts: 0,
      },
    });

    // 監査ログを記録
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: currentAdminId,
        action: 'ADMIN_USER_UNLOCK',
        targetType: 'AdminUser',
        targetId: adminUserId,
      },
    });

    // キャッシュを無効化
    await Promise.all([
      invalidateSystemAdminsCache(),
      invalidateSystemAdminDetailCache(adminUserId),
    ]);

    return {
      message: 'アカウントロックを解除しました',
    };
  }

  /**
   * 2FAをリセット
   */
  async reset2FA(
    adminUserId: string,
    currentAdminId: string
  ): Promise<SystemAdminReset2FAResponse> {
    // 対象の管理者を取得
    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: { id: true, totpEnabled: true, deletedAt: true },
    });

    if (!targetAdmin) {
      throw new NotFoundError('管理者が見つかりません');
    }

    if (targetAdmin.deletedAt) {
      throw new NotFoundError('管理者が見つかりません');
    }

    // 2FAをリセット
    await prisma.adminUser.update({
      where: { id: adminUserId },
      data: {
        totpEnabled: false,
        totpSecret: null,
      },
    });

    // 監査ログを記録
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: currentAdminId,
        action: 'ADMIN_USER_RESET_2FA',
        targetType: 'AdminUser',
        targetId: adminUserId,
      },
    });

    // キャッシュを無効化
    await invalidateSystemAdminDetailCache(adminUserId);

    return {
      message: '2FA設定をリセットしました',
    };
  }

}
