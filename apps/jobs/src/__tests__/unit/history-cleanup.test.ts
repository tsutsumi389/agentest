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
      user: {
        findMany: vi.fn(),
      },
      projectMember: {
        findMany: vi.fn(),
      },
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
  const mockFreeUser = { id: 'user-free-1' };
  const mockProjects = [{ projectId: 'proj-1' }, { projectId: 'proj-2' }];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-15T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('FREEプランユーザーの30日以上前履歴を削除する', async () => {
    // 1回目: ユーザーを返す、2回目: 空配列でループ終了
    mockPrisma.user.findMany
      .mockResolvedValueOnce([mockFreeUser])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(mockProjects);
    mockPrisma.testCaseHistory.deleteMany.mockResolvedValue({ count: 10 });
    mockPrisma.testSuiteHistory.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.projectHistory.deleteMany.mockResolvedValue({ count: 2 });

    await runHistoryCleanup();

    // FREEプランユーザーをクエリしていることを確認
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          subscription: { plan: 'FREE' },
        },
      })
    );
  });

  it('TestCaseHistory, TestSuiteHistory, ProjectHistoryを全て削除する', async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([mockFreeUser])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(mockProjects);
    mockPrisma.testCaseHistory.deleteMany.mockResolvedValue({ count: 10 });
    mockPrisma.testSuiteHistory.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.projectHistory.deleteMany.mockResolvedValue({ count: 2 });

    await runHistoryCleanup();

    // 各履歴テーブルの削除が呼ばれることを確認
    expect(mockPrisma.testCaseHistory.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.testSuiteHistory.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.projectHistory.deleteMany).toHaveBeenCalled();
  });

  it('個人プロジェクト（organizationId: null）のみを対象とする', async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([mockFreeUser])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(mockProjects);
    mockPrisma.testCaseHistory.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.testSuiteHistory.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.projectHistory.deleteMany.mockResolvedValue({ count: 0 });

    await runHistoryCleanup();

    // projectMember.findManyでorganizationId: nullを指定していることを確認
    expect(mockPrisma.projectMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: {
            organizationId: null,
          },
        }),
      })
    );
  });

  it('所有プロジェクトがないユーザーはスキップする', async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([mockFreeUser])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue([]); // プロジェクトなし

    await runHistoryCleanup();

    // 履歴削除は呼ばれない
    expect(mockPrisma.testCaseHistory.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.testSuiteHistory.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.projectHistory.deleteMany).not.toHaveBeenCalled();
  });

  it('カーソルベースバッチ処理が正しく動作する', async () => {
    const batch1 = [{ id: 'user-1' }, { id: 'user-2' }];
    const batch2 = [{ id: 'user-3' }];

    mockPrisma.user.findMany
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce([]); // ループ終了
    mockPrisma.projectMember.findMany.mockResolvedValue([]);

    await runHistoryCleanup();

    // 3回呼ばれる（batch1, batch2, 空配列）
    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(3);

    // 2回目はcursorオプション付き
    expect(mockPrisma.user.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        skip: 1,
        cursor: { id: 'user-2' },
      })
    );
  });

  it('削除件数がある場合にログ出力する', async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([mockFreeUser])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(mockProjects);
    mockPrisma.testCaseHistory.deleteMany.mockResolvedValue({ count: 10 });
    mockPrisma.testSuiteHistory.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.projectHistory.deleteMany.mockResolvedValue({ count: 2 });

    await runHistoryCleanup();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockFreeUser.id,
        userTotal: 17,
        testCaseHistory: 10,
        testSuiteHistory: 5,
        projectHistory: 2,
      }),
      'ユーザーの履歴を削除'
    );
  });

  it('30日の基準日を正しく計算する', async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([mockFreeUser])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(mockProjects);
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
});
