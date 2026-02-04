import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ReviewServiceモック
const mockReviewService = {
  startReview: vi.fn(),
  searchByTestSuite: vi.fn(),
  getDraftsByUser: vi.fn(),
  getAccessibleReview: vi.fn(),
  update: vi.fn(),
  submit: vi.fn(),
  updateVerdict: vi.fn(),
  delete: vi.fn(),
  addComment: vi.fn(),
  updateComment: vi.fn(),
  updateCommentStatus: vi.fn(),
  deleteComment: vi.fn(),
  addReply: vi.fn(),
  updateReply: vi.fn(),
  deleteReply: vi.fn(),
};

vi.mock('../../services/review.service.js', () => ({
  ReviewService: vi.fn().mockImplementation(() => mockReviewService),
}));

import { ReviewController } from '../../controllers/review.controller.js';

// テスト用固定ID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_REVIEW_ID = '22222222-2222-2222-2222-222222222222';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_COMMENT_ID = '44444444-4444-4444-4444-444444444444';
const TEST_REPLY_ID = '55555555-5555-5555-5555-555555555555';

// req/resモックファクトリ
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID } as any,
  params: {},
  body: {},
  query: {},
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('ReviewController', () => {
  let controller: ReviewController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ReviewController();
    mockNext = vi.fn();
  });

  describe('startReview', () => {
    it('レビューを開始して201を返す', async () => {
      const mockReview = { id: TEST_REVIEW_ID, status: 'DRAFT' };
      mockReviewService.startReview.mockResolvedValue(mockReview);

      const req = mockRequest({
        params: { testSuiteId: TEST_SUITE_ID },
        body: { summary: 'テスト' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.startReview(req, res, mockNext);

      expect(mockReviewService.startReview).toHaveBeenCalledWith(TEST_USER_ID, {
        testSuiteId: TEST_SUITE_ID,
        summary: 'テスト',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ review: mockReview });
    });

    it('無効なtestSuiteIdの場合はnextにエラーを渡す', async () => {
      const req = mockRequest({
        params: { testSuiteId: 'invalid-uuid' },
        body: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.startReview(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('サービスエラーをnextに渡す', async () => {
      const error = new Error('Service error');
      mockReviewService.startReview.mockRejectedValue(error);

      const req = mockRequest({
        params: { testSuiteId: TEST_SUITE_ID },
        body: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.startReview(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getReviewsByTestSuite', () => {
    it('レビュー一覧を取得して200を返す', async () => {
      const mockResult = { items: [{ id: TEST_REVIEW_ID }], total: 1 };
      mockReviewService.searchByTestSuite.mockResolvedValue(mockResult);

      const req = mockRequest({
        params: { testSuiteId: TEST_SUITE_ID },
        query: { limit: '10', offset: '0' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getReviewsByTestSuite(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        reviews: mockResult.items,
        total: 1,
        limit: 10,
        offset: 0,
      });
    });

    it('verdictフィルタ付きで検索できる', async () => {
      mockReviewService.searchByTestSuite.mockResolvedValue({ items: [], total: 0 });

      const req = mockRequest({
        params: { testSuiteId: TEST_SUITE_ID },
        query: { limit: '10', offset: '0', verdict: 'APPROVED' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getReviewsByTestSuite(req, res, mockNext);

      expect(mockReviewService.searchByTestSuite).toHaveBeenCalledWith(
        TEST_SUITE_ID,
        expect.objectContaining({ verdict: 'APPROVED' })
      );
    });
  });

  describe('getDrafts', () => {
    it('下書き一覧を取得して200を返す', async () => {
      const mockDrafts = [{ id: TEST_REVIEW_ID, status: 'DRAFT' }];
      mockReviewService.getDraftsByUser.mockResolvedValue(mockDrafts);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getDrafts(req, res, mockNext);

      expect(mockReviewService.getDraftsByUser).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ reviews: mockDrafts });
    });
  });

  describe('getById', () => {
    it('レビューを取得して200を返す', async () => {
      const mockReview = { id: TEST_REVIEW_ID };
      mockReviewService.getAccessibleReview.mockResolvedValue(mockReview);

      const req = mockRequest({ params: { reviewId: TEST_REVIEW_ID } }) as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockReviewService.getAccessibleReview).toHaveBeenCalledWith(TEST_REVIEW_ID, TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ review: mockReview });
    });

    it('レビューが見つからない場合は404を返す', async () => {
      mockReviewService.getAccessibleReview.mockResolvedValue(null);

      const req = mockRequest({ params: { reviewId: TEST_REVIEW_ID } }) as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: { message: 'Review not found' } });
    });

    it('無効なreviewIdの場合はnextにエラーを渡す', async () => {
      const req = mockRequest({ params: { reviewId: 'invalid-uuid' } }) as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('update', () => {
    it('レビューを更新して200を返す', async () => {
      const mockReview = { id: TEST_REVIEW_ID, summary: '更新' };
      mockReviewService.update.mockResolvedValue(mockReview);

      const req = mockRequest({
        params: { reviewId: TEST_REVIEW_ID },
        body: { summary: '更新' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.update(req, res, mockNext);

      expect(mockReviewService.update).toHaveBeenCalledWith(
        TEST_REVIEW_ID,
        TEST_USER_ID,
        expect.objectContaining({ summary: '更新' })
      );
      expect(res.json).toHaveBeenCalledWith({ review: mockReview });
    });
  });

  describe('submit', () => {
    it('レビューを提出して200を返す', async () => {
      const mockReview = { id: TEST_REVIEW_ID, status: 'SUBMITTED' };
      mockReviewService.submit.mockResolvedValue(mockReview);

      const req = mockRequest({
        params: { reviewId: TEST_REVIEW_ID },
        body: { verdict: 'APPROVED' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.submit(req, res, mockNext);

      expect(mockReviewService.submit).toHaveBeenCalledWith(
        TEST_REVIEW_ID,
        TEST_USER_ID,
        expect.objectContaining({ verdict: 'APPROVED' })
      );
      expect(res.json).toHaveBeenCalledWith({ review: mockReview });
    });
  });

  describe('updateVerdict', () => {
    it('評価を変更して200を返す', async () => {
      const mockReview = { id: TEST_REVIEW_ID, verdict: 'CHANGES_REQUESTED' };
      mockReviewService.updateVerdict.mockResolvedValue(mockReview);

      const req = mockRequest({
        params: { reviewId: TEST_REVIEW_ID },
        body: { verdict: 'CHANGES_REQUESTED' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateVerdict(req, res, mockNext);

      expect(mockReviewService.updateVerdict).toHaveBeenCalledWith(
        TEST_REVIEW_ID,
        TEST_USER_ID,
        expect.objectContaining({ verdict: 'CHANGES_REQUESTED' })
      );
      expect(res.json).toHaveBeenCalledWith({ review: mockReview });
    });
  });

  describe('delete', () => {
    it('レビューを削除して204を返す', async () => {
      mockReviewService.delete.mockResolvedValue(undefined);

      const req = mockRequest({ params: { reviewId: TEST_REVIEW_ID } }) as Request;
      const res = mockResponse() as Response;

      await controller.delete(req, res, mockNext);

      expect(mockReviewService.delete).toHaveBeenCalledWith(TEST_REVIEW_ID, TEST_USER_ID);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('addComment', () => {
    it('コメントを追加して201を返す', async () => {
      const mockComment = { id: TEST_COMMENT_ID, content: 'コメント' };
      mockReviewService.addComment.mockResolvedValue(mockComment);

      const req = mockRequest({
        params: { reviewId: TEST_REVIEW_ID },
        body: {
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
          targetField: 'TITLE',
          content: 'コメント',
        },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.addComment(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ comment: mockComment });
    });

    it('サービスエラーをnextに渡す', async () => {
      const error = new Error('Error');
      mockReviewService.addComment.mockRejectedValue(error);

      const req = mockRequest({
        params: { reviewId: TEST_REVIEW_ID },
        body: {
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
          targetField: 'TITLE',
          content: 'コメント',
        },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.addComment(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateComment', () => {
    it('コメントを更新して200を返す', async () => {
      const mockComment = { id: TEST_COMMENT_ID, content: '更新' };
      mockReviewService.updateComment.mockResolvedValue(mockComment);

      const req = mockRequest({
        params: { reviewId: TEST_REVIEW_ID, commentId: TEST_COMMENT_ID },
        body: { content: '更新' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateComment(req, res, mockNext);

      expect(mockReviewService.updateComment).toHaveBeenCalledWith(
        TEST_REVIEW_ID,
        TEST_COMMENT_ID,
        TEST_USER_ID,
        expect.objectContaining({ content: '更新' })
      );
      expect(res.json).toHaveBeenCalledWith({ comment: mockComment });
    });
  });

  describe('updateCommentStatus', () => {
    it('コメントステータスを変更して200を返す', async () => {
      const mockComment = { id: TEST_COMMENT_ID, status: 'RESOLVED' };
      mockReviewService.updateCommentStatus.mockResolvedValue(mockComment);

      const req = mockRequest({
        params: { reviewId: TEST_REVIEW_ID, commentId: TEST_COMMENT_ID },
        body: { status: 'RESOLVED' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateCommentStatus(req, res, mockNext);

      expect(mockReviewService.updateCommentStatus).toHaveBeenCalledWith(
        TEST_REVIEW_ID,
        TEST_COMMENT_ID,
        TEST_USER_ID,
        'RESOLVED'
      );
      expect(res.json).toHaveBeenCalledWith({ comment: mockComment });
    });
  });

  describe('deleteComment', () => {
    it('コメントを削除して204を返す', async () => {
      mockReviewService.deleteComment.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { reviewId: TEST_REVIEW_ID, commentId: TEST_COMMENT_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deleteComment(req, res, mockNext);

      expect(mockReviewService.deleteComment).toHaveBeenCalledWith(TEST_REVIEW_ID, TEST_COMMENT_ID, TEST_USER_ID);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('addReply', () => {
    it('返信を追加して201を返す', async () => {
      const mockReply = { id: TEST_REPLY_ID, content: '返信' };
      mockReviewService.addReply.mockResolvedValue(mockReply);

      const req = mockRequest({
        params: { reviewId: TEST_REVIEW_ID, commentId: TEST_COMMENT_ID },
        body: { content: '返信' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.addReply(req, res, mockNext);

      expect(mockReviewService.addReply).toHaveBeenCalledWith(
        TEST_REVIEW_ID,
        TEST_COMMENT_ID,
        TEST_USER_ID,
        expect.objectContaining({ content: '返信' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ reply: mockReply });
    });
  });

  describe('updateReply', () => {
    it('返信を更新して200を返す', async () => {
      const mockReply = { id: TEST_REPLY_ID, content: '更新' };
      mockReviewService.updateReply.mockResolvedValue(mockReply);

      const req = mockRequest({
        params: { reviewId: TEST_REVIEW_ID, commentId: TEST_COMMENT_ID, replyId: TEST_REPLY_ID },
        body: { content: '更新' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateReply(req, res, mockNext);

      expect(mockReviewService.updateReply).toHaveBeenCalledWith(
        TEST_REVIEW_ID,
        TEST_COMMENT_ID,
        TEST_REPLY_ID,
        TEST_USER_ID,
        expect.objectContaining({ content: '更新' })
      );
      expect(res.json).toHaveBeenCalledWith({ reply: mockReply });
    });
  });

  describe('deleteReply', () => {
    it('返信を削除して204を返す', async () => {
      mockReviewService.deleteReply.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { reviewId: TEST_REVIEW_ID, commentId: TEST_COMMENT_ID, replyId: TEST_REPLY_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deleteReply(req, res, mockNext);

      expect(mockReviewService.deleteReply).toHaveBeenCalledWith(
        TEST_REVIEW_ID,
        TEST_COMMENT_ID,
        TEST_REPLY_ID,
        TEST_USER_ID
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('無効なパラメータの場合はnextにエラーを渡す', async () => {
      const req = mockRequest({
        params: { reviewId: 'invalid', commentId: TEST_COMMENT_ID, replyId: TEST_REPLY_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deleteReply(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
