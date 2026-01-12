import type { Request, Response, NextFunction } from 'express';
import {
  reviewCreateSchema,
  reviewUpdateSchema,
  reviewSubmitSchema,
  reviewSearchSchema,
  reviewCommentCreateSchema,
  reviewCommentUpdateSchema,
  reviewStatusUpdateSchema,
  reviewReplyCreateSchema,
} from '@agentest/shared';
import { z } from 'zod';
import { ReviewService } from '../services/review.service.js';

const testSuiteIdSchema = z.object({
  testSuiteId: z.string().uuid(),
});

const reviewIdSchema = z.object({
  reviewId: z.string().uuid(),
});

const commentIdSchema = z.object({
  reviewId: z.string().uuid(),
  commentId: z.string().uuid(),
});

const replyIdSchema = z.object({
  reviewId: z.string().uuid(),
  commentId: z.string().uuid(),
  replyId: z.string().uuid(),
});

/**
 * レビューコントローラー
 */
export class ReviewController {
  private reviewService = new ReviewService();

  /**
   * レビュー開始（DRAFT作成）
   * POST /api/test-suites/:testSuiteId/reviews
   */
  startReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = testSuiteIdSchema.parse(req.params);
      const data = reviewCreateSchema.parse(req.body);
      const review = await this.reviewService.startReview(req.user!.id, {
        testSuiteId,
        ...data,
      });

      res.status(201).json({ review });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストスイートのレビュー一覧取得（SUBMITTEDのみ）
   * GET /api/test-suites/:testSuiteId/reviews
   */
  getReviewsByTestSuite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = testSuiteIdSchema.parse(req.params);
      const options = reviewSearchSchema.parse(req.query);
      const result = await this.reviewService.searchByTestSuite(testSuiteId, options);

      res.json({
        reviews: result.items,
        total: result.total,
        limit: options.limit,
        offset: options.offset,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 自分の下書きレビュー一覧取得
   * GET /api/reviews/drafts
   */
  getDrafts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const drafts = await this.reviewService.getDraftsByUser(req.user!.id);

      res.json({ reviews: drafts });
    } catch (error) {
      next(error);
    }
  };

  /**
   * レビュー詳細取得
   * GET /api/reviews/:reviewId
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewId } = reviewIdSchema.parse(req.params);

      // アクセス権限確認
      const canAccess = await this.reviewService.canAccessReview(reviewId, req.user!.id);
      if (!canAccess) {
        res.status(404).json({ error: { message: 'Review not found' } });
        return;
      }

      const review = await this.reviewService.findById(reviewId);

      res.json({ review });
    } catch (error) {
      next(error);
    }
  };

  /**
   * レビュー更新
   * PATCH /api/reviews/:reviewId
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewId } = reviewIdSchema.parse(req.params);
      const data = reviewUpdateSchema.parse(req.body);
      const review = await this.reviewService.update(reviewId, req.user!.id, data);

      res.json({ review });
    } catch (error) {
      next(error);
    }
  };

  /**
   * レビュー提出（DRAFT → SUBMITTED）
   * POST /api/reviews/:reviewId/submit
   */
  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewId } = reviewIdSchema.parse(req.params);
      const data = reviewSubmitSchema.parse(req.body);
      const review = await this.reviewService.submit(reviewId, req.user!.id, data);

      res.json({ review });
    } catch (error) {
      next(error);
    }
  };

  /**
   * レビュー削除（DRAFTのみ）
   * DELETE /api/reviews/:reviewId
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewId } = reviewIdSchema.parse(req.params);
      await this.reviewService.delete(reviewId, req.user!.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * コメント追加
   * POST /api/reviews/:reviewId/comments
   */
  addComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewId } = reviewIdSchema.parse(req.params);
      const data = reviewCommentCreateSchema.parse(req.body);
      const comment = await this.reviewService.addComment(reviewId, req.user!.id, data);

      res.status(201).json({ comment });
    } catch (error) {
      next(error);
    }
  };

  /**
   * コメント更新
   * PATCH /api/reviews/:reviewId/comments/:commentId
   */
  updateComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewId, commentId } = commentIdSchema.parse(req.params);
      const data = reviewCommentUpdateSchema.parse(req.body);
      const comment = await this.reviewService.updateComment(reviewId, commentId, req.user!.id, data);

      res.json({ comment });
    } catch (error) {
      next(error);
    }
  };

  /**
   * コメントステータス変更
   * PATCH /api/reviews/:reviewId/comments/:commentId/status
   */
  updateCommentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewId, commentId } = commentIdSchema.parse(req.params);
      const { status } = reviewStatusUpdateSchema.parse(req.body);
      const comment = await this.reviewService.updateCommentStatus(reviewId, commentId, req.user!.id, status);

      res.json({ comment });
    } catch (error) {
      next(error);
    }
  };

  /**
   * コメント削除
   * DELETE /api/reviews/:reviewId/comments/:commentId
   */
  deleteComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewId, commentId } = commentIdSchema.parse(req.params);
      await this.reviewService.deleteComment(reviewId, commentId, req.user!.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * 返信追加
   * POST /api/reviews/:reviewId/comments/:commentId/replies
   */
  addReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewId, commentId } = commentIdSchema.parse(req.params);
      const data = reviewReplyCreateSchema.parse(req.body);
      const reply = await this.reviewService.addReply(reviewId, commentId, req.user!.id, data);

      res.status(201).json({ reply });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 返信更新
   * PATCH /api/reviews/:reviewId/comments/:commentId/replies/:replyId
   */
  updateReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewId, commentId, replyId } = replyIdSchema.parse(req.params);
      const data = reviewReplyCreateSchema.parse(req.body);
      const reply = await this.reviewService.updateReply(reviewId, commentId, replyId, req.user!.id, data);

      res.json({ reply });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 返信削除
   * DELETE /api/reviews/:reviewId/comments/:commentId/replies/:replyId
   */
  deleteReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewId, commentId, replyId } = replyIdSchema.parse(req.params);
      await this.reviewService.deleteReply(reviewId, commentId, replyId, req.user!.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
