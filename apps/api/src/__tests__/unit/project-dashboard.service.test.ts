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
      // getFailingTests, getLongNotExecutedTests, getFlakyTests用のモック
      mockPrisma.testCase.findMany.mockResolvedValue([]);
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([]);
      // getRecentActivities用のモック
      mockPrisma.execution.findMany.mockResolvedValue([]);
      mockPrisma.testCaseHistory.findMany.mockResolvedValue([]);
      mockPrisma.review.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('project-1');

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'project-1', deletedAt: null },
      });
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('resultDistribution');
      expect(result).toHaveProperty('attentionRequired');
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
      // getResultDistribution, getAttentionRequired, getRecentActivities用のデフォルトモック
      mockPrisma.executionExpectedResult.groupBy.mockResolvedValue([]);
      mockPrisma.testCase.findMany.mockResolvedValue([]);
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([]);
      mockPrisma.execution.findMany.mockResolvedValue([]);
      mockPrisma.testCaseHistory.findMany.mockResolvedValue([]);
      mockPrisma.review.findMany.mockResolvedValue([]);
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
      // getAttentionRequired, getRecentActivities用のデフォルトモック
      mockPrisma.testCase.findMany.mockResolvedValue([]);
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([]);
      mockPrisma.execution.findMany.mockResolvedValue([]);
      mockPrisma.testCaseHistory.findMany.mockResolvedValue([]);
      mockPrisma.review.findMany.mockResolvedValue([]);
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
  // getFailingTests
  // ============================================================
  describe('getFailingTests', () => {
    beforeEach(() => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      // getSummary用のモック
      mockPrisma.testSuite.count.mockResolvedValue(0);
      mockPrisma.testCase.count.mockResolvedValue(0);
      mockPrisma.testCaseExpectedResult.count.mockResolvedValue(0);
      // getResultDistribution用のモック
      mockPrisma.executionExpectedResult.groupBy.mockResolvedValue([]);
      // getRecentActivities用のモック
      mockPrisma.execution.findMany.mockResolvedValue([]);
      mockPrisma.testCaseHistory.findMany.mockResolvedValue([]);
      mockPrisma.review.findMany.mockResolvedValue([]);
    });

    it('最新がFAILのテストを連続失敗回数順で取得（最大10件）', async () => {
      const testCases = [
        { id: 'tc-1', title: 'Test 1', testSuite: { id: 'suite-1', name: 'Suite 1' } },
        { id: 'tc-2', title: 'Test 2', testSuite: { id: 'suite-1', name: 'Suite 1' } },
      ];
      mockPrisma.testCase.findMany.mockResolvedValue(testCases);
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([
        // tc-1の結果（3連続失敗）
        { status: 'FAIL', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date('2024-01-03') } },
        { status: 'FAIL', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date('2024-01-02') } },
        { status: 'FAIL', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date('2024-01-01') } },
        // tc-2の結果（1連続失敗）
        { status: 'FAIL', executionTestCase: { originalTestCaseId: 'tc-2' }, execution: { createdAt: new Date('2024-01-03') } },
        { status: 'PASS', executionTestCase: { originalTestCaseId: 'tc-2' }, execution: { createdAt: new Date('2024-01-02') } },
      ]);

      const result = await service.getDashboard('project-1');

      expect(result.attentionRequired.failingTests).toHaveLength(2);
      expect(result.attentionRequired.failingTests[0].consecutiveFailures).toBe(3);
      expect(result.attentionRequired.failingTests[0].testCaseId).toBe('tc-1');
      expect(result.attentionRequired.failingTests[1].consecutiveFailures).toBe(1);
    });

    it('テストケースがない場合は空配列', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('project-1');

      expect(result.attentionRequired.failingTests).toEqual([]);
    });

    it('最新がFAIL以外はスキップ', async () => {
      const testCases = [
        { id: 'tc-1', title: 'Test 1', testSuite: { id: 'suite-1', name: 'Suite 1' } },
      ];
      mockPrisma.testCase.findMany.mockResolvedValue(testCases);
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([
        { status: 'PASS', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date('2024-01-03') } },
        { status: 'FAIL', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date('2024-01-02') } },
      ]);

      const result = await service.getDashboard('project-1');

      expect(result.attentionRequired.failingTests).toEqual([]);
    });
  });

  // ============================================================
  // getLongNotExecutedTests
  // ============================================================
  describe('getLongNotExecutedTests', () => {
    beforeEach(() => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      // getSummary用のモック
      mockPrisma.testSuite.count.mockResolvedValue(0);
      mockPrisma.testCase.count.mockResolvedValue(0);
      mockPrisma.testCaseExpectedResult.count.mockResolvedValue(0);
      // getResultDistribution用のモック
      mockPrisma.executionExpectedResult.groupBy.mockResolvedValue([]);
      // getRecentActivities用のモック
      mockPrisma.execution.findMany.mockResolvedValue([]);
      mockPrisma.testCaseHistory.findMany.mockResolvedValue([]);
      mockPrisma.review.findMany.mockResolvedValue([]);
    });

    it('30日以上未実行/一度も未実行のテストを取得', async () => {
      const now = new Date();
      const thirtyOneDaysAgo = new Date(now);
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      const testCases = [
        { id: 'tc-1', title: 'Never Executed', createdAt: new Date(), testSuite: { id: 'suite-1', name: 'Suite 1' } },
        { id: 'tc-2', title: 'Old Execution', createdAt: new Date(), testSuite: { id: 'suite-1', name: 'Suite 1' } },
      ];
      mockPrisma.testCase.findMany.mockResolvedValue(testCases);
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([
        // tc-2は31日前に実行
        { executionTestCase: { originalTestCaseId: 'tc-2' }, execution: { createdAt: thirtyOneDaysAgo } },
      ]);

      const result = await service.getDashboard('project-1');

      expect(result.attentionRequired.longNotExecuted).toHaveLength(2);
      // 未実行は先頭（nullはソートで先）
      expect(result.attentionRequired.longNotExecuted[0].testCaseId).toBe('tc-1');
      expect(result.attentionRequired.longNotExecuted[0].daysSinceLastExecution).toBeNull();
    });

    it('29日前は対象外、31日前は対象', async () => {
      const now = new Date();
      const twentyNineDaysAgo = new Date(now);
      twentyNineDaysAgo.setDate(twentyNineDaysAgo.getDate() - 29);
      const thirtyOneDaysAgo = new Date(now);
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      const testCases = [
        { id: 'tc-1', title: '29 days ago', createdAt: new Date(), testSuite: { id: 'suite-1', name: 'Suite 1' } },
        { id: 'tc-2', title: '31 days ago', createdAt: new Date(), testSuite: { id: 'suite-1', name: 'Suite 1' } },
      ];
      mockPrisma.testCase.findMany.mockResolvedValue(testCases);
      // getSummary用とgetLongNotExecutedTests用の両方で呼ばれるためmockResolvedValueOnceを使う
      mockPrisma.executionExpectedResult.findMany
        .mockResolvedValueOnce([]) // getSummary用
        .mockResolvedValue([
          { executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: twentyNineDaysAgo } },
          { executionTestCase: { originalTestCaseId: 'tc-2' }, execution: { createdAt: thirtyOneDaysAgo } },
        ]);

      const result = await service.getDashboard('project-1');

      // tc-1は29日前なので対象外、tc-2は31日前なので対象（30日より古い）
      expect(result.attentionRequired.longNotExecuted).toHaveLength(1);
      expect(result.attentionRequired.longNotExecuted[0].testCaseId).toBe('tc-2');
    });
  });

  // ============================================================
  // getFlakyTests
  // ============================================================
  describe('getFlakyTests', () => {
    beforeEach(() => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      // getSummary用のモック
      mockPrisma.testSuite.count.mockResolvedValue(0);
      mockPrisma.testCase.count.mockResolvedValue(0);
      mockPrisma.testCaseExpectedResult.count.mockResolvedValue(0);
      // getResultDistribution用のモック
      mockPrisma.executionExpectedResult.groupBy.mockResolvedValue([]);
      // getRecentActivities用のモック
      mockPrisma.execution.findMany.mockResolvedValue([]);
      mockPrisma.testCaseHistory.findMany.mockResolvedValue([]);
      mockPrisma.review.findMany.mockResolvedValue([]);
    });

    it('過去10回で成功率50-90%のテストを取得', async () => {
      const testCases = [
        { id: 'tc-1', title: 'Flaky Test', testSuite: { id: 'suite-1', name: 'Suite 1' } },
      ];
      mockPrisma.testCase.findMany.mockResolvedValue(testCases);
      // 10回中6回成功 = 60%
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([
        { status: 'PASS', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date() } },
        { status: 'PASS', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date() } },
        { status: 'PASS', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date() } },
        { status: 'PASS', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date() } },
        { status: 'PASS', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date() } },
        { status: 'PASS', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date() } },
        { status: 'FAIL', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date() } },
        { status: 'FAIL', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date() } },
        { status: 'FAIL', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date() } },
        { status: 'FAIL', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date() } },
      ]);

      const result = await service.getDashboard('project-1');

      expect(result.attentionRequired.flakyTests).toHaveLength(1);
      expect(result.attentionRequired.flakyTests[0].passRate).toBe(60);
    });

    it('49%/91%は対象外、50%/90%は対象', async () => {
      const testCases = [
        { id: 'tc-1', title: '49%', testSuite: { id: 'suite-1', name: 'Suite 1' } },
        { id: 'tc-2', title: '50%', testSuite: { id: 'suite-1', name: 'Suite 1' } },
        { id: 'tc-3', title: '90%', testSuite: { id: 'suite-1', name: 'Suite 1' } },
        { id: 'tc-4', title: '91%', testSuite: { id: 'suite-1', name: 'Suite 1' } },
      ];
      mockPrisma.testCase.findMany.mockResolvedValue(testCases);

      const createResults = (testCaseId: string, passCount: number, total: number) => {
        const results = [];
        for (let i = 0; i < passCount; i++) {
          results.push({ status: 'PASS', executionTestCase: { originalTestCaseId: testCaseId }, execution: { createdAt: new Date() } });
        }
        for (let i = 0; i < total - passCount; i++) {
          results.push({ status: 'FAIL', executionTestCase: { originalTestCaseId: testCaseId }, execution: { createdAt: new Date() } });
        }
        return results;
      };

      // 49%: 4.9/10 -> 5/10 = 50%になるので、4/10 = 40%に設定
      // 50%: 5/10
      // 90%: 9/10
      // 91%: 10/10 = 100%に設定
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([
        ...createResults('tc-1', 4, 10),  // 40% -> 対象外
        ...createResults('tc-2', 5, 10),  // 50% -> 対象
        ...createResults('tc-3', 9, 10),  // 90% -> 対象
        ...createResults('tc-4', 10, 10), // 100% -> 対象外
      ]);

      const result = await service.getDashboard('project-1');

      const flakyIds = result.attentionRequired.flakyTests.map(t => t.testCaseId);
      expect(flakyIds).toContain('tc-2');
      expect(flakyIds).toContain('tc-3');
      expect(flakyIds).not.toContain('tc-1');
      expect(flakyIds).not.toContain('tc-4');
    });

    it('3回未満の実行はスキップ', async () => {
      const testCases = [
        { id: 'tc-1', title: 'Only 2 executions', testSuite: { id: 'suite-1', name: 'Suite 1' } },
      ];
      mockPrisma.testCase.findMany.mockResolvedValue(testCases);
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([
        { status: 'PASS', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date() } },
        { status: 'FAIL', executionTestCase: { originalTestCaseId: 'tc-1' }, execution: { createdAt: new Date() } },
      ]);

      const result = await service.getDashboard('project-1');

      expect(result.attentionRequired.flakyTests).toHaveLength(0);
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
      // getFailingTests, getLongNotExecutedTests, getFlakyTests用のモック
      mockPrisma.testCase.findMany.mockResolvedValue([]);
      mockPrisma.executionExpectedResult.findMany.mockResolvedValue([]);
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
});
