import { prisma, type TestCasePriority, type EntityStatus } from '@agentest/db';
import { NotFoundError } from '@agentest/shared';
import { TestCaseRepository } from '../repositories/test-case.repository.js';

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
    const orderKey = lastTestCase ? `${parseInt(lastTestCase.orderKey) + 1}`.padStart(5, '0') : '00001';

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

    // 履歴を保存
    await prisma.testCaseHistory.create({
      data: {
        testCaseId,
        changedByUserId: userId,
        changeType: 'UPDATE',
        snapshot: testCase as unknown as object,
      },
    });

    return this.testCaseRepo.update(testCaseId, data);
  }

  /**
   * テストケースを論理削除
   */
  async softDelete(testCaseId: string, userId: string) {
    const testCase = await this.findById(testCaseId);

    // 履歴を保存
    await prisma.testCaseHistory.create({
      data: {
        testCaseId,
        changedByUserId: userId,
        changeType: 'DELETE',
        snapshot: testCase as unknown as object,
      },
    });

    return this.testCaseRepo.softDelete(testCaseId);
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
  async addPrecondition(testCaseId: string, data: { content: string; orderKey?: string }) {
    await this.findById(testCaseId);

    let orderKey = data.orderKey;
    if (!orderKey) {
      const lastItem = await prisma.testCasePrecondition.findFirst({
        where: { testCaseId },
        orderBy: { orderKey: 'desc' },
      });
      orderKey = lastItem ? `${parseInt(lastItem.orderKey) + 1}`.padStart(5, '0') : '00001';
    }

    return prisma.testCasePrecondition.create({
      data: {
        testCaseId,
        content: data.content,
        orderKey,
      },
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
  async addStep(testCaseId: string, data: { content: string; orderKey?: string }) {
    await this.findById(testCaseId);

    let orderKey = data.orderKey;
    if (!orderKey) {
      const lastItem = await prisma.testCaseStep.findFirst({
        where: { testCaseId },
        orderBy: { orderKey: 'desc' },
      });
      orderKey = lastItem ? `${parseInt(lastItem.orderKey) + 1}`.padStart(5, '0') : '00001';
    }

    return prisma.testCaseStep.create({
      data: {
        testCaseId,
        content: data.content,
        orderKey,
      },
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
  async addExpectedResult(testCaseId: string, data: { content: string; orderKey?: string }) {
    await this.findById(testCaseId);

    let orderKey = data.orderKey;
    if (!orderKey) {
      const lastItem = await prisma.testCaseExpectedResult.findFirst({
        where: { testCaseId },
        orderBy: { orderKey: 'desc' },
      });
      orderKey = lastItem ? `${parseInt(lastItem.orderKey) + 1}`.padStart(5, '0') : '00001';
    }

    return prisma.testCaseExpectedResult.create({
      data: {
        testCaseId,
        content: data.content,
        orderKey,
      },
    });
  }
}
