import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError } from '@agentest/shared';

// Prismaモック
const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  testSuite: { create: vi.fn() },
  testSuiteHistory: { create: vi.fn() },
  testCase: { findMany: vi.fn() },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

// TestSuiteRepositoryモック
const mockTestSuiteRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  suggest: vi.fn(),
  search: vi.fn(),
}));

vi.mock('../../repositories/test-suite.repository.js', () => ({
  TestSuiteRepository: vi.fn().mockImplementation(() => mockTestSuiteRepo),
}));

// TestCaseRepositoryモック
const mockTestCaseRepo = vi.hoisted(() => ({
  search: vi.fn(),
  suggest: vi.fn(),
}));

vi.mock('../../repositories/test-case.repository.js', () => ({
  TestCaseRepository: vi.fn().mockImplementation(() => mockTestCaseRepo),
}));

// redis-publisherモック
vi.mock('../../lib/redis-publisher.js', () => ({
  publishDashboardUpdated: vi.fn(),
}));

// eventsモック
vi.mock('../../lib/events.js', () => ({
  publishTestSuiteUpdated: vi.fn(),
}));

import { TestSuiteService } from '../../services/test-suite.service.js';

// テスト用固定ID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_PROJECT_ID = '33333333-3333-3333-3333-333333333333';

// テスト用テストスイートモック
const createMockTestSuite = (overrides = {}) => ({
  id: TEST_SUITE_ID,
  projectId: TEST_PROJECT_ID,
  name: 'テストスイート',
  description: null,
  status: 'DRAFT',
  deletedAt: null,
  project: { id: TEST_PROJECT_ID, name: 'プロジェクト' },
  createdByUser: { id: TEST_USER_ID, name: 'User', avatarUrl: null },
  _count: { testCases: 0, preconditions: 0 },
  ...overrides,
});

