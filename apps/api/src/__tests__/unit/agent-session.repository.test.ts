import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentSessionStatus } from '@agentest/db';

// Prisma モック
const mockPrismaProjectMember = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
}));

const mockPrismaAgentSession = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

const mockPrismaOAuthAccessToken = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    projectMember: mockPrismaProjectMember,
    agentSession: mockPrismaAgentSession,
    oAuthAccessToken: mockPrismaOAuthAccessToken,
  },
}));

import { AgentSessionRepository } from '../../repositories/agent-session.repository.js';

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_SESSION_ID = '33333333-3333-3333-3333-333333333333';

describe('AgentSessionRepository', () => {
  let repository: AgentSessionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AgentSessionRepository();
  });

  describe('findByUserProjects', () => {
    it('ユーザー所属プロジェクトのセッションを取得する', async () => {
      const mockMembers = [
        { projectId: TEST_PROJECT_ID },
        { projectId: '44444444-4444-4444-4444-444444444444' },
      ];
      const mockSessions = [
        {
          id: TEST_SESSION_ID,
          projectId: TEST_PROJECT_ID,
          clientId: 'claude-code-xxx',
          clientName: 'Claude Code',
          status: 'ACTIVE' as AgentSessionStatus,
          startedAt: new Date(),
          lastHeartbeat: new Date(),
          endedAt: null,
          project: { id: TEST_PROJECT_ID, name: 'テストプロジェクト' },
        },
      ];

      mockPrismaProjectMember.findMany.mockResolvedValue(mockMembers);
      mockPrismaAgentSession.findMany.mockResolvedValue(mockSessions);
      mockPrismaAgentSession.count.mockResolvedValue(1);

      const result = await repository.findByUserProjects({
        userId: TEST_USER_ID,
        statuses: ['ACTIVE', 'IDLE'],
        page: 1,
        limit: 50,
      });

      expect(result.sessions).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.sessions[0].id).toBe(TEST_SESSION_ID);
      expect(result.sessions[0].project.name).toBe('テストプロジェクト');

      // ProjectMember検索でuserIdが使われること
      expect(mockPrismaProjectMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: TEST_USER_ID },
          select: { projectId: true },
        })
      );

      // AgentSession検索でプロジェクトIDリストが使われること
      expect(mockPrismaAgentSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId: { in: [TEST_PROJECT_ID, '44444444-4444-4444-4444-444444444444'] },
            status: { in: ['ACTIVE', 'IDLE'] },
          },
        })
      );
    });

    it('所属プロジェクトがない場合は空配列を返す', async () => {
      mockPrismaProjectMember.findMany.mockResolvedValue([]);

      const result = await repository.findByUserProjects({
        userId: TEST_USER_ID,
        statuses: ['ACTIVE'],
        page: 1,
        limit: 50,
      });

      expect(result.sessions).toEqual([]);
      expect(result.total).toBe(0);
      // AgentSessionは検索されない
      expect(mockPrismaAgentSession.findMany).not.toHaveBeenCalled();
    });

    it('ページネーションが正しく適用される', async () => {
      mockPrismaProjectMember.findMany.mockResolvedValue([{ projectId: TEST_PROJECT_ID }]);
      mockPrismaAgentSession.findMany.mockResolvedValue([]);
      mockPrismaAgentSession.count.mockResolvedValue(100);

      await repository.findByUserProjects({
        userId: TEST_USER_ID,
        statuses: ['ACTIVE'],
        page: 3,
        limit: 10,
      });

      expect(mockPrismaAgentSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3 - 1) * 10
          take: 10,
        })
      );
    });
  });

  describe('findById', () => {
    it('IDでセッションを取得する（プロジェクト情報含む）', async () => {
      const mockSession = {
        id: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        status: 'ACTIVE' as AgentSessionStatus,
        project: { id: TEST_PROJECT_ID, name: 'テストプロジェクト' },
      };
      mockPrismaAgentSession.findUnique.mockResolvedValue(mockSession);

      const result = await repository.findById(TEST_SESSION_ID);

      expect(result).toEqual(mockSession);
      expect(mockPrismaAgentSession.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_SESSION_ID },
        include: { project: { select: { id: true, name: true } } },
      });
    });

    it('存在しないIDの場合nullを返す', async () => {
      mockPrismaAgentSession.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('isProjectMember', () => {
    it('プロジェクトメンバーの場合trueを返す', async () => {
      mockPrismaProjectMember.findFirst.mockResolvedValue({ id: 'member-1' });

      const result = await repository.isProjectMember(TEST_PROJECT_ID, TEST_USER_ID);

      expect(result).toBe(true);
      expect(mockPrismaProjectMember.findFirst).toHaveBeenCalledWith({
        where: { projectId: TEST_PROJECT_ID, userId: TEST_USER_ID },
      });
    });

    it('プロジェクトメンバーでない場合falseを返す', async () => {
      mockPrismaProjectMember.findFirst.mockResolvedValue(null);

      const result = await repository.isProjectMember(TEST_PROJECT_ID, TEST_USER_ID);

      expect(result).toBe(false);
    });
  });

  describe('endSession', () => {
    it('セッションを終了状態に更新する', async () => {
      const now = new Date();
      mockPrismaAgentSession.update.mockResolvedValue({
        id: TEST_SESSION_ID,
        status: 'ENDED',
        endedAt: now,
      });

      const result = await repository.endSession(TEST_SESSION_ID);

      expect(result.status).toBe('ENDED');
      expect(mockPrismaAgentSession.update).toHaveBeenCalledWith({
        where: { id: TEST_SESSION_ID },
        data: {
          status: 'ENDED',
          endedAt: expect.any(Date),
        },
      });
    });
  });

  describe('findOAuthSessions', () => {
    it('ユーザーの有効なOAuthトークンを取得する', async () => {
      const now = new Date();
      const mockTokens = [
        {
          id: 'token-1',
          userId: TEST_USER_ID,
          clientId: 'client-1',
          expiresAt: new Date(Date.now() + 3600000),
          revokedAt: null,
          createdAt: now,
          client: { clientId: 'client-1', clientName: 'Claude Code' },
        },
      ];
      mockPrismaOAuthAccessToken.findMany.mockResolvedValue(mockTokens);

      const result = await repository.findOAuthSessions({
        userId: TEST_USER_ID,
        includeRevoked: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].client.clientName).toBe('Claude Code');
      expect(mockPrismaOAuthAccessToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: TEST_USER_ID,
            revokedAt: null,
            expiresAt: { gt: expect.any(Date) },
          },
        })
      );
    });

    it('includeRevoked=trueの場合、失効済みも含む', async () => {
      mockPrismaOAuthAccessToken.findMany.mockResolvedValue([]);

      await repository.findOAuthSessions({
        userId: TEST_USER_ID,
        includeRevoked: true,
      });

      expect(mockPrismaOAuthAccessToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: TEST_USER_ID },
        })
      );
    });
  });

  describe('findOAuthTokenById', () => {
    it('IDでOAuthトークンを取得する', async () => {
      const mockToken = {
        id: 'token-1',
        userId: TEST_USER_ID,
        clientId: 'client-1',
        client: { clientId: 'client-1', clientName: 'Claude Code' },
      };
      mockPrismaOAuthAccessToken.findUnique.mockResolvedValue(mockToken);

      const result = await repository.findOAuthTokenById('token-1');

      expect(result).toEqual(mockToken);
      expect(mockPrismaOAuthAccessToken.findUnique).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        include: {
          client: { select: { clientId: true, clientName: true } },
        },
      });
    });

    it('存在しないIDの場合nullを返す', async () => {
      mockPrismaOAuthAccessToken.findUnique.mockResolvedValue(null);

      const result = await repository.findOAuthTokenById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('revokeOAuthToken', () => {
    it('トークンを失効状態に更新する', async () => {
      const now = new Date();
      mockPrismaOAuthAccessToken.update.mockResolvedValue({
        id: 'token-1',
        revokedAt: now,
      });

      const result = await repository.revokeOAuthToken('token-1');

      expect(result.revokedAt).toEqual(now);
      expect(mockPrismaOAuthAccessToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
