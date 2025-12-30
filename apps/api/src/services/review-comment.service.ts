import { prisma, type ReviewTargetType, type ReviewTargetField, type ReviewStatus, type ProjectRole } from '@agentest/db';
import { NotFoundError, AuthorizationError, BadRequestError } from '@agentest/shared';
import { ReviewCommentRepository, type ReviewCommentSearchOptions } from '../repositories/review-comment.repository.js';

/**
 * レビューコメント作成データ
 */
interface CreateCommentData {
  targetType: ReviewTargetType;
  targetId: string;
  targetField: ReviewTargetField;
  targetItemId?: string;
  content: string;
}

/**
 * レビューコメントサービス
 */
export class ReviewCommentService {
  private reviewCommentRepo = new ReviewCommentRepository();

  /**
   * 対象リソースの存在確認とプロジェクトID取得
   */
  private async getTargetProjectId(targetType: ReviewTargetType, targetId: string): Promise<string> {
    if (targetType === 'SUITE') {
      const testSuite = await prisma.testSuite.findFirst({
        where: { id: targetId, deletedAt: null },
        select: { projectId: true },
      });
      if (!testSuite) {
        throw new NotFoundError('TestSuite', targetId);
      }
      return testSuite.projectId;
    } else {
      const testCase = await prisma.testCase.findFirst({
        where: { id: targetId, deletedAt: null },
        include: { testSuite: { select: { projectId: true } } },
      });
      if (!testCase) {
        throw new NotFoundError('TestCase', targetId);
      }
      return testCase.testSuite.projectId;
    }
  }

  /**
   * ユーザーのプロジェクト権限を確認
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

    // 組織メンバーシップをチェック
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

  /**
   * 対象アイテムの存在確認（前提条件/ステップ/期待結果）
   */
  private async validateTargetItem(
    targetType: ReviewTargetType,
    targetId: string,
    targetField: ReviewTargetField,
    targetItemId?: string
  ): Promise<void> {
    if (!targetItemId) return;

    // TITLE, DESCRIPTION は targetItemId 不要
    if (targetField === 'TITLE' || targetField === 'DESCRIPTION') {
      return;
    }

    if (targetType === 'SUITE') {
      // スイートの前提条件のみ
      if (targetField === 'PRECONDITION') {
        const precondition = await prisma.testSuitePrecondition.findFirst({
          where: { id: targetItemId, testSuiteId: targetId },
        });
        if (!precondition) {
          throw new NotFoundError('TestSuitePrecondition', targetItemId);
        }
      }
    } else {
      // テストケースの前提条件/ステップ/期待結果
      if (targetField === 'PRECONDITION') {
        const precondition = await prisma.testCasePrecondition.findFirst({
          where: { id: targetItemId, testCaseId: targetId },
        });
        if (!precondition) {
          throw new NotFoundError('TestCasePrecondition', targetItemId);
        }
      } else if (targetField === 'STEP') {
        const step = await prisma.testCaseStep.findFirst({
          where: { id: targetItemId, testCaseId: targetId },
        });
        if (!step) {
          throw new NotFoundError('TestCaseStep', targetItemId);
        }
      } else if (targetField === 'EXPECTED_RESULT') {
        const expectedResult = await prisma.testCaseExpectedResult.findFirst({
          where: { id: targetItemId, testCaseId: targetId },
        });
        if (!expectedResult) {
          throw new NotFoundError('TestCaseExpectedResult', targetItemId);
        }
      }
    }
  }

  /**
   * コメントIDで検索
   */
  async findById(commentId: string) {
    const comment = await this.reviewCommentRepo.findById(commentId);
    if (!comment) {
      throw new NotFoundError('ReviewComment', commentId);
    }
    return comment;
  }

  /**
   * コメント一覧を検索
   */
  async search(
    targetType: ReviewTargetType,
    targetId: string,
    options: ReviewCommentSearchOptions
  ) {
    // 対象リソースの存在確認
    await this.getTargetProjectId(targetType, targetId);

    return this.reviewCommentRepo.search(targetType, targetId, options);
  }

