import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, ValidationError } from '@agentest/shared';
import { uuidSchema } from '@agentest/shared/validators';
import { AgentSessionService, type SessionSource } from '../services/agent-session.service.js';

const VALID_SOURCES: SessionSource[] = ['agent', 'oauth'];

export class AgentSessionController {
  private agentSessionService = new AgentSessionService();

  getSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('認証が必要です');
      }

      const statusParam = req.query.status as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

      const statuses = this.agentSessionService.parseStatuses(statusParam);

      const { sessions, total } = await this.agentSessionService.getSessionsByUser({
        userId: req.user.id,
        statuses,
        page,
        limit,
      });

      res.json({
        data: sessions,
        meta: { total, page, limit },
      });
    } catch (error) {
      next(error);
    }
  };

  endSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('認証が必要です');
      }

      const parseResult = uuidSchema.safeParse(req.params.sessionId);
      if (!parseResult.success) {
        throw new ValidationError('無効なセッションIDです');
      }

      const sourceParam = req.query.source as string | undefined;
      const source =
        sourceParam && VALID_SOURCES.includes(sourceParam as SessionSource)
          ? (sourceParam as SessionSource)
          : undefined;

      const result = await this.agentSessionService.endSession(
        req.user.id,
        parseResult.data,
        source
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  };
}
