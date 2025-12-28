import { prisma, type EntityStatus } from '@agentest/db';
import { NotFoundError, BadRequestError } from '@agentest/shared';
import { TestSuiteRepository } from '../repositories/test-suite.repository.js';

/**
 * テストスイートサービス
 */
export class TestSuiteService {
  private testSuiteRepo = new TestSuiteRepository();

  /**
   * テストスイートを作成
   */
  async create(userId: string, data: { projectId: string; name: string; description?: string; status?: EntityStatus }) {
    // プロジェクトの存在確認
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });
    if (!project || project.deletedAt) {
      throw new NotFoundError('Project', data.projectId);
    }

    return prisma.testSuite.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        status: data.status ?? 'DRAFT',
        createdByUserId: userId,
      },
    });
  }

  /**
   * テストスイートをIDで検索
   */
  async findById(testSuiteId: string) {
    const testSuite = await this.testSuiteRepo.findById(testSuiteId);
    if (!testSuite) {
      throw new NotFoundError('TestSuite', testSuiteId);
    }
    return testSuite;
  }

  /**
   * テストスイートを更新
   */
  async update(
    testSuiteId: string,
    userId: string,
    data: { name?: string; description?: string | null; status?: EntityStatus }
  ) {
    const testSuite = await this.findById(testSuiteId);

    // 履歴を保存
    await prisma.testSuiteHistory.create({
      data: {
        testSuiteId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: testSuite as unknown as object,
      },
    });

    return this.testSuiteRepo.update(testSuiteId, data);
  }

  /**
   * テストスイートを論理削除
   */
  async softDelete(testSuiteId: string, userId: string) {
    const testSuite = await this.findById(testSuiteId);

    // 履歴を保存
    await prisma.testSuiteHistory.create({
      data: {
        testSuiteId,
        changedByUserId: userId,
        changeType: 'DELETE',
        snapshot: testSuite as unknown as object,
      },
    });

    return this.testSuiteRepo.softDelete(testSuiteId);
  }

  /**
   * テストケース一覧を取得
   */
  async getTestCases(testSuiteId: string) {
    await this.findById(testSuiteId);

    return prisma.testCase.findMany({
      where: {
        testSuiteId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            preconditions: true,
            steps: true,
            expectedResults: true,
          },
        },
      },
      orderBy: { orderKey: 'asc' },
    });
  }

  /**
   * 前提条件一覧を取得
   */
  async getPreconditions(testSuiteId: string) {
    await this.findById(testSuiteId);

    return prisma.testSuitePrecondition.findMany({
      where: { testSuiteId },
      orderBy: { orderKey: 'asc' },
    });
  }

  /**
   * 前提条件を追加
   */
  async addPrecondition(testSuiteId: string, data: { content: string; orderKey?: string }) {
    await this.findById(testSuiteId);

    // orderKeyが指定されていない場合は自動生成
    let orderKey = data.orderKey;
    if (!orderKey) {
      const lastPrecondition = await prisma.testSuitePrecondition.findFirst({
        where: { testSuiteId },
        orderBy: { orderKey: 'desc' },
      });
      orderKey = lastPrecondition ? `${parseInt(lastPrecondition.orderKey) + 1}`.padStart(5, '0') : '00001';
    }

    return prisma.testSuitePrecondition.create({
      data: {
        testSuiteId,
        content: data.content,
        orderKey,
      },
    });
  }

  /**
   * 前提条件を更新
   */
  async updatePrecondition(testSuiteId: string, preconditionId: string, userId: string, data: { content: string }) {
    const testSuite = await this.findById(testSuiteId);

    // 前提条件の存在確認
    const precondition = await prisma.testSuitePrecondition.findFirst({
      where: { id: preconditionId, testSuiteId },
    });
    if (!precondition) {
      throw new NotFoundError('Precondition', preconditionId);
    }

    // 履歴を保存
    await prisma.testSuiteHistory.create({
      data: {
        testSuiteId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: {
          ...testSuite,
          preconditions: [precondition],
          changeDetail: {
            type: 'PRECONDITION_UPDATE',
            preconditionId,
            before: { content: precondition.content },
            after: { content: data.content },
          },
        } as unknown as object,
      },
    });

    return prisma.testSuitePrecondition.update({
      where: { id: preconditionId },
      data: { content: data.content },
    });
  }

  /**
   * 前提条件を削除
   */
  async deletePrecondition(testSuiteId: string, preconditionId: string, userId: string) {
    const testSuite = await this.findById(testSuiteId);

    // 前提条件の存在確認
    const precondition = await prisma.testSuitePrecondition.findFirst({
      where: { id: preconditionId, testSuiteId },
    });
    if (!precondition) {
      throw new NotFoundError('Precondition', preconditionId);
    }

    // トランザクションで削除と再整列を実行
    await prisma.$transaction(async (tx) => {
      // 履歴を保存
      await tx.testSuiteHistory.create({
        data: {
          testSuiteId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: {
            ...testSuite,
            preconditions: [precondition],
            changeDetail: {
              type: 'PRECONDITION_DELETE',
              preconditionId,
              deleted: { content: precondition.content, orderKey: precondition.orderKey },
            },
          } as unknown as object,
        },
      });

      // 前提条件を削除
      await tx.testSuitePrecondition.delete({
        where: { id: preconditionId },
      });

      // 残りの前提条件のorderKeyを再整列
      const remainingPreconditions = await tx.testSuitePrecondition.findMany({
        where: { testSuiteId },
        orderBy: { orderKey: 'asc' },
      });

      for (let i = 0; i < remainingPreconditions.length; i++) {
        await tx.testSuitePrecondition.update({
          where: { id: remainingPreconditions[i].id },
          data: { orderKey: `${i + 1}`.padStart(5, '0') },
        });
      }
    });
  }

  /**
   * 前提条件を並び替え
   */
  async reorderPreconditions(testSuiteId: string, preconditionIds: string[], userId: string) {
    const testSuite = await this.findById(testSuiteId);

    // 重複IDのチェック
    const uniqueIds = new Set(preconditionIds);
    if (uniqueIds.size !== preconditionIds.length) {
      throw new BadRequestError('Duplicate precondition IDs are not allowed');
    }

    // 全ての前提条件が存在するか確認
    const preconditions = await prisma.testSuitePrecondition.findMany({
      where: { testSuiteId },
      orderBy: { orderKey: 'asc' },
    });

    // 全件指定されているか確認
    if (preconditionIds.length !== preconditions.length) {
      throw new BadRequestError('All precondition IDs must be provided for reordering');
    }

    const existingIds = new Set(preconditions.map((p) => p.id));
    for (const id of preconditionIds) {
      if (!existingIds.has(id)) {
        throw new NotFoundError('Precondition', id);
      }
    }

    // 履歴を保存（並び替え前の状態）
    await prisma.testSuiteHistory.create({
      data: {
        testSuiteId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: {
          ...testSuite,
          preconditions,
          changeDetail: {
            type: 'PRECONDITION_REORDER',
            before: preconditions.map((p) => p.id),
            after: preconditionIds,
          },
        } as unknown as object,
      },
    });

    // 各前提条件のorderKeyを更新
    await prisma.$transaction(
      preconditionIds.map((id, index) =>
        prisma.testSuitePrecondition.update({
          where: { id },
          data: { orderKey: `${index + 1}`.padStart(5, '0') },
        })
      )
    );

    // 更新後の前提条件一覧を返す
    return prisma.testSuitePrecondition.findMany({
      where: { testSuiteId },
      orderBy: { orderKey: 'asc' },
    });
  }

  /**
   * 実行履歴を取得
   */
  async getExecutions(testSuiteId: string, options: { limit: number; offset: number }) {
    await this.findById(testSuiteId);

    return prisma.execution.findMany({
      where: { testSuiteId },
      include: {
        executedByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
        environment: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: options.limit,
      skip: options.offset,
    });
  }

  /**
   * テスト実行を開始
   */
  async startExecution(testSuiteId: string, userId: string, data: { environmentId?: string }) {
    const testSuite = await this.findById(testSuiteId);

    // テストケースとその詳細を取得
    const testCases = await prisma.testCase.findMany({
      where: {
        testSuiteId,
        deletedAt: null,
      },
      include: {
        preconditions: true,
        steps: true,
        expectedResults: true,
      },
    });

    // スイートの前提条件を取得
    const suitePreconditions = await prisma.testSuitePrecondition.findMany({
      where: { testSuiteId },
    });

    // スナップショットデータを作成
    const snapshotData = {
      testSuite: {
        id: testSuite.id,
        name: testSuite.name,
        description: testSuite.description,
      },
      preconditions: suitePreconditions,
      testCases: testCases.map((tc) => ({
        id: tc.id,
        title: tc.title,
        description: tc.description,
        priority: tc.priority,
        preconditions: tc.preconditions,
        steps: tc.steps,
        expectedResults: tc.expectedResults,
      })),
    };

    // トランザクションで実行と結果レコードを作成
    return prisma.$transaction(async (tx) => {
      const execution = await tx.execution.create({
        data: {
          testSuiteId,
          environmentId: data.environmentId,
          executedByUserId: userId,
          status: 'IN_PROGRESS',
        },
      });

      // スナップショットを保存
      await tx.executionSnapshot.create({
        data: {
          executionId: execution.id,
          snapshotData,
        },
      });

      // スイートの前提条件結果を作成
      for (const precondition of suitePreconditions) {
        await tx.executionPreconditionResult.create({
          data: {
            executionId: execution.id,
            snapshotPreconditionId: precondition.id,
            status: 'UNCHECKED',
          },
        });
      }

      // 各テストケースの結果を作成
      for (const testCase of testCases) {
        // 前提条件結果
        for (const precondition of testCase.preconditions) {
          await tx.executionPreconditionResult.create({
            data: {
              executionId: execution.id,
              snapshotTestCaseId: testCase.id,
              snapshotPreconditionId: precondition.id,
              status: 'UNCHECKED',
            },
          });
        }

        // ステップ結果
        for (const step of testCase.steps) {
          await tx.executionStepResult.create({
            data: {
              executionId: execution.id,
              snapshotTestCaseId: testCase.id,
              snapshotStepId: step.id,
              status: 'PENDING',
            },
          });
        }

        // 期待結果
        for (const expectedResult of testCase.expectedResults) {
          await tx.executionExpectedResult.create({
            data: {
              executionId: execution.id,
              snapshotTestCaseId: testCase.id,
              snapshotExpectedResultId: expectedResult.id,
              status: 'PENDING',
            },
          });
        }
      }

      return execution;
    });
  }
}
