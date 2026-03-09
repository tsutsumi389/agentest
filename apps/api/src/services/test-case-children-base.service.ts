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
 * テストケース子エンティティの基底クラス
 * 共通のfindByIdとイベント発行ユーティリティを提供する
 */
export class TestCaseChildrenBaseService {
  protected testCaseRepo = new TestCaseRepository();
  protected logger: Logger = baseLogger.child({ module: 'test-case' });

  /**
   * テストケースをIDで検索（存在しない場合はNotFoundErrorをスロー）
   * @param options.includeDeleted trueの場合、削除済みテストケースも含めて検索する
   */
  async findById(testCaseId: string, options?: { includeDeleted?: boolean }) {
    const testCase = await this.testCaseRepo.findById(testCaseId, options);
    if (!testCase) {
      throw new NotFoundError('TestCase', testCaseId);
    }
    return testCase;
  }

  /**
   * テストケース更新イベントを安全に発行する（エラー時も処理継続）
   */
  protected async publishEventSafely(
    tx: Prisma.TransactionClient,
    testCaseId: string,
    testSuiteId: string,
    projectId: string,
    userId: string,
    changes: { field: string; oldValue: unknown; newValue: unknown }[]
  ): Promise<void> {
    try {
      const user = await tx.user.findUnique({ where: { id: userId } });
      await publishTestCaseUpdated(
        testCaseId,
        testSuiteId,
        projectId,
        changes,
        { type: 'user', id: userId, name: user?.name || 'Unknown' }
      );
    } catch (error) {
      this.logger.error({ err: error }, 'イベント発行エラー');
    }
  }

  /**
   * 履歴を作成する
   */
  protected async createHistory(
    tx: Prisma.TransactionClient,
    testCaseId: string,
    userId: string,
    snapshot: HistorySnapshot,
    groupId: string
  ): Promise<void> {
    await tx.testCaseHistory.create({
      data: {
        testCaseId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: toJsonSnapshot(snapshot),
        groupId,
      },
    });
  }

  /**
   * テストケースの基本スナップショット情報を生成する
   */
  protected buildBaseSnapshot(testCase: {
    id: string;
    testSuiteId: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
  }): TestCaseSnapshot {
    return {
      id: testCase.id,
      testSuiteId: testCase.testSuiteId,
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      status: testCase.status,
    };
  }
}

// re-export for convenience
export { crypto, prisma, type Prisma, NotFoundError, BadRequestError };
