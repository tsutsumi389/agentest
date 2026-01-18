import { prisma } from '@agentest/db';

/**
 * ラベルリポジトリ
 */
export class LabelRepository {
  /**
   * プロジェクトIDでラベル一覧を取得
   */
  async findByProjectId(projectId: string) {
    return prisma.label.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * IDでラベルを取得
   */
  async findById(id: string) {
    return prisma.label.findUnique({
      where: { id },
    });
  }

  /**
   * プロジェクトIDと名前でラベルを取得
   */
  async findByProjectIdAndName(projectId: string, name: string) {
    return prisma.label.findUnique({
      where: {
        projectId_name: { projectId, name },
      },
    });
  }

  /**
   * ラベルを作成
   */
  async create(data: { projectId: string; name: string; description?: string | null; color: string }) {
    return prisma.label.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        color: data.color,
      },
    });
  }

  /**
   * ラベルを更新
   */
  async update(id: string, data: { name?: string; description?: string | null; color?: string }) {
    return prisma.label.update({
      where: { id },
      data,
    });
  }

  /**
   * ラベルを削除
   */
  async delete(id: string) {
    return prisma.label.delete({
      where: { id },
    });
  }

  /**
   * 複数のラベルIDがプロジェクトに属しているか確認
   */
  async validateLabelsBelongToProject(labelIds: string[], projectId: string): Promise<boolean> {
    if (labelIds.length === 0) return true;

    const count = await prisma.label.count({
      where: {
        id: { in: labelIds },
        projectId,
      },
    });

    return count === labelIds.length;
  }

  /**
   * テストスイートに付与されているラベル一覧を取得
   */
  async getTestSuiteLabels(testSuiteId: string) {
    const testSuiteLabels = await prisma.testSuiteLabel.findMany({
      where: { testSuiteId },
      include: {
        label: true,
      },
      orderBy: {
        label: { name: 'asc' },
      },
    });

    return testSuiteLabels.map((tsl) => tsl.label);
  }

  /**
   * テストスイートのラベルを一括更新
   */
  async updateTestSuiteLabels(testSuiteId: string, labelIds: string[]) {
    // トランザクションで既存のラベルを全削除して新規追加
    await prisma.$transaction(async (tx) => {
      // 既存のラベル関連を全削除
      await tx.testSuiteLabel.deleteMany({
        where: { testSuiteId },
      });

      // 新しいラベルを追加
      if (labelIds.length > 0) {
        await tx.testSuiteLabel.createMany({
          data: labelIds.map((labelId) => ({
            testSuiteId,
            labelId,
          })),
        });
      }
    });

    // 更新後のラベル一覧を取得して返す
    return this.getTestSuiteLabels(testSuiteId);
  }
}