describe('TestSuiteService（コアCRUD）', () => {
  let service: TestSuiteService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestSuiteService();
  });

  describe('create', () => {
    it('テストスイートを作成できる', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        deletedAt: null,
      });
      const mockSuite = { id: TEST_SUITE_ID, name: '新スイート', status: 'DRAFT' };
      mockPrisma.testSuite.create.mockResolvedValue(mockSuite);

      const result = await service.create(TEST_USER_ID, {
        projectId: TEST_PROJECT_ID,
        name: '新スイート',
      });

      expect(result).toEqual(mockSuite);
      expect(mockPrisma.testSuite.create).toHaveBeenCalledWith({
        data: {
          projectId: TEST_PROJECT_ID,
          name: '新スイート',
          description: undefined,
          status: 'DRAFT',
          createdByUserId: TEST_USER_ID,
        },
      });
    });

    it('ステータスを指定して作成できる', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: TEST_PROJECT_ID, deletedAt: null });
      mockPrisma.testSuite.create.mockResolvedValue({ id: TEST_SUITE_ID });

      await service.create(TEST_USER_ID, {
        projectId: TEST_PROJECT_ID,
        name: 'Suite',
        status: 'ACTIVE',
      });

      expect(mockPrisma.testSuite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACTIVE' }),
        })
      );
    });

    it('プロジェクトが存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.create(TEST_USER_ID, { projectId: TEST_PROJECT_ID, name: 'Suite' })
      ).rejects.toThrow(NotFoundError);
    });

    it('削除済みプロジェクトの場合はNotFoundErrorを投げる', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        deletedAt: new Date(),
      });

      await expect(
        service.create(TEST_USER_ID, { projectId: TEST_PROJECT_ID, name: 'Suite' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('findById', () => {
    it('テストスイートを取得できる', async () => {
      const mockSuite = createMockTestSuite();
      mockTestSuiteRepo.findById.mockResolvedValue(mockSuite);

      const result = await service.findById(TEST_SUITE_ID);

      expect(result).toEqual(mockSuite);
    });

    it('存在しないテストスイートはNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(null);

      await expect(service.findById(TEST_SUITE_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockTestSuiteRepo.findById.mockResolvedValue(createMockTestSuite());
    });

    it('テストスイートを更新できる', async () => {
      const updated = createMockTestSuite({ name: '更新名' });
      mockTestSuiteRepo.update.mockResolvedValue(updated);

      const result = await service.update(TEST_SUITE_ID, TEST_USER_ID, { name: '更新名' });

      expect(result).toEqual(updated);
      expect(mockPrisma.testSuiteHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          testSuiteId: TEST_SUITE_ID,
          changedByUserId: TEST_USER_ID,
          changeType: 'UPDATE',
          snapshot: expect.any(Object),
        }),
      });
    });

    it('変更差分を履歴に記録する', async () => {
      mockTestSuiteRepo.update.mockResolvedValue(createMockTestSuite());

      await service.update(TEST_SUITE_ID, TEST_USER_ID, { name: '新名前' });

      expect(mockPrisma.testSuiteHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: {
              type: 'BASIC_INFO_UPDATE',
              fields: expect.objectContaining({
                name: { before: 'テストスイート', after: '新名前' },
              }),
            },
          }),
        }),
      });
    });

    it('groupIdを指定できる', async () => {
      mockTestSuiteRepo.update.mockResolvedValue(createMockTestSuite());

      await service.update(TEST_SUITE_ID, TEST_USER_ID, { name: '更新' }, { groupId: 'group-1' });

      expect(mockPrisma.testSuiteHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ groupId: 'group-1' }),
      });
    });

    it('テストスイートが存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(null);

      await expect(
        service.update(TEST_SUITE_ID, TEST_USER_ID, { name: '更新' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('softDelete', () => {
    beforeEach(() => {
      mockTestSuiteRepo.findById.mockResolvedValue(createMockTestSuite());
    });

    it('テストスイートを論理削除できる', async () => {
      mockTestSuiteRepo.softDelete.mockResolvedValue({ id: TEST_SUITE_ID });

      await service.softDelete(TEST_SUITE_ID, TEST_USER_ID);

      expect(mockPrisma.testSuiteHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          testSuiteId: TEST_SUITE_ID,
          changedByUserId: TEST_USER_ID,
          changeType: 'DELETE',
        }),
      });
      expect(mockTestSuiteRepo.softDelete).toHaveBeenCalledWith(TEST_SUITE_ID);
    });

    it('テストスイートが存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(null);

      await expect(service.softDelete(TEST_SUITE_ID, TEST_USER_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getTestCases', () => {
    it('テストケース一覧を取得できる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(createMockTestSuite());
      const mockCases = [{ id: 'tc-1', title: 'ケース1' }];
      mockPrisma.testCase.findMany.mockResolvedValue(mockCases);

      const result = await service.getTestCases(TEST_SUITE_ID);

      expect(result).toEqual(mockCases);
      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith({
        where: { testSuiteId: TEST_SUITE_ID, deletedAt: null },
        include: {
          _count: { select: { preconditions: true, steps: true, expectedResults: true } },
        },
        orderBy: { orderKey: 'asc' },
      });
    });

    it('テストスイートが存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(null);

      await expect(service.getTestCases(TEST_SUITE_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('searchTestCases', () => {
    it('テストケースを検索できる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(createMockTestSuite());
      const mockResult = { items: [], total: 0 };
      mockTestCaseRepo.search.mockResolvedValue(mockResult);

      const options = {
        limit: 10,
        offset: 0,
        sortBy: 'title' as const,
        sortOrder: 'asc' as const,
        includeDeleted: false,
      };

      const result = await service.searchTestCases(TEST_SUITE_ID, options);

      expect(result).toEqual(mockResult);
      expect(mockTestCaseRepo.search).toHaveBeenCalledWith(TEST_SUITE_ID, options);
    });
  });

  describe('suggestTestCases', () => {
    it('テストケースのサジェストを取得できる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(createMockTestSuite());
      const mockSuggestions = [{ id: 'tc-1', title: 'ケース' }];
      mockTestCaseRepo.suggest.mockResolvedValue(mockSuggestions);

      const result = await service.suggestTestCases(TEST_SUITE_ID, { q: 'test', limit: 5 });

      expect(result).toEqual(mockSuggestions);
      expect(mockTestCaseRepo.suggest).toHaveBeenCalledWith(TEST_SUITE_ID, { q: 'test', limit: 5 });
    });
  });
});
