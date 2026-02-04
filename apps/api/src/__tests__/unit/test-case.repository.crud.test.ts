import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prismaモック
const mockPrismaTestCase = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
}));

const mockPrismaTestCaseHistory = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    testCase: mockPrismaTestCase,
    testCaseHistory: mockPrismaTestCaseHistory,
  },
}));

import { TestCaseRepository } from '../../repositories/test-case.repository.js';

// テスト用固定ID
const TEST_CASE_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '22222222-2222-2222-2222-222222222222';

describe('TestCaseRepository（コアCRUD）', () => {
  let repository: TestCaseRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TestCaseRepository();
  });

  describe('findById', () => {
    it('削除されていないテストケースを取得できる', async () => {
      const mockTestCase = { id: TEST_CASE_ID, title: 'テスト', deletedAt: null };
      mockPrismaTestCase.findFirst.mockResolvedValue(mockTestCase);

      const result = await repository.findById(TEST_CASE_ID);

      expect(result).toEqual(mockTestCase);
      expect(mockPrismaTestCase.findFirst).toHaveBeenCalledWith({
        where: { id: TEST_CASE_ID, deletedAt: null },
        include: expect.objectContaining({
          testSuite: expect.any(Object),
          createdByUser: expect.any(Object),
          preconditions: expect.any(Object),
          steps: expect.any(Object),
          expectedResults: expect.any(Object),
        }),
      });
    });

    it('存在しないテストケースはnullを返す', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(null);

      const result = await repository.findById(TEST_CASE_ID);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('テストケースを更新できる', async () => {
      const updated = { id: TEST_CASE_ID, title: '更新タイトル' };
      mockPrismaTestCase.update.mockResolvedValue(updated);

      const result = await repository.update(TEST_CASE_ID, { title: '更新タイトル' });

      expect(result).toEqual(updated);
      expect(mockPrismaTestCase.update).toHaveBeenCalledWith({
        where: { id: TEST_CASE_ID },
        data: { title: '更新タイトル' },
      });
    });

    it('複数フィールドを同時に更新できる', async () => {
      mockPrismaTestCase.update.mockResolvedValue({ id: TEST_CASE_ID });

      await repository.update(TEST_CASE_ID, {
        title: '新タイトル',
        description: '新説明',
        priority: 'HIGH',
        status: 'READY',
      });

      expect(mockPrismaTestCase.update).toHaveBeenCalledWith({
        where: { id: TEST_CASE_ID },
        data: { title: '新タイトル', description: '新説明', priority: 'HIGH', status: 'READY' },
      });
    });
  });

  describe('softDelete', () => {
    it('deletedAtを設定して論理削除する', async () => {
      mockPrismaTestCase.update.mockResolvedValue({ id: TEST_CASE_ID });

      await repository.softDelete(TEST_CASE_ID);

      expect(mockPrismaTestCase.update).toHaveBeenCalledWith({
        where: { id: TEST_CASE_ID },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('suggest', () => {
    it('キーワードなしで候補を取得できる', async () => {
      const mockResults = [{ id: TEST_CASE_ID, title: 'テスト' }];
      mockPrismaTestCase.findMany.mockResolvedValue(mockResults);

      const result = await repository.suggest(TEST_SUITE_ID, { limit: 10 });

      expect(result).toEqual(mockResults);
      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith({
        where: { testSuiteId: TEST_SUITE_ID, deletedAt: null },
        select: { id: true, title: true, description: true, priority: true, status: true },
        orderBy: [{ status: 'asc' }, { orderKey: 'asc' }],
        take: 10,
      });
    });

    it('キーワード指定時はOR検索条件を追加する', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue([]);

      await repository.suggest(TEST_SUITE_ID, { q: 'search', limit: 5 });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'search', mode: 'insensitive' } },
              { description: { contains: 'search', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });
  });

  describe('findDeletedById', () => {
    it('削除済みテストケースを取得できる', async () => {
      const mockDeleted = { id: TEST_CASE_ID, deletedAt: new Date() };
      mockPrismaTestCase.findFirst.mockResolvedValue(mockDeleted);

      const result = await repository.findDeletedById(TEST_CASE_ID);

      expect(result).toEqual(mockDeleted);
      expect(mockPrismaTestCase.findFirst).toHaveBeenCalledWith({
        where: { id: TEST_CASE_ID, deletedAt: { not: null } },
        include: expect.any(Object),
      });
    });
  });

  describe('restore', () => {
    it('deletedAtをnullに設定して復元する', async () => {
      mockPrismaTestCase.update.mockResolvedValue({ id: TEST_CASE_ID, deletedAt: null });

      await repository.restore(TEST_CASE_ID);

      expect(mockPrismaTestCase.update).toHaveBeenCalledWith({
        where: { id: TEST_CASE_ID },
        data: { deletedAt: null },
      });
    });
  });

  describe('getHistories', () => {
    it('履歴一覧を新しい順で取得できる', async () => {
      const mockHistories = [
        { id: 'h1', changeType: 'UPDATE', createdAt: new Date() },
        { id: 'h2', changeType: 'CREATE', createdAt: new Date() },
      ];
      mockPrismaTestCaseHistory.findMany.mockResolvedValue(mockHistories);

      const result = await repository.getHistories(TEST_CASE_ID, { limit: 10, offset: 0 });

      expect(result).toEqual(mockHistories);
      expect(mockPrismaTestCaseHistory.findMany).toHaveBeenCalledWith({
        where: { testCaseId: TEST_CASE_ID },
        include: expect.objectContaining({
          changedBy: expect.any(Object),
          agentSession: expect.any(Object),
        }),
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });
    });

    it('ページネーションが動作する', async () => {
      mockPrismaTestCaseHistory.findMany.mockResolvedValue([]);

      await repository.getHistories(TEST_CASE_ID, { limit: 20, offset: 40 });

      expect(mockPrismaTestCaseHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 40 })
      );
    });
  });

  describe('countHistories', () => {
    it('履歴件数を取得できる', async () => {
      mockPrismaTestCaseHistory.count.mockResolvedValue(15);

      const result = await repository.countHistories(TEST_CASE_ID);

      expect(result).toBe(15);
      expect(mockPrismaTestCaseHistory.count).toHaveBeenCalledWith({
        where: { testCaseId: TEST_CASE_ID },
      });
    });
  });
});
