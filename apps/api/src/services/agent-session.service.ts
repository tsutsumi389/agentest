import type { AgentSessionStatus } from '@agentest/db'
import { NotFoundError, AuthorizationError, ValidationError } from '@agentest/shared'
import { AgentSessionRepository } from '../repositories/agent-session.repository.js'
import { logger as baseLogger } from '../utils/logger.js'

const logger = baseLogger.child({ module: 'agent-session' })

const VALID_STATUSES: AgentSessionStatus[] = ['ACTIVE', 'IDLE', 'ENDED', 'TIMEOUT']
const DEFAULT_STATUSES: AgentSessionStatus[] = ['ACTIVE', 'IDLE']

// 2つのデータソース（AgentSession + OAuthToken）を統合してからページネーションするため、
// まずは全件取得する必要がある。上限はパフォーマンス保護のため設定。
const MAX_MERGE_LIMIT = 1000

// セッション種別
export type SessionSource = 'agent' | 'oauth'

// API レスポンス用の型
export interface AgentSessionInfo {
  id: string
  source: SessionSource
  projectId: string | null
  projectName: string | null
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

  // ユーザーのセッション一覧を取得する（AgentSession + OAuthトークン統合）
  async getSessionsByUser(params: GetSessionsParams): Promise<{ sessions: AgentSessionInfo[]; total: number }> {
    const { userId, statuses, page, limit } = params

    const includeEnded = statuses.includes('ENDED') || statuses.includes('TIMEOUT')

    // AgentSessionとOAuthトークンを並列取得
    const [agentResult, oauthTokens] = await Promise.all([
      this.agentSessionRepo.findByUserProjects({ userId, statuses, page: 1, limit: MAX_MERGE_LIMIT }),
      this.agentSessionRepo.findOAuthSessions({ userId, includeRevoked: includeEnded }),
    ])

    if (agentResult.total > MAX_MERGE_LIMIT) {
      logger.warn({ userId, total: agentResult.total, limit: MAX_MERGE_LIMIT }, 'セッション数が統合上限を超えています')
    }

    // AgentSessionをDTO変換
    const agentSessions: AgentSessionInfo[] = agentResult.sessions.map((session) => ({
      id: session.id,
      source: 'agent' as SessionSource,
      projectId: session.projectId,
      projectName: session.project.name,
      clientId: session.clientId,
      clientName: session.clientName,
      status: session.status,
      startedAt: session.startedAt,
      lastHeartbeat: session.lastHeartbeat,
      endedAt: session.endedAt,
    }))

    // OAuthトークンをMCPセッション形式に変換
    const now = new Date()
    const oauthSessions: AgentSessionInfo[] = oauthTokens.map((token) => {
      let status: AgentSessionStatus
      if (token.revokedAt) {
        status = 'ENDED'
      } else if (token.expiresAt < now) {
        status = 'TIMEOUT'
      } else {
        status = 'ACTIVE'
      }

      return {
        id: token.id,
        source: 'oauth' as SessionSource,
        projectId: null,
        projectName: null,
        clientId: token.client.clientId,
        clientName: token.client.clientName,
        status,
        startedAt: token.createdAt,
        lastHeartbeat: token.createdAt,
        endedAt: token.revokedAt,
      }
    })

    // 統合してステータスフィルタ適用
    const allSessions = [...agentSessions, ...oauthSessions]
      .filter((s) => statuses.includes(s.status))
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())

    const total = allSessions.length
    const paged = allSessions.slice((page - 1) * limit, page * limit)

    return { sessions: paged, total }
  }

  // セッションを終了する（AgentSessionまたはOAuthトークン）
  async endSession(userId: string, sessionId: string, source?: SessionSource): Promise<{ success: boolean }> {
    // OAuthトークンの場合
    if (source === 'oauth') {
      return this.endOAuthSession(userId, sessionId)
    }

    // AgentSessionの場合（デフォルト）
    const session = await this.agentSessionRepo.findById(sessionId)

    // AgentSessionが見つからなければOAuthトークンとして試行
    if (!session) {
      const oauthToken = await this.agentSessionRepo.findOAuthTokenById(sessionId)
      if (oauthToken) {
        return this.endOAuthSession(userId, sessionId)
      }
      throw new NotFoundError('Session', sessionId)
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

  // OAuthトークンを失効させる
  private async endOAuthSession(userId: string, tokenId: string): Promise<{ success: boolean }> {
    const token = await this.agentSessionRepo.findOAuthTokenById(tokenId)
    if (!token) {
      throw new NotFoundError('OAuthToken', tokenId)
    }

    // 本人のトークンか確認
    if (token.userId !== userId) {
      throw new AuthorizationError('このセッションを終了する権限がありません')
    }

    // 既に失効済み
    if (token.revokedAt) {
      throw new ValidationError('このセッションは既に終了しています')
    }

    await this.agentSessionRepo.revokeOAuthToken(tokenId)
    logger.info({ tokenId, userId }, 'OAuthトークンを失効しました')

    return { success: true }
  }
}
