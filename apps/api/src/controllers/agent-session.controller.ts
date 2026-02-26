import type { Request, Response, NextFunction } from 'express'
import { AuthenticationError, ValidationError } from '@agentest/shared'
import { AgentSessionService } from '../services/agent-session.service.js'

export class AgentSessionController {
  private agentSessionService = new AgentSessionService()

  getSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('認証が必要です')
      }

      const statusParam = req.query.status as string | undefined
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50))

      const statuses = this.agentSessionService.parseStatuses(statusParam)

      const { sessions, total } = await this.agentSessionService.getSessionsByUser({
        userId: req.user.id,
        statuses,
        page,
        limit,
      })

      res.json({
        data: sessions,
        meta: { total, page, limit },
      })
    } catch (error) {
      next(error)
    }
  }

  endSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('認証が必要です')
      }

      const { sessionId } = req.params
      if (!sessionId) {
        throw new ValidationError('セッションIDが必要です')
      }

      const result = await this.agentSessionService.endSession(req.user.id, sessionId)
      res.json({ data: result })
    } catch (error) {
      next(error)
    }
  }
}
