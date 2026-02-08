import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectRepository } from '../../repositories/project.repository.js';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaProject = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

const mockPrismaProjectHistory = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    project: mockPrismaProject,
    projectHistory: mockPrismaProjectHistory,
  },
}));

describe('ProjectRepository', () => {
  let repository: ProjectRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ProjectRepository();
  });

  describe('findById', () => {
    it('IDでプロジェクトを取得できる', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        description: 'Test description',
        deletedAt: null,
        organization: {
          id: 'org-1',
          name: 'Test Organization',
        },
      };
      mockPrismaProject.findFirst.mockResolvedValue(mockProject);

      const result = await repository.findById('project-1');

      expect(mockPrismaProject.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'project-1',
          deletedAt: null,
        },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      });
      expect(result).toEqual(mockProject);
    });

    it('organizationがincludeされる', async () => {
      const mockProject = {
        id: 'project-1',
        organization: {
          id: 'org-1',
          name: 'Organization',
        },
      };
      mockPrismaProject.findFirst.mockResolvedValue(mockProject);

      const result = await repository.findById('project-1');

      expect(result?.organization).toBeDefined();
      expect(result?.organization?.id).toBe('org-1');
    });

    it('削除済みプロジェクトはnullを返す', async () => {
      mockPrismaProject.findFirst.mockResolvedValue(null);

      const result = await repository.findById('deleted-project');

      expect(result).toBeNull();
    });

    it('存在しないIDはnullを返す', async () => {
      mockPrismaProject.findFirst.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findDeletedById', () => {
    it('削除済みプロジェクトを取得できる', async () => {
      const deletedAt = new Date();
      const mockProject = {
        id: 'project-1',
        name: 'Deleted Project',
        deletedAt,
        organization: {
          id: 'org-1',
          name: 'Test Organization',
        },
      };
      mockPrismaProject.findFirst.mockResolvedValue(mockProject);

      const result = await repository.findDeletedById('project-1');

      expect(mockPrismaProject.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'project-1',
          deletedAt: { not: null },
        },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      });
      expect(result).toEqual(mockProject);
    });

    it('未削除プロジェクトはnullを返す', async () => {
      mockPrismaProject.findFirst.mockResolvedValue(null);

      const result = await repository.findDeletedById('active-project');

      expect(result).toBeNull();
    });
  });

  describe('createHistory', () => {
    it('履歴を作成できる', async () => {
      const mockHistory = {
        id: 'history-1',
        projectId: 'project-1',
        changedByUserId: 'user-1',
        changeType: 'UPDATE' as const,
        snapshot: { name: 'Old Name' },
        changeReason: 'Updated name',
        createdAt: new Date(),
      };
      mockPrismaProjectHistory.create.mockResolvedValue(mockHistory);

      const result = await repository.createHistory({
        projectId: 'project-1',
        changedByUserId: 'user-1',
        changeType: 'UPDATE',
        snapshot: { name: 'Old Name' },
        changeReason: 'Updated name',
      });

      expect(mockPrismaProjectHistory.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          changedByUserId: 'user-1',
          changeType: 'UPDATE',
          snapshot: { name: 'Old Name' },
          changeReason: 'Updated name',
        },
      });
      expect(result).toEqual(mockHistory);
    });

    it('changedByAgentSessionIdを設定できる', async () => {
      const mockHistory = {
        id: 'history-1',
        projectId: 'project-1',
        changedByAgentSessionId: 'agent-session-1',
        changeType: 'UPDATE' as const,
        snapshot: { name: 'Old Name' },
        createdAt: new Date(),
      };
      mockPrismaProjectHistory.create.mockResolvedValue(mockHistory);

      const result = await repository.createHistory({
        projectId: 'project-1',
        changedByAgentSessionId: 'agent-session-1',
        changeType: 'UPDATE',
        snapshot: { name: 'Old Name' },
      });

      expect(mockPrismaProjectHistory.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          changedByAgentSessionId: 'agent-session-1',
          changeType: 'UPDATE',
          snapshot: { name: 'Old Name' },
        },
      });
      expect(result).toEqual(mockHistory);
    });

    it('changeReasonなしで履歴を作成できる', async () => {
      const mockHistory = {
        id: 'history-1',
        projectId: 'project-1',
        changedByUserId: 'user-1',
        changeType: 'CREATE' as const,
        snapshot: { name: 'New Project' },
        createdAt: new Date(),
      };
      mockPrismaProjectHistory.create.mockResolvedValue(mockHistory);

      const result = await repository.createHistory({
        projectId: 'project-1',
        changedByUserId: 'user-1',
        changeType: 'CREATE',
        snapshot: { name: 'New Project' },
      });

      expect(mockPrismaProjectHistory.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          changedByUserId: 'user-1',
          changeType: 'CREATE',
          snapshot: { name: 'New Project' },
        },
      });
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getHistories', () => {
    it('履歴一覧を取得できる', async () => {
      const mockHistories = [
        {
          id: 'history-1',
          projectId: 'project-1',
          changeType: 'UPDATE',
          snapshot: { name: 'Old Name' },
          createdAt: new Date(),
          changedBy: { id: 'user-1', name: 'User 1', avatarUrl: null },
          agentSession: null,
        },
        {
          id: 'history-2',
          projectId: 'project-1',
          changeType: 'CREATE',
          snapshot: { name: 'New Project' },
          createdAt: new Date(),
          changedBy: { id: 'user-1', name: 'User 1', avatarUrl: null },
          agentSession: null,
        },
      ];
      mockPrismaProjectHistory.findMany.mockResolvedValue(mockHistories);

      const result = await repository.getHistories('project-1');

      expect(mockPrismaProjectHistory.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        include: {
          changedBy: {
            select: { id: true, name: true, avatarUrl: true },
          },
          agentSession: {
            select: { id: true, clientName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(mockHistories);
    });

    it('limit/offsetでページネーションできる', async () => {
      mockPrismaProjectHistory.findMany.mockResolvedValue([]);

      await repository.getHistories('project-1', { limit: 10, offset: 20 });

      expect(mockPrismaProjectHistory.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        include: {
          changedBy: {
            select: { id: true, name: true, avatarUrl: true },
          },
          agentSession: {
            select: { id: true, clientName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 20,
      });
    });

    it('createdAtの降順でソートされる', async () => {
      mockPrismaProjectHistory.findMany.mockResolvedValue([]);

      await repository.getHistories('project-1');

      expect(mockPrismaProjectHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('デフォルトでlimit=50, offset=0', async () => {
      mockPrismaProjectHistory.findMany.mockResolvedValue([]);

      await repository.getHistories('project-1');

      expect(mockPrismaProjectHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0,
        })
      );
    });
  });

  describe('countHistories', () => {
    it('履歴の総件数を取得できる', async () => {
      mockPrismaProjectHistory.count.mockResolvedValue(25);

      const result = await repository.countHistories('project-1');

      expect(mockPrismaProjectHistory.count).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
      });
      expect(result).toBe(25);
    });

    it('履歴がない場合は0を返す', async () => {
      mockPrismaProjectHistory.count.mockResolvedValue(0);

      const result = await repository.countHistories('project-no-history');

      expect(result).toBe(0);
    });
  });
});
