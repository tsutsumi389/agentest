import { prisma, type TestCasePriority, type EntityStatus, type Prisma } from '@agentest/db';
import { NotFoundError, BadRequestError } from '@agentest/shared';
import { TestCaseRepository } from '../repositories/test-case.repository.js';

// orderKey関連の定数
const ORDER_KEY_INITIAL = '00001';
const ORDER_KEY_PAD_LENGTH = 5;

/**
 * 次のorderKeyを計算する
 * @param currentKey 現在の最大orderKey（nullの場合は初期値を返す）
 * @returns 次のorderKey
 */
function getNextOrderKey(currentKey: string | null): string {
  if (!currentKey) return ORDER_KEY_INITIAL;
  const num = parseInt(currentKey, 10);
  if (isNaN(num)) return ORDER_KEY_INITIAL;
  return `${num + 1}`.padStart(ORDER_KEY_PAD_LENGTH, '0');
}

/**
 * インデックスからorderKeyを生成する
 * @param index 0始まりのインデックス
 * @returns orderKey
 */
function indexToOrderKey(index: number): string {
  return `${index + 1}`.padStart(ORDER_KEY_PAD_LENGTH, '0');
}

/**
 * テストケースのスナップショット型（基本情報）
 */
type TestCaseSnapshot = {
  id: string;
  testSuiteId: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
};

/**
 * 子エンティティのスナップショット型
 */
type ChildEntitySnapshot = {
  id: string;
  content: string;
  orderKey: string;
};

/**
 * 子エンティティ変更の詳細情報
 */
type ChildEntityChangeDetail =
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
    }
  | {
      type: 'STEP_ADD';
      stepId: string;
      added: { content: string; orderKey: string };
    }
  | {
      type: 'STEP_UPDATE';
      stepId: string;
      before: { content: string };
      after: { content: string };
    }
  | {
      type: 'STEP_DELETE';
      stepId: string;
      deleted: { content: string; orderKey: string };
    }
  | {
      type: 'STEP_REORDER';
      before: string[];
      after: string[];
    }
  | {
      type: 'EXPECTED_RESULT_ADD';
      expectedResultId: string;
      added: { content: string; orderKey: string };
    }
  | {
      type: 'EXPECTED_RESULT_UPDATE';
      expectedResultId: string;
      before: { content: string };
      after: { content: string };
    }
  | {
      type: 'EXPECTED_RESULT_DELETE';
      expectedResultId: string;
      deleted: { content: string; orderKey: string };
    }
  | {
      type: 'EXPECTED_RESULT_REORDER';
      before: string[];
      after: string[];
    };

/**
 * 履歴保存用のスナップショット型
 */
type HistorySnapshot = TestCaseSnapshot & {
  preconditions?: ChildEntitySnapshot[];
  steps?: ChildEntitySnapshot[];
  expectedResults?: ChildEntitySnapshot[];
  changeDetail?: ChildEntityChangeDetail;
};

/**
 * スナップショットをPrismaのJSON型に変換
 */
function toJsonSnapshot(snapshot: TestCaseSnapshot | HistorySnapshot): Prisma.InputJsonValue {
  return snapshot as unknown as Prisma.InputJsonValue;
}

/**
 * テストケースサービス
 */
export class TestCaseService {
  private testCaseRepo = new TestCaseRepository();

  /**
   * テストケースを作成
   */
  async create(
    userId: string,
    data: {
      testSuiteId: string;
      title: string;
      description?: string;
      priority?: TestCasePriority;
      status?: EntityStatus;
    }
  ) {
    // テストスイートの存在確認
    const testSuite = await prisma.testSuite.findUnique({
      where: { id: data.testSuiteId },
    });
    if (!testSuite || testSuite.deletedAt) {
      throw new NotFoundError('TestSuite', data.testSuiteId);
    }

    // 次のorderKeyを取得
    const lastTestCase = await prisma.testCase.findFirst({
      where: { testSuiteId: data.testSuiteId },
      orderBy: { orderKey: 'desc' },
    });
    const orderKey = getNextOrderKey(lastTestCase?.orderKey ?? null);

    return prisma.testCase.create({
      data: {
        testSuiteId: data.testSuiteId,
        title: data.title,
        description: data.description,
        priority: data.priority ?? 'MEDIUM',
        status: data.status ?? 'DRAFT',
        orderKey,
        createdByUserId: userId,
      },
    });
  }

