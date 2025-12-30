import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { ReviewCommentController } from '../controllers/review-comment.controller.js';
import { requireReviewCommentRole } from '../middleware/require-review-comment-role.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const reviewCommentController = new ReviewCommentController();

/**
 * コメント作成
 * POST /api/review-comments
 * 認可はサービス層で実施（targetType, targetIdから判定）
 */
router.post('/', requireAuth(authConfig), reviewCommentController.create);

/**
 * コメント詳細取得
 * GET /api/review-comments/:commentId
 */
router.get(
  '/:commentId',
  requireAuth(authConfig),
  requireReviewCommentRole(['ADMIN', 'WRITE', 'READ']),
  reviewCommentController.getById
);

/**
 * コメント編集
 * PATCH /api/review-comments/:commentId
 * 投稿者本人のみ（サービス層でチェック）
 */
router.patch(
  '/:commentId',
  requireAuth(authConfig),
  requireReviewCommentRole(['ADMIN', 'WRITE', 'READ']),
  reviewCommentController.update
);

/**
 * コメント削除
 * DELETE /api/review-comments/:commentId
 * 投稿者本人のみ（サービス層でチェック）
 */
router.delete(
  '/:commentId',
  requireAuth(authConfig),
  requireReviewCommentRole(['ADMIN', 'WRITE', 'READ']),
  reviewCommentController.delete
);

/**
 * ステータス変更
 * PATCH /api/review-comments/:commentId/status
 */
router.patch(
  '/:commentId/status',
  requireAuth(authConfig),
  requireReviewCommentRole(['ADMIN', 'WRITE']),
  reviewCommentController.updateStatus
);

/**
 * 返信作成
 * POST /api/review-comments/:commentId/replies
 */
router.post(
  '/:commentId/replies',
  requireAuth(authConfig),
  requireReviewCommentRole(['ADMIN', 'WRITE']),
  reviewCommentController.createReply
);

/**
 * 返信編集
 * PATCH /api/review-comments/:commentId/replies/:replyId
 * 投稿者本人のみ（サービス層でチェック）
 */
router.patch(
  '/:commentId/replies/:replyId',
  requireAuth(authConfig),
  requireReviewCommentRole(['ADMIN', 'WRITE', 'READ']),
  reviewCommentController.updateReply
);

/**
 * 返信削除
 * DELETE /api/review-comments/:commentId/replies/:replyId
 * 投稿者本人のみ（サービス層でチェック）
 */
router.delete(
  '/:commentId/replies/:replyId',
  requireAuth(authConfig),
  requireReviewCommentRole(['ADMIN', 'WRITE', 'READ']),
  reviewCommentController.deleteReply
);

export default router;
