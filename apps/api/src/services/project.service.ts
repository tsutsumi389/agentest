import { prisma, type ProjectRole, type ChangeType, type Prisma } from '@agentest/db';
import { NotFoundError, ConflictError, ValidationError } from '@agentest/shared';
import { ProjectRepository } from '../repositories/project.repository.js';

// 復元可能な期間（30日）
const RESTORE_LIMIT_DAYS = 30;

/**
 * プロジェクトサービス
 */
export class ProjectService {
  private projectRepo = new ProjectRepository();

  /**
   * プロジェクトを作成
   */
  async create(userId: string, data: { name: string; description?: string | null; organizationId?: string | null }) {
    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        organizationId: data.organizationId,
        ownerId: data.organizationId ? null : userId,
      },
    });

    // 履歴を作成
    await this.createHistory(project.id, userId, 'CREATE', {
      name: project.name,
      description: project.description,
      organizationId: project.organizationId,
      ownerId: project.ownerId,
    });

    return project;
  }

  /**
   * プロジェクトをIDで検索
   */
  async findById(projectId: string) {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }
    return project;
  }

  /**
   * プロジェクトを更新
   */
  async update(projectId: string, data: { name?: string; description?: string | null }, userId?: string) {
    const project = await this.findById(projectId);
    const updatedProject = await this.projectRepo.update(projectId, data);

    // 履歴を作成
    await this.createHistory(projectId, userId, 'UPDATE', {
      before: {
        name: project.name,
        description: project.description,
      },
      after: {
        name: updatedProject.name,
        description: updatedProject.description,
      },
    });

    return updatedProject;
  }

  /**
   * プロジェクトを論理削除
   */
  async softDelete(projectId: string, userId?: string) {
    const project = await this.findById(projectId);
    const result = await this.projectRepo.softDelete(projectId);

    // 履歴を作成
    await this.createHistory(projectId, userId, 'DELETE', {
      name: project.name,
      description: project.description,
      organizationId: project.organizationId,
      ownerId: project.ownerId,
    });

    return result;
  }

  /**
   * メンバー一覧を取得
   */
  async getMembers(projectId: string) {
    const project = await this.findById(projectId);

    const members = await prisma.projectMember.findMany({
      where: { projectId },
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
      orderBy: { addedAt: 'asc' },
    });

    // オーナーを追加
    if (project.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: project.ownerId },
        select: { id: true, email: true, name: true, avatarUrl: true },
      });
      if (owner) {
        return [{ user: owner, role: 'OWNER', addedAt: project.createdAt }, ...members];
      }
    }

    return members;
  }

  /**
   * メンバーを追加
   */
  async addMember(projectId: string, userId: string, role: ProjectRole) {
    await this.findById(projectId);

    // 既にメンバーかチェック
    const existing = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    if (existing) {
      throw new ConflictError('このユーザーは既にメンバーです');
    }

    return prisma.projectMember.create({
      data: { projectId, userId, role },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * メンバーのロールを更新
   */
  async updateMemberRole(projectId: string, userId: string, role: ProjectRole) {
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    if (!member) {
      throw new NotFoundError('ProjectMember');
    }

    return prisma.projectMember.update({
      where: {
        projectId_userId: { projectId, userId },
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
  async removeMember(projectId: string, userId: string) {
    const project = await this.findById(projectId);

    if (project.ownerId === userId) {
      throw new ConflictError('プロジェクトオーナーは削除できません');
    }

    return prisma.projectMember.delete({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
  }

  /**
   * 環境一覧を取得
   */
  async getEnvironments(projectId: string) {
    await this.findById(projectId);

    return prisma.projectEnvironment.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * 環境を作成
   */
  async createEnvironment(
    projectId: string,
    data: { name: string; slug: string; baseUrl?: string | null; description?: string | null; isDefault?: boolean }
  ) {
    await this.findById(projectId);

    // スラッグの重複チェック
    const existing = await prisma.projectEnvironment.findUnique({
      where: {
        projectId_slug: { projectId, slug: data.slug },
      },
    });

    if (existing) {
      throw new ConflictError('このスラッグは既に使用されています');
    }

    // デフォルト環境の場合、他のデフォルトを解除
    if (data.isDefault) {
      await prisma.projectEnvironment.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // 次のソート順を取得
    const maxOrder = await prisma.projectEnvironment.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });

    return prisma.projectEnvironment.create({
      data: {
        projectId,
        name: data.name,
        slug: data.slug,
        baseUrl: data.baseUrl,
        description: data.description,
        isDefault: data.isDefault ?? false,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
  }

  /**
   * 環境を更新
   */
  async updateEnvironment(
    projectId: string,
    environmentId: string,
    data: { name?: string; slug?: string; baseUrl?: string | null; description?: string | null; isDefault?: boolean }
  ) {
    await this.findById(projectId);

    // 環境が存在するか確認
    const environment = await prisma.projectEnvironment.findUnique({
      where: { id: environmentId },
    });

    if (!environment || environment.projectId !== projectId) {
      throw new NotFoundError('Environment', environmentId);
    }

    // スラッグの重複チェック（変更がある場合のみ）
    if (data.slug && data.slug !== environment.slug) {
      const existing = await prisma.projectEnvironment.findUnique({
        where: {
          projectId_slug: { projectId, slug: data.slug },
        },
      });

      if (existing) {
        throw new ConflictError('このスラッグは既に使用されています');
      }
    }

    // トランザクションでデフォルト切替と更新を実行
    return prisma.$transaction(async (tx) => {
      // デフォルト環境の場合、他のデフォルトを解除
      if (data.isDefault && !environment.isDefault) {
        await tx.projectEnvironment.updateMany({
          where: { projectId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.projectEnvironment.update({
        where: { id: environmentId },
        data,
      });
    });
  }

  /**
   * 環境を削除
   */
  async deleteEnvironment(projectId: string, environmentId: string) {
    await this.findById(projectId);

    // 環境が存在するか確認
    const environment = await prisma.projectEnvironment.findUnique({
      where: { id: environmentId },
    });

    if (!environment || environment.projectId !== projectId) {
      throw new NotFoundError('Environment', environmentId);
    }

    // 実行中のテストで使用されていないかチェック
    const inProgressExecution = await prisma.execution.findFirst({
      where: {
        environmentId,
        status: 'IN_PROGRESS',
      },
    });

    if (inProgressExecution) {
      throw new ConflictError('この環境は実行中のテストで使用されているため削除できません');
    }

    // トランザクションで削除とデフォルト昇格を実行
    return prisma.$transaction(async (tx) => {
      // 環境を削除
      await tx.projectEnvironment.delete({
        where: { id: environmentId },
      });

      // デフォルト環境を削除した場合、最もsortOrderが若い環境を新デフォルトに昇格
      if (environment.isDefault) {
        const nextDefault = await tx.projectEnvironment.findFirst({
          where: { projectId },
          orderBy: { sortOrder: 'asc' },
        });

        if (nextDefault) {
          await tx.projectEnvironment.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          });
        }
      }
    });
  }

  /**
   * 環境の並び順を更新
   */
  async reorderEnvironments(projectId: string, environmentIds: string[]) {
    await this.findById(projectId);

    // 指定されたすべての環境がこのプロジェクトに属しているか確認
    const environments = await prisma.projectEnvironment.findMany({
      where: { projectId },
      select: { id: true },
    });

    const projectEnvIds = new Set(environments.map((e) => e.id));

    for (const id of environmentIds) {
      if (!projectEnvIds.has(id)) {
        throw new NotFoundError('Environment', id);
      }
    }

    // sortOrderを一括更新
    await prisma.$transaction(
      environmentIds.map((id, index) =>
        prisma.projectEnvironment.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    return prisma.projectEnvironment.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * テストスイート一覧を取得
   */
  async getTestSuites(projectId: string) {
    await this.findById(projectId);

    return prisma.testSuite.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { testCases: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 履歴を作成
   */
  async createHistory(
    projectId: string,
    userId: string | undefined,
    changeType: ChangeType,
    snapshot: Prisma.InputJsonValue,
    changeReason?: string
  ) {
    return this.projectRepo.createHistory({
      projectId,
      changedByUserId: userId,
      changeType,
      snapshot,
      changeReason,
    });
  }

  /**
   * 履歴一覧を取得
   */
  async getHistories(projectId: string, options?: { limit?: number; offset?: number }) {
    // 削除済みプロジェクトでも履歴は取得可能
    const project = await this.projectRepo.findById(projectId);
    const deletedProject = await this.projectRepo.findDeletedById(projectId);

    if (!project && !deletedProject) {
      throw new NotFoundError('Project', projectId);
    }

    const [histories, total] = await Promise.all([
      this.projectRepo.getHistories(projectId, options),
      this.projectRepo.countHistories(projectId),
    ]);

    return { histories, total };
  }

  /**
   * プロジェクトを復元
   */
  async restore(projectId: string, userId?: string) {
    const project = await this.projectRepo.findDeletedById(projectId);

    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    // 30日以内かチェック
    const deletedAt = project.deletedAt!;
    const now = new Date();
    const daysSinceDeleted = Math.floor((now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceDeleted > RESTORE_LIMIT_DAYS) {
      throw new ValidationError(`削除から${RESTORE_LIMIT_DAYS}日以上経過しているため復元できません`);
    }

    const restoredProject = await this.projectRepo.restore(projectId);

    // 復元履歴を作成
    await this.createHistory(projectId, userId, 'RESTORE', {
      name: restoredProject.name,
      description: restoredProject.description,
      organizationId: restoredProject.organizationId,
      ownerId: restoredProject.ownerId,
    });

    return restoredProject;
  }
}
