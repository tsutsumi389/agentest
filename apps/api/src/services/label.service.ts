import { prisma } from '@agentest/db';
import { NotFoundError, ConflictError, ValidationError } from '@agentest/shared';
import { LabelRepository } from '../repositories/label.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';

/**
 * ラベルサービス
 */
export class LabelService {
  private labelRepo = new LabelRepository();
  private projectRepo = new ProjectRepository();

  /**
   * プロジェクトのラベル一覧を取得
   */
  async getByProjectId(projectId: string) {
    // プロジェクトの存在確認
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    return this.labelRepo.findByProjectId(projectId);
  }

  /**
   * ラベルを作成
   */
  async create(
    projectId: string,
    data: { name: string; description?: string | null; color: string }
  ) {
    // プロジェクトの存在確認
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    // 同名ラベルの重複チェック
    const existing = await this.labelRepo.findByProjectIdAndName(projectId, data.name);
    if (existing) {
      throw new ConflictError('同じ名前のラベルが既に存在します');
    }

    return this.labelRepo.create({
      projectId,
      name: data.name,
      description: data.description,
      color: data.color,
    });
  }

  /**
   * ラベルを更新
   */
  async update(
    projectId: string,
    labelId: string,
    data: { name?: string; description?: string | null; color?: string }
  ) {
    // ラベルの存在確認とプロジェクト所属確認
    const label = await this.labelRepo.findById(labelId);
    if (!label) {
      throw new NotFoundError('Label', labelId);
    }

    if (label.projectId !== projectId) {
      throw new NotFoundError('Label', labelId);
    }

    // 名前を変更する場合、重複チェック
    if (data.name && data.name !== label.name) {
      const existing = await this.labelRepo.findByProjectIdAndName(projectId, data.name);
      if (existing) {
        throw new ConflictError('同じ名前のラベルが既に存在します');
      }
    }

    return this.labelRepo.update(labelId, data);
  }

  /**
   * ラベルを削除
   */
  async delete(projectId: string, labelId: string) {
    // ラベルの存在確認とプロジェクト所属確認
    const label = await this.labelRepo.findById(labelId);
    if (!label) {
      throw new NotFoundError('Label', labelId);
    }

    if (label.projectId !== projectId) {
      throw new NotFoundError('Label', labelId);
    }

    await this.labelRepo.delete(labelId);
  }

  /**
   * ラベルIDがプロジェクトに属しているか検証
   */
  async validateLabelsBelongToProject(labelIds: string[], projectId: string) {
    const isValid = await this.labelRepo.validateLabelsBelongToProject(labelIds, projectId);
    if (!isValid) {
      throw new ValidationError('指定されたラベルの一部がこのプロジェクトに属していません');
    }
  }

  /**
   * テストスイートに付与されているラベル一覧を取得
   */
  async getTestSuiteLabels(testSuiteId: string) {
    // テストスイートの存在確認
    const testSuite = await prisma.testSuite.findFirst({
      where: {
        id: testSuiteId,
        deletedAt: null,
      },
    });
    if (!testSuite) {
      throw new NotFoundError('TestSuite', testSuiteId);
    }

    return this.labelRepo.getTestSuiteLabels(testSuiteId);
  }

  /**
   * テストスイートのラベルを一括更新
   */
  async updateTestSuiteLabels(testSuiteId: string, labelIds: string[]) {
    // テストスイートの存在確認
    const testSuite = await prisma.testSuite.findFirst({
      where: {
        id: testSuiteId,
        deletedAt: null,
      },
      include: {
        project: true,
      },
    });
    if (!testSuite) {
      throw new NotFoundError('TestSuite', testSuiteId);
    }

    // ラベルがプロジェクトに属しているか検証
    if (labelIds.length > 0) {
      await this.validateLabelsBelongToProject(labelIds, testSuite.projectId);
    }

    return this.labelRepo.updateTestSuiteLabels(testSuiteId, labelIds);
  }
}
