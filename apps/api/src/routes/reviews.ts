import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { ReviewController } from '../controllers/review.controller.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const reviewController = new ReviewController();

/**
 * 自分の下書きレビュー一覧取得
 * GET /api/reviews/drafts
 */
router.get('/drafts', requireAuth(authConfig), reviewController.getDrafts);

/**
 * レビュー詳細取得
 * GET /api/reviews/:reviewId
 */
router.get('/:reviewId', requireAuth(authConfig), reviewController.getById);

/**
 * レビュー更新
 * PATCH /api/reviews/:reviewId
 * 投稿者本人のみ（サービス層でチェック）
 */
router.patch('/:reviewId', requireAuth(authConfig), reviewController.update);

/**
 * レビュー提出（DRAFT → SUBMITTED）
 * POST /api/reviews/:reviewId/submit
 * 投稿者本人のみ（サービス層でチェック）
 */
router.post('/:reviewId/submit', requireAuth(authConfig), reviewController.submit);

/**
 * 提出済みレビューの評価変更
 * PATCH /api/reviews/:reviewId/verdict
 * 投稿者本人のみ（サービス層でチェック）
 */
router.patch('/:reviewId/verdict', requireAuth(authConfig), reviewController.updateVerdict);

/**
 * レビュー削除（DRAFTのみ）
 * DELETE /api/reviews/:reviewId
 * 投稿者本人のみ（サービス層でチェック）
 */
router.delete('/:reviewId', requireAuth(authConfig), reviewController.delete);

/**
 * コメント追加
 * POST /api/reviews/:reviewId/comments
 * 権限はサービス層でチェック
 */
router.post('/:reviewId/comments', requireAuth(authConfig), reviewController.addComment);

/**
 * コメント更新
 * PATCH /api/reviews/:reviewId/comments/:commentId
 * 投稿者本人のみ（サービス層でチェック）
 */
router.patch('/:reviewId/comments/:commentId', requireAuth(authConfig), reviewController.updateComment);

/**
 * コメントステータス変更
 * PATCH /api/reviews/:reviewId/comments/:commentId/status
 * 権限はサービス層でチェック
 */
router.patch('/:reviewId/comments/:commentId/status', requireAuth(authConfig), reviewController.updateCommentStatus);

/**
 * コメント削除
 * DELETE /api/reviews/:reviewId/comments/:commentId
 * 投稿者本人のみ（サービス層でチェック）
 */
router.delete('/:reviewId/comments/:commentId', requireAuth(authConfig), reviewController.deleteComment);

/**
 * 返信追加
 * POST /api/reviews/:reviewId/comments/:commentId/replies
 * 権限はサービス層でチェック
 */
router.post('/:reviewId/comments/:commentId/replies', requireAuth(authConfig), reviewController.addReply);

/**
 * 返信更新
 * PATCH /api/reviews/:reviewId/comments/:commentId/replies/:replyId
 * 投稿者本人のみ（サービス層でチェック）
 */
router.patch(
  '/:reviewId/comments/:commentId/replies/:replyId',
  requireAuth(authConfig),
  reviewController.updateReply
);

/**
 * 返信削除
 * DELETE /api/reviews/:reviewId/comments/:commentId/replies/:replyId
 * 投稿者本人のみ（サービス層でチェック）
 */
router.delete(
  '/:reviewId/comments/:commentId/replies/:replyId',
  requireAuth(authConfig),
  reviewController.deleteReply
);

export default router;
