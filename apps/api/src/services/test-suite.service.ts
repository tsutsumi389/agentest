import { prisma, type EntityStatus, type ExecutionStatus, type Prisma } from '@agentest/db';
import { NotFoundError, BadRequestError, ConflictError } from '@agentest/shared';
import { TestSuiteRepository } from '../repositories/test-suite.repository.js';
import { TestCaseRepository, type TestCaseSearchOptions } from '../repositories/test-case.repository.js';

/**
 * テストスイートのスナップショット型（基本情報）
 */
type TestSuiteSnapshot = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  deletedAt?: string | null;
};

/**
 * 前提条件のスナップショット型
 */
type PreconditionSnapshot = {
  id: string;
  content: string;
  orderKey: string;
};

/**
 * テストケースのスナップショット型
 */
type TestCaseSnapshot = {
  id: string;
  title: string;
  orderKey: string;
};

/**
 * 前提条件変更の詳細情報
 */
type PreconditionChangeDetail =
  | {
      type: 'PRECONDITION_ADD';
      preconditionId: string;
      added: { content: string; orderKey: string };
    }
  | {
      type: 'PRECONDITION_UPDATE';
      preconditionId: string;
      before: { content: string };
      after: { content: string };
    }
  | {
      type: 'PRECONDITION_DELETE';
      preconditionId: string;
      deleted: { content: string; orderKey: string };
    }
  | {
      type: 'PRECONDITION_REORDER';
      before: string[];
      after: string[];
    };

/**
 * テストケース変更の詳細情報
 */
type TestCaseChangeDetail = {
  type: 'TEST_CASE_REORDER';
  before: string[];
  after: string[];
};

/**
 * 履歴保存用のスナップショット型
 */
type HistorySnapshot = TestSuiteSnapshot & {
  preconditions?: PreconditionSnapshot[];
  testCases?: TestCaseSnapshot[];
  changeDetail?: PreconditionChangeDetail | TestCaseChangeDetail;
};

/**
 * スナップショットをPrismaのJSON型に変換
 */
function toJsonSnapshot(snapshot: TestSuiteSnapshot | HistorySnapshot): Prisma.InputJsonValue {
  return snapshot as unknown as Prisma.InputJsonValue;
}

/**
 * テストスイートサービス
 */
export class TestSuiteService {
  private testSuiteRepo = new TestSuiteRepository();
  private testCaseRepo = new TestCaseRepository();

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

    const snapshot: TestSuiteSnapshot = {
      id: testSuite.id,
      projectId: testSuite.projectId,
      name: testSuite.name,
      description: testSuite.description,
      status: testSuite.status,
    };

    // 履歴を保存
    await prisma.testSuiteHistory.create({
      data: {
        testSuiteId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: toJsonSnapshot(snapshot),
      },
    });