  /**
   * テストケースをIDで検索
   */
  async findById(testCaseId: string) {
    const testCase = await this.testCaseRepo.findById(testCaseId);
    if (!testCase) {
      throw new NotFoundError('TestCase', testCaseId);
    }
    return testCase;
  }

  /**
   * テストケースを更新
   */
  async update(
    testCaseId: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      priority?: TestCasePriority;
      status?: EntityStatus;
    }
  ) {
    const testCase = await this.findById(testCaseId);

    // 履歴保存と更新を同じトランザクションで実行
    return prisma.$transaction(async (tx) => {
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: testCase as unknown as object,
        },
      });

      return tx.testCase.update({
        where: { id: testCaseId },
        data,
      });
    });
  }

  /**
   * テストケースを論理削除
   */
  async softDelete(testCaseId: string, userId: string) {
    const testCase = await this.findById(testCaseId);

    // 履歴保存と論理削除を同じトランザクションで実行
    return prisma.$transaction(async (tx) => {
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'DELETE',
          snapshot: testCase as unknown as object,
        },
      });

      return tx.testCase.update({
        where: { id: testCaseId },
        data: { deletedAt: new Date() },
      });
    });
  }

  /**
   * 前提条件一覧を取得
   */
  async getPreconditions(testCaseId: string) {
    await this.findById(testCaseId);

    return prisma.testCasePrecondition.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });
  }

  /**
   * 前提条件を追加
   */
  async addPrecondition(testCaseId: string, userId: string, data: { content: string; orderKey?: string }) {
    const testCase = await this.findById(testCaseId);

    return prisma.$transaction(async (tx) => {
      let orderKey = data.orderKey;
      if (!orderKey) {
        const lastItem = await tx.testCasePrecondition.findFirst({
          where: { testCaseId },
          orderBy: { orderKey: 'desc' },
        });
        orderKey = getNextOrderKey(lastItem?.orderKey ?? null);
      }

      const precondition = await tx.testCasePrecondition.create({
        data: {
          testCaseId,
          content: data.content,
          orderKey,
        },
      });

      // 履歴を保存
      const snapshot: HistorySnapshot = {
        id: testCase.id,
        testSuiteId: testCase.testSuiteId,
        title: testCase.title,
        description: testCase.description,
        priority: testCase.priority,
        status: testCase.status,
        preconditions: [{ id: precondition.id, content: precondition.content, orderKey: precondition.orderKey }],
        changeDetail: {
          type: 'PRECONDITION_ADD',
          preconditionId: precondition.id,
          added: { content: precondition.content, orderKey: precondition.orderKey },
        },
      };

      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      return precondition;
    });
  }

  /**
   * 前提条件を更新
   */
  async updatePrecondition(testCaseId: string, preconditionId: string, userId: string, data: { content: string }) {
    const testCase = await this.findById(testCaseId);

    // 前提条件の存在確認
    const precondition = await prisma.testCasePrecondition.findFirst({
      where: { id: preconditionId, testCaseId },
    });
    if (!precondition) {
      throw new NotFoundError('Precondition', preconditionId);
    }

    // 同値更新チェック：変更がなければそのまま返す
    if (precondition.content === data.content) {
      return precondition;
    }

    // 履歴保存と更新を同じトランザクションで実行
    return prisma.$transaction(async (tx) => {
      const snapshot: HistorySnapshot = {
        id: testCase.id,
        testSuiteId: testCase.testSuiteId,
        title: testCase.title,
        description: testCase.description,
        priority: testCase.priority,
        status: testCase.status,
        preconditions: [{ id: precondition.id, content: precondition.content, orderKey: precondition.orderKey }],
        changeDetail: {
          type: 'PRECONDITION_UPDATE',
          preconditionId,
          before: { content: precondition.content },
          after: { content: data.content },
        },
      };

      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      return tx.testCasePrecondition.update({
        where: { id: preconditionId },
        data: { content: data.content },
      });
    });
  }

  /**
   * 前提条件を削除
   */
  async deletePrecondition(testCaseId: string, preconditionId: string, userId: string) {
    const testCase = await this.findById(testCaseId);

    // 前提条件の存在確認
    const precondition = await prisma.testCasePrecondition.findFirst({
      where: { id: preconditionId, testCaseId },
    });
    if (!precondition) {
      throw new NotFoundError('Precondition', preconditionId);
    }

    const snapshot: HistorySnapshot = {
      id: testCase.id,
      testSuiteId: testCase.testSuiteId,
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      status: testCase.status,
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
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      // 前提条件を削除
      await tx.testCasePrecondition.delete({
        where: { id: preconditionId },
      });

      // 残りの前提条件のorderKeyを再整列（並列実行）
      const remainingPreconditions = await tx.testCasePrecondition.findMany({
        where: { testCaseId },
        orderBy: { orderKey: 'asc' },
      });

      await Promise.all(
        remainingPreconditions.map((item, i) =>
          tx.testCasePrecondition.update({
            where: { id: item.id },
            data: { orderKey: indexToOrderKey(i) },
          })
        )
      );
    });
  }

  /**
   * 前提条件を並び替え
   */
  async reorderPreconditions(testCaseId: string, preconditionIds: string[], userId: string) {
    const testCase = await this.findById(testCaseId);

    // 全ての前提条件を取得
    const preconditions = await prisma.testCasePrecondition.findMany({
      where: { testCaseId },
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

    // 同値チェック：順序が変わっていなければそのまま返す
    const currentOrder = preconditions.map((p) => p.id);
    const isSameOrder = currentOrder.every((id, index) => id === preconditionIds[index]);
    if (isSameOrder) {
      return preconditions;
    }

    // 履歴を保存（並び替え前の状態）
    const snapshot: HistorySnapshot = {
      id: testCase.id,
      testSuiteId: testCase.testSuiteId,
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      status: testCase.status,
      preconditions: preconditions.map((p) => ({ id: p.id, content: p.content, orderKey: p.orderKey })),
      changeDetail: {
        type: 'PRECONDITION_REORDER',
        before: preconditions.map((p) => p.id),
        after: preconditionIds,
      },
    };

    // 履歴保存とorderKey更新を同じトランザクションで実行
    await prisma.$transaction(async (tx) => {
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      // 各前提条件のorderKeyを更新（並列実行）
      await Promise.all(
        preconditionIds.map((id, index) =>
          tx.testCasePrecondition.update({
            where: { id },
            data: { orderKey: indexToOrderKey(index) },
          })
        )
      );
    });

    // 更新後の前提条件一覧を返す
    return prisma.testCasePrecondition.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });
  }

  /**
   * ステップ一覧を取得
   */
  async getSteps(testCaseId: string) {
    await this.findById(testCaseId);

    return prisma.testCaseStep.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });
  }

  /**
   * ステップを追加
   */
  async addStep(testCaseId: string, userId: string, data: { content: string; orderKey?: string }) {
    const testCase = await this.findById(testCaseId);

    return prisma.$transaction(async (tx) => {
      let orderKey = data.orderKey;
      if (!orderKey) {
        const lastItem = await tx.testCaseStep.findFirst({
          where: { testCaseId },
          orderBy: { orderKey: 'desc' },
        });
        orderKey = getNextOrderKey(lastItem?.orderKey ?? null);
      }

      const step = await tx.testCaseStep.create({
        data: {
          testCaseId,
          content: data.content,
          orderKey,
        },
      });

      // 履歴を保存
      const snapshot: HistorySnapshot = {
        id: testCase.id,
        testSuiteId: testCase.testSuiteId,
        title: testCase.title,
        description: testCase.description,
        priority: testCase.priority,
        status: testCase.status,
        steps: [{ id: step.id, content: step.content, orderKey: step.orderKey }],
        changeDetail: {
          type: 'STEP_ADD',
          stepId: step.id,
          added: { content: step.content, orderKey: step.orderKey },
        },
      };

      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      return step;
    });
  }

  /**
   * ステップを更新
   */
  async updateStep(testCaseId: string, stepId: string, userId: string, data: { content: string }) {
    const testCase = await this.findById(testCaseId);

    // ステップの存在確認
    const step = await prisma.testCaseStep.findFirst({
      where: { id: stepId, testCaseId },
    });
    if (!step) {
      throw new NotFoundError('Step', stepId);
    }

    // 同値更新チェック：変更がなければそのまま返す
    if (step.content === data.content) {
      return step;
    }

    // 履歴保存と更新を同じトランザクションで実行
    return prisma.$transaction(async (tx) => {
      const snapshot: HistorySnapshot = {
        id: testCase.id,
        testSuiteId: testCase.testSuiteId,
        title: testCase.title,
        description: testCase.description,
        priority: testCase.priority,
        status: testCase.status,
        steps: [{ id: step.id, content: step.content, orderKey: step.orderKey }],
        changeDetail: {
          type: 'STEP_UPDATE',
          stepId,
          before: { content: step.content },
          after: { content: data.content },
        },
      };

      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      return tx.testCaseStep.update({
        where: { id: stepId },
        data: { content: data.content },
      });
    });
  }

  /**
   * ステップを削除
   */
  async deleteStep(testCaseId: string, stepId: string, userId: string) {
    const testCase = await this.findById(testCaseId);

    // ステップの存在確認
    const step = await prisma.testCaseStep.findFirst({
      where: { id: stepId, testCaseId },
    });
    if (!step) {
      throw new NotFoundError('Step', stepId);
    }

    const snapshot: HistorySnapshot = {
      id: testCase.id,
      testSuiteId: testCase.testSuiteId,
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      status: testCase.status,
      steps: [{ id: step.id, content: step.content, orderKey: step.orderKey }],
      changeDetail: {
        type: 'STEP_DELETE',
        stepId,
        deleted: { content: step.content, orderKey: step.orderKey },
      },
    };

    // トランザクションで削除と再整列を実行
    await prisma.$transaction(async (tx) => {
      // 履歴を保存
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      // ステップを削除
      await tx.testCaseStep.delete({
        where: { id: stepId },
      });

      // 残りのステップのorderKeyを再整列（並列実行）
      const remainingSteps = await tx.testCaseStep.findMany({
        where: { testCaseId },
        orderBy: { orderKey: 'asc' },
      });

      await Promise.all(
        remainingSteps.map((item, i) =>
          tx.testCaseStep.update({
            where: { id: item.id },
            data: { orderKey: indexToOrderKey(i) },
          })
        )
      );
    });
  }

  /**
   * ステップを並び替え
   */
  async reorderSteps(testCaseId: string, stepIds: string[], userId: string) {
    const testCase = await this.findById(testCaseId);

    // 全てのステップを取得
    const steps = await prisma.testCaseStep.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });

    // 空配列チェック（ステップが0件の場合はそのまま返す）
    if (steps.length === 0 && stepIds.length === 0) {
      return [];
    }

    // 重複IDのチェック
    const uniqueIds = new Set(stepIds);
    if (uniqueIds.size !== stepIds.length) {
      throw new BadRequestError('Duplicate step IDs are not allowed');
    }

    // 全件指定されているか確認
    if (stepIds.length !== steps.length) {
      throw new BadRequestError('All step IDs must be provided for reordering');
    }

    const existingIds = new Set(steps.map((s) => s.id));
    for (const id of stepIds) {
      if (!existingIds.has(id)) {
        throw new NotFoundError('Step', id);
      }
    }

    // 同値チェック：順序が変わっていなければそのまま返す
    const currentOrder = steps.map((s) => s.id);
    const isSameOrder = currentOrder.every((id, index) => id === stepIds[index]);
    if (isSameOrder) {
      return steps;
    }

    // 履歴を保存（並び替え前の状態）
    const snapshot: HistorySnapshot = {
      id: testCase.id,
      testSuiteId: testCase.testSuiteId,
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      status: testCase.status,
      steps: steps.map((s) => ({ id: s.id, content: s.content, orderKey: s.orderKey })),
      changeDetail: {
        type: 'STEP_REORDER',
        before: steps.map((s) => s.id),
        after: stepIds,
      },
    };

    // 履歴保存とorderKey更新を同じトランザクションで実行
    await prisma.$transaction(async (tx) => {
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      // 各ステップのorderKeyを更新（並列実行）
      await Promise.all(
        stepIds.map((id, index) =>
          tx.testCaseStep.update({
            where: { id },
            data: { orderKey: indexToOrderKey(index) },
          })
        )
      );
    });

    // 更新後のステップ一覧を返す
    return prisma.testCaseStep.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });
  }

  /**
   * 期待結果一覧を取得
   */
  async getExpectedResults(testCaseId: string) {
    await this.findById(testCaseId);

    return prisma.testCaseExpectedResult.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });
  }

  /**
   * 期待結果を追加
   */
  async addExpectedResult(testCaseId: string, userId: string, data: { content: string; orderKey?: string }) {
    const testCase = await this.findById(testCaseId);

    return prisma.$transaction(async (tx) => {
      let orderKey = data.orderKey;
      if (!orderKey) {
        const lastItem = await tx.testCaseExpectedResult.findFirst({
          where: { testCaseId },
          orderBy: { orderKey: 'desc' },
        });
        orderKey = getNextOrderKey(lastItem?.orderKey ?? null);
      }

      const expectedResult = await tx.testCaseExpectedResult.create({
        data: {
          testCaseId,
          content: data.content,
          orderKey,
        },
      });

      // 履歴を保存
      const snapshot: HistorySnapshot = {
        id: testCase.id,
        testSuiteId: testCase.testSuiteId,
        title: testCase.title,
        description: testCase.description,
        priority: testCase.priority,
        status: testCase.status,
        expectedResults: [{ id: expectedResult.id, content: expectedResult.content, orderKey: expectedResult.orderKey }],
        changeDetail: {
          type: 'EXPECTED_RESULT_ADD',
          expectedResultId: expectedResult.id,
          added: { content: expectedResult.content, orderKey: expectedResult.orderKey },
        },
      };

      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      return expectedResult;
    });
  }

  /**
   * 期待結果を更新
   */
  async updateExpectedResult(testCaseId: string, expectedResultId: string, userId: string, data: { content: string }) {
    const testCase = await this.findById(testCaseId);

    // 期待結果の存在確認
    const expectedResult = await prisma.testCaseExpectedResult.findFirst({
      where: { id: expectedResultId, testCaseId },
    });
    if (!expectedResult) {
      throw new NotFoundError('ExpectedResult', expectedResultId);
    }

    // 同値更新チェック：変更がなければそのまま返す
    if (expectedResult.content === data.content) {
      return expectedResult;
    }

    // 履歴保存と更新を同じトランザクションで実行
    return prisma.$transaction(async (tx) => {
      const snapshot: HistorySnapshot = {
        id: testCase.id,
        testSuiteId: testCase.testSuiteId,
        title: testCase.title,
        description: testCase.description,
        priority: testCase.priority,
        status: testCase.status,
        expectedResults: [{ id: expectedResult.id, content: expectedResult.content, orderKey: expectedResult.orderKey }],
        changeDetail: {
          type: 'EXPECTED_RESULT_UPDATE',
          expectedResultId,
          before: { content: expectedResult.content },
          after: { content: data.content },
        },
      };

      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      return tx.testCaseExpectedResult.update({
        where: { id: expectedResultId },
        data: { content: data.content },
      });
    });
  }

  /**
   * 期待結果を削除
   */
  async deleteExpectedResult(testCaseId: string, expectedResultId: string, userId: string) {
    const testCase = await this.findById(testCaseId);

    // 期待結果の存在確認
    const expectedResult = await prisma.testCaseExpectedResult.findFirst({
      where: { id: expectedResultId, testCaseId },
    });
    if (!expectedResult) {
      throw new NotFoundError('ExpectedResult', expectedResultId);
    }

    const snapshot: HistorySnapshot = {
      id: testCase.id,
      testSuiteId: testCase.testSuiteId,
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      status: testCase.status,
      expectedResults: [{ id: expectedResult.id, content: expectedResult.content, orderKey: expectedResult.orderKey }],
      changeDetail: {
        type: 'EXPECTED_RESULT_DELETE',
        expectedResultId,
        deleted: { content: expectedResult.content, orderKey: expectedResult.orderKey },
      },
    };

    // トランザクションで削除と再整列を実行
    await prisma.$transaction(async (tx) => {
      // 履歴を保存
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      // 期待結果を削除
      await tx.testCaseExpectedResult.delete({
        where: { id: expectedResultId },
      });

      // 残りの期待結果のorderKeyを再整列（並列実行）
      const remainingExpectedResults = await tx.testCaseExpectedResult.findMany({
        where: { testCaseId },
        orderBy: { orderKey: 'asc' },
      });

      await Promise.all(
        remainingExpectedResults.map((item, i) =>
          tx.testCaseExpectedResult.update({
            where: { id: item.id },
            data: { orderKey: indexToOrderKey(i) },
          })
        )
      );
    });
  }

  /**
   * 期待結果を並び替え
   */
  async reorderExpectedResults(testCaseId: string, expectedResultIds: string[], userId: string) {
    const testCase = await this.findById(testCaseId);

    // 全ての期待結果を取得
    const expectedResults = await prisma.testCaseExpectedResult.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });

    // 空配列チェック（期待結果が0件の場合はそのまま返す）
    if (expectedResults.length === 0 && expectedResultIds.length === 0) {
      return [];
    }

    // 重複IDのチェック
    const uniqueIds = new Set(expectedResultIds);
    if (uniqueIds.size !== expectedResultIds.length) {
      throw new BadRequestError('Duplicate expected result IDs are not allowed');
    }

    // 全件指定されているか確認
    if (expectedResultIds.length !== expectedResults.length) {
      throw new BadRequestError('All expected result IDs must be provided for reordering');
    }

    const existingIds = new Set(expectedResults.map((e) => e.id));
    for (const id of expectedResultIds) {
      if (!existingIds.has(id)) {
        throw new NotFoundError('ExpectedResult', id);
      }
    }

    // 同値チェック：順序が変わっていなければそのまま返す
    const currentOrder = expectedResults.map((e) => e.id);
    const isSameOrder = currentOrder.every((id, index) => id === expectedResultIds[index]);
    if (isSameOrder) {
      return expectedResults;
    }

    // 履歴を保存（並び替え前の状態）
    const snapshot: HistorySnapshot = {
      id: testCase.id,
      testSuiteId: testCase.testSuiteId,
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      status: testCase.status,
      expectedResults: expectedResults.map((e) => ({ id: e.id, content: e.content, orderKey: e.orderKey })),
      changeDetail: {
        type: 'EXPECTED_RESULT_REORDER',
        before: expectedResults.map((e) => e.id),
        after: expectedResultIds,
      },
    };

    // 履歴保存とorderKey更新を同じトランザクションで実行
    await prisma.$transaction(async (tx) => {
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
        },
      });

      // 各期待結果のorderKeyを更新（並列実行）
      await Promise.all(
        expectedResultIds.map((id, index) =>
          tx.testCaseExpectedResult.update({
            where: { id },
            data: { orderKey: indexToOrderKey(index) },
          })
        )
      );
    });

    // 更新後の期待結果一覧を返す
    return prisma.testCaseExpectedResult.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });
  }
}
