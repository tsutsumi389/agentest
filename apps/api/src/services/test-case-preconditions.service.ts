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
 * テストケースの前提条件（Precondition）に関するCRUD操作を提供するサービス
 */
export class TestCasePreconditionsService extends TestCaseChildrenBaseService {
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
  async addPrecondition(
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
        ...this.buildBaseSnapshot(testCase),
        preconditions: [
          { id: precondition.id, content: precondition.content, orderKey: precondition.orderKey },
        ],
        changeDetail: {
          type: 'PRECONDITION_ADD',
          preconditionId: precondition.id,
          added: { content: precondition.content, orderKey: precondition.orderKey },
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
        [{ field: 'precondition:add', oldValue: null, newValue: precondition.id }]
      );

      return precondition;
    });
  }

  /**
   * 前提条件を更新
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async updatePrecondition(
    testCaseId: string,
    preconditionId: string,
    userId: string,
    data: { content: string },
    groupId?: string
  ) {
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
        ...this.buildBaseSnapshot(testCase),
        preconditions: [
          { id: precondition.id, content: precondition.content, orderKey: precondition.orderKey },
        ],
        changeDetail: {
          type: 'PRECONDITION_UPDATE',
          preconditionId,
          before: { content: precondition.content },
          after: { content: data.content },
        },
      };

      await this.createHistory(tx, testCaseId, userId, snapshot, effectiveGroupId);

      const result = await tx.testCasePrecondition.update({
        where: { id: preconditionId },
        data: { content: data.content },
      });

      // テストケース更新イベント発行（エラー時も処理継続）
      await this.publishEventSafely(
        tx,
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        userId,
        [{ field: 'precondition:update', oldValue: precondition.content, newValue: data.content }]
      );

      return result;
    });
  }

  /**
   * 前提条件を削除
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async deletePrecondition(
    testCaseId: string,
    preconditionId: string,
    userId: string,
    groupId?: string
  ) {
    const testCase = await this.findById(testCaseId);

    // 前提条件の存在確認
    const precondition = await prisma.testCasePrecondition.findFirst({
      where: { id: preconditionId, testCaseId },
    });
    if (!precondition) {
      throw new NotFoundError('Precondition', preconditionId);
    }

    const snapshot: HistorySnapshot = {
      ...this.buildBaseSnapshot(testCase),
      preconditions: [
        { id: precondition.id, content: precondition.content, orderKey: precondition.orderKey },
      ],
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
      await this.createHistory(tx, testCaseId, userId, snapshot, effectiveGroupId);

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
      await this.publishEventSafely(
        tx,
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        userId,
        [{ field: 'precondition:delete', oldValue: preconditionId, newValue: null }]
      );
    });
  }

  /**
   * 前提条件を並び替え
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async reorderPreconditions(
    testCaseId: string,
    preconditionIds: string[],
    userId: string,
    groupId?: string
  ) {
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
      ...this.buildBaseSnapshot(testCase),
      preconditions: preconditions.map((p) => ({
        id: p.id,
        content: p.content,
        orderKey: p.orderKey,
      })),
      changeDetail: {
        type: 'PRECONDITION_REORDER',
        before: preconditions.map((p) => p.id),
        after: preconditionIds,
      },
    };

    // 履歴保存とorderKey更新を同じトランザクションで実行
    const effectiveGroupId = groupId ?? crypto.randomUUID();
    await prisma.$transaction(async (tx) => {
      await this.createHistory(tx, testCaseId, userId, snapshot, effectiveGroupId);

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
      await this.publishEventSafely(
        tx,
        testCaseId,
        testCase.testSuiteId,
        testCase.testSuite.projectId,
        userId,
        [{ field: 'precondition:reorder', oldValue: currentOrder, newValue: preconditionIds }]
      );
    });

    // 更新後の前提条件一覧を返す
    return prisma.testCasePrecondition.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });
  }
}
