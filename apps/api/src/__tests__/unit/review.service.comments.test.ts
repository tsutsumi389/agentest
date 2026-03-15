import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, AuthorizationError, BadRequestError } from '@agentest/shared';

// Prismaモック（validateTargetItem, getTestSuiteProjectId, addComment通知用）
const mockPrisma = vi.hoisted(() => ({
  testSuite: { findFirst: vi.fn(), findUnique: vi.fn() },
  testSuitePrecondition: { findFirst: vi.fn() },
  testCasePrecondition: { findFirst: vi.fn() },
  testCaseStep: { findFirst: vi.fn() },
  testCaseExpectedResult: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

// ReviewRepositoryモック
const mockReviewRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  searchByTestSuite: vi.fn(),
  findDraftsByUser: vi.fn(),
  findDraftByUserAndTestSuite: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateVerdict: vi.fn(),
  submit: vi.fn(),
  delete: vi.fn(),
  addComment: vi.fn(),
  findCommentById: vi.fn(),
  updateComment: vi.fn(),
  updateCommentStatus: vi.fn(),
  deleteComment: vi.fn(),
  addReply: vi.fn(),
  findReplyById: vi.fn(),
  updateReply: vi.fn(),
  deleteReply: vi.fn(),
  getOpenCommentCount: vi.fn(),
}));

vi.mock('../../repositories/review.repository.js', () => ({
  ReviewRepository: vi.fn().mockImplementation(() => mockReviewRepo),
}));

// AuthorizationServiceモック
const mockAuthorizationService = vi.hoisted(() => ({
  checkProjectRole: vi.fn(),
}));

vi.mock('../../services/authorization.service.js', () => ({
  authorizationService: mockAuthorizationService,
  AuthorizationService: vi.fn(),
}));

// NotificationServiceモック
const mockNotificationService = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('../../services/notification.service.js', () => ({
  notificationService: mockNotificationService,
  NotificationService: vi.fn(),
}));

import { ReviewService } from '../../services/review.service.js';

// テスト用固定ID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
const TEST_REVIEW_ID = '33333333-3333-3333-3333-333333333333';
const TEST_SUITE_ID = '44444444-4444-4444-4444-444444444444';
const TEST_PROJECT_ID = '55555555-5555-5555-5555-555555555555';
const TEST_COMMENT_ID = '66666666-6666-6666-6666-666666666666';
const TEST_REPLY_ID = '77777777-7777-7777-7777-777777777777';

// テスト用のレビューモックデータ
const createMockReview = (overrides = {}) => ({
  id: TEST_REVIEW_ID,
  testSuiteId: TEST_SUITE_ID,
  authorUserId: TEST_USER_ID,
  status: 'DRAFT',
  verdict: null,
  summary: null,
  author: { id: TEST_USER_ID, name: 'Test User', avatarUrl: null },
  agentSession: null,
  comments: [],
  _count: { comments: 0 },
  ...overrides,
});

