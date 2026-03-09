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
 * テストケースの期待結果（ExpectedResult）に関するCRUD操作を提供するサービス
 */
export class TestCaseExpectedResultsService extends TestCaseChildrenBaseService {
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
        ...this.buildBaseSnapshot(testCase),
        expectedResults: [{ id: expectedResult.id, content: expectedResult.content, orderKey: expectedResult.orderKey }],
        changeDetail: {
          type: 'EXPECTED_RESULT_ADD',
          expectedResultId: expectedResult.id,
          added: { content: expectedResult.content, orderKey: expectedResult.orderKey },
        },
      };

      await this.createHistory(tx, testCaseId, userId, snapshot, effectiveGroupId);

      // テストケース更新イベント発行（エラー時も処理継続）
      await this.publishEventSafely(
        tx, testCaseId, testCase.testSuiteId, testCase.testSuite.projectId, userId,
        [{ field: 'expectedResult:add', oldValue: null, newValue: expectedResult.id }]
      );

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
        ...this.buildBaseSnapshot(testCase),
        expectedResults: [{ id: expectedResult.id, content: expectedResult.content, orderKey: expectedResult.orderKey }],
        changeDetail: {
          type: 'EXPECTED_RESULT_UPDATE',
          expectedResultId,
          before: { content: expectedResult.content },
          after: { content: data.content },
        },
      };

      await this.createHistory(tx, testCaseId, userId, snapshot, effectiveGroupId);

      const result = await tx.testCaseExpectedResult.update({
        where: { id: expectedResultId },
        data: { content: data.content },
      });

      // テストケース更新イベント発行（エラー時も処理継続）
      await this.publishEventSafely(
        tx, testCaseId, testCase.testSuiteId, testCase.testSuite.projectId, userId,
        [{ field: 'expectedResult:update', oldValue: expectedResult.content, newValue: data.content }]
      );

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
      ...this.buildBaseSnapshot(testCase),
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
      await this.createHistory(tx, testCaseId, userId, snapshot, effectiveGroupId);

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
      await this.publishEventSafely(
        tx, testCaseId, testCase.testSuiteId, testCase.testSuite.projectId, userId,
        [{ field: 'expectedResult:delete', oldValue: expectedResultId, newValue: null }]
      );
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
      ...this.buildBaseSnapshot(testCase),
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
      await this.createHistory(tx, testCaseId, userId, snapshot, effectiveGroupId);

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
      await this.publishEventSafely(
        tx, testCaseId, testCase.testSuiteId, testCase.testSuite.projectId, userId,
        [{ field: 'expectedResult:reorder', oldValue: currentOrder, newValue: expectedResultIds }]
      );
    });

    // 更新後の期待結果一覧を返す
    return prisma.testCaseExpectedResult.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });
  }
}
