import {
  prisma,
  type ReviewVerdict,
  type ReviewTargetType,
  type ReviewTargetField,
  type ReviewStatus,
  type ProjectRole,
} from '@agentest/db';
import { NotFoundError, AuthorizationError, BadRequestError } from '@agentest/shared';
import { ReviewRepository, type ReviewSearchOptions } from '../repositories/review.repository.js';

/**
 * レビュー作成データ
 */
interface CreateReviewData {
  testSuiteId: string;
  summary?: string;
}

/**
 * コメント作成データ
 */
interface CreateCommentData {
  targetType: ReviewTargetType;
  targetId: string;
  targetField: ReviewTargetField;
  targetItemId?: string;
  content: string;
}

/**
 * レビューサービス
 */
export class ReviewService {
  private reviewRepo = new ReviewRepository();

  /**
   * ユーザーのプロジェクト権限を確認
   */
  private async checkProjectRole(
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
   * テストスイートの存在確認とプロジェクトID取得
   */
  private async getTestSuiteProjectId(testSuiteId: string): Promise<string> {
    const testSuite = await prisma.testSuite.findFirst({
      where: { id: testSuiteId, deletedAt: null },
      select: { projectId: true },
    });
    if (!testSuite) {
      throw new NotFoundError('TestSuite', testSuiteId);
    }
    return testSuite.projectId;
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
   * レビューをIDで検索
   */
  async findById(reviewId: string) {
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }
    return review;
  }

  /**
   * テストスイートの公開済みレビュー一覧を検索
   */
  async searchByTestSuite(testSuiteId: string, options: ReviewSearchOptions) {
    // テストスイートの存在確認
    await this.getTestSuiteProjectId(testSuiteId);

    return this.reviewRepo.searchByTestSuite(testSuiteId, options);
  }

  /**
   * ユーザーの下書きレビュー一覧を取得
   */
  async getDraftsByUser(userId: string) {
    return this.reviewRepo.findDraftsByUser(userId);
  }

  /**
   * レビューを開始（DRAFT作成）
   */
  async startReview(userId: string, data: CreateReviewData) {
    // テストスイートの存在確認とプロジェクトID取得
    const projectId = await this.getTestSuiteProjectId(data.testSuiteId);

    // プロジェクト権限確認（WRITE以上）
    const hasPermission = await this.checkProjectRole(userId, projectId, ['ADMIN', 'WRITE']);
    if (!hasPermission) {
      throw new AuthorizationError('Insufficient permissions to start review');
    }

    // 既存の下書きレビューがあるか確認
    const existingDraft = await this.reviewRepo.findDraftByUserAndTestSuite(userId, data.testSuiteId);
    if (existingDraft) {
      throw new BadRequestError('You already have a draft review for this test suite');
    }

    return this.reviewRepo.create({
      testSuiteId: data.testSuiteId,
      authorUserId: userId,
      summary: data.summary,
    });
  }

  /**
   * レビューを更新（投稿者本人のみ）
   */
  async update(reviewId: string, userId: string, data: { summary?: string }) {
    const review = await this.findById(reviewId);

    // 投稿者本人のみ編集可能
    if (review.authorUserId !== userId) {
      throw new AuthorizationError('Only the author can edit this review');
    }

    // DRAFTのみ編集可能
    if (review.status !== 'DRAFT') {
      throw new BadRequestError('Only draft reviews can be edited');
    }

    return this.reviewRepo.update(reviewId, data);
  }

  /**
   * レビューを提出（DRAFT → SUBMITTED）
   */
  async submit(reviewId: string, userId: string, data: { verdict: ReviewVerdict; summary?: string }) {
    const review = await this.findById(reviewId);

    // 投稿者本人のみ提出可能
    if (review.authorUserId !== userId) {
      throw new AuthorizationError('Only the author can submit this review');
    }

    // DRAFTのみ提出可能
    if (review.status !== 'DRAFT') {
      throw new BadRequestError('Only draft reviews can be submitted');
    }

    return this.reviewRepo.submit(reviewId, data);
  }

  /**
   * レビューを削除（DRAFTのみ、投稿者本人のみ）
   */
  async delete(reviewId: string, userId: string) {
    const review = await this.findById(reviewId);

    // 投稿者本人のみ削除可能
    if (review.authorUserId !== userId) {
      throw new AuthorizationError('Only the author can delete this review');
    }

    // DRAFTのみ削除可能
    if (review.status !== 'DRAFT') {
      throw new BadRequestError('Only draft reviews can be deleted');
    }

    return this.reviewRepo.delete(reviewId);
  }

  /**
   * レビューにコメントを追加
   */
  async addComment(reviewId: string, userId: string, data: CreateCommentData) {
    const review = await this.findById(reviewId);

    // 自分のDRAFTレビューまたはSUBMITTEDレビューにのみコメント可能
    if (review.status === 'DRAFT') {
      // DRAFTの場合は投稿者本人のみ
      if (review.authorUserId !== userId) {
        throw new AuthorizationError('Only the author can add comments to a draft review');
      }
    } else {
      // SUBMITTEDの場合は権限確認（WRITE以上）
      const projectId = await this.getTestSuiteProjectId(review.testSuiteId);
      const hasPermission = await this.checkProjectRole(userId, projectId, ['ADMIN', 'WRITE']);
      if (!hasPermission) {
        throw new AuthorizationError('Insufficient permissions to add comment');
      }
    }

    // 対象アイテムの存在確認
    await this.validateTargetItem(data.targetType, data.targetId, data.targetField, data.targetItemId);

    return this.reviewRepo.addComment({
      reviewId,
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
  async updateComment(reviewId: string, commentId: string, userId: string, data: { content: string }) {
    const comment = await this.reviewRepo.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError('ReviewComment', commentId);
    }

    // コメントがレビューに属しているか確認
    if (comment.reviewId !== reviewId) {
      throw new BadRequestError('Comment does not belong to this review');
    }

    // 投稿者本人のみ編集可能
    if (comment.authorUserId !== userId) {
      throw new AuthorizationError('Only the author can edit this comment');
    }

    return this.reviewRepo.updateComment(commentId, data);
  }

  /**
   * コメントのステータスを変更（WRITE以上）
   */
  async updateCommentStatus(reviewId: string, commentId: string, userId: string, status: ReviewStatus) {
    const comment = await this.reviewRepo.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError('ReviewComment', commentId);
    }

    // コメントがレビューに属しているか確認
    if (comment.reviewId !== reviewId) {
      throw new BadRequestError('Comment does not belong to this review');
    }

    // レビューの取得
    const review = await this.findById(reviewId);

    // プロジェクト権限確認（WRITE以上）
    const projectId = await this.getTestSuiteProjectId(review.testSuiteId);
    const hasPermission = await this.checkProjectRole(userId, projectId, ['ADMIN', 'WRITE']);
    if (!hasPermission) {
      throw new AuthorizationError('Insufficient permissions to update comment status');
    }

    return this.reviewRepo.updateCommentStatus(commentId, status);
  }

  /**
   * コメントを削除（投稿者本人のみ）
   */
  async deleteComment(reviewId: string, commentId: string, userId: string) {
    const comment = await this.reviewRepo.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError('ReviewComment', commentId);
    }

    // コメントがレビューに属しているか確認
    if (comment.reviewId !== reviewId) {
      throw new BadRequestError('Comment does not belong to this review');
    }

    // 投稿者本人のみ削除可能
    if (comment.authorUserId !== userId) {
      throw new AuthorizationError('Only the author can delete this comment');
    }

    return this.reviewRepo.deleteComment(commentId);
  }

  /**
   * 返信を追加
   */
  async addReply(
    reviewId: string,
    commentId: string,
    userId: string,
    data: { content: string }
  ) {
    const comment = await this.reviewRepo.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError('ReviewComment', commentId);
    }

    // コメントがレビューに属しているか確認
    if (comment.reviewId !== reviewId) {
      throw new BadRequestError('Comment does not belong to this review');
    }

    // レビューの取得
    const review = await this.findById(reviewId);

    // プロジェクト権限確認（WRITE以上）
    const projectId = await this.getTestSuiteProjectId(review.testSuiteId);
    const hasPermission = await this.checkProjectRole(userId, projectId, ['ADMIN', 'WRITE']);
    if (!hasPermission) {
      throw new AuthorizationError('Insufficient permissions to add reply');
    }

    return this.reviewRepo.addReply({
      commentId,
      authorUserId: userId,
      content: data.content,
    });
  }

