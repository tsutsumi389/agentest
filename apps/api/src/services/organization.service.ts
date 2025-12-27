import { prisma } from '@agentest/db';
import { NotFoundError, ConflictError, AuthorizationError } from '@agentest/shared';
import { OrganizationRepository } from '../repositories/organization.repository.js';

/**
 * 組織サービス
 */
export class OrganizationService {
  private orgRepo = new OrganizationRepository();

  /**
   * 組織を作成
   */
  async create(userId: string, data: { name: string; slug: string; description?: string }) {
    // スラッグの重複チェック
    const existing = await prisma.organization.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      throw new ConflictError('このスラッグは既に使用されています');
    }

    // トランザクションで組織とオーナーメンバーシップを作成
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId,
          role: 'OWNER',
        },
      });

      return organization;
    });
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
  async update(organizationId: string, data: { name?: string; description?: string | null; billingEmail?: string | null }) {
    await this.findById(organizationId);
    return this.orgRepo.update(organizationId, data);
  }

  /**
   * 組織を論理削除
   */
  async softDelete(organizationId: string) {
    await this.findById(organizationId);
    return this.orgRepo.softDelete(organizationId);
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
  async invite(organizationId: string, invitedByUserId: string, data: { email: string; role: 'ADMIN' | 'MEMBER' }) {
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

    // トークン生成
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7日

    return prisma.organizationInvitation.create({
      data: {
        organizationId,
        email: data.email,
        role: data.role,
        token,
        invitedByUserId,
        expiresAt,
      },
    });
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
    return prisma.$transaction(async (tx) => {
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
  }

  /**
   * メンバーのロールを更新
   */
  async updateMemberRole(organizationId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    if (!member) {
      throw new NotFoundError('OrganizationMember');
    }

    // OWNERは一人だけ
    if (role === 'OWNER') {
      // 現在のOWNERをADMINに変更
      await prisma.organizationMember.updateMany({
        where: { organizationId, role: 'OWNER' },
        data: { role: 'ADMIN' },
      });
    }

    return prisma.organizationMember.update({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      data: { role },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * メンバーを削除
   */
  async removeMember(organizationId: string, userId: string) {
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    if (!member) {
      throw new NotFoundError('OrganizationMember');
    }

    if (member.role === 'OWNER') {
      throw new ConflictError('オーナーは削除できません。先にオーナーを変更してください');
    }

    return prisma.organizationMember.delete({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });
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
  async cancelInvitation(organizationId: string, invitationId: string) {
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
    return prisma.organizationInvitation.delete({
      where: { id: invitationId },
    });
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

    // ユーザーのメールアドレスを確認
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.email) {
      throw new AuthorizationError('この招待はあなた宛てではありません');
    }

    return prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { declinedAt: new Date() },
      include: { organization: true },
    });
  }
}
