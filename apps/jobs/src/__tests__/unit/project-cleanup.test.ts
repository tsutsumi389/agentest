/**
 * project-cleanup ユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    project: {
      findMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
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
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('30日以上前のdeletedAtのプロジェクトを削除する', async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([mockDeletedProject])
      .mockResolvedValueOnce([]);
    mockPrisma.project.delete.mockResolvedValue({ id: mockDeletedProject.id });
    mockPrisma.project.count.mockResolvedValue(0);

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
    mockPrisma.project.count.mockResolvedValue(0);

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
    mockPrisma.project.count.mockResolvedValue(0);

    await runProjectCleanup();

    // 削除は呼ばれない
    expect(mockPrisma.project.delete).not.toHaveBeenCalled();

    // 完了ログが出力される
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('合計 0 件のプロジェクトを物理削除しました')
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
    mockPrisma.project.count.mockResolvedValue(0);

    await runProjectCleanup();

    // 3件全て削除を試行
    expect(mockPrisma.project.delete).toHaveBeenCalledTimes(3);

    // エラーログが出力される
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('プロジェクト削除失敗: proj-2'),
      expect.any(Error)
    );

    // 成功分のみカウント（2件）
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('合計 2 件のプロジェクトを物理削除しました')
    );
  });

  it('30日の基準日を正しく計算する', async () => {
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    mockPrisma.project.count.mockResolvedValue(0);

    await runProjectCleanup();

    // findManyの呼び出しで基準日を確認
    const call = mockPrisma.project.findMany.mock.calls[0][0];
    const cutoffDate = call.where.deletedAt.lt;
    // 2025-05-15 から 30日前 = 2025-04-15
    const expected = new Date('2025-04-15T00:00:00.000Z');
    expect(cutoffDate.getTime()).toBe(expected.getTime());
  });

  it('残りのソフトデリート済みプロジェクト数をレポートする', async () => {
    mockPrisma.project.findMany.mockResolvedValueOnce([]);
    mockPrisma.project.count.mockResolvedValue(5);

    await runProjectCleanup();

    expect(mockPrisma.project.count).toHaveBeenCalledWith({
      where: {
        deletedAt: { not: null },
      },
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('残りのソフトデリート済みプロジェクト: 5件')
    );
  });

  it('削除成功時にログを出力する', async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([mockDeletedProject])
      .mockResolvedValueOnce([]);
    mockPrisma.project.delete.mockResolvedValue({ id: mockDeletedProject.id });
    mockPrisma.project.count.mockResolvedValue(0);

    await runProjectCleanup();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(`プロジェクト削除開始: ${mockDeletedProject.id}`)
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(`プロジェクト削除完了: ${mockDeletedProject.id}`)
    );
  });
});
