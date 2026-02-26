import type { AgentSessionStatus } from '@agentest/db'
import { NotFoundError, AuthorizationError, ValidationError } from '@agentest/shared'
import { AgentSessionRepository } from '../repositories/agent-session.repository.js'
import { logger as baseLogger } from '../utils/logger.js'

const logger = baseLogger.child({ module: 'agent-session' })

const VALID_STATUSES: AgentSessionStatus[] = ['ACTIVE', 'IDLE', 'ENDED', 'TIMEOUT']
const DEFAULT_STATUSES: AgentSessionStatus[] = ['ACTIVE', 'IDLE']

// API レスポンス用の型
export interface AgentSessionInfo {
  id: string
  projectId: string
  projectName: string
  clientId: string
  clientName: string | null
  status: AgentSessionStatus
  startedAt: Date
  lastHeartbeat: Date
  endedAt: Date | null
}

interface GetSessionsParams {
  userId: string
  statuses: AgentSessionStatus[]
  page: number
  limit: number
}

export class AgentSessionService {
  private agentSessionRepo = new AgentSessionRepository()

  // ステータスパラメータをパースする
  parseStatuses(statusParam?: string): AgentSessionStatus[] {
    if (!statusParam) {
      return DEFAULT_STATUSES
    }

    const parsed = statusParam
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is AgentSessionStatus => VALID_STATUSES.includes(s as AgentSessionStatus))

    return parsed.length > 0 ? parsed : DEFAULT_STATUSES
  }

  // ユーザーのセッション一覧を取得する
  async getSessionsByUser(params: GetSessionsParams): Promise<{ sessions: AgentSessionInfo[]; total: number }> {
    const { userId, statuses, page, limit } = params

    const result = await this.agentSessionRepo.findByUserProjects({
      userId,
      statuses,
      page,
      limit,
    })

    // DBモデルからAPI用DTOに変換（projectNameをフラット化）
    const sessions: AgentSessionInfo[] = result.sessions.map((session) => ({
      id: session.id,
      projectId: session.projectId,
      projectName: session.project.name,
      clientId: session.clientId,
      clientName: session.clientName,
      status: session.status,
      startedAt: session.startedAt,
      lastHeartbeat: session.lastHeartbeat,
      endedAt: session.endedAt,
    }))

    return { sessions, total: result.total }
  }

  // セッションを終了する
  async endSession(userId: string, sessionId: string): Promise<{ success: boolean }> {
    // セッション存在確認
    const session = await this.agentSessionRepo.findById(sessionId)
    if (!session) {
      throw new NotFoundError('AgentSession', sessionId)
    }

    // プロジェクトメンバーチェック
    const isMember = await this.agentSessionRepo.isProjectMember(session.projectId, userId)
    if (!isMember) {
      throw new AuthorizationError('このセッションを終了する権限がありません')
    }

    // 終了済み検証
    if (session.status === 'ENDED' || session.status === 'TIMEOUT') {
      throw new ValidationError('このセッションは既に終了しています')
    }

    await this.agentSessionRepo.endSession(sessionId)
    logger.info({ sessionId, userId }, 'MCPセッションを終了しました')

    return { success: true }
  }
}
