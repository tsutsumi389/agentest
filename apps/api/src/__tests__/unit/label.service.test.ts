import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LabelService } from '../../services/label.service.js';
import { NotFoundError, ConflictError, ValidationError } from '@agentest/shared';

// LabelRepository のモック
const mockLabelRepo = {
  findByProjectId: vi.fn(),
  findById: vi.fn(),
  findByProjectIdAndName: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  validateLabelsBelongToProject: vi.fn(),
  getTestSuiteLabels: vi.fn(),
  updateTestSuiteLabels: vi.fn(),
};

// ProjectRepository のモック
const mockProjectRepo = {
  findById: vi.fn(),
};

// TestSuiteRepository のモック
const mockTestSuiteRepo = {
  findById: vi.fn(),
};

vi.mock('../../repositories/label.repository.js', () => ({
  LabelRepository: vi.fn().mockImplementation(() => mockLabelRepo),
}));

vi.mock('../../repositories/project.repository.js', () => ({
  ProjectRepository: vi.fn().mockImplementation(() => mockProjectRepo),
}));

vi.mock('../../repositories/test-suite.repository.js', () => ({
  TestSuiteRepository: vi.fn().mockImplementation(() => mockTestSuiteRepo),
}));

describe('LabelService', () => {
  let service: LabelService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LabelService();
  });

  describe('getByProjectId', () => {
    it('プロジェクトのラベル一覧を取得できる', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const mockLabels = [
        { id: 'label-1', name: 'Bug', color: '#FF0000' },
        { id: 'label-2', name: 'Feature', color: '#00FF00' },
      ];
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockLabelRepo.findByProjectId.mockResolvedValue(mockLabels);

      const result = await service.getByProjectId('project-1');

      expect(mockProjectRepo.findById).toHaveBeenCalledWith('project-1');
      expect(mockLabelRepo.findByProjectId).toHaveBeenCalledWith('project-1');
      expect(result).toEqual(mockLabels);
    });

    it('存在しないプロジェクトはNotFoundErrorを投げる', async () => {
      mockProjectRepo.findById.mockResolvedValue(null);

      await expect(service.getByProjectId('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('ラベルを作成できる', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const mockLabel = {
        id: 'label-1',
        projectId: 'project-1',
        name: 'Bug',
        description: null,
        color: '#FF0000',
      };
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockLabelRepo.findByProjectIdAndName.mockResolvedValue(null);
      mockLabelRepo.create.mockResolvedValue(mockLabel);

      const result = await service.create('project-1', {
        name: 'Bug',
        color: '#FF0000',
      });

      expect(mockLabelRepo.create).toHaveBeenCalledWith({
        projectId: 'project-1',
        name: 'Bug',
        description: undefined,
        color: '#FF0000',
      });
      expect(result).toEqual(mockLabel);
    });

    it('存在しないプロジェクトはNotFoundErrorを投げる', async () => {
      mockProjectRepo.findById.mockResolvedValue(null);

      await expect(
        service.create('non-existent', { name: 'Bug', color: '#FF0000' })
      ).rejects.toThrow(NotFoundError);
    });

    it('同名ラベルが存在する場合はConflictErrorを投げる', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const existingLabel = { id: 'label-1', name: 'Bug' };
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockLabelRepo.findByProjectIdAndName.mockResolvedValue(existingLabel);

      await expect(service.create('project-1', { name: 'Bug', color: '#FF0000' })).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe('update', () => {
    it('ラベルを更新できる', async () => {
      const mockLabel = {
        id: 'label-1',
        projectId: 'project-1',
        name: 'Bug',
        color: '#FF0000',
      };
      const updatedLabel = { ...mockLabel, name: 'Updated Bug' };
      mockLabelRepo.findById.mockResolvedValue(mockLabel);
      mockLabelRepo.findByProjectIdAndName.mockResolvedValue(null);
      mockLabelRepo.update.mockResolvedValue(updatedLabel);

      const result = await service.update('project-1', 'label-1', {
        name: 'Updated Bug',
      });

      expect(mockLabelRepo.update).toHaveBeenCalledWith('label-1', { name: 'Updated Bug' });
      expect(result).toEqual(updatedLabel);
    });

    it('部分更新が可能', async () => {
      const mockLabel = {
        id: 'label-1',
        projectId: 'project-1',
        name: 'Bug',
        color: '#FF0000',
        description: null,
      };
      const updatedLabel = { ...mockLabel, color: '#00FF00' };
      mockLabelRepo.findById.mockResolvedValue(mockLabel);
      mockLabelRepo.update.mockResolvedValue(updatedLabel);

      const result = await service.update('project-1', 'label-1', {
        color: '#00FF00',
      });

      expect(mockLabelRepo.update).toHaveBeenCalledWith('label-1', { color: '#00FF00' });
      expect(result).toEqual(updatedLabel);
    });

    it('存在しないラベルはNotFoundErrorを投げる', async () => {
      mockLabelRepo.findById.mockResolvedValue(null);

      await expect(
        service.update('project-1', 'non-existent', { name: 'Updated' })
      ).rejects.toThrow(NotFoundError);
    });

    it('別プロジェクトのラベルはNotFoundErrorを投げる', async () => {
      const mockLabel = {
        id: 'label-1',
        projectId: 'project-2', // 別のプロジェクト
        name: 'Bug',
      };
      mockLabelRepo.findById.mockResolvedValue(mockLabel);

      await expect(service.update('project-1', 'label-1', { name: 'Updated' })).rejects.toThrow(
        NotFoundError
      );
    });

    it('名前変更時に重複がある場合はConflictErrorを投げる', async () => {
      const mockLabel = {
        id: 'label-1',
        projectId: 'project-1',
        name: 'Bug',
      };
      const existingLabel = { id: 'label-2', name: 'Feature' };
      mockLabelRepo.findById.mockResolvedValue(mockLabel);
      mockLabelRepo.findByProjectIdAndName.mockResolvedValue(existingLabel);

      await expect(service.update('project-1', 'label-1', { name: 'Feature' })).rejects.toThrow(
        ConflictError
      );
    });

    it('同じ名前への変更は許可される', async () => {
      const mockLabel = {
        id: 'label-1',
        projectId: 'project-1',
        name: 'Bug',
        color: '#FF0000',
      };
      mockLabelRepo.findById.mockResolvedValue(mockLabel);
      mockLabelRepo.update.mockResolvedValue(mockLabel);

      // 名前を変更しない場合はfindByProjectIdAndNameは呼ばれない
      const result = await service.update('project-1', 'label-1', {
        name: 'Bug', // 同じ名前
      });

      expect(mockLabelRepo.findByProjectIdAndName).not.toHaveBeenCalled();
      expect(result).toEqual(mockLabel);
    });
  });

  describe('delete', () => {
    it('ラベルを削除できる', async () => {
      const mockLabel = {
        id: 'label-1',
        projectId: 'project-1',
        name: 'Bug',
      };
      mockLabelRepo.findById.mockResolvedValue(mockLabel);
      mockLabelRepo.delete.mockResolvedValue(mockLabel);

      await service.delete('project-1', 'label-1');

      expect(mockLabelRepo.delete).toHaveBeenCalledWith('label-1');
    });

    it('存在しないラベルはNotFoundErrorを投げる', async () => {
      mockLabelRepo.findById.mockResolvedValue(null);

      await expect(service.delete('project-1', 'non-existent')).rejects.toThrow(NotFoundError);
    });

    it('別プロジェクトのラベルはNotFoundErrorを投げる', async () => {
      const mockLabel = {
        id: 'label-1',
        projectId: 'project-2', // 別のプロジェクト
        name: 'Bug',
      };
      mockLabelRepo.findById.mockResolvedValue(mockLabel);

      await expect(service.delete('project-1', 'label-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('validateLabelsBelongToProject', () => {
    it('有効なラベルは成功する', async () => {
      mockLabelRepo.validateLabelsBelongToProject.mockResolvedValue(true);

      await expect(
        service.validateLabelsBelongToProject(['label-1', 'label-2'], 'project-1')
      ).resolves.not.toThrow();

      expect(mockLabelRepo.validateLabelsBelongToProject).toHaveBeenCalledWith(
        ['label-1', 'label-2'],
        'project-1'
      );
    });

    it('無効なラベルはValidationErrorを投げる', async () => {
      mockLabelRepo.validateLabelsBelongToProject.mockResolvedValue(false);

      await expect(
        service.validateLabelsBelongToProject(['label-1', 'invalid-label'], 'project-1')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getTestSuiteLabels', () => {
    it('テストスイートのラベルを取得できる', async () => {
      const mockTestSuite = { id: 'suite-1', projectId: 'project-1' };
      const mockLabels = [
        { id: 'label-1', name: 'Bug', color: '#FF0000' },
        { id: 'label-2', name: 'Feature', color: '#00FF00' },
      ];
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockLabelRepo.getTestSuiteLabels.mockResolvedValue(mockLabels);

      const result = await service.getTestSuiteLabels('suite-1');

      expect(mockTestSuiteRepo.findById).toHaveBeenCalledWith('suite-1');
      expect(mockLabelRepo.getTestSuiteLabels).toHaveBeenCalledWith('suite-1');
      expect(result).toEqual(mockLabels);
    });

    it('存在しないテストスイートはNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(null);

      await expect(service.getTestSuiteLabels('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateTestSuiteLabels', () => {
    it('テストスイートのラベルを更新できる', async () => {
      const mockTestSuite = { id: 'suite-1', projectId: 'project-1' };
      const mockLabels = [
        { id: 'label-1', name: 'Bug', color: '#FF0000' },
        { id: 'label-2', name: 'Feature', color: '#00FF00' },
      ];
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockLabelRepo.validateLabelsBelongToProject.mockResolvedValue(true);
      mockLabelRepo.updateTestSuiteLabels.mockResolvedValue(mockLabels);

      const result = await service.updateTestSuiteLabels('suite-1', ['label-1', 'label-2']);

      expect(mockTestSuiteRepo.findById).toHaveBeenCalledWith('suite-1');
      expect(mockLabelRepo.validateLabelsBelongToProject).toHaveBeenCalledWith(
        ['label-1', 'label-2'],
        'project-1'
      );
      expect(mockLabelRepo.updateTestSuiteLabels).toHaveBeenCalledWith('suite-1', [
        'label-1',
        'label-2',
      ]);
      expect(result).toEqual(mockLabels);
    });

    it('存在しないテストスイートはNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(null);

      await expect(service.updateTestSuiteLabels('non-existent', ['label-1'])).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