    return this.testSuiteRepo.update(testSuiteId, data);
  }

  /**
   * テストスイートを論理削除
   */
  async softDelete(testSuiteId: string, userId: string) {
    const testSuite = await this.findById(testSuiteId);

    const snapshot: TestSuiteSnapshot = {
      id: testSuite.id,
      projectId: testSuite.projectId,
      name: testSuite.name,
      description: testSuite.description,
      status: testSuite.status,
    };

    // 履歴を保存
    await prisma.testSuiteHistory.create({
      data: {
        testSuiteId,
        changedByUserId: userId,
        changeType: 'DELETE',
        snapshot: toJsonSnapshot(snapshot),
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
   * テストケースを検索
   */
  async searchTestCases(testSuiteId: string, options: TestCaseSearchOptions) {
    // テストスイート存在確認
    await this.findById(testSuiteId);
    return this.testCaseRepo.search(testSuiteId, options);
  }

  /**
   * テストケースをサジェスト（@メンション用）
   */
  async suggestTestCases(testSuiteId: string, options: { q?: string; limit: number }) {
    // テストスイート存在確認
    await this.findById(testSuiteId);
    return this.testCaseRepo.suggest(testSuiteId, options);
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
  async addPrecondition(testSuiteId: string, userId: string, data: { content: string; orderKey?: string }) {
    const testSuite = await this.findById(testSuiteId);

    // orderKeyが指定されていない場合は自動生成
    let orderKey = data.orderKey;
    if (!orderKey) {
      const lastPrecondition = await prisma.testSuitePrecondition.findFirst({
        where: { testSuiteId },
        orderBy: { orderKey: 'desc' },
      });
      orderKey = lastPrecondition ? `${parseInt(lastPrecondition.orderKey) + 1}`.padStart(5, '0') : '00001';
    }

    const precondition = await prisma.testSuitePrecondition.create({
      data: {
        testSuiteId,
        content: data.content,
        orderKey,
      },
    });

    const snapshot: HistorySnapshot = {
      id: testSuite.id,
      projectId: testSuite.projectId,
      name: testSuite.name,
      description: testSuite.description,
      status: testSuite.status,
      preconditions: [{ id: precondition.id, content: precondition.content, orderKey: precondition.orderKey }],
      changeDetail: {
        type: 'PRECONDITION_ADD',
        preconditionId: precondition.id,
        added: { content: precondition.content, orderKey: precondition.orderKey },
      },
    };

    // 履歴を保存
    await prisma.testSuiteHistory.create({
      data: {
        testSuiteId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: toJsonSnapshot(snapshot),
      },
    });

    return precondition;
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

    const snapshot: HistorySnapshot = {
      id: testSuite.id,
      projectId: testSuite.projectId,
      name: testSuite.name,
      description: testSuite.description,
      status: testSuite.status,
      preconditions: [{ id: precondition.id, content: precondition.content, orderKey: precondition.orderKey }],
      changeDetail: {
        type: 'PRECONDITION_UPDATE',
        preconditionId,
        before: { content: precondition.content },
        after: { content: data.content },
      },
    };

    // 履歴を保存
    await prisma.testSuiteHistory.create({
      data: {
        testSuiteId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: toJsonSnapshot(snapshot),
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

    const snapshot: HistorySnapshot = {
      id: testSuite.id,
      projectId: testSuite.projectId,
      name: testSuite.name,
      description: testSuite.description,
      status: testSuite.status,
      preconditions: [{ id: precondition.id, content: precondition.content, orderKey: precondition.orderKey }],
      changeDetail: {
        type: 'PRECONDITION_DELETE',
        preconditionId,
        deleted: { content: precondition.content, orderKey: precondition.orderKey },
      },
    };

    // トランザクションで削除と再整列を実行
    await prisma.$transaction(async (tx) => {
      // 履歴を保存
      await tx.testSuiteHistory.create({
        data: {
          testSuiteId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
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

    // 全ての前提条件を取得
    const preconditions = await prisma.testSuitePrecondition.findMany({
      where: { testSuiteId },
      orderBy: { orderKey: 'asc' },
    });

    // 空配列チェック（前提条件が0件の場合はそのまま返す）
    if (preconditions.length === 0 && preconditionIds.length === 0) {
      return [];
    }

    // 重複IDのチェック
    const uniqueIds = new Set(preconditionIds);
    if (uniqueIds.size !== preconditionIds.length) {
      throw new BadRequestError('Duplicate precondition IDs are not allowed');
    }

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

    const snapshot: HistorySnapshot = {
      id: testSuite.id,
      projectId: testSuite.projectId,
      name: testSuite.name,
      description: testSuite.description,
      status: testSuite.status,
      preconditions: preconditions.map((p) => ({ id: p.id, content: p.content, orderKey: p.orderKey })),
      changeDetail: {
        type: 'PRECONDITION_REORDER',
        before: preconditions.map((p) => p.id),
        after: preconditionIds,
      },
    };

    // 履歴を保存（並び替え前の状態）
    await prisma.testSuiteHistory.create({
      data: {
        testSuiteId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: toJsonSnapshot(snapshot),
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
  async getExecutions(
    testSuiteId: string,
    options: {
      status?: ExecutionStatus[];
      from?: string;
      to?: string;
      limit: number;
      offset: number;
      sortBy?: 'startedAt' | 'completedAt' | 'status';
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    await this.findById(testSuiteId);

    const where: Prisma.ExecutionWhereInput = {
      testSuiteId,
      ...(options.status?.length && { status: { in: options.status } }),
      ...((options.from || options.to) && {
        startedAt: {
          ...(options.from && { gte: new Date(options.from) }),
          ...(options.to && { lte: new Date(options.to) }),
        },
      }),
    };

    const [executions, total] = await Promise.all([
      prisma.execution.findMany({
        where,
        include: {
          executedByUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
          environment: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { [options.sortBy || 'startedAt']: options.sortOrder || 'desc' },
        take: options.limit,
        skip: options.offset,
      }),
      prisma.execution.count({ where }),
    ]);

    return { executions, total };
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
        preconditions: { orderBy: { orderKey: 'asc' } },
        steps: { orderBy: { orderKey: 'asc' } },
        expectedResults: { orderBy: { orderKey: 'asc' } },
      },
      orderBy: { orderKey: 'asc' },
    });

    // スイートの前提条件を取得
    const suitePreconditions = await prisma.testSuitePrecondition.findMany({
      where: { testSuiteId },
      orderBy: { orderKey: 'asc' },
    });

    // トランザクションで実行と正規化テーブルを作成
    return prisma.$transaction(async (tx) => {
      // 1. Executionを作成
      const execution = await tx.execution.create({
        data: {
          testSuiteId,
          environmentId: data.environmentId,
          executedByUserId: userId,
          status: 'IN_PROGRESS',
        },
      });

      // 2. ExecutionTestSuiteを作成（テストスイートのスナップショット）
      const executionTestSuite = await tx.executionTestSuite.create({
        data: {
          executionId: execution.id,
          originalTestSuiteId: testSuite.id,
          name: testSuite.name,
          description: testSuite.description,
        },
      });

      // 3. ExecutionTestSuitePreconditionを作成（スイート前提条件のスナップショット）
      const execSuitePreconditions = await Promise.all(
        suitePreconditions.map((precondition) =>
          tx.executionTestSuitePrecondition.create({
            data: {
              executionTestSuiteId: executionTestSuite.id,
              originalPreconditionId: precondition.id,
              content: precondition.content,
              orderKey: precondition.orderKey,
            },
          })
        )
      );

      // スイート前提条件のマッピング（元ID → 実行時ID）
      const suitePreconditionMap = new Map(
        suitePreconditions.map((orig, index) => [orig.id, execSuitePreconditions[index].id])
      );

      // 4. ExecutionTestCaseとその子要素を作成
      for (const testCase of testCases) {
        // ExecutionTestCaseを作成
        const executionTestCase = await tx.executionTestCase.create({
          data: {
            executionTestSuiteId: executionTestSuite.id,
            originalTestCaseId: testCase.id,
            title: testCase.title,
            description: testCase.description,
            priority: testCase.priority,
            orderKey: testCase.orderKey,
          },
        });

        // ExecutionTestCasePreconditionを作成
        const execCasePreconditions = await Promise.all(
          testCase.preconditions.map((precondition) =>
            tx.executionTestCasePrecondition.create({
              data: {
                executionTestCaseId: executionTestCase.id,
                originalPreconditionId: precondition.id,
                content: precondition.content,
                orderKey: precondition.orderKey,
              },
            })
          )
        );

        // ExecutionTestCaseStepを作成
        const execSteps = await Promise.all(
          testCase.steps.map((step) =>
            tx.executionTestCaseStep.create({
              data: {
                executionTestCaseId: executionTestCase.id,
                originalStepId: step.id,
                content: step.content,
                orderKey: step.orderKey,
              },
            })
          )
        );

        // ExecutionTestCaseExpectedResultを作成
        const execExpectedResults = await Promise.all(
          testCase.expectedResults.map((expectedResult) =>
            tx.executionTestCaseExpectedResult.create({
              data: {
                executionTestCaseId: executionTestCase.id,
                originalExpectedResultId: expectedResult.id,
                content: expectedResult.content,
                orderKey: expectedResult.orderKey,
              },
            })
          )
        );

        // 5. ExecutionPreconditionResult（テストケース前提条件の結果）を作成
        for (let i = 0; i < testCase.preconditions.length; i++) {
          await tx.executionPreconditionResult.create({
            data: {
              executionId: execution.id,
              executionTestCaseId: executionTestCase.id,
              executionCasePreconditionId: execCasePreconditions[i].id,
              status: 'UNCHECKED',
            },
          });
        }

        // 6. ExecutionStepResultを作成
        for (let i = 0; i < testCase.steps.length; i++) {
          await tx.executionStepResult.create({
            data: {
              executionId: execution.id,
              executionTestCaseId: executionTestCase.id,
              executionStepId: execSteps[i].id,
              status: 'PENDING',
            },
          });
        }

        // 7. ExecutionExpectedResultを作成
        for (let i = 0; i < testCase.expectedResults.length; i++) {
          await tx.executionExpectedResult.create({
            data: {
              executionId: execution.id,
              executionTestCaseId: executionTestCase.id,
              executionExpectedResultId: execExpectedResults[i].id,
              status: 'PENDING',
            },
          });
        }
      }

      // 8. ExecutionPreconditionResult（スイート前提条件の結果）を作成
      for (const precondition of suitePreconditions) {
        await tx.executionPreconditionResult.create({
          data: {
            executionId: execution.id,
            executionSuitePreconditionId: suitePreconditionMap.get(precondition.id),
            status: 'UNCHECKED',
          },
        });
      }

      return execution;
    });
  }

  /**
   * 変更履歴一覧を取得
   */
  async getHistories(testSuiteId: string, options: { limit: number; offset: number }) {
    // 削除済みを含めてテストスイートの存在確認
    const testSuite = await prisma.testSuite.findUnique({
      where: { id: testSuiteId },
    });
    if (!testSuite) {
      throw new NotFoundError('TestSuite', testSuiteId);
    }

    const [histories, total] = await Promise.all([
      this.testSuiteRepo.getHistories(testSuiteId, options),
      this.testSuiteRepo.countHistories(testSuiteId),
    ]);

    return { histories, total };
  }

  /**
   * 削除済みテストスイートを復元
   */
  async restore(testSuiteId: string, userId: string) {
    // 削除済みテストスイートを取得
    const testSuite = await this.testSuiteRepo.findDeletedById(testSuiteId);
    if (!testSuite) {
      // 削除されていないか、存在しない
      const existingTestSuite = await prisma.testSuite.findUnique({
        where: { id: testSuiteId },
      });
      if (existingTestSuite && !existingTestSuite.deletedAt) {
        throw new ConflictError('Test suite is not deleted');
      }
      throw new NotFoundError('TestSuite', testSuiteId);
    }

    const snapshot: TestSuiteSnapshot = {
      id: testSuite.id,
      projectId: testSuite.projectId,
      name: testSuite.name,
      description: testSuite.description,
      status: testSuite.status,
      deletedAt: testSuite.deletedAt?.toISOString() ?? null,
    };

    // 復元と履歴保存をトランザクションで実行
    return prisma.$transaction(async (tx) => {
      // 履歴を保存
      await tx.testSuiteHistory.create({
        data: {
          testSuiteId,
          changedByUserId: userId,
          changeType: 'RESTORE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      // リポジトリを使用して復元
      return this.testSuiteRepo.restore(testSuiteId);
    });
  }

  /**
   * テストケースを並び替え
   */
  async reorderTestCases(testSuiteId: string, testCaseIds: string[], userId: string) {
    const testSuite = await this.findById(testSuiteId);

    // 現在のテストケース一覧取得
    const testCases = await prisma.testCase.findMany({
      where: {
        testSuiteId,
        deletedAt: null,
      },
      orderBy: { orderKey: 'asc' },
    });

    // 空配列チェック（テストケースが0件の場合はそのまま返す）
    if (testCases.length === 0 && testCaseIds.length === 0) {
      return [];
    }

    // 重複チェック
    const uniqueIds = new Set(testCaseIds);
    if (uniqueIds.size !== testCaseIds.length) {
      throw new BadRequestError('重複したテストケースIDが含まれています');
    }

    // 全件指定確認
    const existingIds = testCases.map((tc) => tc.id);
    const existingIdSet = new Set(existingIds);
    const missingIds = testCaseIds.filter((id) => !existingIdSet.has(id));
    if (missingIds.length > 0) {
      throw new BadRequestError('存在しないテストケースIDが含まれています');
    }

    const extraIds = existingIds.filter((id) => !uniqueIds.has(id));
    if (extraIds.length > 0) {
      throw new BadRequestError('すべてのテストケースを指定してください');
    }

    // 同値チェック（順序が変わっていない場合はそのまま返す）
    const isSameOrder = testCaseIds.every((id, index) => id === existingIds[index]);
    if (isSameOrder) {
      return testCases;
    }

    // 履歴スナップショット作成
    const snapshot: HistorySnapshot = {
      id: testSuite.id,
      projectId: testSuite.projectId,
      name: testSuite.name,
      description: testSuite.description,
      status: testSuite.status,
      testCases: testCases.map((tc) => ({
        id: tc.id,
        title: tc.title,
        orderKey: tc.orderKey,
      })),
      changeDetail: {
        type: 'TEST_CASE_REORDER',
        before: existingIds,
        after: testCaseIds,
      },
    };

    // トランザクション実行
    await prisma.$transaction(async (tx) => {
      // 履歴保存
      await tx.testSuiteHistory.create({
        data: {
          testSuiteId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      // orderKey更新（並列実行）
      await Promise.all(
        testCaseIds.map((id, index) =>
          tx.testCase.update({
            where: { id },
            data: { orderKey: `${index + 1}`.padStart(5, '0') },
          })
        )
      );
    });

    // 更新後のテストケース一覧を返却
    return prisma.testCase.findMany({
      where: {
        testSuiteId,
        deletedAt: null,
      },
      orderBy: { orderKey: 'asc' },
    });
  }
}
