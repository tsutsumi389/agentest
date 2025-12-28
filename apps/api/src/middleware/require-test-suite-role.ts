import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, type ProjectRole } from '@agentest/db';
import { AuthenticationError, AuthorizationError, NotFoundError, BadRequestError } from '@agentest/shared';

const testSuiteIdSchema = z.string().uuid();

export interface RequireTestSuiteRoleOptions {
  /**
   * 削除済みテストスイートへの操作を許可するか（デフォルト: false）
   * trueの場合、deletedAtがnullでないテストスイートでも権限チェックを通過する
   */
  allowDeletedSuite?: boolean;
}

/**
 * テストスイート権限チェックミドルウェア
 * テストスイートIDから親プロジェクトを取得し、プロジェクト権限をチェック
 *
 * @param roles - 必要なプロジェクトロールの配列
 * @param options - オプション設定
 */
export function requireTestSuiteRole(roles: ProjectRole[], options: RequireTestSuiteRoleOptions = {}) {
  const { allowDeletedSuite = false } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated');
      }

      const user = req.user as { id: string };
      const testSuiteId = req.params.testSuiteId;

      if (!testSuiteId) {
        throw new AuthorizationError('Test suite ID required');
      }

      // UUID形式のバリデーション
      const parseResult = testSuiteIdSchema.safeParse(testSuiteId);
      if (!parseResult.success) {
        throw new BadRequestError('Invalid test suite ID format');
      }

      // テストスイートとプロジェクト情報を取得
      const testSuite = await prisma.testSuite.findUnique({
        where: { id: testSuiteId },
        include: {
          project: {
            include: {
              members: {
                where: { userId: user.id },
              },
            },
          },
        },
      });

      if (!testSuite) {
        throw new NotFoundError('TestSuite', testSuiteId);
      }

      // 削除済みテストスイートのチェック
      if (testSuite.deletedAt && !allowDeletedSuite) {
        throw new NotFoundError('TestSuite', testSuiteId);
      }

      const project = testSuite.project;

      // 削除済みプロジェクトのチェック
      if (project.deletedAt) {
        throw new AuthorizationError('Project has been deleted');
      }

      // プロジェクトオーナーは全権限を持つ
      if (project.ownerId === user.id) {
        // リクエストにプロジェクトIDを設定（後続の処理で使用可能）
        req.params.projectId = project.id;
        return next();
      }

      // プロジェクトメンバーシップをチェック
      const member = project.members[0];
      if (member && roles.includes(member.role)) {
        req.params.projectId = project.id;
        return next();
      }

      // プロジェクトが組織に属する場合、組織メンバーシップをチェック
      if (project.organizationId) {
        const orgMember = await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: project.organizationId,
              userId: user.id,
            },
          },
        });

        if (orgMember && ['OWNER', 'ADMIN'].includes(orgMember.role)) {
          req.params.projectId = project.id;
          return next();
        }
      }

      throw new AuthorizationError('Insufficient permissions');
    } catch (error) {
      next(error);
    }
  };
}
