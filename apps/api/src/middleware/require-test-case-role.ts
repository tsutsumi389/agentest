import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, type ProjectRole } from '@agentest/db';
import { AuthenticationError, AuthorizationError, NotFoundError, BadRequestError } from '@agentest/shared';

const testCaseIdSchema = z.string().uuid();

export interface RequireTestCaseRoleOptions {
  /**
   * 削除済みテストケースへの操作を許可するか（デフォルト: false）
   * trueの場合、deletedAtがnullでないテストケースでも権限チェックを通過する
   */
  allowDeletedTestCase?: boolean;
}

/**
 * テストケース権限チェックミドルウェア
 * テストケースIDからテストスイート、親プロジェクトを取得し、プロジェクト権限をチェック
 *
 * @param roles - 必要なプロジェクトロールの配列
 * @param options - オプション設定
 */
export function requireTestCaseRole(roles: ProjectRole[], options: RequireTestCaseRoleOptions = {}) {
  const { allowDeletedTestCase = false } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated');
      }

      const user = req.user as { id: string };
      const testCaseId = req.params.testCaseId;

      if (!testCaseId) {
        throw new AuthorizationError('Test case ID required');
      }

      // UUID形式のバリデーション
      const parseResult = testCaseIdSchema.safeParse(testCaseId);
      if (!parseResult.success) {
        throw new BadRequestError('Invalid test case ID format');
      }

      // テストケース、テストスイート、プロジェクト情報を取得
      const testCase = await prisma.testCase.findUnique({
        where: { id: testCaseId },
        include: {
          testSuite: {
            include: {
              project: {
                include: {
                  members: {
                    where: { userId: user.id },
                  },
                },
              },
            },
          },
        },
      });

      if (!testCase) {
        throw new NotFoundError('TestCase', testCaseId);
      }

      // 削除済みテストケースのチェック
      if (testCase.deletedAt && !allowDeletedTestCase) {
        throw new NotFoundError('TestCase', testCaseId);
      }

      const testSuite = testCase.testSuite;

      // 削除済みテストスイートのチェック
      if (testSuite.deletedAt) {
        throw new AuthorizationError('Test suite has been deleted');
      }

      const project = testSuite.project;

      // 削除済みプロジェクトのチェック
      if (project.deletedAt) {
        throw new AuthorizationError('Project has been deleted');
      }

      // プロジェクトメンバーシップをチェック
      const member = project.members[0];
      if (member) {
        // OWNERロールは全権限を持つ
        if (member.role === 'OWNER') {
          req.params.projectId = project.id;
          req.params.testSuiteId = testSuite.id;
          return next();
        }
        // 指定されたロールを持っているか
        if (roles.includes(member.role)) {
          req.params.projectId = project.id;
          req.params.testSuiteId = testSuite.id;
          return next();
        }
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
          req.params.testSuiteId = testSuite.id;
          return next();
        }
      }

      throw new AuthorizationError('Insufficient permissions');
    } catch (error) {
      next(error);
    }
  };
}