describe('ReviewService（コメント操作）', () => {
  let service: ReviewService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReviewService();
  });

  describe('addComment', () => {
    describe('DRAFTレビューの場合', () => {
      beforeEach(() => {
        mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'DRAFT' }));
      });

      it('投稿者本人がコメントを追加できる', async () => {
        const mockComment = { id: TEST_COMMENT_ID, content: 'コメント' };
        mockReviewRepo.addComment.mockResolvedValue(mockComment);

        const result = await service.addComment(TEST_REVIEW_ID, TEST_USER_ID, {
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
          targetField: 'TITLE',
          content: 'コメント',
        });

        expect(result).toEqual(mockComment);
        expect(mockReviewRepo.addComment).toHaveBeenCalledWith({
          reviewId: TEST_REVIEW_ID,
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
          targetField: 'TITLE',
          targetItemId: undefined,
          targetItemContent: undefined,
          authorUserId: TEST_USER_ID,
          content: 'コメント',
        });
      });

      it('他人はDRAFTレビューにコメントできない', async () => {
        await expect(
          service.addComment(TEST_REVIEW_ID, OTHER_USER_ID, {
            targetType: 'SUITE',
            targetId: TEST_SUITE_ID,
            targetField: 'TITLE',
            content: 'コメント',
          })
        ).rejects.toThrow(AuthorizationError);
      });
    });

    describe('SUBMITTEDレビューの場合', () => {
      beforeEach(() => {
        mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'SUBMITTED' }));
        mockPrisma.testSuite.findFirst.mockResolvedValue({ projectId: TEST_PROJECT_ID });
      });

      it('WRITE以上の権限でコメントを追加できる', async () => {
        mockAuthorizationService.checkProjectRole.mockResolvedValue(true);
        const mockComment = { id: TEST_COMMENT_ID };
        mockReviewRepo.addComment.mockResolvedValue(mockComment);
        mockPrisma.user.findUnique.mockResolvedValue({ name: 'Other User' });
        mockPrisma.testSuite.findUnique.mockResolvedValue({
          name: 'Suite',
          project: { id: TEST_PROJECT_ID, organizationId: null },
        });
        mockNotificationService.send.mockResolvedValue(undefined);

        const result = await service.addComment(TEST_REVIEW_ID, OTHER_USER_ID, {
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
          targetField: 'TITLE',
          content: 'コメント',
        });

        expect(result).toEqual(mockComment);
        expect(mockAuthorizationService.checkProjectRole).toHaveBeenCalledWith(
          OTHER_USER_ID,
          TEST_PROJECT_ID,
          ['ADMIN', 'WRITE']
        );
      });

      it('権限がない場合はAuthorizationErrorを投げる', async () => {
        mockAuthorizationService.checkProjectRole.mockResolvedValue(false);

        await expect(
          service.addComment(TEST_REVIEW_ID, OTHER_USER_ID, {
            targetType: 'SUITE',
            targetId: TEST_SUITE_ID,
            targetField: 'TITLE',
            content: 'コメント',
          })
        ).rejects.toThrow(AuthorizationError);
      });
    });

    describe('通知', () => {
      it('他人がコメントした場合、レビュー作成者に通知を送信する', async () => {
        mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'SUBMITTED' }));
        mockPrisma.testSuite.findFirst.mockResolvedValue({ projectId: TEST_PROJECT_ID });
        mockAuthorizationService.checkProjectRole.mockResolvedValue(true);
        const mockComment = { id: TEST_COMMENT_ID };
        mockReviewRepo.addComment.mockResolvedValue(mockComment);
        mockPrisma.user.findUnique.mockResolvedValue({ name: 'Commenter' });
        mockPrisma.testSuite.findUnique.mockResolvedValue({
          name: 'テストスイート',
          project: { id: TEST_PROJECT_ID, organizationId: 'org-1' },
        });
        mockNotificationService.send.mockResolvedValue(undefined);

        await service.addComment(TEST_REVIEW_ID, OTHER_USER_ID, {
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
          targetField: 'TITLE',
          content: 'コメント',
        });

        expect(mockNotificationService.send).toHaveBeenCalledWith({
          userId: TEST_USER_ID,
          type: 'REVIEW_COMMENT',
          title: 'レビューにコメントが追加されました',
          body: 'Commenterさんが「テストスイート」のレビューにコメントを追加しました',
          data: {
            reviewId: TEST_REVIEW_ID,
            testSuiteId: TEST_SUITE_ID,
            commentId: TEST_COMMENT_ID,
          },
          organizationId: 'org-1',
        });
      });

      it('投稿者本人がコメントした場合は通知を送信しない', async () => {
        mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'DRAFT' }));
        mockReviewRepo.addComment.mockResolvedValue({ id: TEST_COMMENT_ID });

        await service.addComment(TEST_REVIEW_ID, TEST_USER_ID, {
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
          targetField: 'TITLE',
          content: 'コメント',
        });

        expect(mockNotificationService.send).not.toHaveBeenCalled();
      });
    });

    describe('validateTargetItem', () => {
      beforeEach(() => {
        mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'DRAFT' }));
        mockReviewRepo.addComment.mockResolvedValue({ id: TEST_COMMENT_ID });
      });

      it('targetItemIdなしの場合は検証をスキップする', async () => {
        await service.addComment(TEST_REVIEW_ID, TEST_USER_ID, {
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
          targetField: 'PRECONDITION',
          content: 'コメント',
        });

        expect(mockPrisma.testSuitePrecondition.findFirst).not.toHaveBeenCalled();
      });

      it('TITLE/DESCRIPTIONフィールドの場合はtargetItemIdの検証をスキップする', async () => {
        await service.addComment(TEST_REVIEW_ID, TEST_USER_ID, {
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
          targetField: 'TITLE',
          targetItemId: 'some-id',
          content: 'コメント',
        });

        // 検証はスキップされる（Prisma呼び出しなし）
        expect(mockReviewRepo.addComment).toHaveBeenCalled();
      });

      it.todo('スイートの前提条件が存在しない場合はNotFoundErrorを投げる');
    });
  });

  describe('updateComment', () => {
    it('投稿者本人がコメントを更新できる', async () => {
      mockReviewRepo.findCommentById.mockResolvedValue({
        id: TEST_COMMENT_ID,
        reviewId: TEST_REVIEW_ID,
        authorUserId: TEST_USER_ID,
      });
      const updatedComment = { id: TEST_COMMENT_ID, content: '更新' };
      mockReviewRepo.updateComment.mockResolvedValue(updatedComment);

      const result = await service.updateComment(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID, {
        content: '更新',
      });

      expect(result).toEqual(updatedComment);
    });

    it('コメントが存在しない場合はNotFoundErrorを投げる', async () => {
      mockReviewRepo.findCommentById.mockResolvedValue(null);

      await expect(
        service.updateComment(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID, { content: '更新' })
      ).rejects.toThrow(NotFoundError);
    });

    it('コメントが別レビューに属する場合はBadRequestErrorを投げる', async () => {
      mockReviewRepo.findCommentById.mockResolvedValue({
        id: TEST_COMMENT_ID,
        reviewId: 'other-review-id',
        authorUserId: TEST_USER_ID,
      });

      await expect(
        service.updateComment(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID, { content: '更新' })
      ).rejects.toThrow(BadRequestError);
    });

    it('他人のコメントはAuthorizationErrorを投げる', async () => {
      mockReviewRepo.findCommentById.mockResolvedValue({
        id: TEST_COMMENT_ID,
        reviewId: TEST_REVIEW_ID,
        authorUserId: OTHER_USER_ID,
      });

      await expect(
        service.updateComment(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID, { content: '更新' })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('updateCommentStatus', () => {
    beforeEach(() => {
      mockReviewRepo.findCommentById.mockResolvedValue({
        id: TEST_COMMENT_ID,
        reviewId: TEST_REVIEW_ID,
      });
      mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'SUBMITTED' }));
      mockPrisma.testSuite.findFirst.mockResolvedValue({ projectId: TEST_PROJECT_ID });
    });

    it('WRITE以上の権限でコメントステータスを変更できる', async () => {
      mockAuthorizationService.checkProjectRole.mockResolvedValue(true);
      const updatedComment = { id: TEST_COMMENT_ID, status: 'RESOLVED' };
      mockReviewRepo.updateCommentStatus.mockResolvedValue(updatedComment);

      const result = await service.updateCommentStatus(
        TEST_REVIEW_ID,
        TEST_COMMENT_ID,
        TEST_USER_ID,
        'RESOLVED'
      );

      expect(result).toEqual(updatedComment);
    });

    it('権限がない場合はAuthorizationErrorを投げる', async () => {
      mockAuthorizationService.checkProjectRole.mockResolvedValue(false);

      await expect(
        service.updateCommentStatus(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID, 'RESOLVED')
      ).rejects.toThrow(AuthorizationError);
    });

    it('コメントが存在しない場合はNotFoundErrorを投げる', async () => {
      mockReviewRepo.findCommentById.mockResolvedValue(null);

      await expect(
        service.updateCommentStatus(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID, 'RESOLVED')
      ).rejects.toThrow(NotFoundError);
    });

    it('コメントが別レビューに属する場合はBadRequestErrorを投げる', async () => {
      mockReviewRepo.findCommentById.mockResolvedValue({
        id: TEST_COMMENT_ID,
        reviewId: 'other-review-id',
      });

      await expect(
        service.updateCommentStatus(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID, 'RESOLVED')
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('deleteComment', () => {
    it('投稿者本人がコメントを削除できる', async () => {
      mockReviewRepo.findCommentById.mockResolvedValue({
        id: TEST_COMMENT_ID,
        reviewId: TEST_REVIEW_ID,
        authorUserId: TEST_USER_ID,
      });
      mockReviewRepo.deleteComment.mockResolvedValue({ id: TEST_COMMENT_ID });

      await service.deleteComment(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID);

      expect(mockReviewRepo.deleteComment).toHaveBeenCalledWith(TEST_COMMENT_ID);
    });

    it('コメントが存在しない場合はNotFoundErrorを投げる', async () => {
      mockReviewRepo.findCommentById.mockResolvedValue(null);

      await expect(
        service.deleteComment(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('コメントが別レビューに属する場合はBadRequestErrorを投げる', async () => {
      mockReviewRepo.findCommentById.mockResolvedValue({
        id: TEST_COMMENT_ID,
        reviewId: 'other-review-id',
        authorUserId: TEST_USER_ID,
      });

      await expect(
        service.deleteComment(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID)
      ).rejects.toThrow(BadRequestError);
    });

    it('他人のコメントはAuthorizationErrorを投げる', async () => {
      mockReviewRepo.findCommentById.mockResolvedValue({
        id: TEST_COMMENT_ID,
        reviewId: TEST_REVIEW_ID,
        authorUserId: OTHER_USER_ID,
      });

      await expect(
        service.deleteComment(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID)
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('addReply', () => {
    beforeEach(() => {
      mockReviewRepo.findCommentById.mockResolvedValue({
        id: TEST_COMMENT_ID,
        reviewId: TEST_REVIEW_ID,
      });
      mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'SUBMITTED' }));
      mockPrisma.testSuite.findFirst.mockResolvedValue({ projectId: TEST_PROJECT_ID });
    });

    it('WRITE以上の権限で返信を追加できる', async () => {
      mockAuthorizationService.checkProjectRole.mockResolvedValue(true);
      const mockReply = { id: TEST_REPLY_ID, content: '返信' };
      mockReviewRepo.addReply.mockResolvedValue(mockReply);

      const result = await service.addReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID, {
        content: '返信',
      });

      expect(result).toEqual(mockReply);
      expect(mockReviewRepo.addReply).toHaveBeenCalledWith({
        commentId: TEST_COMMENT_ID,
        authorUserId: TEST_USER_ID,
        content: '返信',
      });
    });

    it('権限がない場合はAuthorizationErrorを投げる', async () => {
      mockAuthorizationService.checkProjectRole.mockResolvedValue(false);

      await expect(
        service.addReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID, { content: '返信' })
      ).rejects.toThrow(AuthorizationError);
    });

    it('コメントが存在しない場合はNotFoundErrorを投げる', async () => {
      mockReviewRepo.findCommentById.mockResolvedValue(null);

      await expect(
        service.addReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID, { content: '返信' })
      ).rejects.toThrow(NotFoundError);
    });

    it('コメントが別レビューに属する場合はBadRequestErrorを投げる', async () => {
      mockReviewRepo.findCommentById.mockResolvedValue({
        id: TEST_COMMENT_ID,
        reviewId: 'other-review-id',
      });

      await expect(
        service.addReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID, { content: '返信' })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('updateReply', () => {
    it('投稿者本人が返信を更新できる', async () => {
      mockReviewRepo.findReplyById.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: TEST_COMMENT_ID,
        authorUserId: TEST_USER_ID,
        comment: { reviewId: TEST_REVIEW_ID },
      });
      const updatedReply = { id: TEST_REPLY_ID, content: '更新返信' };
      mockReviewRepo.updateReply.mockResolvedValue(updatedReply);

      const result = await service.updateReply(
        TEST_REVIEW_ID,
        TEST_COMMENT_ID,
        TEST_REPLY_ID,
        TEST_USER_ID,
        { content: '更新返信' }
      );

      expect(result).toEqual(updatedReply);
    });

    it('返信が存在しない場合はNotFoundErrorを投げる', async () => {
      mockReviewRepo.findReplyById.mockResolvedValue(null);

      await expect(
        service.updateReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID, {
          content: '更新',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('返信が別コメントに属する場合はBadRequestErrorを投げる', async () => {
      mockReviewRepo.findReplyById.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: 'other-comment-id',
        authorUserId: TEST_USER_ID,
        comment: { reviewId: TEST_REVIEW_ID },
      });

      await expect(
        service.updateReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID, {
          content: '更新',
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('返信のコメントが別レビューに属する場合はBadRequestErrorを投げる', async () => {
      mockReviewRepo.findReplyById.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: TEST_COMMENT_ID,
        authorUserId: TEST_USER_ID,
        comment: { reviewId: 'other-review-id' },
      });

      await expect(
        service.updateReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID, {
          content: '更新',
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('他人の返信はAuthorizationErrorを投げる', async () => {
      mockReviewRepo.findReplyById.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: TEST_COMMENT_ID,
        authorUserId: OTHER_USER_ID,
        comment: { reviewId: TEST_REVIEW_ID },
      });

      await expect(
        service.updateReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID, {
          content: '更新',
        })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('deleteReply', () => {
    it('投稿者本人が返信を削除できる', async () => {
      mockReviewRepo.findReplyById.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: TEST_COMMENT_ID,
        authorUserId: TEST_USER_ID,
        comment: { reviewId: TEST_REVIEW_ID },
      });
      mockReviewRepo.deleteReply.mockResolvedValue({ id: TEST_REPLY_ID });

      await service.deleteReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID);

      expect(mockReviewRepo.deleteReply).toHaveBeenCalledWith(TEST_REPLY_ID);
    });

    it('返信が存在しない場合はNotFoundErrorを投げる', async () => {
      mockReviewRepo.findReplyById.mockResolvedValue(null);

      await expect(
        service.deleteReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('返信が別コメントに属する場合はBadRequestErrorを投げる', async () => {
      mockReviewRepo.findReplyById.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: 'other-comment-id',
        authorUserId: TEST_USER_ID,
        comment: { reviewId: TEST_REVIEW_ID },
      });

      await expect(
        service.deleteReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID)
      ).rejects.toThrow(BadRequestError);
    });

    it('返信のコメントが別レビューに属する場合はBadRequestErrorを投げる', async () => {
      mockReviewRepo.findReplyById.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: TEST_COMMENT_ID,
        authorUserId: TEST_USER_ID,
        comment: { reviewId: 'other-review-id' },
      });

      await expect(
        service.deleteReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID)
      ).rejects.toThrow(BadRequestError);
    });

    it('他人の返信はAuthorizationErrorを投げる', async () => {
      mockReviewRepo.findReplyById.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: TEST_COMMENT_ID,
        authorUserId: OTHER_USER_ID,
        comment: { reviewId: TEST_REVIEW_ID },
      });

      await expect(
        service.deleteReply(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID)
      ).rejects.toThrow(AuthorizationError);
    });
  });
});
