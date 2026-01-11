import crypto from 'node:crypto';
import { prisma, type TestCasePriority, type EntityStatus, type Prisma } from '@agentest/db';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  AuthorizationError,
  type TestCaseChangeDetail,
} from '@agentest/shared';
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
  deletedAt?: string | null;
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
 * 履歴保存用のスナップショット型
 */
type HistorySnapshot = TestCaseSnapshot & {
  preconditions?: ChildEntitySnapshot[];
  steps?: ChildEntitySnapshot[];
  expectedResults?: ChildEntitySnapshot[];
  changeDetail?: TestCaseChangeDetail;
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
   * テストケースを作成（子エンティティ含む）
   */
  async create(
    userId: string,
    data: {
      testSuiteId: string;
      title: string;
      description?: string;
      priority?: TestCasePriority;
      status?: EntityStatus;
      preconditions?: { content: string }[];
      steps?: { content: string }[];
      expectedResults?: { content: string }[];
    }
  ) {
    // テストスイートの存在確認とプロジェクトメンバーシップ検証
    const testSuite = await prisma.testSuite.findUnique({
      where: { id: data.testSuiteId },
      include: {
        project: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });
    if (!testSuite || testSuite.deletedAt) {
      throw new NotFoundError('TestSuite', data.testSuiteId);
    }

    // プロジェクトメンバーシップチェック（WRITE権限以上）
    const member = testSuite.project.members[0];
    if (!member || !['OWNER', 'ADMIN', 'WRITE'].includes(member.role)) {
      // 組織メンバーシップもチェック
      if (testSuite.project.organizationId) {
        const orgMember = await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: testSuite.project.organizationId,
              userId,
            },
          },
        });
        if (!orgMember || !['OWNER', 'ADMIN'].includes(orgMember.role)) {
          throw new AuthorizationError('Insufficient permissions');
        }
      } else {
        throw new AuthorizationError('Insufficient permissions');
      }
    }

    // 次のorderKeyを取得
    const lastTestCase = await prisma.testCase.findFirst({
      where: { testSuiteId: data.testSuiteId },
      orderBy: { orderKey: 'desc' },
    });
    const orderKey = getNextOrderKey(lastTestCase?.orderKey ?? null);

    // 子エンティティがある場合はトランザクションで一括作成
    if (data.preconditions?.length || data.steps?.length || data.expectedResults?.length) {
      return prisma.$transaction(async (tx) => {
        const testCase = await tx.testCase.create({
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

        // 子エンティティを一括登録
        if (data.preconditions?.length) {
          await tx.testCasePrecondition.createMany({
            data: data.preconditions.map((p, i) => ({
              testCaseId: testCase.id,
              content: p.content,
              orderKey: indexToOrderKey(i),
            })),
          });
        }

        if (data.steps?.length) {
          await tx.testCaseStep.createMany({
            data: data.steps.map((s, i) => ({
              testCaseId: testCase.id,
              content: s.content,
              orderKey: indexToOrderKey(i),
            })),
          });
        }

        if (data.expectedResults?.length) {
          await tx.testCaseExpectedResult.createMany({
            data: data.expectedResults.map((e, i) => ({
              testCaseId: testCase.id,
              content: e.content,
              orderKey: indexToOrderKey(i),
            })),
          });
        }

        // 作成したテストケースを子エンティティ含めて返却
        return tx.testCase.findUnique({
          where: { id: testCase.id },
          include: {
            preconditions: { orderBy: { orderKey: 'asc' } },
            steps: { orderBy: { orderKey: 'asc' } },
            expectedResults: { orderBy: { orderKey: 'asc' } },
          },
        });
      });
    }

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
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async update(
    testCaseId: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      priority?: TestCasePriority;
      status?: EntityStatus;
    },
    groupId?: string
  ) {
    const testCase = await this.findById(testCaseId);

    // 変更があるフィールドのみchangeDetailに含める
    const fields: {
      title?: { before: string; after: string };
      description?: { before: string | null; after: string | null };
      priority?: { before: string; after: string };
      status?: { before: string; after: string };
    } = {};

    if (data.title !== undefined && data.title !== testCase.title) {
      fields.title = { before: testCase.title, after: data.title };
    }
    if (data.description !== undefined && data.description !== testCase.description) {
      fields.description = { before: testCase.description, after: data.description };
    }
    if (data.priority !== undefined && data.priority !== testCase.priority) {
      fields.priority = { before: testCase.priority, after: data.priority };
    }
    if (data.status !== undefined && data.status !== testCase.status) {
      fields.status = { before: testCase.status, after: data.status };
    }

    // 変更がない場合はそのまま返す
    if (Object.keys(fields).length === 0) {
      return testCase;
    }

    // 履歴用のスナップショットを作成
    const snapshot: HistorySnapshot = {
      id: testCase.id,
      testSuiteId: testCase.testSuiteId,
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      status: testCase.status,
      changeDetail: {
        type: 'BASIC_INFO_UPDATE',
        fields,
      },
    };

    // 履歴保存と更新を同じトランザクションで実行
    const effectiveGroupId = groupId ?? crypto.randomUUID();
    return prisma.$transaction(async (tx) => {
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'UPDATE',
          snapshot: toJsonSnapshot(snapshot),
          groupId: effectiveGroupId,
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
    const groupId = crypto.randomUUID();
    return prisma.$transaction(async (tx) => {
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'DELETE',
          snapshot: testCase as unknown as object,
          groupId,
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

      return tx.testCasePrecondition.update({
        where: { id: preconditionId },
        data: { content: data.content },
      });
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

      return tx.testCaseStep.update({
        where: { id: stepId },
        data: { content: data.content },
      });
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

      return tx.testCaseExpectedResult.update({
        where: { id: expectedResultId },
        data: { content: data.content },
      });
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
    });

    // 更新後の期待結果一覧を返す
    return prisma.testCaseExpectedResult.findMany({
      where: { testCaseId },
      orderBy: { orderKey: 'asc' },
    });
  }

  /**
   * テストケースをコピー
   */
  async copy(testCaseId: string, userId: string, data: { targetTestSuiteId?: string; title?: string }) {
    // 1. コピー元テストケース取得（子エンティティ含む）
    const sourceTestCase = await prisma.testCase.findFirst({
      where: { id: testCaseId },
      include: {
        testSuite: { select: { id: true, projectId: true } },
        preconditions: { orderBy: { orderKey: 'asc' } },
        steps: { orderBy: { orderKey: 'asc' } },
        expectedResults: { orderBy: { orderKey: 'asc' } },
      },
    });
    if (!sourceTestCase) {
      throw new NotFoundError('TestCase', testCaseId);
    }

    // 2. 削除済みチェック
    if (sourceTestCase.deletedAt) {
      throw new BadRequestError('削除済みテストケースはコピーできません');
    }

    // 3. コピー先テストスイート決定・検証
    const targetTestSuiteId = data.targetTestSuiteId ?? sourceTestCase.testSuiteId;
    const targetTestSuite = await prisma.testSuite.findFirst({
      where: { id: targetTestSuiteId, deletedAt: null },
      include: { project: { select: { id: true } } },
    });
    if (!targetTestSuite) {
      throw new NotFoundError('TestSuite', targetTestSuiteId);
    }

    // 4. 同一プロジェクト内チェック
    if (sourceTestCase.testSuite.projectId !== targetTestSuite.project.id) {
      throw new BadRequestError('異なるプロジェクトへのコピーはできません');
    }

    // 5. タイトル生成
    const newTitle = data.title ?? `${sourceTestCase.title} (コピー)`;

    // 6. トランザクションでコピー実行
    const groupId = crypto.randomUUID();
    return prisma.$transaction(async (tx) => {
      // orderKey取得
      const lastTestCase = await tx.testCase.findFirst({
        where: { testSuiteId: targetTestSuiteId },
        orderBy: { orderKey: 'desc' },
      });
      const orderKey = getNextOrderKey(lastTestCase?.orderKey ?? null);

      // テストケース作成（ステータスはDRAFT固定）
      const newTestCase = await tx.testCase.create({
        data: {
          testSuiteId: targetTestSuiteId,
          title: newTitle,
          description: sourceTestCase.description,
          priority: sourceTestCase.priority,
          status: 'DRAFT',
          orderKey,
          createdByUserId: userId,
        },
      });

      // 子エンティティをコピー
      if (sourceTestCase.preconditions.length > 0) {
        await tx.testCasePrecondition.createMany({
          data: sourceTestCase.preconditions.map((p) => ({
            testCaseId: newTestCase.id,
            content: p.content,
            orderKey: p.orderKey,
          })),
        });
      }

      if (sourceTestCase.steps.length > 0) {
        await tx.testCaseStep.createMany({
          data: sourceTestCase.steps.map((s) => ({
            testCaseId: newTestCase.id,
            content: s.content,
            orderKey: s.orderKey,
          })),
        });
      }

      if (sourceTestCase.expectedResults.length > 0) {
        await tx.testCaseExpectedResult.createMany({
          data: sourceTestCase.expectedResults.map((e) => ({
            testCaseId: newTestCase.id,
            content: e.content,
            orderKey: e.orderKey,
          })),
        });
      }

      // 新しく作成された子エンティティを取得
      const newPreconditions = await tx.testCasePrecondition.findMany({
        where: { testCaseId: newTestCase.id },
        orderBy: { orderKey: 'asc' },
      });
      const newSteps = await tx.testCaseStep.findMany({
        where: { testCaseId: newTestCase.id },
        orderBy: { orderKey: 'asc' },
      });
      const newExpectedResults = await tx.testCaseExpectedResult.findMany({
        where: { testCaseId: newTestCase.id },
        orderBy: { orderKey: 'asc' },
      });

      // 履歴記録
      const snapshot: HistorySnapshot = {
        id: newTestCase.id,
        testSuiteId: newTestCase.testSuiteId,
        title: newTestCase.title,
        description: newTestCase.description,
        priority: newTestCase.priority,
        status: newTestCase.status,
        preconditions: newPreconditions.map((p) => ({
          id: p.id,
          content: p.content,
          orderKey: p.orderKey,
        })),
        steps: newSteps.map((s) => ({
          id: s.id,
          content: s.content,
          orderKey: s.orderKey,
        })),
        expectedResults: newExpectedResults.map((e) => ({
          id: e.id,
          content: e.content,
          orderKey: e.orderKey,
        })),
        changeDetail: {
          type: 'COPY',
          sourceTestCaseId: testCaseId,
          sourceTitle: sourceTestCase.title,
          targetTestSuiteId,
        },
      };

      await tx.testCaseHistory.create({
        data: {
          testCaseId: newTestCase.id,
          changedByUserId: userId,
          changeType: 'CREATE',
          snapshot: toJsonSnapshot(snapshot),
          groupId,
        },
      });

      // 詳細情報を含めて返却
      return tx.testCase.findUnique({
        where: { id: newTestCase.id },
        include: {
          testSuite: { select: { id: true, name: true, projectId: true } },
          createdByUser: { select: { id: true, name: true, avatarUrl: true } },
          preconditions: { orderBy: { orderKey: 'asc' } },
          steps: { orderBy: { orderKey: 'asc' } },
          expectedResults: { orderBy: { orderKey: 'asc' } },
        },
      });
    });
  }

  /**
   * 変更履歴一覧を取得（グループ化版）
   * グループ単位でのページネーションを行い、ページ境界をまたぐグループの分断を防ぐ
   */
  async getHistoriesGrouped(testCaseId: string, options: { limit: number; offset: number }) {
    // 削除済みを含めてテストケースの存在確認
    const testCase = await prisma.testCase.findUnique({
      where: { id: testCaseId },
    });
    if (!testCase) {
      throw new NotFoundError('TestCase', testCaseId);
    }

    return this.testCaseRepo.getHistoriesGrouped(testCaseId, options);
  }

  /**
   * 変更履歴一覧を取得
   * @deprecated グループ化版のgetHistoriesGroupedを使用してください
   */
  async getHistories(testCaseId: string, options: { limit: number; offset: number }) {
    // 削除済みを含めてテストケースの存在確認
    const testCase = await prisma.testCase.findUnique({
      where: { id: testCaseId },
    });
    if (!testCase) {
      throw new NotFoundError('TestCase', testCaseId);
    }

    const [histories, total] = await Promise.all([
      this.testCaseRepo.getHistories(testCaseId, options),
      this.testCaseRepo.countHistories(testCaseId),
    ]);

    return { histories, total };
  }

  /**
   * 削除済みテストケースを復元
   */
  async restore(testCaseId: string, userId: string) {
    // 削除済みテストケースを取得
    const testCase = await this.testCaseRepo.findDeletedById(testCaseId);
    if (!testCase) {
      // 削除されていないか、存在しない
      const existingTestCase = await prisma.testCase.findUnique({
        where: { id: testCaseId },
      });
      if (existingTestCase && !existingTestCase.deletedAt) {
        throw new ConflictError('Test case is not deleted');
      }
      throw new NotFoundError('TestCase', testCaseId);
    }

    // 30日制限チェック
    const deletedAt = testCase.deletedAt!;
    const daysSinceDeleted = Math.floor((Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceDeleted > 30) {
      throw new BadRequestError('復元期限（30日）を過ぎています');
    }

    // テストスイート存在・未削除確認
    const testSuite = await prisma.testSuite.findUnique({
      where: { id: testCase.testSuiteId },
    });
    if (!testSuite) {
      throw new BadRequestError('テストスイートが存在しません');
    }
    if (testSuite.deletedAt) {
      throw new BadRequestError('削除済みテストスイートへの復元はできません');
    }

    const snapshot: TestCaseSnapshot = {
      id: testCase.id,
      testSuiteId: testCase.testSuiteId,
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      status: testCase.status,
      deletedAt: testCase.deletedAt?.toISOString() ?? null,
    };

    // 復元と履歴保存をトランザクションで実行
    const groupId = crypto.randomUUID();
    return prisma.$transaction(async (tx) => {
      // 履歴を保存
      await tx.testCaseHistory.create({
        data: {
          testCaseId,
          changedByUserId: userId,
          changeType: 'RESTORE',
          snapshot: toJsonSnapshot(snapshot),
          groupId,
        },
      });

      // リポジトリを使用して復元
      return this.testCaseRepo.restore(testCaseId);
    });
  }

  /**
   * 子エンティティを含めてテストケースを更新（差分更新）
   * - idあり: 更新
   * - idなし: 新規作成
   * - リクエストにないid: 削除
   *
   * @param groupId 外部から指定されたgroupId（省略時は自動生成）
   */
  async updateWithChildren(
    testCaseId: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      priority?: TestCasePriority;
      status?: EntityStatus;
      preconditions?: { id?: string; content: string }[];
      steps?: { id?: string; content: string }[];
      expectedResults?: { id?: string; content: string }[];
    },
    groupId?: string
  ) {
    const testCase = await this.findById(testCaseId);

    // groupIdが指定されていない場合は自動生成
    const effectiveGroupId = groupId ?? crypto.randomUUID();

    return prisma.$transaction(async (tx) => {
      // 更新前のスナップショットを取得
      const beforePreconditions = await tx.testCasePrecondition.findMany({
        where: { testCaseId },
        orderBy: { orderKey: 'asc' },
      });
      const beforeSteps = await tx.testCaseStep.findMany({
        where: { testCaseId },
        orderBy: { orderKey: 'asc' },
      });
      const beforeExpectedResults = await tx.testCaseExpectedResult.findMany({
        where: { testCaseId },
        orderBy: { orderKey: 'asc' },
      });

      // テストケース本体の更新（基本情報）
      const { preconditions, steps, expectedResults, ...testCaseData } = data;
      if (Object.keys(testCaseData).length > 0) {
        // 変更があるフィールドを検出
        const fields: {
          title?: { before: string; after: string };
          description?: { before: string | null; after: string | null };
          priority?: { before: string; after: string };
          status?: { before: string; after: string };
        } = {};

        if (testCaseData.title !== undefined && testCaseData.title !== testCase.title) {
          fields.title = { before: testCase.title, after: testCaseData.title };
        }
        if (testCaseData.description !== undefined && testCaseData.description !== testCase.description) {
          fields.description = { before: testCase.description, after: testCaseData.description };
        }
        if (testCaseData.priority !== undefined && testCaseData.priority !== testCase.priority) {
          fields.priority = { before: testCase.priority, after: testCaseData.priority };
        }
        if (testCaseData.status !== undefined && testCaseData.status !== testCase.status) {
          fields.status = { before: testCase.status, after: testCaseData.status };
        }

        // 実際に変更がある場合のみ履歴を作成
        if (Object.keys(fields).length > 0) {
          const basicInfoSnapshot: HistorySnapshot = {
            id: testCase.id,
            testSuiteId: testCase.testSuiteId,
            title: testCase.title,
            description: testCase.description,
            priority: testCase.priority,
            status: testCase.status,
            changeDetail: {
              type: 'BASIC_INFO_UPDATE',
              fields,
            },
          };

          await tx.testCaseHistory.create({
            data: {
              testCaseId,
              changedByUserId: userId,
              changeType: 'UPDATE',
              snapshot: toJsonSnapshot(basicInfoSnapshot),
              groupId: effectiveGroupId,
            },
          });

          await tx.testCase.update({
            where: { id: testCaseId },
            data: testCaseData,
          });
        }
      }

      // 子エンティティの差分同期と履歴作成
      if (preconditions !== undefined) {
        await this.syncChildEntitiesWithHistory(
          tx,
          testCaseId,
          testCase,
          userId,
          'precondition',
          preconditions,
          beforePreconditions,
          effectiveGroupId
        );
      }

      if (steps !== undefined) {
        await this.syncChildEntitiesWithHistory(
          tx,
          testCaseId,
          testCase,
          userId,
          'step',
          steps,
          beforeSteps,
          effectiveGroupId
        );
      }

      if (expectedResults !== undefined) {
        await this.syncChildEntitiesWithHistory(
          tx,
          testCaseId,
          testCase,
          userId,
          'expectedResult',
          expectedResults,
          beforeExpectedResults,
          effectiveGroupId
        );
      }

      // 更新後のテストケースを子エンティティ含めて返却
      return tx.testCase.findUnique({
        where: { id: testCaseId },
        include: {
          preconditions: { orderBy: { orderKey: 'asc' } },
          steps: { orderBy: { orderKey: 'asc' } },
          expectedResults: { orderBy: { orderKey: 'asc' } },
        },
      });
    });
  }

  /**
   * 子エンティティの差分同期処理（各変更ごとに履歴作成）
   * - idあり & 既存に存在: 更新 → XXXX_UPDATE履歴
   * - idなし: 新規作成 → XXXX_ADD履歴
   * - 既存にあるがリクエストにない: 削除 → XXXX_DELETE履歴
   */
  private async syncChildEntitiesWithHistory(
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
