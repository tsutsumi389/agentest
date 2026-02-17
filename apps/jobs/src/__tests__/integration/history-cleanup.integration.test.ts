/**
 * history-cleanup 結合テスト
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { runHistoryCleanup } from '../../jobs/history-cleanup.js';
import {
  createTestUser,
  createTestProject,
  createTestSuite,
  createTestCase,
  createTestCaseHistory,
  createTestSuiteHistory,
  createTestProjectHistory,
  createTestOrganization,
  cleanupTestData,
  daysAgo,
} from './test-helpers.js';

describe('runHistoryCleanup（結合テスト）', () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    await cleanupTestData();
    vi.restoreAllMocks();
  });

  it('31日前の履歴を削除する', async () => {
    const user = await createTestUser();
    const project = await createTestProject(user.id);
    const suite = await createTestSuite(project.id);
    const testCase = await createTestCase(suite.id);

    // 31日前の履歴（削除対象）
    await createTestCaseHistory(testCase.id, { createdAt: daysAgo(31) });
    await createTestSuiteHistory(suite.id, { createdAt: daysAgo(31) });
    await createTestProjectHistory(project.id, { createdAt: daysAgo(31) });

    await runHistoryCleanup();

    const testCaseHistories = await prisma.testCaseHistory.count();
    const testSuiteHistories = await prisma.testSuiteHistory.count();
    const projectHistories = await prisma.projectHistory.count();

    expect(testCaseHistories).toBe(0);
    expect(testSuiteHistories).toBe(0);
    expect(projectHistories).toBe(0);
  });

  it('29日前の履歴は削除されない', async () => {
    const user = await createTestUser();
    const project = await createTestProject(user.id);
    const suite = await createTestSuite(project.id);
    const testCase = await createTestCase(suite.id);

    // 29日前の履歴（30日未満なので削除されない）
    await createTestCaseHistory(testCase.id, { createdAt: daysAgo(29) });
    await createTestSuiteHistory(suite.id, { createdAt: daysAgo(29) });
    await createTestProjectHistory(project.id, { createdAt: daysAgo(29) });

    await runHistoryCleanup();

    const testCaseHistories = await prisma.testCaseHistory.count();
    const testSuiteHistories = await prisma.testSuiteHistory.count();
    const projectHistories = await prisma.projectHistory.count();

    expect(testCaseHistories).toBe(1);
    expect(testSuiteHistories).toBe(1);
    expect(projectHistories).toBe(1);
  });

  it('組織プロジェクトの古い履歴も削除する', async () => {
    const user = await createTestUser();
    const org = await createTestOrganization(user.id);
    const project = await createTestProject(user.id, {
      organizationId: org.id,
    });
    const suite = await createTestSuite(project.id);
    const testCase = await createTestCase(suite.id);

    // 60日前の履歴（削除対象）
    await createTestCaseHistory(testCase.id, { createdAt: daysAgo(60) });
    await createTestSuiteHistory(suite.id, { createdAt: daysAgo(60) });
    await createTestProjectHistory(project.id, { createdAt: daysAgo(60) });

    await runHistoryCleanup();

    const testCaseHistories = await prisma.testCaseHistory.count();
    const testSuiteHistories = await prisma.testSuiteHistory.count();
    const projectHistories = await prisma.projectHistory.count();

    expect(testCaseHistories).toBe(0);
    expect(testSuiteHistories).toBe(0);
    expect(projectHistories).toBe(0);
  });

  it('複数ユーザーの履歴を適切に処理する', async () => {
    // ユーザー1（古い履歴）
    const user1 = await createTestUser({ email: 'user1@test.com' });
    const project1 = await createTestProject(user1.id);
    const suite1 = await createTestSuite(project1.id);
    const case1 = await createTestCase(suite1.id);
    await createTestCaseHistory(case1.id, { createdAt: daysAgo(35) }); // 削除対象

    // ユーザー2（新しい履歴）
    const user2 = await createTestUser({ email: 'user2@test.com' });
    const project2 = await createTestProject(user2.id);
    const suite2 = await createTestSuite(project2.id);
    const case2 = await createTestCase(suite2.id);
    await createTestCaseHistory(case2.id, { createdAt: daysAgo(10) }); // 削除されない

    await runHistoryCleanup();

    const histories = await prisma.testCaseHistory.findMany({
      include: { testCase: { include: { testSuite: { include: { project: true } } } } },
    });

    expect(histories).toHaveLength(1);
    expect(histories[0].testCase.testSuite.project.id).toBe(project2.id);
  });
});
