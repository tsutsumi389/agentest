import { prisma, type ProjectRole, type ChangeType, type Prisma } from '@agentest/db';
import { NotFoundError, ConflictError, ValidationError } from '@agentest/shared';
import { ProjectRepository } from '../repositories/project.repository.js';
import {
  TestSuiteRepository,
  type TestSuiteSearchOptions,
} from '../repositories/test-suite.repository.js';
import { notificationService } from './notification.service.js';

// 復元可能な期間（30日）
const RESTORE_LIMIT_DAYS = 30;

/**
 * プロジェクトサービス
 */
export class ProjectService {
  private projectRepo = new ProjectRepository();
  private testSuiteRepo = new TestSuiteRepository();

  /**
   * プロジェクトを作成
   * プロジェクト作成時に作成者をOWNERロールでProjectMemberに登録する
   */
  async create(
    userId: string,
    data: { name: string; description?: string | null; organizationId?: string | null }
  ) {
    // 組織プロジェクトの場合、組織の存在確認を実行
    if (data.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: data.organizationId, deletedAt: null },
        select: { id: true },
      });

      // 組織が存在しない（または削除済み）場合はエラー
      if (!org) {
        throw new NotFoundError('Organization', data.organizationId);
      }
    }

    const project = await prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          name: data.name,
          description: data.description,
          organizationId: data.organizationId,
        },
      });

      // 作成者をOWNERとしてProjectMemberに登録
      await tx.projectMember.create({
        data: {
          projectId: newProject.id,
          userId,
          role: 'OWNER',
        },
      });

      // 履歴を作成
      await tx.projectHistory.create({
        data: {
          projectId: newProject.id,
          changedByUserId: userId,
          changeType: 'CREATE',
          snapshot: {
            name: newProject.name,
            description: newProject.description,
            organizationId: newProject.organizationId,
          },
        },
      });

      return newProject;
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
  async update(
    projectId: string,
    data: { name?: string; description?: string | null },
    userId?: string
  ) {
    const project = await this.findById(projectId);

    // トランザクションで更新と履歴作成を実行
    const updatedProject = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data,
      });

      await tx.projectHistory.create({
        data: {
          projectId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: {
            before: {
              name: project.name,
              description: project.description,
            },
            after: {
              name: updated.name,
              description: updated.description,
            },
          },
        },
      });

      return updated;
    });

    return updatedProject;
  }

  /**
   * プロジェクトを論理削除
   */
  async softDelete(projectId: string, userId?: string) {
    const project = await this.findById(projectId);

    // トランザクションで論理削除と履歴作成を実行
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.project.update({
        where: { id: projectId },
        data: { deletedAt: new Date() },
      });

      await tx.projectHistory.create({
        data: {
          projectId,
          changedByUserId: userId,
          changeType: 'DELETE',
          snapshot: {
            name: project.name,
            description: project.description,
            organizationId: project.organizationId,
          },
        },
      });

      return deleted;
    });

    return result;
  }

  /**
   * メンバー一覧を取得
   * OWNERも含めて全メンバーをProjectMemberテーブルから取得
   */
  async getMembers(projectId: string) {
    await this.findById(projectId);

    // OWNERを先頭に、その後は追加日時順でソート
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
      orderBy: [{ role: 'asc' }, { addedAt: 'asc' }],
    });

    return members;
  }

  /**
   * メンバーを追加
   */
  async addMember(projectId: string, userId: string, role: ProjectRole, addedByUserId?: string) {
    const project = await this.findById(projectId);

    // 既にメンバーかチェック
    const existing = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    if (existing) {
      throw new ConflictError('このユーザーは既にメンバーです');
    }

    const member = await prisma.projectMember.create({
      data: { projectId, userId, role },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    // 追加されたユーザーに通知を送信（自分自身を追加した場合は除外）
    if (addedByUserId && addedByUserId !== userId) {
      const addedByUser = await prisma.user.findUnique({
        where: { id: addedByUserId },
        select: { name: true },
      });

      await notificationService.send({
        userId,
        type: 'PROJECT_ADDED',
        title: 'プロジェクトに追加されました',
        body: `${addedByUser?.name || 'メンバー'}さんがあなたをプロジェクト「${project.name}」に追加しました`,
        data: { projectId, role },
        organizationId: project.organizationId ?? undefined,
      });
    }

    return member;
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

    // OWNERからの変更は禁止
    if (member.role === 'OWNER') {
      throw new ConflictError('オーナーのロールは変更できません');
    }

    // OWNERへの変更は禁止
    if (role === 'OWNER') {
      throw new ValidationError('OWNERロールへの変更はできません');
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
    await this.findById(projectId);

    // メンバーを取得してOWNERかチェック
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!member) {
      throw new NotFoundError('ProjectMember');
    }

    // OWNERロールのメンバーは削除不可
    if (member.role === 'OWNER') {
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
    data: {
      name: string;
      baseUrl?: string | null;
      description?: string | null;
      isDefault?: boolean;
    }
  ) {
    await this.findById(projectId);

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
    data: {
      name?: string;
      baseUrl?: string | null;
      description?: string | null;
      isDefault?: boolean;
    }
  ) {
    await this.findById(projectId);

    // 環境が存在するか確認
    const environment = await prisma.projectEnvironment.findUnique({
      where: { id: environmentId },
    });

    if (!environment || environment.projectId !== projectId) {
      throw new NotFoundError('Environment', environmentId);
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
   * テストスイートをサジェスト（@メンション用）
   */
  async suggestTestSuites(projectId: string, options: { q?: string; limit: number }) {
    // プロジェクトの存在確認
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }
    return this.testSuiteRepo.suggest(projectId, options);
  }

  /**
   * テストスイートを検索
   */
  async searchTestSuites(projectId: string, options: TestSuiteSearchOptions) {
    // プロジェクトの存在確認（削除済みプロジェクトは検索対象外）
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    return this.testSuiteRepo.search(projectId, options);
  }

  /**
   * 単独で履歴を作成（トランザクション外で使用）
   * 注意: CRUD操作の履歴はそれぞれのメソッド内でトランザクションにより保証されている。
   * このメソッドは外部から個別に履歴を追加する場合にのみ使用する。
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
    const daysSinceDeleted = Math.floor(
      (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceDeleted > RESTORE_LIMIT_DAYS) {
      throw new ValidationError(
        `削除から${RESTORE_LIMIT_DAYS}日以上経過しているため復元できません`
      );
    }

    // トランザクションで復元と履歴作成を実行
    const restoredProject = await prisma.$transaction(async (tx) => {
      const restored = await tx.project.update({
        where: { id: projectId },
        data: { deletedAt: null },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      });

      await tx.projectHistory.create({
        data: {
          projectId,
          changedByUserId: userId,
          changeType: 'RESTORE',
          snapshot: {
            name: restored.name,
            description: restored.description,
            organizationId: restored.organizationId,
          },
        },
      });

      return restored;
    });

    return restoredProject;
  }
}
