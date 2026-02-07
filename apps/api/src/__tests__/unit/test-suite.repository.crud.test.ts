import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prismaモック
const mockPrismaTestSuite = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
}));

const mockPrismaTestSuiteHistory = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    testSuite: mockPrismaTestSuite,
    testSuiteHistory: mockPrismaTestSuiteHistory,
  },
}));

import { TestSuiteRepository } from '../../repositories/test-suite.repository.js';

// テスト用固定ID
const TEST_SUITE_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';

describe('TestSuiteRepository（コアCRUD）', () => {
  let repository: TestSuiteRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TestSuiteRepository();
  });

  describe('findById', () => {
    it('削除されていないテストスイートを取得できる', async () => {
      const mockSuite = { id: TEST_SUITE_ID, name: 'テストスイート', deletedAt: null };
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSuite);

      const result = await repository.findById(TEST_SUITE_ID);

      expect(result).toEqual(mockSuite);
      expect(mockPrismaTestSuite.findFirst).toHaveBeenCalledWith({
        where: { id: TEST_SUITE_ID, deletedAt: null },
        include: expect.objectContaining({
          project: expect.any(Object),
          createdByUser: expect.any(Object),
          _count: expect.any(Object),
        }),
      });
    });

    it('存在しないテストスイートはnullを返す', async () => {
      mockPrismaTestSuite.findFirst.mockResolvedValue(null);

      const result = await repository.findById(TEST_SUITE_ID);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('テストスイートを更新できる', async () => {
      const updated = { id: TEST_SUITE_ID, name: '更新名' };
      mockPrismaTestSuite.update.mockResolvedValue(updated);

      const result = await repository.update(TEST_SUITE_ID, { name: '更新名' });

      expect(result).toEqual(updated);
      expect(mockPrismaTestSuite.update).toHaveBeenCalledWith({
        where: { id: TEST_SUITE_ID },
        data: { name: '更新名' },
      });
    });

    it('複数フィールドを同時に更新できる', async () => {
      mockPrismaTestSuite.update.mockResolvedValue({ id: TEST_SUITE_ID });

      await repository.update(TEST_SUITE_ID, {
        name: '新名前',
        description: '新説明',
        status: 'ACTIVE',
      });

      expect(mockPrismaTestSuite.update).toHaveBeenCalledWith({
        where: { id: TEST_SUITE_ID },
        data: { name: '新名前', description: '新説明', status: 'ACTIVE' },
      });
    });
  });

  describe('softDelete', () => {
    it('deletedAtを設定して論理削除する', async () => {
      mockPrismaTestSuite.update.mockResolvedValue({ id: TEST_SUITE_ID });

      await repository.softDelete(TEST_SUITE_ID);

      expect(mockPrismaTestSuite.update).toHaveBeenCalledWith({
        where: { id: TEST_SUITE_ID },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('suggest', () => {
    it('キーワードなしで候補を取得できる', async () => {
      const mockResults = [{ id: TEST_SUITE_ID, name: 'Suite' }];
      mockPrismaTestSuite.findMany.mockResolvedValue(mockResults);

      const result = await repository.suggest(TEST_PROJECT_ID, { limit: 10 });

      expect(result).toEqual(mockResults);
      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith({
        where: { projectId: TEST_PROJECT_ID, deletedAt: null },
        select: { id: true, name: true, description: true, status: true },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        take: 10,
      });
    });

    it('キーワード指定時はOR検索条件を追加する', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([]);

      await repository.suggest(TEST_PROJECT_ID, { q: 'keyword', limit: 5 });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'keyword', mode: 'insensitive' } },
              { description: { contains: 'keyword', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });
  });

  describe('findDeletedById', () => {
    it('削除済みテストスイートを取得できる', async () => {
      const mockDeleted = { id: TEST_SUITE_ID, deletedAt: new Date() };
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockDeleted);

      const result = await repository.findDeletedById(TEST_SUITE_ID);

      expect(result).toEqual(mockDeleted);
      expect(mockPrismaTestSuite.findFirst).toHaveBeenCalledWith({
        where: { id: TEST_SUITE_ID, deletedAt: { not: null } },
        include: expect.any(Object),
      });
    });
  });

  describe('restore', () => {
    it('deletedAtをnullに設定して復元する', async () => {
      mockPrismaTestSuite.update.mockResolvedValue({ id: TEST_SUITE_ID, deletedAt: null });

      await repository.restore(TEST_SUITE_ID);

      expect(mockPrismaTestSuite.update).toHaveBeenCalledWith({
        where: { id: TEST_SUITE_ID },
        data: { deletedAt: null },
      });
    });
  });

  describe('getHistories', () => {
    it('履歴一覧を新しい順で取得できる', async () => {
      const mockHistories = [{ id: 'h1', changeType: 'UPDATE' }];
      mockPrismaTestSuiteHistory.findMany.mockResolvedValue(mockHistories);

      const result = await repository.getHistories(TEST_SUITE_ID, { limit: 10, offset: 0 });

      expect(result).toEqual(mockHistories);
      expect(mockPrismaTestSuiteHistory.findMany).toHaveBeenCalledWith({
        where: { testSuiteId: TEST_SUITE_ID },
        include: expect.objectContaining({
          changedBy: expect.any(Object),
          agentSession: expect.any(Object),
        }),
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });
    });
  });

  describe('countHistories', () => {
    it('履歴件数を取得できる', async () => {
      mockPrismaTestSuiteHistory.count.mockResolvedValue(8);

      const result = await repository.countHistories(TEST_SUITE_ID);

      expect(result).toBe(8);
      expect(mockPrismaTestSuiteHistory.count).toHaveBeenCalledWith({
        where: { testSuiteId: TEST_SUITE_ID },
      });
    });
  });
});
