import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError } from '@agentest/shared';

// Prisma のモック
const mockPrisma = vi.hoisted(() => ({
  project: {
    findFirst: vi.fn(),
  },
  testSuite: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  testCase: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  testCaseExpectedResult: {
    count: vi.fn(),
  },
  execution: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  executionExpectedResult: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  testCaseHistory: {
    findMany: vi.fn(),
  },
  review: {
    findMany: vi.fn(),
  },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

import { ProjectDashboardService } from '../../services/project-dashboard.service.js';

describe('ProjectDashboardService', () => {
  let service: ProjectDashboardService;

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    description: null,
    organizationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectDashboardService();
  });

  // ============================================================
  // getDashboard（メイン）
  // ============================================================
  describe('getDashboard', () => {
    it('プロジェクト存在時に統計を取得できる', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      // getSummary用のモック
      mockPrisma.testSuite.count.mockResolvedValue(2);
      mockPrisma.testCase.count.mockResolvedValue(5);
      mockPrisma.testCaseExpectedResult.count.mockResolvedValue(10);
      // getResultDistribution用のモック
      mockPrisma.executionExpectedResult.groupBy.mockResolvedValue([
        { status: 'PASS', _count: { status: 10 } },
        { status: 'FAIL', _count: { status: 2 } },
      ]);
      // getRecentActivities用のモック
      mockPrisma.execution.findMany.mockResolvedValue([]);
      mockPrisma.testCaseHistory.findMany.mockResolvedValue([]);
      mockPrisma.review.findMany.mockResolvedValue([]);
      // getExecutionStatusSuites用のモック
      mockPrisma.testSuite.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('project-1');

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'project-1', deletedAt: null },
      });
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('resultDistribution');
      expect(result).toHaveProperty('executionStatusSuites');
      expect(result).toHaveProperty('recentActivities');
    });

    it('存在しないプロジェクトはNotFoundError', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(service.getDashboard('non-existent'))
        .rejects.toThrow(NotFoundError);
    });

    it('削除済みプロジェクトはNotFoundError', async () => {
      // findFirstはdeletedAt: nullの条件で検索するためnullが返る
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(service.getDashboard('deleted-project'))
        .rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================
  // getSummary（privateメソッドだがgetDashboard経由でテスト）
  // ============================================================
  describe('getSummary', () => {
    beforeEach(() => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      // getResultDistribution, getRecentActivities用のデフォルトモック
      mockPrisma.executionExpectedResult.groupBy.mockResolvedValue([]);
      mockPrisma.testCase.findMany.mockResolvedValue([]);
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([]);
      mockPrisma.execution.findMany.mockResolvedValue([]);
      mockPrisma.testCaseHistory.findMany.mockResolvedValue([]);
      mockPrisma.review.findMany.mockResolvedValue([]);
      // getExecutionStatusSuites用のモック
      mockPrisma.testSuite.findMany.mockResolvedValue([]);
    });

    it('テストスイート数/テストケース数/期待結果数を取得', async () => {
      mockPrisma.testSuite.count.mockResolvedValue(3);
      mockPrisma.testCase.count.mockResolvedValue(10);
      mockPrisma.testCaseExpectedResult.count.mockResolvedValue(25);

      const result = await service.getDashboard('project-1');

      expect(result.summary.totalTestSuites).toBe(3);
      expect(result.summary.totalTestCases).toBe(10);
      expect(result.summary.totalExpectedResults).toBe(25);
    });

    it('データがない場合は全て0', async () => {
      mockPrisma.testSuite.count.mockResolvedValue(0);
      mockPrisma.testCase.count.mockResolvedValue(0);
      mockPrisma.testCaseExpectedResult.count.mockResolvedValue(0);

      const result = await service.getDashboard('project-1');

      expect(result.summary.totalTestSuites).toBe(0);
      expect(result.summary.totalTestCases).toBe(0);
      expect(result.summary.totalExpectedResults).toBe(0);
    });
  });

  // ============================================================
  // getResultDistribution
  // ============================================================
  describe('getResultDistribution', () => {
    beforeEach(() => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      // getSummary用のモック
      mockPrisma.testSuite.count.mockResolvedValue(0);
      mockPrisma.testCase.count.mockResolvedValue(0);
      mockPrisma.testCaseExpectedResult.count.mockResolvedValue(0);
      // getRecentActivities用のデフォルトモック
      mockPrisma.testCase.findMany.mockResolvedValue([]);
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([]);
      mockPrisma.execution.findMany.mockResolvedValue([]);
      mockPrisma.testCaseHistory.findMany.mockResolvedValue([]);
      mockPrisma.review.findMany.mockResolvedValue([]);
      // getExecutionStatusSuites用のモック
      mockPrisma.testSuite.findMany.mockResolvedValue([]);
    });

    it('各ステータス(PASS/FAIL/SKIPPED/PENDING)のカウント', async () => {
      mockPrisma.executionExpectedResult.groupBy.mockResolvedValue([
        { status: 'PASS', _count: { status: 15 } },
        { status: 'FAIL', _count: { status: 3 } },
        { status: 'SKIPPED', _count: { status: 3 } },
        { status: 'PENDING', _count: { status: 5 } },
      ]);

      const result = await service.getDashboard('project-1');

      expect(result.resultDistribution.pass).toBe(15);
      expect(result.resultDistribution.fail).toBe(3);
      expect(result.resultDistribution.skipped).toBe(3);
      expect(result.resultDistribution.pending).toBe(5);
    });

    it('結果がない場合は全て0', async () => {
      mockPrisma.executionExpectedResult.groupBy.mockResolvedValue([]);

      const result = await service.getDashboard('project-1');

      expect(result.resultDistribution.pass).toBe(0);
      expect(result.resultDistribution.fail).toBe(0);
      expect(result.resultDistribution.skipped).toBe(0);
      expect(result.resultDistribution.pending).toBe(0);
    });
  });

  // ============================================================
  // getRecentActivities
  // ============================================================
  describe('getRecentActivities', () => {
    beforeEach(() => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      // getSummary用のモック
      mockPrisma.testSuite.count.mockResolvedValue(0);
      mockPrisma.testCase.count.mockResolvedValue(0);
      mockPrisma.testCaseExpectedResult.count.mockResolvedValue(0);
      // getResultDistribution用のモック
      mockPrisma.executionExpectedResult.groupBy.mockResolvedValue([]);
      // getExecutionStatusSuites用のモック
      mockPrisma.testSuite.findMany.mockResolvedValue([]);
    });

    it('execution/testCaseUpdate/reviewを日時降順で取得（最大10件）', async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      mockPrisma.execution.findMany.mockResolvedValue([
        {
          id: 'exec-1',
          createdAt: now,
          testSuite: { id: 'suite-1', name: 'Suite 1' },
          executedByUser: { id: 'user-1', name: 'User 1', avatarUrl: null },
        },
      ]);
      mockPrisma.testCaseHistory.findMany.mockResolvedValue([
        {
          id: 'history-1',
          createdAt: yesterday,
          testCase: {
            id: 'tc-1',
            title: 'Test Case 1',
            testSuite: { id: 'suite-1', name: 'Suite 1' },
          },
          changedBy: { id: 'user-1', name: 'User 1', avatarUrl: null },
        },
      ]);
      mockPrisma.review.findMany.mockResolvedValue([
        {
          id: 'review-1',
          submittedAt: twoDaysAgo,
          verdict: 'APPROVED',
          testSuite: { id: 'suite-1', name: 'Suite 1' },
          author: { id: 'user-1', name: 'User 1', avatarUrl: null },
        },
      ]);

      const result = await service.getDashboard('project-1');

      expect(result.recentActivities).toHaveLength(3);
      expect(result.recentActivities[0].type).toBe('execution');
      expect(result.recentActivities[1].type).toBe('testCaseUpdate');
      expect(result.recentActivities[2].type).toBe('review');
    });

    it('活動がない場合は空配列', async () => {
      mockPrisma.execution.findMany.mockResolvedValue([]);
      mockPrisma.testCaseHistory.findMany.mockResolvedValue([]);
      mockPrisma.review.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('project-1');

      expect(result.recentActivities).toEqual([]);
    });
  });

  // ============================================================
  // getExecutionStatusSuites（テストスイート単位のテスト実行状況）
  // ============================================================
  describe('getExecutionStatusSuites', () => {
    beforeEach(() => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      // getSummary用のモック
      mockPrisma.testSuite.count.mockResolvedValue(0);
      mockPrisma.testCase.count.mockResolvedValue(0);
      mockPrisma.testCaseExpectedResult.count.mockResolvedValue(0);
      // getResultDistribution用のモック
      mockPrisma.executionExpectedResult.groupBy.mockResolvedValue([]);
      // getRecentActivities用のモック（testCase, executionExpectedResult）
      mockPrisma.testCase.findMany.mockResolvedValue([]);
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([]);
      // getRecentActivities用のモック
      mockPrisma.execution.findMany.mockResolvedValue([]);
      mockPrisma.testCaseHistory.findMany.mockResolvedValue([]);
      mockPrisma.review.findMany.mockResolvedValue([]);
    });

    it('失敗中テストスイート: 最終実行にFAILを含むスイートを取得', async () => {
      mockPrisma.testSuite.findMany.mockResolvedValue([
        {
          id: 'suite-1',
          name: 'Suite 1',
          createdAt: new Date(),
          _count: { executions: 1, testCases: 5 },
          executions: [
            {
              id: 'exec-1',
              createdAt: new Date(),
              environment: { id: 'env-1', name: 'Production' },
              expectedResults: [
                { status: 'PASS' },
                { status: 'FAIL' },
                { status: 'FAIL' },
              ],
            },
          ],
        },
        {
          id: 'suite-2',
          name: 'Suite 2',
          createdAt: new Date(),
          _count: { executions: 1, testCases: 3 },
          executions: [
            {
              id: 'exec-2',
              createdAt: new Date(),
              environment: null,
              expectedResults: [
                { status: 'PASS' },
                { status: 'PASS' },
              ],
            },
          ],
        },
      ]);

      const result = await service.getDashboard('project-1');

      expect(result.executionStatusSuites.failingSuites.items).toHaveLength(1);
      expect(result.executionStatusSuites.failingSuites.items[0].testSuiteId).toBe('suite-1');
      expect(result.executionStatusSuites.failingSuites.items[0].failCount).toBe(2);
      expect(result.executionStatusSuites.failingSuites.total).toBe(1);
    });

    it('スキップ中テストスイート: 最終実行にSKIPPEDを含むスイートを取得', async () => {
      mockPrisma.testSuite.findMany.mockResolvedValue([
        {
          id: 'suite-1',
          name: 'Suite 1',
          createdAt: new Date(),
          _count: { executions: 1, testCases: 5 },
          executions: [
            {
              id: 'exec-1',
              createdAt: new Date(),
              environment: { id: 'env-1', name: 'Staging' },
              expectedResults: [
                { status: 'PASS' },
                { status: 'SKIPPED' },
                { status: 'SKIPPED' },
                { status: 'SKIPPED' },
              ],
            },
          ],
        },
      ]);

      const result = await service.getDashboard('project-1');

      expect(result.executionStatusSuites.skippedSuites.items).toHaveLength(1);
      expect(result.executionStatusSuites.skippedSuites.items[0].skippedCount).toBe(3);
    });

    it('未実行テストスイート: 実行が0件のスイートを取得', async () => {
      mockPrisma.testSuite.findMany.mockResolvedValue([
        {
          id: 'suite-1',
          name: 'Never Executed Suite',
          createdAt: new Date('2024-01-01'),
          _count: { executions: 0, testCases: 10 },
          executions: [],
        },
        {
          id: 'suite-2',
          name: 'Executed Suite',
          createdAt: new Date('2024-01-02'),
          _count: { executions: 1, testCases: 5 },
          executions: [
            {
              id: 'exec-1',
              createdAt: new Date(),
              environment: null,
              expectedResults: [{ status: 'PASS' }],
            },
          ],
        },
      ]);

      const result = await service.getDashboard('project-1');

      expect(result.executionStatusSuites.neverExecutedSuites.items).toHaveLength(1);
      expect(result.executionStatusSuites.neverExecutedSuites.items[0].testSuiteId).toBe('suite-1');
      expect(result.executionStatusSuites.neverExecutedSuites.items[0].testCaseCount).toBe(10);
    });

    it('実行中テストスイート: 最終実行にPENDINGを含むスイートを取得', async () => {
      mockPrisma.testSuite.findMany.mockResolvedValue([
        {
          id: 'suite-1',
          name: 'In Progress Suite',
          createdAt: new Date(),
          _count: { executions: 1, testCases: 5 },
          executions: [
            {
              id: 'exec-1',
              createdAt: new Date(),
              environment: { id: 'env-1', name: 'Development' },
              expectedResults: [
                { status: 'PASS' },
                { status: 'PENDING' },
                { status: 'PENDING' },
              ],
            },
          ],
        },
      ]);

      const result = await service.getDashboard('project-1');

      expect(result.executionStatusSuites.inProgressSuites.items).toHaveLength(1);
      expect(result.executionStatusSuites.inProgressSuites.items[0].pendingCount).toBe(2);
    });

    it('テストスイートがない場合は全て空配列', async () => {
      mockPrisma.testSuite.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('project-1');

      expect(result.executionStatusSuites.failingSuites.items).toEqual([]);
      expect(result.executionStatusSuites.failingSuites.total).toBe(0);
      expect(result.executionStatusSuites.skippedSuites.items).toEqual([]);
      expect(result.executionStatusSuites.skippedSuites.total).toBe(0);
      expect(result.executionStatusSuites.neverExecutedSuites.items).toEqual([]);
      expect(result.executionStatusSuites.neverExecutedSuites.total).toBe(0);
      expect(result.executionStatusSuites.inProgressSuites.items).toEqual([]);
      expect(result.executionStatusSuites.inProgressSuites.total).toBe(0);
    });
  });
});
