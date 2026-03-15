import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, type ProjectRole } from '@agentest/db';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  BadRequestError,
} from '@agentest/shared';

const commentIdSchema = z.string().uuid();

/**
 * レビューコメント権限チェックミドルウェア
 * コメントIDから対象リソース（スイート/ケース）を取得し、プロジェクト権限をチェック
 *
 * @param roles - 必要なプロジェクトロールの配列
 */
export function requireReviewCommentRole(roles: ProjectRole[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated');
      }

      const user = req.user as { id: string };
      const commentId = req.params.commentId;

      if (!commentId) {
        throw new AuthorizationError('Comment ID required');
      }

      // UUID形式のバリデーション
      const parseResult = commentIdSchema.safeParse(commentId);
      if (!parseResult.success) {
        throw new BadRequestError('Invalid comment ID format');
      }

      // コメント情報を取得
      const comment = await prisma.reviewComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundError('ReviewComment', commentId);
      }

      // 対象リソースのプロジェクトIDを取得
      let projectId: string;
      if (comment.targetType === 'SUITE') {
        const testSuite = await prisma.testSuite.findFirst({
          where: { id: comment.targetId, deletedAt: null },
          select: { projectId: true },
        });
        if (!testSuite) {
          throw new NotFoundError('TestSuite', comment.targetId);
        }
        projectId = testSuite.projectId;
      } else {
        const testCase = await prisma.testCase.findFirst({
          where: { id: comment.targetId, deletedAt: null },
          include: { testSuite: { select: { projectId: true } } },
        });
        if (!testCase) {
          throw new NotFoundError('TestCase', comment.targetId);
        }
        projectId = testCase.testSuite.projectId;
      }

      // プロジェクト情報を取得
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          members: {
            where: { userId: user.id },
          },
        },
      });

      if (!project) {
        throw new NotFoundError('Project', projectId);
      }

      // 削除済みプロジェクトのチェック
      if (project.deletedAt) {
        throw new AuthorizationError('Project has been deleted');
      }

      // プロジェクトメンバーシップをチェック
      const member = project.members[0];
      if (member) {
        // OWNERロールは全権限を持つ
        if (member.role === 'OWNER') {
          req.params.projectId = projectId;
          return next();
        }
        // 指定されたロールを持っているか
        if (roles.includes(member.role)) {
          req.params.projectId = projectId;
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
          req.params.projectId = projectId;
          return next();
        }
      }

      throw new AuthorizationError('Insufficient permissions');
    } catch (error) {
      next(error);
    }
  };
}
