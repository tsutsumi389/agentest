import crypto from 'node:crypto';
import { prisma, type TestCasePriority, type EntityStatus } from '@agentest/db';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  AuthorizationError,
} from '@agentest/shared';
import { publishDashboardUpdated } from '../lib/redis-publisher.js';
import { publishTestCaseUpdated } from '../lib/events.js';
import {
  TestCaseChildrenService,
  getNextOrderKey,
  indexToOrderKey,
  toJsonSnapshot,
  type TestCaseSnapshot,
  type HistorySnapshot,
} from './test-case-children.service.js';

/**
 * テストケースサービス
 * 子エンティティ操作はTestCaseChildrenServiceを継承
 */
export class TestCaseService extends TestCaseChildrenService {

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
      const result = await prisma.$transaction(async (tx) => {
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

      // ダッシュボード更新イベント発行
      await publishDashboardUpdated(testSuite.project.id, 'test_case', result?.id);

      return result;
    }

    const newTestCase = await prisma.testCase.create({
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

    // ダッシュボード更新イベント発行
    await publishDashboardUpdated(testSuite.project.id, 'test_case', newTestCase.id);

    return newTestCase;
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
    const result = await prisma.$transaction(async (tx) => {
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

    // ダッシュボード更新イベント発行
    await publishDashboardUpdated(testCase.testSuite.projectId, 'test_case', testCaseId);

    return result;
  }

  /**
   * テストケースを論理削除
   */
  async softDelete(testCaseId: string, userId: string) {
    const testCase = await this.findById(testCaseId);

    // 履歴保存と論理削除を同じトランザクションで実行
    const groupId = crypto.randomUUID();
    const result = await prisma.$transaction(async (tx) => {
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

    // ダッシュボード更新イベント発行
    await publishDashboardUpdated(testCase.testSuite.projectId, 'test_case', testCaseId);

    return result;
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

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
          newTestCase.id,
          newTestCase.testSuiteId,
          targetTestSuite.project.id,
          [{ field: 'copy', oldValue: testCaseId, newValue: newTestCase.id }],
          { type: 'user', id: userId, name: user?.name || 'Unknown' }
        );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
      }

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
    }, { timeout: 15000 });
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
    const result = await prisma.$transaction(async (tx) => {
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

    // ダッシュボード更新イベント発行
    await publishDashboardUpdated(testSuite.projectId, 'test_case', testCaseId);

    return result;
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

      // テストケース更新イベント発行（エラー時も処理継続）
      try {
        const user = await tx.user.findUnique({ where: { id: userId } });
        await publishTestCaseUpdated(
          testCaseId,
          testCase.testSuiteId,
          testCase.testSuite.projectId,
          [{ field: 'updateWithChildren', oldValue: null, newValue: effectiveGroupId }],
          { type: 'user', id: userId, name: user?.name || 'Unknown' }
        );
      } catch (error) {
        this.logger.error({ err: error }, 'イベント発行エラー');
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
}
