import { prisma, type ProjectRole } from '@agentest/db';

/**
 * 認可サービス
 * プロジェクトや組織の権限チェックを行う共通サービス
 */
export class AuthorizationService {
  /**
   * ユーザーのプロジェクト権限を確認
   * @param userId ユーザーID
   * @param projectId プロジェクトID
   * @param requiredRoles 必要なロール（OWNERは常に権限あり）
   * @returns 権限がある場合はtrue
   */
  async checkProjectRole(
    userId: string,
    projectId: string,
    requiredRoles: ProjectRole[]
  ): Promise<boolean> {
    // プロジェクトメンバーシップをチェック
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    if (projectMember) {
      if (projectMember.role === 'OWNER' || requiredRoles.includes(projectMember.role)) {
        return true;
      }
    }

    // プロジェクトの組織情報を取得
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    // 組織メンバーシップをチェック（OWNER/ADMINは全プロジェクトにアクセス可能）
    if (project?.organizationId) {
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
}

// シングルトンインスタンス
export const authorizationService = new AuthorizationService();
