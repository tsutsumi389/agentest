import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, type ProjectRole } from '@agentest/db';
import { AuthenticationError, AuthorizationError, NotFoundError, BadRequestError } from '@agentest/shared';

const executionIdSchema = z.string().uuid();

export interface RequireExecutionRoleOptions {
  /**
   * 完了済み実行への操作を許可するか（デフォルト: true）
   * falseの場合、完了済み・中止済みの実行では権限チェックを通過しない
   */
  allowCompletedExecution?: boolean;
}

/**
 * 実行権限チェックミドルウェア
 * 実行IDからテストスイート、親プロジェクトを取得し、プロジェクト権限をチェック
 *
 * @param roles - 必要なプロジェクトロールの配列
 * @param options - オプション設定
 */
export function requireExecutionRole(roles: ProjectRole[], options: RequireExecutionRoleOptions = {}) {
  const { allowCompletedExecution = true } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated');
      }

      const user = req.user as { id: string };
      const executionId = req.params.executionId;

      if (!executionId) {
        throw new AuthorizationError('Execution ID required');
      }

      // UUID形式のバリデーション
      const parseResult = executionIdSchema.safeParse(executionId);
      if (!parseResult.success) {
        throw new BadRequestError('Invalid execution ID format');
      }

      // 実行、テストスイート、プロジェクト情報を取得
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
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

      if (!execution) {
        throw new NotFoundError('Execution', executionId);
      }

      // 完了済み実行のチェック
      if (!allowCompletedExecution && execution.status !== 'IN_PROGRESS') {
        throw new AuthorizationError('Execution is not in progress');
      }

      const testSuite = execution.testSuite;

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
