/**
 * project-cleanup ユニットテスト
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
      project: {
        findMany: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
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
import { runProjectCleanup } from '../../jobs/project-cleanup.js';

describe('runProjectCleanup', () => {
  const mockDeletedProject = {
    id: 'proj-1',
    name: 'Deleted Project',
    deletedAt: new Date('2025-04-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-15T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('30日以上前のdeletedAtのプロジェクトを削除する', async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([mockDeletedProject])
      .mockResolvedValueOnce([]);
    mockPrisma.project.delete.mockResolvedValue({ id: mockDeletedProject.id });
    mockPrisma.project.count
      .mockResolvedValueOnce(1) // 事前カウント
      .mockResolvedValueOnce(0); // 残件数カウント

    await runProjectCleanup();

    // deletedAt条件でクエリしていることを確認
    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: {
            not: null,
            lt: expect.any(Date),
          },
        },
      })
    );

    // プロジェクト削除が呼ばれることを確認
    expect(mockPrisma.project.delete).toHaveBeenCalledWith({
      where: { id: mockDeletedProject.id },
    });
  });

  it('カーソルベースバッチ処理が正しく動作する', async () => {
    const batch1 = [
      { id: 'proj-1', name: 'Project 1', deletedAt: new Date('2025-04-01') },
      { id: 'proj-2', name: 'Project 2', deletedAt: new Date('2025-04-02') },
    ];
    const batch2 = [
      { id: 'proj-3', name: 'Project 3', deletedAt: new Date('2025-04-03') },
    ];

    mockPrisma.project.findMany
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce([]); // ループ終了
    mockPrisma.project.delete.mockResolvedValue({ id: 'dummy' });
    mockPrisma.project.count
      .mockResolvedValueOnce(3) // 事前カウント
      .mockResolvedValueOnce(0); // 残件数カウント

    await runProjectCleanup();

    // 3回呼ばれる（batch1, batch2, 空配列）
    expect(mockPrisma.project.findMany).toHaveBeenCalledTimes(3);

    // 2回目はcursorオプション付き
    expect(mockPrisma.project.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        skip: 1,
        cursor: { id: 'proj-2' },
      })
    );

    // 3件削除される
    expect(mockPrisma.project.delete).toHaveBeenCalledTimes(3);
  });

  it('削除対象がない場合でも正常に完了する', async () => {
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    mockPrisma.project.count
      .mockResolvedValueOnce(0) // 事前カウント
      .mockResolvedValueOnce(0); // 残件数カウント

    await runProjectCleanup();

    // 削除は呼ばれない
    expect(mockPrisma.project.delete).not.toHaveBeenCalled();

    // 完了ログが出力される
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ totalDeleted: 0 }),
      'プロジェクトの物理削除が完了しました'
    );
  });

  it('個別エラー発生時も処理を続行する', async () => {
    const projects = [
      { id: 'proj-1', name: 'Project 1', deletedAt: new Date('2025-04-01') },
      { id: 'proj-2', name: 'Project 2', deletedAt: new Date('2025-04-02') },
      { id: 'proj-3', name: 'Project 3', deletedAt: new Date('2025-04-03') },
    ];

    mockPrisma.project.findMany
      .mockResolvedValueOnce(projects)
      .mockResolvedValueOnce([]);
    mockPrisma.project.delete
      .mockResolvedValueOnce({ id: 'proj-1' })
      .mockRejectedValueOnce(new Error('削除エラー')) // 2件目でエラー
      .mockResolvedValueOnce({ id: 'proj-3' });
    mockPrisma.project.count
      .mockResolvedValueOnce(3) // 事前カウント
      .mockResolvedValueOnce(0); // 残件数カウント

    await runProjectCleanup();

    // 3件全て削除を試行
    expect(mockPrisma.project.delete).toHaveBeenCalledTimes(3);

    // エラーログが出力される
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), projectId: 'proj-2' }),
      'プロジェクト削除失敗'
    );

    // 成功分のみカウント（2件）
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ totalDeleted: 2 }),
      'プロジェクトの物理削除が完了しました'
    );
  });

  it('30日の基準日を正しく計算する', async () => {
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    mockPrisma.project.count
      .mockResolvedValueOnce(0) // 事前カウント
      .mockResolvedValueOnce(0); // 残件数カウント

    await runProjectCleanup();

    // findManyの呼び出しで基準日を確認
    const call = mockPrisma.project.findMany.mock.calls[0][0];
    const cutoffDate = call.where.deletedAt.lt;
    // 2025-05-15 から 30日前 = 2025-04-15
    const expected = new Date('2025-04-15T00:00:00.000Z');
    expect(cutoffDate.getTime()).toBe(expected.getTime());
  });

  it('削除対象件数を事前にレポートする', async () => {
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    mockPrisma.project.count
      .mockResolvedValueOnce(3) // 事前カウント
      .mockResolvedValueOnce(0); // 残件数カウント

    await runProjectCleanup();

    // 事前カウントが呼ばれる
    expect(mockPrisma.project.count).toHaveBeenNthCalledWith(1, {
      where: {
        deletedAt: { not: null, lt: expect.any(Date) },
      },
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ targetCount: 3 }),
      '削除対象のプロジェクトを検索'
    );
  });

  it('残りのソフトデリート済みプロジェクト数をレポートする', async () => {
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    mockPrisma.project.count
      .mockResolvedValueOnce(0) // 事前カウント
      .mockResolvedValueOnce(5); // 残件数カウント

    await runProjectCleanup();

    // 残件数カウントが呼ばれる
    expect(mockPrisma.project.count).toHaveBeenNthCalledWith(2, {
      where: {
        deletedAt: { not: null },
      },
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ remainingCount: 5 }),
      '残りのソフトデリート済みプロジェクト'
    );
  });

  it('削除成功時にログを出力する', async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([mockDeletedProject])
      .mockResolvedValueOnce([]);
    mockPrisma.project.delete.mockResolvedValue({ id: mockDeletedProject.id });
    mockPrisma.project.count
      .mockResolvedValueOnce(1) // 事前カウント
      .mockResolvedValueOnce(0); // 残件数カウント

    await runProjectCleanup();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: mockDeletedProject.id, projectName: mockDeletedProject.name }),
      'プロジェクト削除開始'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: mockDeletedProject.id }),
      'プロジェクト削除完了'
    );
  });
});
