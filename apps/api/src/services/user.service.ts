import { prisma } from '@agentest/db';
import { NotFoundError } from '@agentest/shared';
import { UserRepository } from '../repositories/user.repository.js';

/**
 * ユーザーサービス
 */
export class UserService {
  private userRepo = new UserRepository();

  /**
   * ユーザーをIDで検索
   */
  async findById(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return user;
  }

  /**
   * ユーザーを更新
   */
  async update(userId: string, data: { name?: string; avatarUrl?: string | null }) {
    const user = await this.findById(userId);
    return this.userRepo.update(user.id, data);
  }

  /**
   * ユーザーを論理削除
   */
  async softDelete(userId: string) {
    await this.findById(userId);
    return this.userRepo.softDelete(userId);
  }

  /**
   * ユーザーの組織一覧を取得
   */
  async getOrganizations(userId: string) {
    return prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            avatarUrl: true,
            plan: true,
            createdAt: true,
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  /**
   * ユーザーのプロジェクト一覧を取得
   */
  async getProjects(userId: string) {
    // ユーザーがオーナーのプロジェクト
    const ownedProjects = await prisma.project.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { testSuites: true },
        },
      },
    });

    // ユーザーがメンバーのプロジェクト
    const memberProjects = await prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            organization: {
              select: { id: true, name: true, slug: true },
            },
            _count: {
              select: { testSuites: true },
            },
          },
        },
      },
    });

    // 重複を排除してマージ
    const projectMap = new Map();
    for (const p of ownedProjects) {
      projectMap.set(p.id, { ...p, role: 'OWNER' });
    }
    for (const m of memberProjects) {
      if (!projectMap.has(m.project.id) && !m.project.deletedAt) {
        projectMap.set(m.project.id, { ...m.project, role: m.role });
      }
    }

    return Array.from(projectMap.values());
  }
}
