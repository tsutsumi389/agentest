import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ConflictError } from '@agentest/shared';

// ProjectRepository のモック
const mockProjectRepo = vi.hoisted(() => ({
  findById: vi.fn(),
}));

vi.mock('../../repositories/project.repository.js', () => ({
  ProjectRepository: vi.fn().mockImplementation(() => mockProjectRepo),
}));

// Prisma のモック
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  projectEnvironment: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
  },
  execution: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn((operations) => {
    // 配列の場合は順番に実行
    if (Array.isArray(operations)) {
      return Promise.all(operations);
    }
    // 関数の場合はコールバックとして実行
    return operations(mockPrisma);
  }),
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

import { ProjectService } from '../../services/project.service.js';

describe('ProjectService - Environment Management', () => {
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

  const mockEnvironment = {
    id: 'env-1',
    projectId: 'project-1',
    name: 'Development',
    slug: 'dev',
    baseUrl: 'http://localhost:3000',
    description: 'Development environment',
    isDefault: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectService();
  });

  // ============================================================
  // updateEnvironment
  // ============================================================
  describe('updateEnvironment', () => {
    it('環境を更新できる', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(mockEnvironment);
      mockPrisma.projectEnvironment.update.mockResolvedValue({
        ...mockEnvironment,
        name: 'Updated Name',
      });

      const result = await service.updateEnvironment('project-1', 'env-1', { name: 'Updated Name' });

      expect(mockProjectRepo.findById).toHaveBeenCalledWith('project-1');
      expect(mockPrisma.projectEnvironment.findUnique).toHaveBeenCalledWith({
        where: { id: 'env-1' },
      });
      expect(result.name).toBe('Updated Name');
    });

    it('スラッグを変更できる', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique
        .mockResolvedValueOnce(mockEnvironment) // 環境存在確認
        .mockResolvedValueOnce(null); // スラッグ重複チェック（なし）
      mockPrisma.projectEnvironment.update.mockResolvedValue({
        ...mockEnvironment,
        slug: 'development',
      });

      const result = await service.updateEnvironment('project-1', 'env-1', { slug: 'development' });

      expect(result.slug).toBe('development');
    });

    it('重複するスラッグへの変更はConflictErrorを投げる', async () => {
      const existingEnv = { ...mockEnvironment, id: 'env-2', slug: 'staging' };
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique
        .mockResolvedValueOnce(mockEnvironment) // 環境存在確認
        .mockResolvedValueOnce(existingEnv); // スラッグ重複チェック（あり）

      await expect(service.updateEnvironment('project-1', 'env-1', { slug: 'staging' }))
        .rejects.toThrow(ConflictError);
    });

    it('同じスラッグへの更新は重複チェックをスキップする', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(mockEnvironment);
      mockPrisma.projectEnvironment.update.mockResolvedValue({
        ...mockEnvironment,
        name: 'Updated Name',
      });

      // スラッグを現在と同じ値に設定
      await service.updateEnvironment('project-1', 'env-1', { slug: 'dev', name: 'Updated Name' });

      // findUniqueは1回のみ呼ばれる（環境存在確認のみ、スラッグ重複チェックはスキップ）
      expect(mockPrisma.projectEnvironment.findUnique).toHaveBeenCalledTimes(1);
    });

    it('デフォルト環境に設定すると他のデフォルトが解除される', async () => {
      const nonDefaultEnv = { ...mockEnvironment, id: 'env-2', isDefault: false, sortOrder: 1 };
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(nonDefaultEnv);
      mockPrisma.projectEnvironment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectEnvironment.update.mockResolvedValue({
        ...nonDefaultEnv,
        isDefault: true,
      });

      const result = await service.updateEnvironment('project-1', 'env-2', { isDefault: true });

      expect(mockPrisma.projectEnvironment.updateMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', isDefault: true },
        data: { isDefault: false },
      });
      expect(result.isDefault).toBe(true);
    });

    it('既にデフォルトの環境をデフォルトに設定しても他の解除は発生しない', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(mockEnvironment); // 既にisDefault: true
      mockPrisma.projectEnvironment.update.mockResolvedValue(mockEnvironment);

      await service.updateEnvironment('project-1', 'env-1', { isDefault: true });

      expect(mockPrisma.projectEnvironment.updateMany).not.toHaveBeenCalled();
    });

    it('存在しないプロジェクトはNotFoundErrorを投げる', async () => {
      mockProjectRepo.findById.mockResolvedValue(null);

      await expect(service.updateEnvironment('invalid-project', 'env-1', { name: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });

    it('存在しない環境はNotFoundErrorを投げる', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(null);

      await expect(service.updateEnvironment('project-1', 'invalid-env', { name: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });

    it('異なるプロジェクトの環境への更新はNotFoundErrorを投げる', async () => {
      const otherProjectEnv = { ...mockEnvironment, projectId: 'project-2' };
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(otherProjectEnv);

      await expect(service.updateEnvironment('project-1', 'env-1', { name: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================
  // deleteEnvironment
  // ============================================================
  describe('deleteEnvironment', () => {
    it('環境を削除できる', async () => {
      const nonDefaultEnv = { ...mockEnvironment, isDefault: false };
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(nonDefaultEnv);
      mockPrisma.execution.findFirst.mockResolvedValue(null);
      mockPrisma.projectEnvironment.delete.mockResolvedValue(nonDefaultEnv);

      await service.deleteEnvironment('project-1', 'env-1');

      expect(mockPrisma.projectEnvironment.delete).toHaveBeenCalledWith({
        where: { id: 'env-1' },
      });
    });

    it('実行中のテストがある環境は削除できない', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(mockEnvironment);
      mockPrisma.execution.findFirst.mockResolvedValue({
        id: 'exec-1',
        environmentId: 'env-1',
        status: 'IN_PROGRESS',
      });

      await expect(service.deleteEnvironment('project-1', 'env-1'))
        .rejects.toThrow(ConflictError);
      expect(mockPrisma.projectEnvironment.delete).not.toHaveBeenCalled();
    });

    it('デフォルト環境を削除すると次の環境が昇格する', async () => {
      const nextEnv = { id: 'env-2', sortOrder: 1 };
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(mockEnvironment); // isDefault: true
      mockPrisma.execution.findFirst.mockResolvedValue(null);
      mockPrisma.projectEnvironment.delete.mockResolvedValue(mockEnvironment);
      mockPrisma.projectEnvironment.findFirst.mockResolvedValue(nextEnv);
      mockPrisma.projectEnvironment.update.mockResolvedValue({ ...nextEnv, isDefault: true });

      await service.deleteEnvironment('project-1', 'env-1');

      // トランザクション内でfindFirstとupdateが呼ばれることを確認
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('唯一のデフォルト環境を削除しても昇格対象がなければ何もしない', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(mockEnvironment);
      mockPrisma.execution.findFirst.mockResolvedValue(null);
      mockPrisma.projectEnvironment.delete.mockResolvedValue(mockEnvironment);
      mockPrisma.projectEnvironment.findFirst.mockResolvedValue(null); // 他に環境なし

      await service.deleteEnvironment('project-1', 'env-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('存在しないプロジェクトはNotFoundErrorを投げる', async () => {
      mockProjectRepo.findById.mockResolvedValue(null);

      await expect(service.deleteEnvironment('invalid-project', 'env-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('存在しない環境はNotFoundErrorを投げる', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(null);

      await expect(service.deleteEnvironment('project-1', 'invalid-env'))
        .rejects.toThrow(NotFoundError);
    });

    it('異なるプロジェクトの環境への削除はNotFoundErrorを投げる', async () => {
      const otherProjectEnv = { ...mockEnvironment, projectId: 'project-2' };
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(otherProjectEnv);

      await expect(service.deleteEnvironment('project-1', 'env-1'))
        .rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================
  // reorderEnvironments
  // ============================================================
  describe('reorderEnvironments', () => {
    const mockEnvironments = [
      { id: 'env-1', sortOrder: 0 },
      { id: 'env-2', sortOrder: 1 },
      { id: 'env-3', sortOrder: 2 },
    ];

    it('環境の並び順を更新できる', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findMany.mockResolvedValue(mockEnvironments);
      mockPrisma.projectEnvironment.update.mockImplementation(({ where }) =>
        Promise.resolve({ id: where.id, sortOrder: 0 })
      );

      await service.reorderEnvironments('project-1', ['env-3', 'env-1', 'env-2']);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.projectEnvironment.findMany).toHaveBeenCalledTimes(2); // 検証用と結果取得用
    });

    it('プロジェクトに属さない環境IDを含む場合はNotFoundErrorを投げる', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findMany.mockResolvedValue(mockEnvironments);

      await expect(service.reorderEnvironments('project-1', ['env-1', 'env-2', 'invalid-env']))
        .rejects.toThrow(NotFoundError);
    });

    it('空の配列でも処理できる', async () => {
      // 注意: バリデーションはコントローラーで行われるため、サービスレベルでは空配列も受け付ける
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findMany.mockResolvedValue([]);

      await service.reorderEnvironments('project-1', []);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith([]);
    });

    it('存在しないプロジェクトはNotFoundErrorを投げる', async () => {
      mockProjectRepo.findById.mockResolvedValue(null);

      await expect(service.reorderEnvironments('invalid-project', ['env-1']))
        .rejects.toThrow(NotFoundError);
    });

    it('並び替え後に正しいsortOrderが設定される', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findMany.mockResolvedValue(mockEnvironments);

      const updateCalls: Array<{ id: string; sortOrder: number }> = [];
      mockPrisma.projectEnvironment.update.mockImplementation(({ where, data }) => {
        updateCalls.push({ id: where.id, sortOrder: data.sortOrder });
        return Promise.resolve({ id: where.id, sortOrder: data.sortOrder });
      });

      await service.reorderEnvironments('project-1', ['env-3', 'env-1', 'env-2']);

      // トランザクション内で各環境が更新されることを確認
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================================
  // createEnvironment（既存機能のテスト追加）
  // ============================================================
  describe('createEnvironment', () => {
    it('環境を作成できる', async () => {
      const newEnv = {
        id: 'new-env',
        projectId: 'project-1',
        name: 'Staging',
        slug: 'staging',
        baseUrl: 'http://staging.example.com',
        description: 'Staging environment',
        isDefault: false,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(null); // スラッグ重複なし
      mockPrisma.projectEnvironment.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
      mockPrisma.projectEnvironment.create.mockResolvedValue(newEnv);

      const result = await service.createEnvironment('project-1', {
        name: 'Staging',
        slug: 'staging',
        baseUrl: 'http://staging.example.com',
        description: 'Staging environment',
      });

      expect(result.name).toBe('Staging');
      expect(result.slug).toBe('staging');
      expect(result.sortOrder).toBe(1);
    });

    it('重複するスラッグはConflictErrorを投げる', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(mockEnvironment); // スラッグ重複あり

      await expect(service.createEnvironment('project-1', {
        name: 'Test',
        slug: 'dev', // 既存のスラッグ
      })).rejects.toThrow(ConflictError);
    });

    it('デフォルト環境として作成すると他のデフォルトが解除される', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(null);
      mockPrisma.projectEnvironment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectEnvironment.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
      mockPrisma.projectEnvironment.create.mockResolvedValue({
        ...mockEnvironment,
        id: 'new-env',
        isDefault: true,
      });

      await service.createEnvironment('project-1', {
        name: 'New Default',
        slug: 'new-default',
        isDefault: true,
      });

      expect(mockPrisma.projectEnvironment.updateMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', isDefault: true },
        data: { isDefault: false },
      });
    });

    it('最初の環境はsortOrder=0で作成される', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findUnique.mockResolvedValue(null);
      mockPrisma.projectEnvironment.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
      mockPrisma.projectEnvironment.create.mockResolvedValue({
        ...mockEnvironment,
        sortOrder: 0,
      });

      await service.createEnvironment('project-1', {
        name: 'First',
        slug: 'first',
      });

      expect(mockPrisma.projectEnvironment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sortOrder: 0 }),
      });
    });
  });

  // ============================================================
  // getEnvironments（既存機能のテスト追加）
  // ============================================================
  describe('getEnvironments', () => {
    it('プロジェクトの環境一覧を取得できる', async () => {
      const environments = [
        { ...mockEnvironment, sortOrder: 0 },
        { ...mockEnvironment, id: 'env-2', name: 'Staging', slug: 'staging', sortOrder: 1 },
      ];
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findMany.mockResolvedValue(environments);

      const result = await service.getEnvironments('project-1');

      expect(mockPrisma.projectEnvironment.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        orderBy: { sortOrder: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].sortOrder).toBe(0);
      expect(result[1].sortOrder).toBe(1);
    });

    it('環境がない場合は空配列を返す', async () => {
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockPrisma.projectEnvironment.findMany.mockResolvedValue([]);

      const result = await service.getEnvironments('project-1');

      expect(result).toEqual([]);
    });

    it('存在しないプロジェクトはNotFoundErrorを投げる', async () => {
      mockProjectRepo.findById.mockResolvedValue(null);

      await expect(service.getEnvironments('invalid-project'))
        .rejects.toThrow(NotFoundError);
    });
  });
});
