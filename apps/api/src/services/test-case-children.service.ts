/**
 * テストケース子エンティティ（前提条件・ステップ・期待結果）のCRUD操作を提供するファサード
 *
 * 実装は以下のモジュールに分割:
 * - test-case-children-base.service.ts: 共通ロジック（findById, 定数, 型, スナップショット）
 * - test-case-preconditions.service.ts: 前提条件のCRUD
 * - test-case-steps.service.ts: ステップのCRUD
 * - test-case-expected-results.service.ts: 期待結果のCRUD
 *
 * このファイルはバレルre-export + 統合クラスを提供し、既存のimportパスを維持する。
 */

import { type Prisma } from '@agentest/db';
import { BadRequestError } from '@agentest/shared';
import { TestCasePreconditionsService } from './test-case-preconditions.service.js';
import { TestCaseStepsService } from './test-case-steps.service.js';
import { TestCaseExpectedResultsService } from './test-case-expected-results.service.js';
import {
  indexToOrderKey,
  type HistorySnapshot,
} from './test-case-children-base.service.js';

// 型・定数・ユーティリティのre-export（既存importを維持）
export {
  ORDER_KEY_INITIAL,
  ORDER_KEY_PAD_LENGTH,
  getNextOrderKey,
  indexToOrderKey,
  toJsonSnapshot,
  TestCaseChildrenBaseService,
  type TestCaseSnapshot,
  type ChildEntitySnapshot,
  type HistorySnapshot,
} from './test-case-children-base.service.js';

export { TestCasePreconditionsService } from './test-case-preconditions.service.js';
export { TestCaseStepsService } from './test-case-steps.service.js';
export { TestCaseExpectedResultsService } from './test-case-expected-results.service.js';

/**
 * テストケース子エンティティ（前提条件・ステップ・期待結果）のCRUD操作を提供する統合クラス
 *
 * Preconditions・Steps・ExpectedResultsの各サービスを内部に委譲し、
 * 既存の TestCaseService extends TestCaseChildrenService のAPI互換性を維持する。
 */
export class TestCaseChildrenService extends TestCasePreconditionsService {
  // StepsとExpectedResultsの操作を委譲用に内部インスタンスを保持
  private _stepsService = new TestCaseStepsService();
  private _expectedResultsService = new TestCaseExpectedResultsService();

  // --- ステップ操作の委譲 ---

  async getSteps(testCaseId: string) {
    return this._stepsService.getSteps(testCaseId);
  }

  async addStep(testCaseId: string, userId: string, data: { content: string; orderKey?: string }, groupId?: string) {
    return this._stepsService.addStep(testCaseId, userId, data, groupId);
  }

  async updateStep(testCaseId: string, stepId: string, userId: string, data: { content: string }, groupId?: string) {
    return this._stepsService.updateStep(testCaseId, stepId, userId, data, groupId);
  }

  async deleteStep(testCaseId: string, stepId: string, userId: string, groupId?: string) {
    return this._stepsService.deleteStep(testCaseId, stepId, userId, groupId);
  }

  async reorderSteps(testCaseId: string, stepIds: string[], userId: string, groupId?: string) {
    return this._stepsService.reorderSteps(testCaseId, stepIds, userId, groupId);
  }

  // --- 期待結果操作の委譲 ---

  async getExpectedResults(testCaseId: string) {
    return this._expectedResultsService.getExpectedResults(testCaseId);
  }

  async addExpectedResult(testCaseId: string, userId: string, data: { content: string; orderKey?: string }, groupId?: string) {
    return this._expectedResultsService.addExpectedResult(testCaseId, userId, data, groupId);
  }

  async updateExpectedResult(testCaseId: string, expectedResultId: string, userId: string, data: { content: string }, groupId?: string) {
    return this._expectedResultsService.updateExpectedResult(testCaseId, expectedResultId, userId, data, groupId);
  }

  async deleteExpectedResult(testCaseId: string, expectedResultId: string, userId: string, groupId?: string) {
    return this._expectedResultsService.deleteExpectedResult(testCaseId, expectedResultId, userId, groupId);
  }

  async reorderExpectedResults(testCaseId: string, expectedResultIds: string[], userId: string, groupId?: string) {
    return this._expectedResultsService.reorderExpectedResults(testCaseId, expectedResultIds, userId, groupId);
  }

  // --- 差分同期処理（syncChildEntitiesWithHistory）---

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
    const baseSnapshot = this.buildBaseSnapshot(testCase);

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

      await this.createHistory(tx, testCaseId, userId, deleteSnapshot, groupId);
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

          await this.createHistory(tx, testCaseId, userId, updateSnapshot, groupId);
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

        await this.createHistory(tx, testCaseId, userId, addSnapshot, groupId);
      }
    }
  }
}
