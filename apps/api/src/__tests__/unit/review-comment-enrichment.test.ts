import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prismaモック
const mockPrismaTestCase = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

const mockPrismaTestSuite = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    testCase: mockPrismaTestCase,
    testSuite: mockPrismaTestSuite,
  },
}));

import {
  enrichCommentsWithTargetName,
  enrichReviewWithTargetNames,
} from '../../repositories/review-comment-enrichment.js';

describe('enrichCommentsWithTargetName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('空配列の場合はそのまま返す', async () => {
    const result = await enrichCommentsWithTargetName([]);

    expect(result).toEqual([]);
    expect(mockPrismaTestCase.findMany).not.toHaveBeenCalled();
    expect(mockPrismaTestSuite.findMany).not.toHaveBeenCalled();
  });

  it('targetType=CASEのコメントにテストケース名を付与する', async () => {
    const comments = [
      { id: 'c1', targetType: 'CASE', targetId: 'case-1', content: 'test' },
      { id: 'c2', targetType: 'CASE', targetId: 'case-2', content: 'test2' },
    ];
    mockPrismaTestCase.findMany.mockResolvedValue([
      { id: 'case-1', title: 'ログインテスト' },
      { id: 'case-2', title: '登録テスト' },
    ]);

    const result = await enrichCommentsWithTargetName(comments);

    expect(result).toEqual([
      { id: 'c1', targetType: 'CASE', targetId: 'case-1', content: 'test', targetName: 'ログインテスト' },
      { id: 'c2', targetType: 'CASE', targetId: 'case-2', content: 'test2', targetName: '登録テスト' },
    ]);
    expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['case-1', 'case-2'] } },
      select: { id: true, title: true },
    });
  });

  it('targetType=SUITEのコメントにテストスイート名を付与する', async () => {
    const comments = [
      { id: 'c1', targetType: 'SUITE', targetId: 'suite-1', content: 'test' },
    ];
    mockPrismaTestSuite.findMany.mockResolvedValue([
      { id: 'suite-1', name: '認証スイート' },
    ]);

    const result = await enrichCommentsWithTargetName(comments);

    expect(result).toEqual([
      { id: 'c1', targetType: 'SUITE', targetId: 'suite-1', content: 'test', targetName: '認証スイート' },
    ]);
    expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['suite-1'] } },
      select: { id: true, name: true },
    });
  });

  it('CASEとSUITEが混在する場合に両方バッチ取得する', async () => {
    const comments = [
      { id: 'c1', targetType: 'CASE', targetId: 'case-1', content: 'case comment' },
      { id: 'c2', targetType: 'SUITE', targetId: 'suite-1', content: 'suite comment' },
      { id: 'c3', targetType: 'CASE', targetId: 'case-2', content: 'another case' },
    ];
    mockPrismaTestCase.findMany.mockResolvedValue([
      { id: 'case-1', title: 'テストA' },
      { id: 'case-2', title: 'テストB' },
    ]);
    mockPrismaTestSuite.findMany.mockResolvedValue([
      { id: 'suite-1', name: 'スイートA' },
    ]);

    const result = await enrichCommentsWithTargetName(comments);

    expect(result[0].targetName).toBe('テストA');
    expect(result[1].targetName).toBe('スイートA');
    expect(result[2].targetName).toBe('テストB');
  });

  it('同一targetIdの重複を排除してバッチ取得する', async () => {
    const comments = [
      { id: 'c1', targetType: 'CASE', targetId: 'case-1', content: 'first' },
      { id: 'c2', targetType: 'CASE', targetId: 'case-1', content: 'second' },
    ];
    mockPrismaTestCase.findMany.mockResolvedValue([
      { id: 'case-1', title: 'ログインテスト' },
    ]);

    const result = await enrichCommentsWithTargetName(comments);

    expect(result[0].targetName).toBe('ログインテスト');
    expect(result[1].targetName).toBe('ログインテスト');
    // 重複排除されたIDで呼ばれる
    expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['case-1'] } },
      select: { id: true, title: true },
    });
  });

  it('削除済みターゲットにはnullを返す', async () => {
    const comments = [
      { id: 'c1', targetType: 'CASE', targetId: 'deleted-case', content: 'test' },
    ];
    // 削除済みで見つからない
    mockPrismaTestCase.findMany.mockResolvedValue([]);

    const result = await enrichCommentsWithTargetName(comments);

    expect(result[0].targetName).toBeNull();
  });

  it('CASEのみの場合はtestSuiteクエリを発行しない', async () => {
    const comments = [
      { id: 'c1', targetType: 'CASE', targetId: 'case-1', content: 'test' },
    ];
    mockPrismaTestCase.findMany.mockResolvedValue([
      { id: 'case-1', title: 'テスト' },
    ]);

    await enrichCommentsWithTargetName(comments);

    expect(mockPrismaTestCase.findMany).toHaveBeenCalled();
    expect(mockPrismaTestSuite.findMany).not.toHaveBeenCalled();
  });

  it('SUITEのみの場合はtestCaseクエリを発行しない', async () => {
    const comments = [
      { id: 'c1', targetType: 'SUITE', targetId: 'suite-1', content: 'test' },
    ];
    mockPrismaTestSuite.findMany.mockResolvedValue([
      { id: 'suite-1', name: 'スイート' },
    ]);

    await enrichCommentsWithTargetName(comments);

    expect(mockPrismaTestSuite.findMany).toHaveBeenCalled();
    expect(mockPrismaTestCase.findMany).not.toHaveBeenCalled();
  });
});

describe('enrichReviewWithTargetNames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('レビューオブジェクトのコメントにtargetNameを付与する', async () => {
    const review = {
      id: 'review-1',
      comments: [
        { id: 'c1', targetType: 'CASE', targetId: 'case-1', content: 'comment' },
      ],
    };
    mockPrismaTestCase.findMany.mockResolvedValue([
      { id: 'case-1', title: 'ログインテスト' },
    ]);

    const result = await enrichReviewWithTargetNames(review);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('review-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result!.comments[0] as any).targetName).toBe('ログインテスト');
  });

  it('nullレビューの場合はnullを返す', async () => {
    const result = await enrichReviewWithTargetNames(null);

    expect(result).toBeNull();
    expect(mockPrismaTestCase.findMany).not.toHaveBeenCalled();
  });

  it('レビューの他のフィールドは変更しない', async () => {
    const review = {
      id: 'review-1',
      status: 'SUBMITTED',
      verdict: 'APPROVED',
      summary: 'サマリー',
      comments: [],
    };

    const result = await enrichReviewWithTargetNames(review);

    expect(result).toEqual({
      id: 'review-1',
      status: 'SUBMITTED',
      verdict: 'APPROVED',
      summary: 'サマリー',
      comments: [],
    });
  });
});
