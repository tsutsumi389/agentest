import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '@agentest/shared';

// 復元可能な期間（30日）
const RESTORE_LIMIT_DAYS = 30;

// ProjectRepository のモック
const mockProjectRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findDeletedById: vi.fn(),
  createHistory: vi.fn(),
  getHistories: vi.fn(),
  countHistories: vi.fn(),
}));

vi.mock('../../repositories/project.repository.js', () => ({
  ProjectRepository: vi.fn().mockImplementation(() => mockProjectRepo),
}));

// Prisma のモック
const mockPrisma = vi.hoisted(() => ({
  project: {
    create: vi.fn(),
    update: vi.fn(),
  },
  projectMember: {
    create: vi.fn(),
  },
  projectHistory: {
    create: vi.fn(),
  },
  $transaction: vi.fn((operations: unknown) => {
    if (Array.isArray(operations)) {
      return Promise.all(operations);
    }
    return (operations as (tx: typeof mockPrisma) => unknown)(mockPrisma);
  }),
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

import { ProjectService } from '../../services/project.service.js';

describe('ProjectService - History & Restore', () => {
  let service: ProjectService;

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    description: 'Test Description',
    organizationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockDeletedProject = {
    ...mockProject,
    deletedAt: new Date(),
  };

  const mockHistory = {
    id: 'history-1',
    projectId: 'project-1',
    changedByUserId: 'user-1',
    changedByAgentSessionId: null,
    changeType: 'CREATE' as const,
    snapshot: { name: 'Test Project' },
    changeReason: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectService();
  });

  // ============================================================
  // createHistory
  // ============================================================
  describe('createHistory', () => {
    it('履歴を作成できる', async () => {
      mockProjectRepo.createHistory.mockResolvedValue(mockHistory);

      const result = await service.createHistory(
        'project-1',
        'user-1',
        'CREATE',
        { name: 'Test Project' }
      );

      expect(mockProjectRepo.createHistory).toHaveBeenCalledWith({
        projectId: 'project-1',
        changedByUserId: 'user-1',
        changeType: 'CREATE',
        snapshot: { name: 'Test Project' },
        changeReason: undefined,
      });
      expect(result).toEqual(mockHistory);
    });

    it('変更理由を含めて履歴を作成できる', async () => {
      mockProjectRepo.createHistory.mockResolvedValue({
        ...mockHistory,
        changeReason: '設定変更のため',
      });

      await service.createHistory(
        'project-1',
        'user-1',
        'UPDATE',
        { before: { name: 'Old' }, after: { name: 'New' } },
        '設定変更のため'
      );

      expect(mockProjectRepo.createHistory).toHaveBeenCalledWith({
        projectId: 'project-1',
        changedByUserId: 'user-1',
        changeType: 'UPDATE',
        snapshot: { before: { name: 'Old' }, after: { name: 'New' } },
        changeReason: '設定変更のため',
      });
    });

    it('userIdがundefinedでも履歴を作成できる', async () => {
      mockProjectRepo.createHistory.mockResolvedValue({
        ...mockHistory,
        changedByUserId: null,
      });

      await service.createHistory('project-1', undefined, 'CREATE', { name: 'Test' });

      expect(mockProjectRepo.createHistory).toHaveBeenCalledWith({
        projectId: 'project-1',
        changedByUserId: undefined,
        changeType: 'CREATE',
        snapshot: { name: 'Test' },
        changeReason: undefined,
      });
    });
  });

  // ============================================================
  // getHistories
  // ============================================================
  describe('getHistories', () => {
    const mockHistories = [
      { ...mockHistory, changeType: 'UPDATE' },
      { ...mockHistory, id: 'history-2', changeType: 'CREATE' },
    ];

    it('履歴一覧を取得できる', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockProjectRepo.findDeletedById.mockResolvedValue(null);
      mockProjectRepo.getHistories.mockResolvedValue(mockHistories);
      mockProjectRepo.countHistories.mockResolvedValue(2);

      const result = await service.getHistories('project-1');

      expect(mockProjectRepo.getHistories).toHaveBeenCalledWith('project-1', undefined);
      expect(result.histories).toEqual(mockHistories);
      expect(result.total).toBe(2);
    });

    it('limitとoffsetを指定して履歴を取得できる', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockProjectRepo.findDeletedById.mockResolvedValue(null);
      mockProjectRepo.getHistories.mockResolvedValue([mockHistories[0]]);
      mockProjectRepo.countHistories.mockResolvedValue(2);

      const result = await service.getHistories('project-1', { limit: 1, offset: 0 });

      expect(mockProjectRepo.getHistories).toHaveBeenCalledWith('project-1', { limit: 1, offset: 0 });
      expect(result.histories).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    it('削除済みプロジェクトでも履歴を取得できる', async () => {
      mockProjectRepo.findById.mockResolvedValue(null);
      mockProjectRepo.findDeletedById.mockResolvedValue(mockDeletedProject);
      mockProjectRepo.getHistories.mockResolvedValue(mockHistories);
      mockProjectRepo.countHistories.mockResolvedValue(2);

      const result = await service.getHistories('project-1');

      expect(result.histories).toEqual(mockHistories);
      expect(result.total).toBe(2);
    });

    it('存在しないプロジェクトはNotFoundErrorを投げる', async () => {
      mockProjectRepo.findById.mockResolvedValue(null);
      mockProjectRepo.findDeletedById.mockResolvedValue(null);

      await expect(service.getHistories('invalid-project'))
        .rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================
  // restore
  // ============================================================
  describe('restore', () => {
    const restoredProject = {
      ...mockProject,
      deletedAt: null,
    };

    it('削除済みプロジェクトを復元できる', async () => {
      const deletedRecently = {
        ...mockDeletedProject,
        deletedAt: new Date(), // 今日削除された
      };
      mockProjectRepo.findDeletedById.mockResolvedValue(deletedRecently);
      mockPrisma.project.update.mockResolvedValue(restoredProject);

      const result = await service.restore('project-1', 'user-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: { deletedAt: null },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      });
      expect(result.deletedAt).toBeNull();
    });

    it('復元時に履歴が作成される', async () => {
      const deletedRecently = {
        ...mockDeletedProject,
        deletedAt: new Date(),
      };
      mockProjectRepo.findDeletedById.mockResolvedValue(deletedRecently);
      mockPrisma.project.update.mockResolvedValue(restoredProject);

      await service.restore('project-1', 'user-1');

      expect(mockPrisma.projectHistory.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          changedByUserId: 'user-1',
          changeType: 'RESTORE',
          snapshot: {
            name: restoredProject.name,
            description: restoredProject.description,
            organizationId: restoredProject.organizationId,
          },
        },
      });
    });

    it('削除から29日後でも復元できる', async () => {
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 29);
      const deletedProject = { ...mockDeletedProject, deletedAt };

      mockProjectRepo.findDeletedById.mockResolvedValue(deletedProject);
      mockPrisma.project.update.mockResolvedValue(restoredProject);

      const result = await service.restore('project-1', 'user-1');

      expect(result.deletedAt).toBeNull();
    });

    it('削除から30日後でも復元できる', async () => {
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - RESTORE_LIMIT_DAYS);
      const deletedProject = { ...mockDeletedProject, deletedAt };

      mockProjectRepo.findDeletedById.mockResolvedValue(deletedProject);
      mockPrisma.project.update.mockResolvedValue(restoredProject);

      const result = await service.restore('project-1', 'user-1');

      expect(result.deletedAt).toBeNull();
    });

    it('削除から31日以上経過するとValidationErrorを投げる', async () => {
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 31);
      const deletedProject = { ...mockDeletedProject, deletedAt };

      mockProjectRepo.findDeletedById.mockResolvedValue(deletedProject);

      await expect(service.restore('project-1', 'user-1'))
        .rejects.toThrow(ValidationError);
      await expect(service.restore('project-1', 'user-1'))
        .rejects.toThrow('30日以上経過');
    });

    it('削除されていないプロジェクトはNotFoundErrorを投げる', async () => {
      mockProjectRepo.findDeletedById.mockResolvedValue(null);

      await expect(service.restore('project-1', 'user-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('存在しないプロジェクトはNotFoundErrorを投げる', async () => {
      mockProjectRepo.findDeletedById.mockResolvedValue(null);

      await expect(service.restore('invalid-project', 'user-1'))
        .rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================
  // create（履歴作成の自動呼び出し）
  // ============================================================
  describe('create - with history', () => {
    it('プロジェクト作成時に履歴が作成される', async () => {
      const newProject = { ...mockProject };
      mockPrisma.project.create.mockResolvedValue(newProject);

      await service.create('user-1', {
        name: 'Test Project',
        description: 'Test Description',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.projectHistory.create).toHaveBeenCalledWith({
        data: {
          projectId: newProject.id,
          changedByUserId: 'user-1',
          changeType: 'CREATE',
          snapshot: {
            name: newProject.name,
            description: newProject.description,
            organizationId: newProject.organizationId,
          },
        },
      });
    });
  });

  // ============================================================
  // update（履歴作成の自動呼び出し）
  // ============================================================
  describe('update - with history', () => {
    it('プロジェクト更新時に履歴が作成される', async () => {
      const updatedProject = { ...mockProject, name: 'Updated Project' };
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.project.update.mockResolvedValue(updatedProject);

      await service.update('project-1', { name: 'Updated Project' }, 'user-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.projectHistory.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          changedByUserId: 'user-1',
          changeType: 'UPDATE',
          snapshot: {
            before: {
              name: mockProject.name,
              description: mockProject.description,
            },
            after: {
              name: updatedProject.name,
              description: updatedProject.description,
            },
          },
        },
      });
    });
  });

  // ============================================================
  // softDelete（履歴作成の自動呼び出し）
  // ============================================================
  describe('softDelete - with history', () => {
    it('プロジェクト削除時に履歴が作成される', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.project.update.mockResolvedValue({ ...mockProject, deletedAt: new Date() });

      await service.softDelete('project-1', 'user-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.projectHistory.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          changedByUserId: 'user-1',
          changeType: 'DELETE',
          snapshot: {
            name: mockProject.name,
            description: mockProject.description,
            organizationId: mockProject.organizationId,
          },
        },
      });
    });
  });

  // ============================================================
  // トランザクションロールバック
  // ============================================================
  describe('トランザクションロールバック', () => {
    it('update中に履歴作成が失敗した場合、更新もロールバックされる', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.project.update.mockResolvedValue({ ...mockProject, name: 'Updated' });
      mockPrisma.projectHistory.create.mockRejectedValue(new Error('DB error'));
      mockPrisma.$transaction.mockImplementation(async (fn: unknown) => {
        return (fn as (tx: typeof mockPrisma) => unknown)(mockPrisma);
      });

      await expect(service.update('project-1', { name: 'Updated' }, 'user-1'))
        .rejects.toThrow('DB error');
    });

    it('softDelete中に履歴作成が失敗した場合、削除もロールバックされる', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.project.update.mockResolvedValue({ ...mockProject, deletedAt: new Date() });
      mockPrisma.projectHistory.create.mockRejectedValue(new Error('DB error'));
      mockPrisma.$transaction.mockImplementation(async (fn: unknown) => {
        return (fn as (tx: typeof mockPrisma) => unknown)(mockPrisma);
      });

      await expect(service.softDelete('project-1', 'user-1'))
        .rejects.toThrow('DB error');
    });

    it('restore中に履歴作成が失敗した場合、復元もロールバックされる', async () => {
      const deletedRecently = { ...mockDeletedProject, deletedAt: new Date() };
      mockProjectRepo.findDeletedById.mockResolvedValue(deletedRecently);
      mockPrisma.project.update.mockResolvedValue({ ...mockProject, deletedAt: null });
      mockPrisma.projectHistory.create.mockRejectedValue(new Error('DB error'));
      mockPrisma.$transaction.mockImplementation(async (fn: unknown) => {
        return (fn as (tx: typeof mockPrisma) => unknown)(mockPrisma);
      });

      await expect(service.restore('project-1', 'user-1'))
        .rejects.toThrow('DB error');
    });
  });
});
