/**
 * history-cleanup ユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockPrisma, mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return {
    mockPrisma: {
      testCaseHistory: {
        deleteMany: vi.fn(),
      },
      testSuiteHistory: {
        deleteMany: vi.fn(),
      },
      projectHistory: {
        deleteMany: vi.fn(),
      },
    },
    mockLogger,
  };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// モック設定後にインポート
import { runHistoryCleanup } from '../../jobs/history-cleanup.js';

describe('runHistoryCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-15T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TestCaseHistory, TestSuiteHistory, ProjectHistoryを全て削除する', async () => {
    mockPrisma.testCaseHistory.deleteMany.mockResolvedValue({ count: 10 });
    mockPrisma.testSuiteHistory.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.projectHistory.deleteMany.mockResolvedValue({ count: 2 });

    await runHistoryCleanup();

    // 各履歴テーブルの削除が呼ばれることを確認
    expect(mockPrisma.testCaseHistory.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.testSuiteHistory.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.projectHistory.deleteMany).toHaveBeenCalled();
  });

  it('30日の基準日を正しく計算する', async () => {
    mockPrisma.testCaseHistory.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.testSuiteHistory.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.projectHistory.deleteMany.mockResolvedValue({ count: 0 });

    await runHistoryCleanup();

    // testCaseHistoryの削除で基準日を確認
    const call = mockPrisma.testCaseHistory.deleteMany.mock.calls[0][0];
    const cutoffDate = call.where.createdAt.lt;
    // 2025-05-15 から 30日前 = 2025-04-15
    const expected = new Date('2025-04-15T00:00:00.000Z');
    expect(cutoffDate.getTime()).toBe(expected.getTime());
  });

  it('削除件数をログ出力する', async () => {
    mockPrisma.testCaseHistory.deleteMany.mockResolvedValue({ count: 10 });
    mockPrisma.testSuiteHistory.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.projectHistory.deleteMany.mockResolvedValue({ count: 2 });

    await runHistoryCleanup();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        totalDeleted: 17,
        testCaseHistory: 10,
        testSuiteHistory: 5,
        projectHistory: 2,
      }),
      '古い履歴レコードの削除が完了しました'
    );
  });

  it('削除件数が0の場合も正常に完了する', async () => {
    mockPrisma.testCaseHistory.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.testSuiteHistory.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.projectHistory.deleteMany.mockResolvedValue({ count: 0 });

    await runHistoryCleanup();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        totalDeleted: 0,
      }),
      '古い履歴レコードの削除が完了しました'
    );
  });
});