  /**
   * コメントを作成
   */
  async create(userId: string, data: CreateCommentData) {
    // 対象リソースの存在確認とプロジェクトID取得
    const projectId = await this.getTargetProjectId(data.targetType, data.targetId);

    // プロジェクト権限確認（WRITE以上）
    const hasPermission = await this.checkProjectRole(userId, projectId, ['ADMIN', 'WRITE']);
    if (!hasPermission) {
      throw new AuthorizationError('Insufficient permissions to create comment');
    }

    // 対象アイテムの存在確認
    await this.validateTargetItem(data.targetType, data.targetId, data.targetField, data.targetItemId);

    return this.reviewCommentRepo.create({
      targetType: data.targetType,
      targetId: data.targetId,
      targetField: data.targetField,
      targetItemId: data.targetItemId,
      authorUserId: userId,
      content: data.content,
    });
  }

  /**
   * コメントを更新（投稿者本人のみ）
   */
  async update(commentId: string, userId: string, data: { content: string }) {
    const comment = await this.findById(commentId);

    // 投稿者本人のみ編集可能
    if (comment.authorUserId !== userId) {
      throw new AuthorizationError('Only the author can edit this comment');
    }

    return this.reviewCommentRepo.update(commentId, data);
  }

  /**
   * コメントのステータスを変更（WRITE以上）
   */
  async updateStatus(commentId: string, userId: string, status: ReviewStatus) {
    const comment = await this.findById(commentId);

    // 対象リソースの存在確認とプロジェクトID取得
    const projectId = await this.getTargetProjectId(comment.targetType, comment.targetId);

    // プロジェクト権限確認（WRITE以上）
    const hasPermission = await this.checkProjectRole(userId, projectId, ['ADMIN', 'WRITE']);
    if (!hasPermission) {
      throw new AuthorizationError('Insufficient permissions to update comment status');
    }

    return this.reviewCommentRepo.updateStatus(commentId, status);
  }

  /**
   * コメントを削除（投稿者本人のみ）
   */
  async delete(commentId: string, userId: string) {
    const comment = await this.findById(commentId);

    // 投稿者本人のみ削除可能
    if (comment.authorUserId !== userId) {
      throw new AuthorizationError('Only the author can delete this comment');
    }

    return this.reviewCommentRepo.delete(commentId);
  }

  /**
   * 返信を作成
   */
  async createReply(commentId: string, userId: string, data: { content: string }) {
    const comment = await this.findById(commentId);

    // 対象リソースの存在確認とプロジェクトID取得
    const projectId = await this.getTargetProjectId(comment.targetType, comment.targetId);

    // プロジェクト権限確認（WRITE以上）
    const hasPermission = await this.checkProjectRole(userId, projectId, ['ADMIN', 'WRITE']);
    if (!hasPermission) {
      throw new AuthorizationError('Insufficient permissions to create reply');
    }

    return this.reviewCommentRepo.createReply({
      commentId,
      authorUserId: userId,
      content: data.content,
    });
  }

  /**
   * 返信を更新（投稿者本人のみ）
   */
  async updateReply(commentId: string, replyId: string, userId: string, data: { content: string }) {
    // コメントの存在確認
    await this.findById(commentId);

    const reply = await this.reviewCommentRepo.findReplyById(replyId);
    if (!reply) {
      throw new NotFoundError('ReviewCommentReply', replyId);
    }

    // 返信がコメントに属しているか確認
    if (reply.commentId !== commentId) {
      throw new BadRequestError('Reply does not belong to this comment');
    }

    // 投稿者本人のみ編集可能
    if (reply.authorUserId !== userId) {
      throw new AuthorizationError('Only the author can edit this reply');
    }

    return this.reviewCommentRepo.updateReply(replyId, data);
  }

  /**
   * 返信を削除（投稿者本人のみ）
   */
  async deleteReply(commentId: string, replyId: string, userId: string) {
    // コメントの存在確認
    await this.findById(commentId);

    const reply = await this.reviewCommentRepo.findReplyById(replyId);
    if (!reply) {
      throw new NotFoundError('ReviewCommentReply', replyId);
    }

    // 返信がコメントに属しているか確認
    if (reply.commentId !== commentId) {
      throw new BadRequestError('Reply does not belong to this comment');
    }

    // 投稿者本人のみ削除可能
    if (reply.authorUserId !== userId) {
      throw new AuthorizationError('Only the author can delete this reply');
    }

    return this.reviewCommentRepo.deleteReply(replyId);
  }

  /**
   * 対象リソースのプロジェクトIDを取得（外部公開用）
   */
  async getProjectIdForTarget(targetType: ReviewTargetType, targetId: string): Promise<string> {
    return this.getTargetProjectId(targetType, targetId);
  }
}
