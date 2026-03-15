import type { Request, Response, NextFunction } from 'express';
import {
  reviewCommentCreateSchema,
  reviewCommentUpdateSchema,
  reviewStatusUpdateSchema,
  reviewReplyCreateSchema,
  reviewCommentSearchSchema,
} from '@agentest/shared';
import { z } from 'zod';
import { ReviewCommentService } from '../services/review-comment.service.js';

const commentIdSchema = z.object({
  commentId: z.string().uuid(),
});

const replyIdSchema = z.object({
  commentId: z.string().uuid(),
  replyId: z.string().uuid(),
});

/**
 * レビューコメントコントローラー
 */
export class ReviewCommentController {
  private reviewCommentService = new ReviewCommentService();

  /**
   * コメント作成
   * POST /api/review-comments
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = reviewCommentCreateSchema.parse(req.body);
      const comment = await this.reviewCommentService.create(req.user!.id, data);

      res.status(201).json({ comment });
    } catch (error) {
      next(error);
    }
  };

  /**
   * コメント詳細取得
   * GET /api/review-comments/:commentId
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { commentId } = commentIdSchema.parse(req.params);
      const comment = await this.reviewCommentService.findById(commentId);

      res.json({ comment });
    } catch (error) {
      next(error);
    }
  };

  /**
   * コメント編集
   * PATCH /api/review-comments/:commentId
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { commentId } = commentIdSchema.parse(req.params);
      const data = reviewCommentUpdateSchema.parse(req.body);
      const comment = await this.reviewCommentService.update(commentId, req.user!.id, data);

      res.json({ comment });
    } catch (error) {
      next(error);
    }
  };

  /**
   * コメント削除
   * DELETE /api/review-comments/:commentId
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { commentId } = commentIdSchema.parse(req.params);
      await this.reviewCommentService.delete(commentId, req.user!.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * ステータス変更
   * PATCH /api/review-comments/:commentId/status
   */
  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { commentId } = commentIdSchema.parse(req.params);
      const { status } = reviewStatusUpdateSchema.parse(req.body);
      const comment = await this.reviewCommentService.updateStatus(commentId, req.user!.id, status);

      res.json({ comment });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 返信作成
   * POST /api/review-comments/:commentId/replies
   */
  createReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { commentId } = commentIdSchema.parse(req.params);
      const data = reviewReplyCreateSchema.parse(req.body);
      const reply = await this.reviewCommentService.createReply(commentId, req.user!.id, data);

      res.status(201).json({ reply });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 返信編集
   * PATCH /api/review-comments/:commentId/replies/:replyId
   */
  updateReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { commentId, replyId } = replyIdSchema.parse(req.params);
      const data = reviewCommentUpdateSchema.parse(req.body);
      const reply = await this.reviewCommentService.updateReply(
        commentId,
        replyId,
        req.user!.id,
        data
      );

      res.json({ reply });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 返信削除
   * DELETE /api/review-comments/:commentId/replies/:replyId
   */
  deleteReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { commentId, replyId } = replyIdSchema.parse(req.params);
      await this.reviewCommentService.deleteReply(commentId, replyId, req.user!.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストスイートのコメント一覧取得
   * GET /api/test-suites/:testSuiteId/comments
   */
  getTestSuiteComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const searchParams = reviewCommentSearchSchema.parse(req.query);
      const { items, total } = await this.reviewCommentService.search(
        'SUITE',
        testSuiteId,
        searchParams
      );

      res.json({
        comments: items,
        total,
        limit: searchParams.limit,
        offset: searchParams.offset,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストケースのコメント一覧取得
   * GET /api/test-cases/:testCaseId/comments
   */
  getTestCaseComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const searchParams = reviewCommentSearchSchema.parse(req.query);
      const { items, total } = await this.reviewCommentService.search(
        'CASE',
        testCaseId,
        searchParams
      );

      res.json({
        comments: items,
        total,
        limit: searchParams.limit,
        offset: searchParams.offset,
      });
    } catch (error) {
      next(error);
    }
  };
}
