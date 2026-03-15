import { prisma } from '@agentest/db';
import {
  NotFoundError,
  ConflictError,
  AuthorizationError,
  DELETION_GRACE_PERIOD_DAYS,
} from '@agentest/shared';
import { OrganizationRepository } from '../repositories/organization.repository.js';
import { auditLogService } from './audit-log.service.js';
import { notificationService } from './notification.service.js';

/**
 * 組織サービス
 */
export class OrganizationService {
  private orgRepo = new OrganizationRepository();

  /**
   * 組織を作成
   */
  async create(userId: string, data: { name: string; description?: string }) {
    // トランザクションで組織とオーナーメンバーシップを作成
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.name,
          description: data.description,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId,
          role: 'OWNER',
        },
      });

      return org;
    });

    // 監査ログを記録
    await auditLogService.log({
      userId,
      organizationId: organization.id,
      category: 'ORGANIZATION',
      action: 'organization.created',
      targetType: 'Organization',
      targetId: organization.id,
      details: { name: data.name },
    });

    return organization;
  }

  /**
   * 組織をIDで検索
   */
  async findById(organizationId: string) {
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw new NotFoundError('Organization', organizationId);
    }
    return org;
  }

  /**
   * 組織を更新
   */
  async update(
    organizationId: string,
    data: { name?: string; description?: string | null },
    userId?: string
  ) {
    await this.findById(organizationId);
    const organization = await this.orgRepo.update(organizationId, data);

    // 監査ログを記録
    await auditLogService.log({
      userId,
      organizationId,
      category: 'ORGANIZATION',
      action: 'organization.updated',
      targetType: 'Organization',
      targetId: organizationId,
      details: data,
    });

    return organization;
  }

  /**
   * 組織を論理削除
   */
  async softDelete(organizationId: string, userId?: string) {
    const org = await this.findById(organizationId);
    const result = await this.orgRepo.softDelete(organizationId);

    // 監査ログを記録
    await auditLogService.log({
      userId,
      organizationId,
      category: 'ORGANIZATION',
      action: 'organization.deleted',
      targetType: 'Organization',
      targetId: organizationId,
      details: { name: org.name },
    });

    return result;
  }

  /**
   * メンバー一覧を取得
   */
  async getMembers(organizationId: string) {
    await this.findById(organizationId);

    return prisma.organizationMember.findMany({
      where: { organizationId },
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
      orderBy: { joinedAt: 'asc' },
    });
  }

  /**
   * 招待を送信
   */
  async invite(
    organizationId: string,
    invitedByUserId: string,
    data: { email: string; role: 'ADMIN' | 'MEMBER' }
  ) {
    await this.findById(organizationId);

    // 既存ユーザーが既にメンバーかチェック
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      const existingMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMember) {
        throw new ConflictError('このユーザーは既にメンバーです');
      }
    }

    // 保留中の招待が既にあるかチェック
    const existingInvitation = await prisma.organizationInvitation.findFirst({
      where: {
        organizationId,
        email: data.email,
        acceptedAt: null,
        declinedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      throw new ConflictError('このメールアドレスには既に保留中の招待があります');
    }

    // トークン生成
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7日

    const invitation = await prisma.organizationInvitation.create({
      data: {
        organizationId,
        email: data.email,
        role: data.role,
        token,
        invitedByUserId,
        expiresAt,
      },
    });

    // 監査ログを記録
    await auditLogService.log({
      userId: invitedByUserId,
      organizationId,
      category: 'MEMBER',
      action: 'member.invited',
      targetType: 'OrganizationInvitation',
      targetId: invitation.id,
      details: { email: data.email, role: data.role },
    });

    // 既存ユーザーに通知を送信（メール含む）
    let emailSent = false;
    if (existingUser) {
      const inviter = await prisma.user.findUnique({
        where: { id: invitedByUserId },
        select: { name: true },
      });
      const org = await this.findById(organizationId);

      await notificationService.send({
        userId: existingUser.id,
        type: 'ORG_INVITATION',
        title: `${org.name}への招待`,
        body: `${inviter?.name || 'メンバー'}さんから組織「${org.name}」への招待が届いています`,
        data: { organizationId, inviteToken: token },
        organizationId,
      });
      emailSent = true;
    }

    return { invitation, emailSent };
  }

  /**
   * トークンで招待詳細を取得（認証不要）
   */
  async getInvitationByToken(token: string) {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundError('Invitation');
    }

    // 招待の状態を判定
    let status: 'pending' | 'accepted' | 'declined' | 'expired' = 'pending';
    if (invitation.acceptedAt) {
      status = 'accepted';
    } else if (invitation.declinedAt) {
      status = 'declined';
    } else if (invitation.expiresAt < new Date()) {
      status = 'expired';
    }

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      status,
      organization: invitation.organization,
      invitedBy: invitation.invitedBy,
    };
  }

  /**
   * 招待を承認
   */
  async acceptInvitation(token: string, userId: string) {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) {
      throw new NotFoundError('Invitation');
    }

    if (invitation.acceptedAt || invitation.declinedAt) {
      throw new ConflictError('この招待は既に処理されています');
    }

    if (invitation.expiresAt < new Date()) {
      throw new ConflictError('この招待は期限切れです');
    }

    // ユーザーのメールアドレスを確認
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.email) {
      throw new AuthorizationError('この招待はあなた宛てではありません');
    }

    // トランザクションで処理
    const member = await prisma.$transaction(async (tx) => {
      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return tx.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
        },
        include: {
          organization: true,
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });
    });

    // 監査ログを記録
    await auditLogService.log({
      userId,
      organizationId: invitation.organizationId,
      category: 'MEMBER',
      action: 'member.invitation_accepted',
      targetType: 'OrganizationMember',
      targetId: member.id,
      details: { email: invitation.email, role: invitation.role },
    });

    // 招待した人に通知を送信
    if (invitation.invitedByUserId) {
      const acceptedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      await notificationService.send({
        userId: invitation.invitedByUserId,
        type: 'INVITATION_ACCEPTED',
        title: '招待が承諾されました',
        body: `${acceptedUser?.name || 'ユーザー'}さんが組織「${invitation.organization.name}」への招待を承諾しました`,
        data: { organizationId: invitation.organizationId, userId },
        organizationId: invitation.organizationId,
      });
    }

    return member;
  }

  /**
   * メンバーのロールを更新
   * 注意: OWNERへの変更はtransferOwnershipを使用すること
   */
  async updateMemberRole(
    organizationId: string,
    targetUserId: string,
    role: 'ADMIN' | 'MEMBER',
    performedByUserId?: string
  ) {
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
    });

    if (!member) {
      throw new NotFoundError('OrganizationMember');
    }

    const previousRole = member.role;

    // OWNERのロール変更は不可（transferOwnershipを使用）
    if (member.role === 'OWNER') {
      throw new ConflictError(
        'オーナーのロールは変更できません。オーナー権限移譲を使用してください'
      );
    }

    const updatedMember = await prisma.organizationMember.update({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
      data: { role },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    // 監査ログを記録
    await auditLogService.log({
      userId: performedByUserId,
      organizationId,
      category: 'MEMBER',
      action: 'member.role_updated',
      targetType: 'OrganizationMember',
      targetId: member.id,
      details: {
        targetUserId,
        previousRole,
        newRole: role,
      },
    });

    return updatedMember;
  }

  /**
   * メンバーを削除
   */
  async removeMember(organizationId: string, targetUserId: string, performedByUserId?: string) {
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    });

    if (!member) {
      throw new NotFoundError('OrganizationMember');
    }

    if (member.role === 'OWNER') {
      throw new ConflictError('オーナーは削除できません。先にオーナーを変更してください');
    }

    const result = await prisma.organizationMember.delete({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
    });

    // 監査ログを記録
    await auditLogService.log({
      userId: performedByUserId,
      organizationId,
      category: 'MEMBER',
      action: 'member.removed',
      targetType: 'OrganizationMember',
      targetId: member.id,
      details: {
        targetUserId,
        email: member.user.email,
        role: member.role,
      },
    });

    return result;
  }

  /**
   * 組織のプロジェクト一覧を取得
   */
  async getProjects(organizationId: string) {
    await this.findById(organizationId);

    return prisma.project.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { testSuites: true, members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 保留中の招待一覧を取得
   */
  async getPendingInvitations(organizationId: string) {
    await this.findById(organizationId);

    return prisma.organizationInvitation.findMany({
      where: {
        organizationId,
        acceptedAt: null,
        declinedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 招待を取消
   */
  async cancelInvitation(organizationId: string, invitationId: string, userId?: string) {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundError('Invitation', invitationId);
    }

    if (invitation.organizationId !== organizationId) {
      throw new AuthorizationError('この招待を取消す権限がありません');
    }

    if (invitation.acceptedAt || invitation.declinedAt) {
      throw new ConflictError('この招待は既に処理されています');
    }

    // 招待を削除
    const result = await prisma.organizationInvitation.delete({
      where: { id: invitationId },
    });

    // 監査ログを記録
    await auditLogService.log({
      userId,
      organizationId,
      category: 'MEMBER',
      action: 'member.invitation_cancelled',
      targetType: 'OrganizationInvitation',
      targetId: invitationId,
      details: { email: invitation.email, role: invitation.role },
    });

    return result;
  }

  /**
   * 招待を辞退
   */
  async declineInvitation(token: string, userId: string) {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) {
      throw new NotFoundError('Invitation');
    }

    if (invitation.acceptedAt || invitation.declinedAt) {
      throw new ConflictError('この招待は既に処理されています');
    }

    if (invitation.expiresAt < new Date()) {
      throw new ConflictError('この招待は期限切れです');
    }

    // ユーザーのメールアドレスを確認
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.email) {
      throw new AuthorizationError('この招待はあなた宛てではありません');
    }

    const result = await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { declinedAt: new Date() },
      include: { organization: true },
    });

    // 監査ログを記録
    await auditLogService.log({
      userId,
      organizationId: invitation.organizationId,
      category: 'MEMBER',
      action: 'member.invitation_declined',
      targetType: 'OrganizationInvitation',
      targetId: invitation.id,
      details: { email: invitation.email },
    });

    return result;
  }

  /**
   * 組織を復元
   */
  async restore(organizationId: string, userId: string) {
    // 削除済み組織を取得
    const org = await this.orgRepo.findDeletedById(organizationId);
    if (!org) {
      throw new NotFoundError('Organization', organizationId);
    }

    // 猶予期間チェック
    const deletedAt = new Date(org.deletedAt!);
    const permanentDeletionDate = new Date(deletedAt);
    permanentDeletionDate.setDate(permanentDeletionDate.getDate() + DELETION_GRACE_PERIOD_DAYS);

    if (new Date() > permanentDeletionDate) {
      throw new ConflictError('復元期間（30日間）を過ぎています。この組織は復元できません');
    }

    // 復元実行
    const restoredOrg = await this.orgRepo.restore(organizationId);

    // 監査ログを記録
    await auditLogService.log({
      userId,
      organizationId,
      category: 'ORGANIZATION',
      action: 'organization.restored',
      targetType: 'Organization',
      targetId: organizationId,
      details: { name: org.name },
    });

    return restoredOrg;
  }

  /**
   * オーナー権限を移譲
   */
  async transferOwnership(organizationId: string, currentOwnerId: string, newOwnerId: string) {
    // 組織の存在確認（論理削除されている場合はエラー）
    await this.findById(organizationId);

    // 自分自身への移譲は不可
    if (currentOwnerId === newOwnerId) {
      throw new ConflictError('自分自身にオーナー権限を移譲することはできません');
    }

    // 現在のオーナーを確認
    const currentOwner = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: currentOwnerId },
      },
    });

    if (!currentOwner || currentOwner.role !== 'OWNER') {
      throw new AuthorizationError('オーナー権限を移譲する権限がありません');
    }

    // 新オーナーがメンバーか確認
    const newOwner = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: newOwnerId },
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    if (!newOwner) {
      throw new NotFoundError('OrganizationMember', newOwnerId);
    }

    // トランザクションで権限を移譲
    const updatedNewOwner = await prisma.$transaction(async (tx) => {
      // 現オーナーをADMINに変更
      await tx.organizationMember.update({
        where: {
          organizationId_userId: { organizationId, userId: currentOwnerId },
        },
        data: { role: 'ADMIN' },
      });

      // 新オーナーをOWNERに変更
      return tx.organizationMember.update({
        where: {
          organizationId_userId: { organizationId, userId: newOwnerId },
        },
        data: { role: 'OWNER' },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });
    });

    // 監査ログを記録
    await auditLogService.log({
      userId: currentOwnerId,
      organizationId,
      category: 'ORGANIZATION',
      action: 'organization.ownership_transferred',
      targetType: 'Organization',
      targetId: organizationId,
      details: {
        previousOwnerId: currentOwnerId,
        newOwnerId,
        newOwnerEmail: updatedNewOwner.user.email,
      },
    });

    return updatedNewOwner;
  }
}
