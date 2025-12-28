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
   * @param userId ユーザーID
   * @param options オプション
   * @param options.includeDeleted 削除済み組織も含めるか（デフォルト: false）
   */
  async getOrganizations(userId: string, options: { includeDeleted?: boolean } = {}) {
    const { includeDeleted = false } = options;

    return prisma.organizationMember.findMany({
      where: {
        userId,
        organization: includeDeleted ? undefined : { deletedAt: null },
      },
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
            deletedAt: true,
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
   * @param userId ユーザーID
   * @param options 検索オプション
   * @param options.q 名前部分一致検索
   * @param options.organizationId 組織フィルタ（null指定で個人プロジェクトのみ）
   * @param options.includeDeleted 削除済みプロジェクトも含めるか（デフォルト: false）
   */
  async getProjects(
    userId: string,
    options: {
      q?: string;
      organizationId?: string | null;
      includeDeleted?: boolean;
    } = {}
  ) {
    const { q, organizationId, includeDeleted = false } = options;

    // 削除条件
    const deletedCondition = includeDeleted ? {} : { deletedAt: null };

    // 名前検索条件
    const nameCondition = q ? { name: { contains: q, mode: 'insensitive' as const } } : {};

    // 組織フィルタ条件
    // organizationId が undefined の場合: フィルタなし（全組織 + 個人）
    // organizationId が null の場合: 個人プロジェクトのみ
    // organizationId が文字列の場合: その組織のプロジェクトのみ
    const orgCondition =
      organizationId === undefined
        ? {}
        : organizationId === null
          ? { organizationId: null }
          : { organizationId };

    // ユーザーがオーナーのプロジェクト
    const ownedProjects = await prisma.project.findMany({
      where: {
        ownerId: userId,
        ...deletedCondition,
        ...nameCondition,
        ...orgCondition,
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
      where: {
        userId,
        project: {
          ...deletedCondition,
          ...nameCondition,
          ...orgCondition,
        },
      },
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
      // includeDeleted が true の場合は deletedAt チェックをスキップ
      const shouldInclude = includeDeleted || !m.project.deletedAt;
      if (!projectMap.has(m.project.id) && shouldInclude) {
        projectMap.set(m.project.id, { ...m.project, role: m.role });
      }
    }

    return Array.from(projectMap.values());
  }
}
