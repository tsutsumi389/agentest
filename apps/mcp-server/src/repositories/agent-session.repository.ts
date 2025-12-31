import { prisma, type AgentSession, type AgentSessionStatus } from '@agentest/db';

/**
 * AgentSession作成用のデータ型
 */
export interface CreateAgentSessionData {
  projectId: string;
  clientId: string;
  clientName?: string;
}

/**
 * AgentSessionリポジトリ
 * AgentSessionのCRUD操作を提供
 */
export const agentSessionRepository = {
  /**
   * 新しいAgentSessionを作成
   */
  async create(data: CreateAgentSessionData): Promise<AgentSession> {
    return prisma.agentSession.create({
      data: {
        projectId: data.projectId,
        clientId: data.clientId,
        clientName: data.clientName,
        status: 'ACTIVE',
        startedAt: new Date(),
        lastHeartbeat: new Date(),
      },
    });
  },

  /**
   * IDでAgentSessionを取得
   */
  async findById(id: string): Promise<AgentSession | null> {
    return prisma.agentSession.findUnique({
      where: { id },
    });
  },

  /**
   * プロジェクトIDとクライアントIDでアクティブなセッションを取得
   */
  async findActiveByProjectAndClient(
    projectId: string,
    clientId: string
  ): Promise<AgentSession | null> {
    return prisma.agentSession.findFirst({
      where: {
        projectId,
        clientId,
        status: 'ACTIVE',
      },
      orderBy: {
        startedAt: 'desc',
      },
    });
  },

  /**
   * プロジェクトのすべてのアクティブなセッションを取得
   */
  async findActiveByProject(projectId: string): Promise<AgentSession[]> {
    return prisma.agentSession.findMany({
      where: {
        projectId,
        status: 'ACTIVE',
      },
      orderBy: {
        startedAt: 'desc',
      },
    });
  },

  /**
   * ハートビートを更新
   */
  async updateHeartbeat(id: string): Promise<AgentSession> {
    return prisma.agentSession.update({
      where: { id },
      data: {
        lastHeartbeat: new Date(),
      },
    });
  },

  /**
   * ステータスを更新
   */
  async updateStatus(
    id: string,
    status: AgentSessionStatus,
    endedAt?: Date
  ): Promise<AgentSession> {
    return prisma.agentSession.update({
      where: { id },
      data: {
        status,
        ...(endedAt && { endedAt }),
      },
    });
  },

  /**
   * セッションを終了
   */
  async endSession(id: string): Promise<AgentSession> {
    return prisma.agentSession.update({
      where: { id },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
    });
  },

  /**
   * タイムアウトしたセッションを取得
   * 最後のハートビートから指定秒数経過したセッション
   */
  async findTimedOutSessions(timeoutSeconds: number): Promise<AgentSession[]> {
    const cutoffTime = new Date(Date.now() - timeoutSeconds * 1000);

    return prisma.agentSession.findMany({
      where: {
        status: 'ACTIVE',
        lastHeartbeat: {
          lt: cutoffTime,
        },
      },
    });
  },

  /**
   * 複数のセッションをタイムアウト状態に更新
   */
  async markAsTimedOut(ids: string[]): Promise<number> {
    const result = await prisma.agentSession.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status: 'TIMEOUT',
        endedAt: new Date(),
      },
    });

    return result.count;
  },
};
