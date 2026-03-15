import crypto from 'node:crypto';
import { prisma } from '@agentest/db';
import { NotFoundError, BadRequestError } from '@agentest/shared';
import {
  TestCaseChildrenBaseService,
  getNextOrderKey,
  indexToOrderKey,
  type HistorySnapshot,
} from './test-case-children-base.service.js';

/**
 * テストケースの手順（Step）に関するCRUD操作を提供するサービス
 */
export class TestCaseStepsService extends TestCaseChildrenBaseService {
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
  async addStep(
    testCaseId: string,
    userId: string,
    data: { content: string; orderKey?: string },
    groupId?: string
  ) {
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
        ...this.buildBaseSnapshot(testCase),
        steps: [{ id: step.id, content: step.content, orderKey: step.orderKey }],
        changeDetail: {
          type: 'STEP_ADD',
          stepId: step.id,
          added: { content: step.content, orderKey: step.orderKey },
        },
      };

      await this.createHistory(tx, testCaseId, userId, snapshot, effectiveGroupId);

      // テストケース更新イベント発行（エラー時も処理継続）
      await this.publishEventSafely(
        tx,
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        userId,
        [{ field: 'step:add', oldValue: null, newValue: step.id }]
      );

      return step;
    });
  }

  /**
   * ステップを更新
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async updateStep(
    testCaseId: string,
    stepId: string,
    userId: string,
    data: { content: string },
    groupId?: string
  ) {
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
        ...this.buildBaseSnapshot(testCase),
        steps: [{ id: step.id, content: step.content, orderKey: step.orderKey }],
        changeDetail: {
          type: 'STEP_UPDATE',
          stepId,
          before: { content: step.content },
          after: { content: data.content },
        },
      };

      await this.createHistory(tx, testCaseId, userId, snapshot, effectiveGroupId);

      const result = await tx.testCaseStep.update({
        where: { id: stepId },
        data: { content: data.content },
      });

      // テストケース更新イベント発行（エラー時も処理継続）
      await this.publishEventSafely(
        tx,
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        userId,
        [{ field: 'step:update', oldValue: step.content, newValue: data.content }]
      );

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
      ...this.buildBaseSnapshot(testCase),
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
      await this.createHistory(tx, testCaseId, userId, snapshot, effectiveGroupId);

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
      await this.publishEventSafely(
        tx,
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        userId,
        [{ field: 'step:delete', oldValue: stepId, newValue: null }]
      );
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
      ...this.buildBaseSnapshot(testCase),
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
      await this.createHistory(tx, testCaseId, userId, snapshot, effectiveGroupId);

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
      await this.publishEventSafely(
        tx,
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        userId,
        [{ field: 'step:reorder', oldValue: currentOrder, newValue: stepIds }]
      );
    });

    // 更新後のステップ一覧を返す
    return prisma.testCaseStep.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });
  }
}
