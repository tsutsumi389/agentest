/**
 * history-cleanup 結合テスト
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { runHistoryCleanup } from '../../jobs/history-cleanup.js';
import {
  createTestUser,
  createTestSubscription,
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

  it('FREEプランユーザーの31日前履歴を削除する', async () => {
    // FREEプランユーザー
    const user = await createTestUser({ plan: 'FREE' });
    await createTestSubscription({ userId: user.id, plan: 'FREE' });
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

  it('PROプランユーザーの履歴は削除されない', async () => {
    // PROプランユーザー
    const user = await createTestUser({ plan: 'PRO' });
    await createTestSubscription({ userId: user.id, plan: 'PRO' });
    const project = await createTestProject(user.id);
    const suite = await createTestSuite(project.id);
    const testCase = await createTestCase(suite.id);

    // 60日前の履歴（PROなので削除されない）
    await createTestCaseHistory(testCase.id, { createdAt: daysAgo(60) });
    await createTestSuiteHistory(suite.id, { createdAt: daysAgo(60) });
    await createTestProjectHistory(project.id, { createdAt: daysAgo(60) });

    await runHistoryCleanup();

    const testCaseHistories = await prisma.testCaseHistory.count();
    const testSuiteHistories = await prisma.testSuiteHistory.count();
    const projectHistories = await prisma.projectHistory.count();

    expect(testCaseHistories).toBe(1);
    expect(testSuiteHistories).toBe(1);
    expect(projectHistories).toBe(1);
  });

  it('FREEプランユーザーの29日前履歴は削除されない', async () => {
    // FREEプランユーザー
    const user = await createTestUser({ plan: 'FREE' });
    await createTestSubscription({ userId: user.id, plan: 'FREE' });
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

  it('組織プロジェクトの履歴は削除されない', async () => {
    // FREEプランユーザー + 組織
    const user = await createTestUser({ plan: 'FREE' });
    await createTestSubscription({ userId: user.id, plan: 'FREE' });
    const org = await createTestOrganization(user.id, { plan: 'TEAM' });
    const project = await createTestProject(user.id, {
      organizationId: org.id,
    });
    const suite = await createTestSuite(project.id);
    const testCase = await createTestCase(suite.id);

    // 60日前の履歴（組織プロジェクトなので削除されない）
    await createTestCaseHistory(testCase.id, { createdAt: daysAgo(60) });
    await createTestSuiteHistory(suite.id, { createdAt: daysAgo(60) });
    await createTestProjectHistory(project.id, { createdAt: daysAgo(60) });

    await runHistoryCleanup();

    const testCaseHistories = await prisma.testCaseHistory.count();
    const testSuiteHistories = await prisma.testSuiteHistory.count();
    const projectHistories = await prisma.projectHistory.count();

    expect(testCaseHistories).toBe(1);
    expect(testSuiteHistories).toBe(1);
    expect(projectHistories).toBe(1);
  });

  it('複数ユーザーの履歴を適切に処理する', async () => {
    // FREEユーザー1
    const freeUser1 = await createTestUser({ email: 'free1@test.com', plan: 'FREE' });
    await createTestSubscription({ userId: freeUser1.id, plan: 'FREE' });
    const freeProject1 = await createTestProject(freeUser1.id);
    const freeSuite1 = await createTestSuite(freeProject1.id);
    const freeCase1 = await createTestCase(freeSuite1.id);
    await createTestCaseHistory(freeCase1.id, { createdAt: daysAgo(35) }); // 削除対象

    // FREEユーザー2（新しい履歴）
    const freeUser2 = await createTestUser({ email: 'free2@test.com', plan: 'FREE' });
    await createTestSubscription({ userId: freeUser2.id, plan: 'FREE' });
    const freeProject2 = await createTestProject(freeUser2.id);
    const freeSuite2 = await createTestSuite(freeProject2.id);
    const freeCase2 = await createTestCase(freeSuite2.id);
    await createTestCaseHistory(freeCase2.id, { createdAt: daysAgo(10) }); // 削除されない

    // PROユーザー
    const proUser = await createTestUser({ email: 'pro@test.com', plan: 'PRO' });
    await createTestSubscription({ userId: proUser.id, plan: 'PRO' });
    const proProject = await createTestProject(proUser.id);
    const proSuite = await createTestSuite(proProject.id);
    const proCase = await createTestCase(proSuite.id);
    await createTestCaseHistory(proCase.id, { createdAt: daysAgo(100) }); // 削除されない

    await runHistoryCleanup();

    const histories = await prisma.testCaseHistory.findMany({
      include: { testCase: { include: { testSuite: { include: { project: true } } } } },
    });

    expect(histories).toHaveLength(2);
    const projectIds = histories.map((h) => h.testCase.testSuite.project.id);
    expect(projectIds).not.toContain(freeProject1.id);
    expect(projectIds).toContain(freeProject2.id);
    expect(projectIds).toContain(proProject.id);
  });
});
