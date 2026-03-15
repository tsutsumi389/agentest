import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ReviewCommentController } from '../../controllers/review-comment.controller.js';
import { NotFoundError } from '@agentest/shared';

// ReviewCommentService のモック
const mockReviewCommentService = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateStatus: vi.fn(),
  createReply: vi.fn(),
  updateReply: vi.fn(),
  deleteReply: vi.fn(),
  search: vi.fn(),
};

vi.mock('../../services/review-comment.service.js', () => ({
  ReviewCommentService: vi.fn().mockImplementation(() => mockReviewCommentService),
}));

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_COMMENT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_REPLY_ID = '33333333-3333-3333-3333-333333333333';
const TEST_SUITE_ID = '44444444-4444-4444-4444-444444444444';
const TEST_CASE_ID = '55555555-5555-5555-5555-555555555555';

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID, email: 'test@example.com' } as any,
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

describe('ReviewCommentController', () => {
  let controller: ReviewCommentController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ReviewCommentController();
    mockNext = vi.fn();
  });

  describe('create', () => {
    it('コメントを作成できる', async () => {
      const mockComment = {
        id: TEST_COMMENT_ID,
        content: 'Test comment',
        authorId: TEST_USER_ID,
      };
      mockReviewCommentService.create.mockResolvedValue(mockComment);

      const req = mockRequest({
        body: {
          targetType: 'CASE',
          targetId: TEST_CASE_ID,
          targetField: 'TITLE',
          content: 'Test comment',
        },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.create(req, res, mockNext);

      expect(mockReviewCommentService.create).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          targetType: 'CASE',
          targetId: TEST_CASE_ID,
          targetField: 'TITLE',
          content: 'Test comment',
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ comment: mockComment });
    });
  });

  describe('getById', () => {
    it('コメント詳細を取得できる', async () => {
      const mockComment = {
        id: TEST_COMMENT_ID,
        content: 'Test comment',
      };
      mockReviewCommentService.findById.mockResolvedValue(mockComment);

      const req = mockRequest({
        params: { commentId: TEST_COMMENT_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockReviewCommentService.findById).toHaveBeenCalledWith(TEST_COMMENT_ID);
      expect(res.json).toHaveBeenCalledWith({ comment: mockComment });
    });

    it('エラーをnextに渡す', async () => {
      const error = new NotFoundError('ReviewComment', TEST_COMMENT_ID);
      mockReviewCommentService.findById.mockRejectedValue(error);

      const req = mockRequest({
        params: { commentId: TEST_COMMENT_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('update', () => {
    it('コメントを更新できる', async () => {
      const mockComment = {
        id: TEST_COMMENT_ID,
        content: 'Updated comment',
      };
      mockReviewCommentService.update.mockResolvedValue(mockComment);

      const req = mockRequest({
        params: { commentId: TEST_COMMENT_ID },
        body: { content: 'Updated comment' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.update(req, res, mockNext);

      expect(mockReviewCommentService.update).toHaveBeenCalledWith(TEST_COMMENT_ID, TEST_USER_ID, {
        content: 'Updated comment',
      });
      expect(res.json).toHaveBeenCalledWith({ comment: mockComment });
    });
  });

  describe('delete', () => {
    it('コメントを削除できる', async () => {
      mockReviewCommentService.delete.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { commentId: TEST_COMMENT_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.delete(req, res, mockNext);

      expect(mockReviewCommentService.delete).toHaveBeenCalledWith(TEST_COMMENT_ID, TEST_USER_ID);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('コメントステータスを更新できる', async () => {
      const mockComment = {
        id: TEST_COMMENT_ID,
        status: 'RESOLVED',
      };
      mockReviewCommentService.updateStatus.mockResolvedValue(mockComment);

      const req = mockRequest({
        params: { commentId: TEST_COMMENT_ID },
        body: { status: 'RESOLVED' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateStatus(req, res, mockNext);

      expect(mockReviewCommentService.updateStatus).toHaveBeenCalledWith(
        TEST_COMMENT_ID,
        TEST_USER_ID,
        'RESOLVED'
      );
      expect(res.json).toHaveBeenCalledWith({ comment: mockComment });
    });
  });

  describe('createReply', () => {
    it('返信を作成できる', async () => {
      const mockReply = {
        id: TEST_REPLY_ID,
        content: 'Reply content',
        authorId: TEST_USER_ID,
      };
      mockReviewCommentService.createReply.mockResolvedValue(mockReply);

      const req = mockRequest({
        params: { commentId: TEST_COMMENT_ID },
        body: { content: 'Reply content' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.createReply(req, res, mockNext);

      expect(mockReviewCommentService.createReply).toHaveBeenCalledWith(
        TEST_COMMENT_ID,
        TEST_USER_ID,
        { content: 'Reply content' }
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ reply: mockReply });
    });
  });

  describe('updateReply', () => {
    it('返信を更新できる', async () => {
      const mockReply = {
        id: TEST_REPLY_ID,
        content: 'Updated reply',
      };
      mockReviewCommentService.updateReply.mockResolvedValue(mockReply);

      const req = mockRequest({
        params: { commentId: TEST_COMMENT_ID, replyId: TEST_REPLY_ID },
        body: { content: 'Updated reply' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateReply(req, res, mockNext);

      expect(mockReviewCommentService.updateReply).toHaveBeenCalledWith(
        TEST_COMMENT_ID,
        TEST_REPLY_ID,
        TEST_USER_ID,
        { content: 'Updated reply' }
      );
      expect(res.json).toHaveBeenCalledWith({ reply: mockReply });
    });
  });

  describe('deleteReply', () => {
    it('返信を削除できる', async () => {
      mockReviewCommentService.deleteReply.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { commentId: TEST_COMMENT_ID, replyId: TEST_REPLY_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deleteReply(req, res, mockNext);

      expect(mockReviewCommentService.deleteReply).toHaveBeenCalledWith(
        TEST_COMMENT_ID,
        TEST_REPLY_ID,
        TEST_USER_ID
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getTestSuiteComments', () => {
    it('テストスイートのコメント一覧を取得できる', async () => {
      const mockResult = {
        items: [{ id: TEST_COMMENT_ID, content: 'Comment' }],
        total: 1,
      };
      mockReviewCommentService.search.mockResolvedValue(mockResult);

      const req = mockRequest({
        params: { testSuiteId: TEST_SUITE_ID },
        query: { limit: '10', offset: '0' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getTestSuiteComments(req, res, mockNext);

      expect(mockReviewCommentService.search).toHaveBeenCalledWith(
        'SUITE',
        TEST_SUITE_ID,
        expect.objectContaining({
          limit: 10,
          offset: 0,
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        comments: mockResult.items,
        total: 1,
        limit: 10,
        offset: 0,
      });
    });

    it('statusでフィルタできる', async () => {
      mockReviewCommentService.search.mockResolvedValue({
        items: [],
        total: 0,
      });

      const req = mockRequest({
        params: { testSuiteId: TEST_SUITE_ID },
        query: { status: 'OPEN' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getTestSuiteComments(req, res, mockNext);

      expect(mockReviewCommentService.search).toHaveBeenCalledWith(
        'SUITE',
        TEST_SUITE_ID,
        expect.objectContaining({
          status: 'OPEN',
        })
      );
    });
  });

  describe('getTestCaseComments', () => {
    it('テストケースのコメント一覧を取得できる', async () => {
      const mockResult = {
        items: [{ id: TEST_COMMENT_ID, content: 'Comment' }],
        total: 1,
      };
      mockReviewCommentService.search.mockResolvedValue(mockResult);

      const req = mockRequest({
        params: { testCaseId: TEST_CASE_ID },
        query: { limit: '10', offset: '0' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getTestCaseComments(req, res, mockNext);

      expect(mockReviewCommentService.search).toHaveBeenCalledWith(
        'CASE',
        TEST_CASE_ID,
        expect.objectContaining({
          limit: 10,
          offset: 0,
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        comments: mockResult.items,
        total: 1,
        limit: 10,
        offset: 0,
      });
    });
  });
});
