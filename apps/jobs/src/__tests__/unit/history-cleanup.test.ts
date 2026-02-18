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
  const originalEnv = process.env.HISTORY_RETENTION_DAYS;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-15T00:00:00.000Z'));
    delete process.env.HISTORY_RETENTION_DAYS;
  });

  afterEach(() => {
    vi.useRealTimers();
    // 環境変数を復元
    if (originalEnv !== undefined) {
      process.env.HISTORY_RETENTION_DAYS = originalEnv;
    } else {
      delete process.env.HISTORY_RETENTION_DAYS;
    }
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

  describe('HISTORY_RETENTION_DAYS 環境変数', () => {
    /** ヘルパー: 指定日数分前の日付を期待値として取得 */
    function expectedCutoffDate(days: number): Date {
      const d = new Date('2025-05-15T00:00:00.000Z');
      d.setDate(d.getDate() - days);
      return d;
    }

    /** ヘルパー: deleteMany のモックを設定して実行 */
    async function runWithMocks(): Promise<void> {
      mockPrisma.testCaseHistory.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.testSuiteHistory.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.projectHistory.deleteMany.mockResolvedValue({ count: 0 });
      await runHistoryCleanup();
    }

    /** deleteMany に渡された cutoffDate を取得 */
    function getCutoffDate(): Date {
      return mockPrisma.testCaseHistory.deleteMany.mock.calls[0][0].where.createdAt.lt;
    }

    it('未設定時はデフォルト30日を使用する', async () => {
      await runWithMocks();
      expect(getCutoffDate().getTime()).toBe(expectedCutoffDate(30).getTime());
    });

    it('HISTORY_RETENTION_DAYS=90 を指定すると90日を使用する', async () => {
      process.env.HISTORY_RETENTION_DAYS = '90';
      await runWithMocks();
      expect(getCutoffDate().getTime()).toBe(expectedCutoffDate(90).getTime());
    });

    it('HISTORY_RETENTION_DAYS=7 を指定すると7日を使用する', async () => {
      process.env.HISTORY_RETENTION_DAYS = '7';
      await runWithMocks();
      expect(getCutoffDate().getTime()).toBe(expectedCutoffDate(7).getTime());
    });

    it('HISTORY_RETENTION_DAYS=0 はデフォルト30日にフォールバックする', async () => {
      process.env.HISTORY_RETENTION_DAYS = '0';
      await runWithMocks();
      expect(getCutoffDate().getTime()).toBe(expectedCutoffDate(30).getTime());
    });

    it('負数はデフォルト30日にフォールバックする', async () => {
      process.env.HISTORY_RETENTION_DAYS = '-10';
      await runWithMocks();
      expect(getCutoffDate().getTime()).toBe(expectedCutoffDate(30).getTime());
    });

    it('非数値はデフォルト30日にフォールバックする', async () => {
      process.env.HISTORY_RETENTION_DAYS = 'abc';
      await runWithMocks();
      expect(getCutoffDate().getTime()).toBe(expectedCutoffDate(30).getTime());
    });

    it('小数は整数部のみ使用する', async () => {
      process.env.HISTORY_RETENTION_DAYS = '45.7';
      await runWithMocks();
      expect(getCutoffDate().getTime()).toBe(expectedCutoffDate(45).getTime());
    });

    it('無効値で警告ログを出力する', async () => {
      process.env.HISTORY_RETENTION_DAYS = 'invalid';
      await runWithMocks();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'invalid' }),
        expect.stringContaining('HISTORY_RETENTION_DAYS')
      );
    });
  });
});
