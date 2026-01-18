import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LabelRepository } from '../../repositories/label.repository.js';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaLabel = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
}));

const mockPrismaTestSuiteLabel = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
}));

const mockPrismaTransaction = vi.hoisted(() => vi.fn());

vi.mock('@agentest/db', () => ({
  prisma: {
    label: mockPrismaLabel,
    testSuiteLabel: mockPrismaTestSuiteLabel,
    $transaction: mockPrismaTransaction,
  },
}));

describe('LabelRepository', () => {
  let repository: LabelRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new LabelRepository();
  });

  describe('findByProjectId', () => {
    it('プロジェクトのラベル一覧を取得できる', async () => {
      const mockLabels = [
        { id: 'label-1', projectId: 'project-1', name: 'Bug', color: '#FF0000' },
        { id: 'label-2', projectId: 'project-1', name: 'Feature', color: '#00FF00' },
      ];
      mockPrismaLabel.findMany.mockResolvedValue(mockLabels);

      const result = await repository.findByProjectId('project-1');

      expect(mockPrismaLabel.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(mockLabels);
    });

    it('結果はname昇順でソートされる', async () => {
      mockPrismaLabel.findMany.mockResolvedValue([]);

      await repository.findByProjectId('project-1');

      expect(mockPrismaLabel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
    });
  });

  describe('findById', () => {
    it('IDでラベルを取得できる', async () => {
      const mockLabel = {
        id: 'label-1',
        projectId: 'project-1',
        name: 'Bug',
        color: '#FF0000',
        description: null,
      };
      mockPrismaLabel.findUnique.mockResolvedValue(mockLabel);

      const result = await repository.findById('label-1');

      expect(mockPrismaLabel.findUnique).toHaveBeenCalledWith({
        where: { id: 'label-1' },
      });
      expect(result).toEqual(mockLabel);
    });

    it('存在しない場合はnullを返す', async () => {
      mockPrismaLabel.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByProjectIdAndName', () => {
    it('プロジェクトと名前でラベルを取得できる', async () => {
      const mockLabel = {
        id: 'label-1',
        projectId: 'project-1',
        name: 'Bug',
        color: '#FF0000',
      };
      mockPrismaLabel.findUnique.mockResolvedValue(mockLabel);

      const result = await repository.findByProjectIdAndName('project-1', 'Bug');

      expect(mockPrismaLabel.findUnique).toHaveBeenCalledWith({
        where: {
          projectId_name: { projectId: 'project-1', name: 'Bug' },
        },
      });
      expect(result).toEqual(mockLabel);
    });

    it('存在しない場合はnullを返す', async () => {
      mockPrismaLabel.findUnique.mockResolvedValue(null);

      const result = await repository.findByProjectIdAndName('project-1', 'NonExistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('ラベルを作成できる', async () => {
      const mockLabel = {
        id: 'label-1',
        projectId: 'project-1',
        name: 'Bug',
        description: 'Bug reports',
        color: '#FF0000',
      };
      mockPrismaLabel.create.mockResolvedValue(mockLabel);

      const result = await repository.create({
        projectId: 'project-1',
        name: 'Bug',
        description: 'Bug reports',
        color: '#FF0000',
      });

      expect(mockPrismaLabel.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          name: 'Bug',
          description: 'Bug reports',
          color: '#FF0000',
        },
      });
      expect(result).toEqual(mockLabel);
    });

    it('descriptionなしで作成できる', async () => {
      const mockLabel = {
        id: 'label-1',
        projectId: 'project-1',
        name: 'Bug',
        description: undefined,
        color: '#FF0000',
      };
      mockPrismaLabel.create.mockResolvedValue(mockLabel);

      const result = await repository.create({
        projectId: 'project-1',
        name: 'Bug',
        color: '#FF0000',
      });

      expect(mockPrismaLabel.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          name: 'Bug',
          description: undefined,
          color: '#FF0000',
        },
      });
      expect(result).toEqual(mockLabel);
    });
  });

  describe('update', () => {
    it('nameを更新できる', async () => {
      const mockLabel = {
        id: 'label-1',
        name: 'Updated Bug',
        color: '#FF0000',
      };
      mockPrismaLabel.update.mockResolvedValue(mockLabel);

      const result = await repository.update('label-1', { name: 'Updated Bug' });

      expect(mockPrismaLabel.update).toHaveBeenCalledWith({
        where: { id: 'label-1' },
        data: { name: 'Updated Bug' },
      });
      expect(result).toEqual(mockLabel);
    });

    it('colorを更新できる', async () => {
      const mockLabel = {
        id: 'label-1',
        name: 'Bug',
        color: '#00FF00',
      };
      mockPrismaLabel.update.mockResolvedValue(mockLabel);

      const result = await repository.update('label-1', { color: '#00FF00' });

      expect(mockPrismaLabel.update).toHaveBeenCalledWith({
        where: { id: 'label-1' },
        data: { color: '#00FF00' },
      });
      expect(result).toEqual(mockLabel);
    });

    it('descriptionをnullに更新できる', async () => {
      const mockLabel = {
        id: 'label-1',
        name: 'Bug',
        description: null,
      };
      mockPrismaLabel.update.mockResolvedValue(mockLabel);

      const result = await repository.update('label-1', { description: null });

      expect(mockPrismaLabel.update).toHaveBeenCalledWith({
        where: { id: 'label-1' },
        data: { description: null },
      });
      expect(result).toEqual(mockLabel);
    });
  });

  describe('delete', () => {
    it('ラベルを削除できる', async () => {
      const mockLabel = {
        id: 'label-1',
        name: 'Bug',
        color: '#FF0000',
      };
      mockPrismaLabel.delete.mockResolvedValue(mockLabel);

      const result = await repository.delete('label-1');

      expect(mockPrismaLabel.delete).toHaveBeenCalledWith({
        where: { id: 'label-1' },
      });
      expect(result).toEqual(mockLabel);
    });
  });

  describe('validateLabelsBelongToProject', () => {
    it('全てのラベルが属していればtrueを返す', async () => {
      mockPrismaLabel.count.mockResolvedValue(3);

      const result = await repository.validateLabelsBelongToProject(
        ['label-1', 'label-2', 'label-3'],
        'project-1'
      );

      expect(mockPrismaLabel.count).toHaveBeenCalledWith({
        where: {
          id: { in: ['label-1', 'label-2', 'label-3'] },
          projectId: 'project-1',
        },
      });
      expect(result).toBe(true);
    });

    it('一部が属していなければfalseを返す', async () => {
      // 3つのラベルIDを渡したが、プロジェクトに属しているのは2つだけ
      mockPrismaLabel.count.mockResolvedValue(2);

      const result = await repository.validateLabelsBelongToProject(
        ['label-1', 'label-2', 'label-3'],
        'project-1'
      );

      expect(result).toBe(false);
    });

    it('空配列はtrueを返す', async () => {
      const result = await repository.validateLabelsBelongToProject([], 'project-1');

      expect(mockPrismaLabel.count).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('getTestSuiteLabels', () => {
    it('テストスイートのラベル一覧を取得できる', async () => {
      const mockTestSuiteLabels = [
        { testSuiteId: 'suite-1', labelId: 'label-1', label: { id: 'label-1', name: 'Bug', color: '#FF0000' } },
        { testSuiteId: 'suite-1', labelId: 'label-2', label: { id: 'label-2', name: 'Feature', color: '#00FF00' } },
      ];
      mockPrismaTestSuiteLabel.findMany.mockResolvedValue(mockTestSuiteLabels);

      const result = await repository.getTestSuiteLabels('suite-1');

      expect(mockPrismaTestSuiteLabel.findMany).toHaveBeenCalledWith({
        where: { testSuiteId: 'suite-1' },
        include: {
          label: true,
        },
        orderBy: {
          label: { name: 'asc' },
        },
      });
      // ラベルオブジェクトのみを返す
      expect(result).toEqual([
        { id: 'label-1', name: 'Bug', color: '#FF0000' },
        { id: 'label-2', name: 'Feature', color: '#00FF00' },
      ]);
    });
  });

  describe('updateTestSuiteLabels', () => {
    it('ラベルを一括更新できる', async () => {
      // トランザクション内の処理をモック
      mockPrismaTransaction.mockImplementation(async (callback) => {
        const tx = {
          testSuiteLabel: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
            createMany: vi.fn().mockResolvedValue({ count: 3 }),
          },
        };
        return callback(tx);
      });

      // getTestSuiteLabelsの結果をモック
      const mockLabels = [
        { id: 'label-1', name: 'Bug', color: '#FF0000' },
        { id: 'label-2', name: 'Feature', color: '#00FF00' },
        { id: 'label-3', name: 'Enhancement', color: '#0000FF' },
      ];
      mockPrismaTestSuiteLabel.findMany.mockResolvedValue([
        { testSuiteId: 'suite-1', labelId: 'label-1', label: mockLabels[0] },
        { testSuiteId: 'suite-1', labelId: 'label-2', label: mockLabels[1] },
        { testSuiteId: 'suite-1', labelId: 'label-3', label: mockLabels[2] },
      ]);

      const result = await repository.updateTestSuiteLabels('suite-1', [
        'label-1',
        'label-2',
        'label-3',
      ]);

      expect(mockPrismaTransaction).toHaveBeenCalled();
      expect(result).toEqual(mockLabels);
    });
  });
});
