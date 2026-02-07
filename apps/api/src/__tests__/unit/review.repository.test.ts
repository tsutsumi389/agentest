import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prismaモック
const mockPrismaReview = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

const mockPrismaReviewComment = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
}));

const mockPrismaReviewCommentReply = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    review: mockPrismaReview,
    reviewComment: mockPrismaReviewComment,
    reviewCommentReply: mockPrismaReviewCommentReply,
  },
}));

import { ReviewRepository } from '../../repositories/review.repository.js';

// テスト用固定ID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_REVIEW_ID = '33333333-3333-3333-3333-333333333333';
const TEST_SUITE_ID = '44444444-4444-4444-4444-444444444444';
const TEST_COMMENT_ID = '55555555-5555-5555-5555-555555555555';
const TEST_REPLY_ID = '66666666-6666-6666-6666-666666666666';

describe('ReviewRepository', () => {
  let repository: ReviewRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ReviewRepository();
  });

  describe('findById', () => {
    it('レビューを詳細情報付きで取得できる', async () => {
      const mockReview = {
        id: TEST_REVIEW_ID,
        testSuiteId: TEST_SUITE_ID,
        authorUserId: TEST_USER_ID,
        status: 'DRAFT',
        author: { id: TEST_USER_ID, name: 'Test User', avatarUrl: null },
        agentSession: null,
        comments: [],
        _count: { comments: 0 },
      };
      mockPrismaReview.findUnique.mockResolvedValue(mockReview);

      const result = await repository.findById(TEST_REVIEW_ID);

      expect(result).toEqual(mockReview);
      expect(mockPrismaReview.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_REVIEW_ID },
        include: expect.any(Object),
      });
    });

    it('存在しないレビューはnullを返す', async () => {
      mockPrismaReview.findUnique.mockResolvedValue(null);

      const result = await repository.findById(TEST_REVIEW_ID);

      expect(result).toBeNull();
    });
  });

  describe('searchByTestSuite', () => {
    it('SUBMITTED状態のレビューを検索できる', async () => {
      const mockReviews = [{ id: TEST_REVIEW_ID, status: 'SUBMITTED' }];
      mockPrismaReview.findMany.mockResolvedValue(mockReviews);
      mockPrismaReview.count.mockResolvedValue(1);

      const result = await repository.searchByTestSuite(TEST_SUITE_ID, {
        limit: 10,
        offset: 0,
      });

      expect(result.items).toEqual(mockReviews);
      expect(result.total).toBe(1);
      expect(mockPrismaReview.findMany).toHaveBeenCalledWith({
        where: { testSuiteId: TEST_SUITE_ID, status: 'SUBMITTED' },
        include: expect.any(Object),
        orderBy: { submittedAt: 'desc' },
        take: 10,
        skip: 0,
      });
    });

    it('verdictフィルタを適用できる', async () => {
      mockPrismaReview.findMany.mockResolvedValue([]);
      mockPrismaReview.count.mockResolvedValue(0);

      await repository.searchByTestSuite(TEST_SUITE_ID, {
        verdict: 'APPROVED',
        limit: 10,
        offset: 0,
      });

      expect(mockPrismaReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            testSuiteId: TEST_SUITE_ID,
            status: 'SUBMITTED',
            verdict: 'APPROVED',
          },
        })
      );
    });

    it('verdictが未指定の場合はフィルタなし', async () => {
      mockPrismaReview.findMany.mockResolvedValue([]);
      mockPrismaReview.count.mockResolvedValue(0);

      await repository.searchByTestSuite(TEST_SUITE_ID, {
        limit: 10,
        offset: 0,
      });

      expect(mockPrismaReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { testSuiteId: TEST_SUITE_ID, status: 'SUBMITTED' },
        })
      );
    });

    it('ページネーションが動作する', async () => {
      mockPrismaReview.findMany.mockResolvedValue([]);
      mockPrismaReview.count.mockResolvedValue(50);

      await repository.searchByTestSuite(TEST_SUITE_ID, {
        limit: 20,
        offset: 40,
      });

      expect(mockPrismaReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 40,
        })
      );
    });
  });

  describe('findDraftsByUser', () => {
    it('ユーザーの下書きレビュー一覧を取得できる', async () => {
      const mockDrafts = [{ id: TEST_REVIEW_ID, status: 'DRAFT', authorUserId: TEST_USER_ID }];
      mockPrismaReview.findMany.mockResolvedValue(mockDrafts);

      const result = await repository.findDraftsByUser(TEST_USER_ID);

      expect(result).toEqual(mockDrafts);
      expect(mockPrismaReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { authorUserId: TEST_USER_ID, status: 'DRAFT' },
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('findDraftByUserAndTestSuite', () => {
    it('特定テストスイートのユーザー下書きを取得できる', async () => {
      const mockDraft = { id: TEST_REVIEW_ID, status: 'DRAFT' };
      mockPrismaReview.findFirst.mockResolvedValue(mockDraft);

      const result = await repository.findDraftByUserAndTestSuite(TEST_USER_ID, TEST_SUITE_ID);

      expect(result).toEqual(mockDraft);
      expect(mockPrismaReview.findFirst).toHaveBeenCalledWith({
        where: {
          testSuiteId: TEST_SUITE_ID,
          authorUserId: TEST_USER_ID,
          status: 'DRAFT',
        },
        include: expect.any(Object),
      });
    });

    it('下書きが存在しない場合はnullを返す', async () => {
      mockPrismaReview.findFirst.mockResolvedValue(null);

      const result = await repository.findDraftByUserAndTestSuite(TEST_USER_ID, TEST_SUITE_ID);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('DRAFT状態でレビューを作成できる', async () => {
      const mockReview = { id: TEST_REVIEW_ID, status: 'DRAFT' };
      mockPrismaReview.create.mockResolvedValue(mockReview);

      const result = await repository.create({
        testSuiteId: TEST_SUITE_ID,
        authorUserId: TEST_USER_ID,
        summary: 'テストサマリー',
      });

      expect(result).toEqual(mockReview);
      expect(mockPrismaReview.create).toHaveBeenCalledWith({
        data: {
          testSuiteId: TEST_SUITE_ID,
          authorUserId: TEST_USER_ID,
          authorAgentSessionId: undefined,
          summary: 'テストサマリー',
          status: 'DRAFT',
        },
        include: expect.any(Object),
      });
    });

    it('authorAgentSessionIdでレビューを作成できる', async () => {
      mockPrismaReview.create.mockResolvedValue({ id: TEST_REVIEW_ID });

      await repository.create({
        testSuiteId: TEST_SUITE_ID,
        authorAgentSessionId: 'agent-session-1',
      });

      expect(mockPrismaReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorAgentSessionId: 'agent-session-1',
            authorUserId: undefined,
          }),
        })
      );
    });
  });

  describe('update', () => {
    it('レビューのサマリーを更新できる', async () => {
      const mockReview = { id: TEST_REVIEW_ID, summary: '更新サマリー' };
      mockPrismaReview.update.mockResolvedValue(mockReview);

      const result = await repository.update(TEST_REVIEW_ID, { summary: '更新サマリー' });

      expect(result).toEqual(mockReview);
      expect(mockPrismaReview.update).toHaveBeenCalledWith({
        where: { id: TEST_REVIEW_ID },
        data: { summary: '更新サマリー' },
        include: expect.any(Object),
      });
    });
  });

  describe('updateVerdict', () => {
    it('レビューの評価を更新できる', async () => {
      const mockReview = { id: TEST_REVIEW_ID, verdict: 'APPROVED' };
      mockPrismaReview.update.mockResolvedValue(mockReview);

      const result = await repository.updateVerdict(TEST_REVIEW_ID, 'APPROVED');

      expect(result).toEqual(mockReview);
      expect(mockPrismaReview.update).toHaveBeenCalledWith({
        where: { id: TEST_REVIEW_ID },
        data: { verdict: 'APPROVED' },
        include: expect.any(Object),
      });
    });
  });

  describe('submit', () => {
    it('レビューをSUBMITTED状態に変更しsubmittedAtを設定する', async () => {
      const mockReview = { id: TEST_REVIEW_ID, status: 'SUBMITTED' };
      mockPrismaReview.update.mockResolvedValue(mockReview);

      const result = await repository.submit(TEST_REVIEW_ID, {
        verdict: 'APPROVED',
        summary: '最終サマリー',
      });

      expect(result).toEqual(mockReview);
      expect(mockPrismaReview.update).toHaveBeenCalledWith({
        where: { id: TEST_REVIEW_ID },
        data: {
          status: 'SUBMITTED',
          verdict: 'APPROVED',
          summary: '最終サマリー',
          submittedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });
    });
  });

  describe('delete', () => {
    it('レビューを物理削除できる', async () => {
      const mockReview = { id: TEST_REVIEW_ID };
      mockPrismaReview.delete.mockResolvedValue(mockReview);

      const result = await repository.delete(TEST_REVIEW_ID);

      expect(result).toEqual(mockReview);
      expect(mockPrismaReview.delete).toHaveBeenCalledWith({
        where: { id: TEST_REVIEW_ID },
      });
    });
  });

  describe('addComment', () => {
    it('コメントをOPEN状態で作成できる', async () => {
      const mockComment = { id: TEST_COMMENT_ID, status: 'OPEN' };
      mockPrismaReviewComment.create.mockResolvedValue(mockComment);

      const result = await repository.addComment({
        reviewId: TEST_REVIEW_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
        targetField: 'TITLE',
        authorUserId: TEST_USER_ID,
        content: 'テストコメント',
      });

      expect(result).toEqual(mockComment);
      expect(mockPrismaReviewComment.create).toHaveBeenCalledWith({
        data: {
          reviewId: TEST_REVIEW_ID,
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
          targetField: 'TITLE',
          targetItemId: undefined,
          targetItemContent: undefined,
          authorUserId: TEST_USER_ID,
          authorAgentSessionId: undefined,
          content: 'テストコメント',
          status: 'OPEN',
        },
        include: expect.any(Object),
      });
    });

    it('targetItemIdを指定してコメントを作成できる', async () => {
      mockPrismaReviewComment.create.mockResolvedValue({ id: TEST_COMMENT_ID });

      await repository.addComment({
        reviewId: TEST_REVIEW_ID,
        targetType: 'CASE',
        targetId: 'case-1',
        targetField: 'STEP',
        targetItemId: 'step-1',
        targetItemContent: 'ステップ内容',
        authorUserId: TEST_USER_ID,
        content: 'コメント内容',
      });

      expect(mockPrismaReviewComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            targetItemId: 'step-1',
            targetItemContent: 'ステップ内容',
          }),
        })
      );
    });
  });

  describe('findCommentById', () => {
    it('コメントをreview情報付きで取得できる', async () => {
      const mockComment = {
        id: TEST_COMMENT_ID,
        reviewId: TEST_REVIEW_ID,
        review: { id: TEST_REVIEW_ID },
      };
      mockPrismaReviewComment.findUnique.mockResolvedValue(mockComment);

      const result = await repository.findCommentById(TEST_COMMENT_ID);

      expect(result).toEqual(mockComment);
      expect(mockPrismaReviewComment.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_COMMENT_ID },
        include: expect.objectContaining({
          review: true,
        }),
      });
    });

    it('存在しないコメントはnullを返す', async () => {
      mockPrismaReviewComment.findUnique.mockResolvedValue(null);

      const result = await repository.findCommentById(TEST_COMMENT_ID);

      expect(result).toBeNull();
    });
  });

  describe('updateComment', () => {
    it('コメント内容を更新できる', async () => {
      const mockComment = { id: TEST_COMMENT_ID, content: '更新内容' };
      mockPrismaReviewComment.update.mockResolvedValue(mockComment);

      const result = await repository.updateComment(TEST_COMMENT_ID, { content: '更新内容' });

      expect(result).toEqual(mockComment);
      expect(mockPrismaReviewComment.update).toHaveBeenCalledWith({
        where: { id: TEST_COMMENT_ID },
        data: { content: '更新内容' },
        include: expect.any(Object),
      });
    });
  });

  describe('updateCommentStatus', () => {
    it('コメントステータスを更新できる', async () => {
      const mockComment = { id: TEST_COMMENT_ID, status: 'RESOLVED' };
      mockPrismaReviewComment.update.mockResolvedValue(mockComment);

      const result = await repository.updateCommentStatus(TEST_COMMENT_ID, 'RESOLVED');

      expect(result).toEqual(mockComment);
      expect(mockPrismaReviewComment.update).toHaveBeenCalledWith({
        where: { id: TEST_COMMENT_ID },
        data: { status: 'RESOLVED' },
        include: expect.any(Object),
      });
    });
  });

  describe('deleteComment', () => {
    it('コメントを物理削除できる', async () => {
      const mockComment = { id: TEST_COMMENT_ID };
      mockPrismaReviewComment.delete.mockResolvedValue(mockComment);

      const result = await repository.deleteComment(TEST_COMMENT_ID);

      expect(result).toEqual(mockComment);
      expect(mockPrismaReviewComment.delete).toHaveBeenCalledWith({
        where: { id: TEST_COMMENT_ID },
      });
    });
  });

  describe('findReplyById', () => {
    it('返信をcomment.review情報付きで取得できる', async () => {
      const mockReply = {
        id: TEST_REPLY_ID,
        commentId: TEST_COMMENT_ID,
        comment: { id: TEST_COMMENT_ID, review: { id: TEST_REVIEW_ID } },
      };
      mockPrismaReviewCommentReply.findUnique.mockResolvedValue(mockReply);

      const result = await repository.findReplyById(TEST_REPLY_ID);

      expect(result).toEqual(mockReply);
      expect(mockPrismaReviewCommentReply.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_REPLY_ID },
        include: expect.objectContaining({
          comment: { include: { review: true } },
        }),
      });
    });

    it('存在しない返信はnullを返す', async () => {
      mockPrismaReviewCommentReply.findUnique.mockResolvedValue(null);

      const result = await repository.findReplyById(TEST_REPLY_ID);

      expect(result).toBeNull();
    });
  });

  describe('addReply', () => {
    it('返信を作成できる', async () => {
      const mockReply = { id: TEST_REPLY_ID, content: '返信内容' };
      mockPrismaReviewCommentReply.create.mockResolvedValue(mockReply);

      const result = await repository.addReply({
        commentId: TEST_COMMENT_ID,
        authorUserId: TEST_USER_ID,
        content: '返信内容',
      });

      expect(result).toEqual(mockReply);
      expect(mockPrismaReviewCommentReply.create).toHaveBeenCalledWith({
        data: {
          commentId: TEST_COMMENT_ID,
          authorUserId: TEST_USER_ID,
          authorAgentSessionId: undefined,
          content: '返信内容',
        },
        include: expect.any(Object),
      });
    });
  });

  describe('updateReply', () => {
    it('返信を更新できる', async () => {
      const mockReply = { id: TEST_REPLY_ID, content: '更新返信' };
      mockPrismaReviewCommentReply.update.mockResolvedValue(mockReply);

      const result = await repository.updateReply(TEST_REPLY_ID, { content: '更新返信' });

      expect(result).toEqual(mockReply);
      expect(mockPrismaReviewCommentReply.update).toHaveBeenCalledWith({
        where: { id: TEST_REPLY_ID },
        data: { content: '更新返信' },
        include: expect.any(Object),
      });
    });
  });

  describe('deleteReply', () => {
    it('返信を物理削除できる', async () => {
      const mockReply = { id: TEST_REPLY_ID };
      mockPrismaReviewCommentReply.delete.mockResolvedValue(mockReply);

      const result = await repository.deleteReply(TEST_REPLY_ID);

      expect(result).toEqual(mockReply);
      expect(mockPrismaReviewCommentReply.delete).toHaveBeenCalledWith({
        where: { id: TEST_REPLY_ID },
      });
    });
  });

  describe('getOpenCommentCount', () => {
    it('未解決コメント数を取得できる', async () => {
      mockPrismaReviewComment.count.mockResolvedValue(3);

      const result = await repository.getOpenCommentCount(TEST_REVIEW_ID);

      expect(result).toBe(3);
      expect(mockPrismaReviewComment.count).toHaveBeenCalledWith({
        where: { reviewId: TEST_REVIEW_ID, status: 'OPEN' },
      });
    });

    it('未解決コメントがない場合は0を返す', async () => {
      mockPrismaReviewComment.count.mockResolvedValue(0);

      const result = await repository.getOpenCommentCount(TEST_REVIEW_ID);

      expect(result).toBe(0);
    });
  });
});
