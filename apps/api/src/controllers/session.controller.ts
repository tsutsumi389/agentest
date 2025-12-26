import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, ValidationError } from '@agentest/shared';
import { SessionService } from '../services/session.service.js';

/**
 * セッション管理コントローラー
 */
export class SessionController {
  private sessionService = new SessionService();

  /**
   * 現在のユーザーのセッション一覧を取得
   * GET /api/sessions
   */
  getSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('認証が必要です');
      }

      // 現在のセッションIDを取得（リクエストに含まれている場合）
      const currentSessionId = req.sessionId;

      const sessions = await this.sessionService.getUserSessions(
        req.user.id,
        currentSessionId
      );

      res.json({ sessions });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 特定のセッションを終了（強制ログアウト）
   * DELETE /api/sessions/:sessionId
   */
  revokeSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('認証が必要です');
      }

      const { sessionId } = req.params;
      if (!sessionId) {
        throw new ValidationError('セッションIDが必要です');
      }

      // 現在のセッションを終了しようとしている場合は警告
      if (sessionId === req.sessionId) {
        throw new ValidationError(
          '現在使用中のセッションは終了できません。ログアウトを使用してください。'
        );
      }

      const result = await this.sessionService.revokeSession(req.user.id, sessionId);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * 他の全セッションを終了（現在のセッション以外）
   * DELETE /api/sessions
   */
  revokeOtherSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('認証が必要です');
      }

      if (!req.sessionId) {
        throw new AuthenticationError('現在のセッションを特定できません');
      }

      const result = await this.sessionService.revokeOtherSessions(
        req.user.id,
        req.sessionId
      );

      res.json({
        message: `${result.revokedCount}件のセッションを終了しました`,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 有効なセッション数を取得
   * GET /api/sessions/count
   */
  getSessionCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('認証が必要です');
      }

      const count = await this.sessionService.getActiveSessionCount(req.user.id);

      res.json({ count });
    } catch (error) {
      next(error);
    }
  };
}