  /**
   * 返信を更新（投稿者本人のみ）
   */
  async updateReply(
    reviewId: string,
    commentId: string,
    replyId: string,
    userId: string,
    data: { content: string }
  ) {
    const reply = await this.reviewRepo.findReplyById(replyId);
    if (!reply) {
      throw new NotFoundError('ReviewCommentReply', replyId);
    }

    // 返信がコメントに属しているか確認
    if (reply.commentId !== commentId) {
      throw new BadRequestError('Reply does not belong to this comment');
    }

    // コメントがレビューに属しているか確認
    if (reply.comment.reviewId !== reviewId) {
      throw new BadRequestError('Comment does not belong to this review');
    }

    // 投稿者本人のみ編集可能
    if (reply.authorUserId !== userId) {
      throw new AuthorizationError('Only the author can edit this reply');
    }

    return this.reviewRepo.updateReply(replyId, data);
  }

  /**
   * 返信を削除（投稿者本人のみ）
   */
  async deleteReply(
    reviewId: string,
    commentId: string,
    replyId: string,
    userId: string
  ) {
    const reply = await this.reviewRepo.findReplyById(replyId);
    if (!reply) {
      throw new NotFoundError('ReviewCommentReply', replyId);
    }

    // 返信がコメントに属しているか確認
    if (reply.commentId !== commentId) {
      throw new BadRequestError('Reply does not belong to this comment');
    }

    // コメントがレビューに属しているか確認
    if (reply.comment.reviewId !== reviewId) {
      throw new BadRequestError('Comment does not belong to this review');
    }

    // 投稿者本人のみ削除可能
    if (reply.authorUserId !== userId) {
      throw new AuthorizationError('Only the author can delete this reply');
    }

    return this.reviewRepo.deleteReply(replyId);
  }

  /**
   * レビューにアクセスできるか確認（DRAFTは投稿者本人のみ）
   */
  async canAccessReview(reviewId: string, userId: string): Promise<boolean> {
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) {
      return false;
    }

    // SUBMITTEDは誰でもアクセス可能
    if (review.status === 'SUBMITTED') {
      return true;
    }

    // DRAFTは投稿者本人のみ
    return review.authorUserId === userId;
  }
}
