import crypto from 'node:crypto';
import { prisma, type Prisma } from '@agentest/db';
import {
  NotFoundError,
  BadRequestError,
  type TestCaseChangeDetail,
} from '@agentest/shared';
import { TestCaseRepository } from '../repositories/test-case.repository.js';
import { publishTestCaseUpdated } from '../lib/events.js';
import { logger as baseLogger } from '../utils/logger.js';
import type { Logger } from '@agentest/shared/logger';

// orderKey関連の定数
export const ORDER_KEY_INITIAL = '00001';
export const ORDER_KEY_PAD_LENGTH = 5;

/**
 * 次のorderKeyを計算する
 * @param currentKey 現在の最大orderKey（nullの場合は初期値を返す）
 * @returns 次のorderKey
 */
export function getNextOrderKey(currentKey: string | null): string {
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
export function indexToOrderKey(index: number): string {
  return `${index + 1}`.padStart(ORDER_KEY_PAD_LENGTH, '0');
}

/**
 * テストケースのスナップショット型（基本情報）
 */
export type TestCaseSnapshot = {
  id: string;
  testSuiteId: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  deletedAt?: string | null;
};

/**
 * 子エンティティのスナップショット型
 */
export type ChildEntitySnapshot = {
  id: string;
  content: string;
  orderKey: string;
};

/**
 * 履歴保存用のスナップショット型
 */
export type HistorySnapshot = TestCaseSnapshot & {
  preconditions?: ChildEntitySnapshot[];
  steps?: ChildEntitySnapshot[];
  expectedResults?: ChildEntitySnapshot[];
  changeDetail?: TestCaseChangeDetail;
};

/**
 * スナップショットをPrismaのJSON型に変換
 */
export function toJsonSnapshot(snapshot: TestCaseSnapshot | HistorySnapshot): Prisma.InputJsonValue {
  return snapshot as unknown as Prisma.InputJsonValue;
}

/**
 * テストケース子エンティティ（前提条件・ステップ・期待結果）のCRUD操作を提供する基底クラス
 */
export class TestCaseChildrenService {
  protected testCaseRepo = new TestCaseRepository();
  protected logger: Logger = baseLogger.child({ module: 'test-case' });

  /**
   * テストケースをIDで検索（存在しない場合はNotFoundErrorをスロー）
   */
  async findById(testCaseId: string) {
    const testCase = await this.testCaseRepo.findById(testCaseId);
    if (!testCase) {
      throw new NotFoundError('TestCase', testCaseId);
    }
    return testCase;
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
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async addPrecondition(testCaseId: string, userId: string, data: { content: string; orderKey?: string }, groupId?: string) {
    const testCase = await this.findById(testCaseId);

    const effectiveGroupId = groupId ?? crypto.randomUUID();
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
          groupId: effectiveGroupId,
        },
      });

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
          testCaseId,
          testCase.testSuiteId,
          testCase.testSuite.projectId,
          [{ field: 'precondition:add', oldValue: null, newValue: precondition.id }],
          { type: 'user', id: userId, name: user?.name || 'Unknown' }
        );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }

      return precondition;
    });
  }

  /**
   * 前提条件を更新
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async updatePrecondition(testCaseId: string, preconditionId: string, userId: string, data: { content: string }, groupId?: string) {
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
    const effectiveGroupId = groupId ?? crypto.randomUUID();
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
          groupId: effectiveGroupId,
        },
      });

      const result = await tx.testCasePrecondition.update({
        where: { id: preconditionId },
        data: { content: data.content },
      });

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
          testCaseId,
          testCase.testSuiteId,
          testCase.testSuite.projectId,
          [{ field: 'precondition:update', oldValue: precondition.content, newValue: data.content }],
          { type: 'user', id: userId, name: user?.name || 'Unknown' }
        );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }

      return result;
    });
  }

  /**
   * 前提条件を削除
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async deletePrecondition(testCaseId: string, preconditionId: string, userId: string, groupId?: string) {
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
    const effectiveGroupId = groupId ?? crypto.randomUUID();
    await prisma.$transaction(async (tx) => {
      // 履歴を保存
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
          groupId: effectiveGroupId,
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

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        [{ field: 'precondition:delete', oldValue: preconditionId, newValue: null }],
        { type: 'user', id: userId, name: user?.name || 'Unknown' }
      );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }
    });
  }

  /**
   * 前提条件を並び替え
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async reorderPreconditions(testCaseId: string, preconditionIds: string[], userId: string, groupId?: string) {
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
    const effectiveGroupId = groupId ?? crypto.randomUUID();
    await prisma.$transaction(async (tx) => {
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
          groupId: effectiveGroupId,
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

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        [{ field: 'precondition:reorder', oldValue: currentOrder, newValue: preconditionIds }],
        { type: 'user', id: userId, name: user?.name || 'Unknown' }
      );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }
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
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async addStep(testCaseId: string, userId: string, data: { content: string; orderKey?: string }, groupId?: string) {
    const testCase = await this.findById(testCaseId);

    const effectiveGroupId = groupId ?? crypto.randomUUID();
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
          groupId: effectiveGroupId,
        },
      });

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        [{ field: 'step:add', oldValue: null, newValue: step.id }],
        { type: 'user', id: userId, name: user?.name || 'Unknown' }
      );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }

      return step;
    });
  }

  /**
   * ステップを更新
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async updateStep(testCaseId: string, stepId: string, userId: string, data: { content: string }, groupId?: string) {
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
    const effectiveGroupId = groupId ?? crypto.randomUUID();
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
          groupId: effectiveGroupId,
        },
      });

      const result = await tx.testCaseStep.update({
        where: { id: stepId },
        data: { content: data.content },
      });

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        [{ field: 'step:update', oldValue: step.content, newValue: data.content }],
        { type: 'user', id: userId, name: user?.name || 'Unknown' }
      );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }

      return result;
    });
  }

  /**
   * ステップを削除
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async deleteStep(testCaseId: string, stepId: string, userId: string, groupId?: string) {
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
    const effectiveGroupId = groupId ?? crypto.randomUUID();
    await prisma.$transaction(async (tx) => {
      // 履歴を保存
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
          groupId: effectiveGroupId,
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

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        [{ field: 'step:delete', oldValue: stepId, newValue: null }],
        { type: 'user', id: userId, name: user?.name || 'Unknown' }
      );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }
    });
  }

  /**
   * ステップを並び替え
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async reorderSteps(testCaseId: string, stepIds: string[], userId: string, groupId?: string) {
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
    const effectiveGroupId = groupId ?? crypto.randomUUID();
    await prisma.$transaction(async (tx) => {
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
          groupId: effectiveGroupId,
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

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        [{ field: 'step:reorder', oldValue: currentOrder, newValue: stepIds }],
        { type: 'user', id: userId, name: user?.name || 'Unknown' }
      );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }
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
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async addExpectedResult(testCaseId: string, userId: string, data: { content: string; orderKey?: string }, groupId?: string) {
    const testCase = await this.findById(testCaseId);

    const effectiveGroupId = groupId ?? crypto.randomUUID();
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
          groupId: effectiveGroupId,
        },
      });

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        [{ field: 'expectedResult:add', oldValue: null, newValue: expectedResult.id }],
        { type: 'user', id: userId, name: user?.name || 'Unknown' }
      );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }

      return expectedResult;
    });
  }

  /**
   * 期待結果を更新
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async updateExpectedResult(testCaseId: string, expectedResultId: string, userId: string, data: { content: string }, groupId?: string) {
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
    const effectiveGroupId = groupId ?? crypto.randomUUID();
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
          groupId: effectiveGroupId,
        },
      });

      const result = await tx.testCaseExpectedResult.update({
        where: { id: expectedResultId },
        data: { content: data.content },
      });

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        [{ field: 'expectedResult:update', oldValue: expectedResult.content, newValue: data.content }],
        { type: 'user', id: userId, name: user?.name || 'Unknown' }
      );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }

      return result;
    });
  }

  /**
   * 期待結果を削除
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async deleteExpectedResult(testCaseId: string, expectedResultId: string, userId: string, groupId?: string) {
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
    const effectiveGroupId = groupId ?? crypto.randomUUID();
    await prisma.$transaction(async (tx) => {
      // 履歴を保存
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
          groupId: effectiveGroupId,
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

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        [{ field: 'expectedResult:delete', oldValue: expectedResultId, newValue: null }],
        { type: 'user', id: userId, name: user?.name || 'Unknown' }
      );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }
    });
  }

  /**
   * 期待結果を並び替え
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async reorderExpectedResults(testCaseId: string, expectedResultIds: string[], userId: string, groupId?: string) {
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
    const effectiveGroupId = groupId ?? crypto.randomUUID();
    await prisma.$transaction(async (tx) => {
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
          groupId: effectiveGroupId,
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

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        [{ field: 'expectedResult:reorder', oldValue: currentOrder, newValue: expectedResultIds }],
        { type: 'user', id: userId, name: user?.name || 'Unknown' }
      );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }
    });

    // 更新後の期待結果一覧を返す
    return prisma.testCaseExpectedResult.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });
  }

  /**
   * 子エンティティの差分同期処理（各変更ごとに履歴作成）
   * - idあり & 既存に存在: 更新 → XXXX_UPDATE履歴
   * - idなし: 新規作成 → XXXX_ADD履歴
   * - 既存にあるがリクエストにない: 削除 → XXXX_DELETE履歴
   */
  protected async syncChildEntitiesWithHistory(
    tx: Prisma.TransactionClient,
    testCaseId: string,
    testCase: { id: string; testSuiteId: string; title: string; description: string | null; priority: string; status: string },
    userId: string,
    entityType: 'precondition' | 'step' | 'expectedResult',
    items: { id?: string; content: string }[],
    existingItems: { id: string; content: string; orderKey: string }[],
    groupId: string
  ): Promise<void> {
    const existingMap = new Map(existingItems.map((e) => [e.id, e]));
    const existingIds = new Set(existingItems.map((e) => e.id));
    const requestIds = new Set(items.filter((i) => i.id).map((i) => i.id));

    // 基本スナップショット情報
    const baseSnapshot = {
      id: testCase.id,
      testSuiteId: testCase.testSuiteId,
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      status: testCase.status,
    };

    // 削除対象: 既存にあるがリクエストにない
    const toDelete = [...existingIds].filter((id) => !requestIds.has(id));

    // 削除処理と履歴作成
    for (const deleteId of toDelete) {
      const existing = existingMap.get(deleteId)!;
      const entityInfo = { id: existing.id, content: existing.content, orderKey: existing.orderKey };

      // エンティティタイプごとに明示的にchangeDetailを構築
      let deleteSnapshot: HistorySnapshot;
      if (entityType === 'precondition') {
        deleteSnapshot = {
          ...baseSnapshot,
          preconditions: [entityInfo],
          changeDetail: {
            type: 'PRECONDITION_DELETE',
            preconditionId: deleteId,
            deleted: { content: existing.content, orderKey: existing.orderKey },
          },
        };
        await tx.testCasePrecondition.delete({ where: { id: deleteId } });
      } else if (entityType === 'step') {
        deleteSnapshot = {
          ...baseSnapshot,
          steps: [entityInfo],
          changeDetail: {
            type: 'STEP_DELETE',
            stepId: deleteId,
            deleted: { content: existing.content, orderKey: existing.orderKey },
          },
        };
        await tx.testCaseStep.delete({ where: { id: deleteId } });
      } else {
        deleteSnapshot = {
          ...baseSnapshot,
          expectedResults: [entityInfo],
          changeDetail: {
            type: 'EXPECTED_RESULT_DELETE',
            expectedResultId: deleteId,
            deleted: { content: existing.content, orderKey: existing.orderKey },
          },
        };
        await tx.testCaseExpectedResult.delete({ where: { id: deleteId } });
      }

      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(deleteSnapshot),
          groupId,
        },
      });
    }

    // 更新/作成処理
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const orderKey = indexToOrderKey(i);

      if (item.id && existingIds.has(item.id)) {
        // 既存エンティティの更新
        const existing = existingMap.get(item.id)!;
        const entityInfo = { id: existing.id, content: existing.content, orderKey: existing.orderKey };

        // 内容が変更されている場合のみ履歴を作成
        if (existing.content !== item.content) {
          let updateSnapshot: HistorySnapshot;
          if (entityType === 'precondition') {
            updateSnapshot = {
              ...baseSnapshot,
              preconditions: [entityInfo],
              changeDetail: {
                type: 'PRECONDITION_UPDATE',
                preconditionId: item.id,
                before: { content: existing.content },
                after: { content: item.content },
              },
            };
          } else if (entityType === 'step') {
            updateSnapshot = {
              ...baseSnapshot,
              steps: [entityInfo],
              changeDetail: {
                type: 'STEP_UPDATE',
                stepId: item.id,
                before: { content: existing.content },
                after: { content: item.content },
              },
            };
          } else {
            updateSnapshot = {
              ...baseSnapshot,
              expectedResults: [entityInfo],
              changeDetail: {
                type: 'EXPECTED_RESULT_UPDATE',
                expectedResultId: item.id,
                before: { content: existing.content },
                after: { content: item.content },
              },
            };
          }

          await tx.testCaseHistory.create({
            data: {
              testCaseId,
              changedByUserId: userId,
              changeType: 'UPDATE',
              snapshot: toJsonSnapshot(updateSnapshot),
              groupId,
            },
          });
        }

        // 実際に更新
        if (entityType === 'precondition') {
          await tx.testCasePrecondition.update({
            where: { id: item.id },
            data: { content: item.content, orderKey },
          });
        } else if (entityType === 'step') {
          await tx.testCaseStep.update({
            where: { id: item.id },
            data: { content: item.content, orderKey },
          });
        } else {
          await tx.testCaseExpectedResult.update({
            where: { id: item.id },
            data: { content: item.content, orderKey },
          });
        }
      } else if (item.id && !existingIds.has(item.id)) {
        // 他のテストケースのIDを指定した場合はエラー
        throw new BadRequestError(`Invalid ${entityType} ID: ${item.id}`);
      } else {
        // 新規作成
        let createdEntity: { id: string; content: string; orderKey: string };
        let addSnapshot: HistorySnapshot;

        if (entityType === 'precondition') {
          createdEntity = await tx.testCasePrecondition.create({
            data: { testCaseId, content: item.content, orderKey },
          });
          addSnapshot = {
            ...baseSnapshot,
            preconditions: [{ id: createdEntity.id, content: createdEntity.content, orderKey: createdEntity.orderKey }],
            changeDetail: {
              type: 'PRECONDITION_ADD',
              preconditionId: createdEntity.id,
              added: { content: createdEntity.content, orderKey: createdEntity.orderKey },
            },
          };
        } else if (entityType === 'step') {
          createdEntity = await tx.testCaseStep.create({
            data: { testCaseId, content: item.content, orderKey },
          });
          addSnapshot = {
            ...baseSnapshot,
            steps: [{ id: createdEntity.id, content: createdEntity.content, orderKey: createdEntity.orderKey }],
            changeDetail: {
              type: 'STEP_ADD',
              stepId: createdEntity.id,
              added: { content: createdEntity.content, orderKey: createdEntity.orderKey },
            },
          };
        } else {
          createdEntity = await tx.testCaseExpectedResult.create({
            data: { testCaseId, content: item.content, orderKey },
          });
          addSnapshot = {
            ...baseSnapshot,
            expectedResults: [{ id: createdEntity.id, content: createdEntity.content, orderKey: createdEntity.orderKey }],
            changeDetail: {
              type: 'EXPECTED_RESULT_ADD',
              expectedResultId: createdEntity.id,
              added: { content: createdEntity.content, orderKey: createdEntity.orderKey },
            },
          };
        }

        await tx.testCaseHistory.create({
          data: {
            testCaseId,
            changedByUserId: userId,
            changeType: 'UPDATE',
            snapshot: toJsonSnapshot(addSnapshot),
            groupId,
          },
        });
      }
    }
  }
}
