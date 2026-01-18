import { prisma } from '@agentest/db';

/**
 * 内部API用認可ヘルパーサービス
 * MCPサーバーからの内部API呼び出し時に、ユーザーのアクセス権限を確認する
 */
export class InternalAuthorizationService {
  /**
   * ユーザーがプロジェクトにアクセスできるか確認
   * アクセス可能条件:
   * 1. ProjectMemberとして登録されている
   * 2. プロジェクトが所属する組織のOrganizationMemberである
   *
   * @param userId ユーザーID
   * @param projectId プロジェクトID
   * @returns アクセス可能な場合true
   */
  async canAccessProject(userId: string, projectId: string): Promise<boolean> {
    // プロジェクトの存在確認と情報取得
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        organizationId: true,
        deletedAt: true,
      },
    });

    // プロジェクトが存在しないか削除済みの場合はアクセス不可
    if (!project || project.deletedAt) {
      return false;
    }

    // 1. ProjectMemberとして登録されているかチェック
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (projectMember) {
      return true;
    }

    // 2. 組織経由のアクセス確認（プロジェクトが組織に属している場合）
    if (project.organizationId) {
      const orgMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: project.organizationId,
            userId,
          },
        },
      });

      if (orgMember) {
        return true;
      }
    }

    return false;
  }

  /**
   * ユーザーがテストスイートにアクセスできるか確認
   * テストスイートのプロジェクトへのアクセス権限を確認する
   *
   * @param userId ユーザーID
   * @param testSuiteId テストスイートID
   * @returns アクセス可能な場合true
   */
  async canAccessTestSuite(userId: string, testSuiteId: string): Promise<boolean> {
    // テストスイートの存在確認とプロジェクトID取得
    const testSuite = await prisma.testSuite.findUnique({
      where: { id: testSuiteId },
      select: {
        id: true,
        projectId: true,
        deletedAt: true,
      },
    });

    // テストスイートが存在しないか削除済みの場合はアクセス不可
    if (!testSuite || testSuite.deletedAt) {
      return false;
    }

    // プロジェクトへのアクセス権限を確認
    return this.canAccessProject(userId, testSuite.projectId);
  }

  /**
   * ユーザーがアクセス可能なプロジェクトIDの一覧を取得
   * getTestSuitesなどで使用するユーティリティメソッド
   *
   * @param userId ユーザーID
   * @returns アクセス可能なプロジェクトIDの配列
   */
  async getAccessibleProjectIds(userId: string): Promise<string[]> {
    // ProjectMemberとして直接参加しているプロジェクト（削除済みを除外）
    const directProjects = await prisma.projectMember.findMany({
      where: {
        userId,
        project: { deletedAt: null },
      },
      select: { projectId: true },
    });

    // ユーザーが所属する組織のプロジェクト（削除済みを除外）
    const orgProjects = await prisma.project.findMany({
      where: {
        organization: {
          members: {
            some: { userId },
          },
        },
        deletedAt: null,
      },
      select: { id: true },
    });

    // 重複を除いて結合
    const projectIds = new Set([
      ...directProjects.map((p) => p.projectId),
      ...orgProjects.map((p) => p.id),
    ]);

    return Array.from(projectIds);
  }

  /**
   * ユーザーがプロジェクトに書き込みできるか確認
   * 書き込み可能条件:
   * 1. ProjectMemberとしてOWNER, ADMIN, WRITEロールを持つ
   * 2. プロジェクトが所属する組織でOWNER, ADMINロールを持つ
   *
   * @param userId ユーザーID
   * @param projectId プロジェクトID
   * @returns 書き込み可能な場合true
   */
  async canWriteToProject(userId: string, projectId: string): Promise<boolean> {
    // プロジェクトの存在確認と情報取得
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        organizationId: true,
        deletedAt: true,
      },
    });

    // プロジェクトが存在しないか削除済みの場合は書き込み不可
    if (!project || project.deletedAt) {
      return false;
    }

    // 1. ProjectMemberとしてOWNER, ADMIN, WRITEロールを持つかチェック
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (projectMember && ['OWNER', 'ADMIN', 'WRITE'].includes(projectMember.role)) {
      return true;
    }

    // 2. 組織経由の書き込み権限確認（プロジェクトが組織に属している場合）
    if (project.organizationId) {
      const orgMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: project.organizationId,
            userId,
          },
        },
      });

      if (orgMember && ['OWNER', 'ADMIN'].includes(orgMember.role)) {
        return true;
      }
    }

    return false;
  }

  /**
   * ユーザーがテストスイートに書き込みできるか確認
   * テストスイートのプロジェクトへの書き込み権限を確認する
   *
   * @param userId ユーザーID
   * @param testSuiteId テストスイートID
   * @returns 書き込み可能な場合true
   */
  async canWriteToTestSuite(userId: string, testSuiteId: string): Promise<boolean> {
    // テストスイートの存在確認とプロジェクトID取得
    const testSuite = await prisma.testSuite.findUnique({
      where: { id: testSuiteId },
      select: {
        id: true,
        projectId: true,
        deletedAt: true,
      },
    });

    // テストスイートが存在しないか削除済みの場合は書き込み不可
    if (!testSuite || testSuite.deletedAt) {
      return false;
    }

    // プロジェクトへの書き込み権限を確認
    return this.canWriteToProject(userId, testSuite.projectId);
  }

  /**
   * ユーザーが実行に書き込みできるか確認
   * 書き込み可能条件:
   * 1. 実行が存在する
   * 2. 実行のテストスイートへの書き込み権限を持つ
   *
   * @param userId ユーザーID
   * @param executionId 実行ID
   * @returns 書き込み可能な場合true
   */
  async canWriteToExecution(userId: string, executionId: string): Promise<boolean> {
    // 実行の存在確認とテストスイートID取得
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      select: {
        id: true,
        testSuiteId: true,
      },
    });

    // 実行が存在しない場合は書き込み不可
    if (!execution) {
      return false;
    }

    // テストスイートへの書き込み権限を確認
    return this.canWriteToTestSuite(userId, execution.testSuiteId);
  }
}
