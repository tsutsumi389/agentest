import { prisma, type AgentSessionStatus } from '@agentest/db'

export interface FindByUserProjectsParams {
  userId: string
  statuses: AgentSessionStatus[]
  page: number
  limit: number
}

export interface FindOAuthSessionsParams {
  userId: string
  includeRevoked: boolean
}

export class AgentSessionRepository {
  // ユーザー所属プロジェクトのセッション取得（ProjectMember経由）
  async findByUserProjects(params: FindByUserProjectsParams) {
    const { userId, statuses, page, limit } = params

    // ユーザーが所属するプロジェクトID一覧を取得
    const members = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    })

    const projectIds = members.map((m) => m.projectId)

    if (projectIds.length === 0) {
      return { sessions: [], total: 0 }
    }

    const where = {
      projectId: { in: projectIds },
      status: { in: statuses },
    }

    const [sessions, total] = await Promise.all([
      prisma.agentSession.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: { lastHeartbeat: 'desc' as const },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.agentSession.count({ where }),
    ])

    return { sessions, total }
  }

  // ID指定取得（プロジェクト情報include）
  async findById(id: string) {
    return prisma.agentSession.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } } },
    })
  }

  // プロジェクトメンバーかどうかを確認
  async isProjectMember(projectId: string, userId: string): Promise<boolean> {
    const member = await prisma.projectMember.findFirst({
      where: { projectId, userId },
    })
    return member !== null
  }

  // ユーザーのOAuthアクセストークン一覧を取得（MCPセッションとして表示）
  async findOAuthSessions(params: FindOAuthSessionsParams) {
    const { userId, includeRevoked } = params

    const where: Record<string, unknown> = { userId }
    if (!includeRevoked) {
      where.revokedAt = null
      where.expiresAt = { gt: new Date() }
    }

    return prisma.oAuthAccessToken.findMany({
      where,
      include: {
        client: { select: { clientId: true, clientName: true } },
      },
      orderBy: { createdAt: 'desc' as const },
    })
  }

  // OAuthアクセストークンを失効させる
  async revokeOAuthToken(tokenId: string) {
    return prisma.oAuthAccessToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    })
  }

  // OAuthアクセストークンをIDで取得
  async findOAuthTokenById(tokenId: string) {
    return prisma.oAuthAccessToken.findUnique({
      where: { id: tokenId },
      include: {
        client: { select: { clientId: true, clientName: true } },
      },
    })
  }

  // セッション終了
  async endSession(id: string) {
    return prisma.agentSession.update({
      where: { id },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
    })
  }
}
