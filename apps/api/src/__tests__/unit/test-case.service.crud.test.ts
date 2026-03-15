import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, AuthorizationError } from '@agentest/shared';

// Prismaモック（トランザクション対応）
const mockTx = vi.hoisted(() => ({
  testCase: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  testCaseHistory: { create: vi.fn() },
  testCasePrecondition: { createMany: vi.fn() },
  testCaseStep: { createMany: vi.fn() },
  testCaseExpectedResult: { createMany: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  testSuite: { findUnique: vi.fn() },
  testCase: { findFirst: vi.fn(), create: vi.fn() },
  organizationMember: { findUnique: vi.fn() },
  $transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

// TestCaseRepositoryモック
const mockTestCaseRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
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
  publishTestCaseUpdated: vi.fn(),
}));

import { TestCaseService } from '../../services/test-case.service.js';

// テスト用固定ID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_CASE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_PROJECT_ID = '44444444-4444-4444-4444-444444444444';

// テスト用テストケースモック
const createMockTestCase = (overrides = {}) => ({
  id: TEST_CASE_ID,
  testSuiteId: TEST_SUITE_ID,
  title: 'テストケース',
  description: 'テスト説明',
  priority: 'MEDIUM',
  status: 'DRAFT',
  orderKey: '00001',
  deletedAt: null,
  testSuite: { id: TEST_SUITE_ID, name: 'スイート', projectId: TEST_PROJECT_ID },
  createdByUser: { id: TEST_USER_ID, name: 'User', avatarUrl: null },
  preconditions: [],
  steps: [],
  expectedResults: [],
  ...overrides,
});

describe('TestCaseService（コアCRUD）', () => {
  let service: TestCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestCaseService();
  });

  describe('create', () => {
    const mockTestSuiteWithMember = {
      id: TEST_SUITE_ID,
      deletedAt: null,
      project: {
        id: TEST_PROJECT_ID,
        organizationId: null,
        members: [{ userId: TEST_USER_ID, role: 'WRITE' }],
      },
    };

    beforeEach(() => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuiteWithMember);
      mockPrisma.testCase.findFirst.mockResolvedValue(null); // orderKey計算用
    });

    it('テストケースを作成できる（子エンティティなし）', async () => {
      const mockCreated = { id: TEST_CASE_ID, title: '新ケース' };
      mockPrisma.testCase.create.mockResolvedValue(mockCreated);

      const result = await service.create(TEST_USER_ID, {
        testSuiteId: TEST_SUITE_ID,
        title: '新ケース',
      });

      expect(result).toEqual(mockCreated);
      expect(mockPrisma.testCase.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          testSuiteId: TEST_SUITE_ID,
          title: '新ケース',
          priority: 'MEDIUM',
          status: 'DRAFT',
          orderKey: '00001',
          createdByUserId: TEST_USER_ID,
        }),
      });
    });

    it('子エンティティ付きでトランザクション内作成できる', async () => {
      const mockCreated = { id: TEST_CASE_ID };
      mockTx.testCase.create.mockResolvedValue(mockCreated);
      mockTx.testCasePrecondition.createMany.mockResolvedValue({ count: 1 });
      mockTx.testCaseStep.createMany.mockResolvedValue({ count: 1 });
      mockTx.testCaseExpectedResult.createMany.mockResolvedValue({ count: 1 });
      mockTx.testCase.findUnique.mockResolvedValue(mockCreated);

      const result = await service.create(TEST_USER_ID, {
        testSuiteId: TEST_SUITE_ID,
        title: '新ケース',
        preconditions: [{ content: '前提1' }],
        steps: [{ content: 'ステップ1' }],
        expectedResults: [{ content: '期待結果1' }],
      });

      expect(result).toEqual(mockCreated);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockTx.testCasePrecondition.createMany).toHaveBeenCalled();
      expect(mockTx.testCaseStep.createMany).toHaveBeenCalled();
      expect(mockTx.testCaseExpectedResult.createMany).toHaveBeenCalled();
    });

    it('既存テストケースのorderKeyを考慮する', async () => {
      mockPrisma.testCase.findFirst.mockResolvedValue({ orderKey: '00003' });
      mockPrisma.testCase.create.mockResolvedValue({ id: TEST_CASE_ID });

      await service.create(TEST_USER_ID, {
        testSuiteId: TEST_SUITE_ID,
        title: 'ケース',
      });

      expect(mockPrisma.testCase.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ orderKey: '00004' }),
      });
    });

    it('テストスイートが存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(null);

      await expect(
        service.create(TEST_USER_ID, { testSuiteId: TEST_SUITE_ID, title: 'ケース' })
      ).rejects.toThrow(NotFoundError);
    });

    it('削除済みテストスイートの場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        ...mockTestSuiteWithMember,
        deletedAt: new Date(),
      });

      await expect(
        service.create(TEST_USER_ID, { testSuiteId: TEST_SUITE_ID, title: 'ケース' })
      ).rejects.toThrow(NotFoundError);
    });

    it('WRITE権限がない場合はAuthorizationErrorを投げる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: TEST_SUITE_ID,
        deletedAt: null,
        project: {
          id: TEST_PROJECT_ID,
          organizationId: null,
          members: [{ userId: TEST_USER_ID, role: 'READ' }],
        },
      });

      await expect(
        service.create(TEST_USER_ID, { testSuiteId: TEST_SUITE_ID, title: 'ケース' })
      ).rejects.toThrow(AuthorizationError);
    });

    it('プロジェクトメンバーでなく組織ADMIN/OWNERの場合は作成できる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: TEST_SUITE_ID,
        deletedAt: null,
        project: {
          id: TEST_PROJECT_ID,
          organizationId: 'org-1',
          members: [],
        },
      });
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        role: 'ADMIN',
      });
      mockPrisma.testCase.create.mockResolvedValue({ id: TEST_CASE_ID });

      const result = await service.create(TEST_USER_ID, {
        testSuiteId: TEST_SUITE_ID,
        title: 'ケース',
      });

      expect(result).toBeDefined();
    });
  });

  describe('findById', () => {
    it('テストケースを取得できる', async () => {
      const mockCase = createMockTestCase();
      mockTestCaseRepo.findById.mockResolvedValue(mockCase);

      const result = await service.findById(TEST_CASE_ID);

      expect(result).toEqual(mockCase);
    });

    it('存在しないテストケースはNotFoundErrorを投げる', async () => {
      mockTestCaseRepo.findById.mockResolvedValue(null);

      await expect(service.findById(TEST_CASE_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockTestCaseRepo.findById.mockResolvedValue(createMockTestCase());
    });

    it('テストケースを更新できる', async () => {
      const updated = { id: TEST_CASE_ID, title: '更新タイトル' };
      mockTx.testCaseHistory.create.mockResolvedValue({});
      mockTx.testCase.update.mockResolvedValue(updated);

      const result = await service.update(TEST_CASE_ID, TEST_USER_ID, { title: '更新タイトル' });

      expect(result).toEqual(updated);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('変更差分を履歴に記録する', async () => {
      mockTx.testCaseHistory.create.mockResolvedValue({});
      mockTx.testCase.update.mockResolvedValue({});

      await service.update(TEST_CASE_ID, TEST_USER_ID, { title: '新タイトル', priority: 'HIGH' });

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          testCaseId: TEST_CASE_ID,
          changedByUserId: TEST_USER_ID,
          changeType: 'UPDATE',
          snapshot: expect.objectContaining({
            changeDetail: {
              type: 'BASIC_INFO_UPDATE',
              fields: expect.objectContaining({
                title: { before: 'テストケース', after: '新タイトル' },
                priority: { before: 'MEDIUM', after: 'HIGH' },
              }),
            },
          }),
        }),
      });
    });

    it('変更がない場合は履歴を作成せず早期終了する', async () => {
      const result = await service.update(TEST_CASE_ID, TEST_USER_ID, {
        title: 'テストケース', // 同じ値
      });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(result.title).toBe('テストケース');
    });

    it('外部からgroupIdを指定できる', async () => {
      mockTx.testCaseHistory.create.mockResolvedValue({});
      mockTx.testCase.update.mockResolvedValue({});

      await service.update(TEST_CASE_ID, TEST_USER_ID, { title: '更新' }, 'custom-group-id');

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ groupId: 'custom-group-id' }),
      });
    });

    it('テストケースが存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestCaseRepo.findById.mockResolvedValue(null);

      await expect(service.update(TEST_CASE_ID, TEST_USER_ID, { title: '更新' })).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('softDelete', () => {
    beforeEach(() => {
      mockTestCaseRepo.findById.mockResolvedValue(createMockTestCase());
    });

    it('テストケースを論理削除できる', async () => {
      const deleted = { id: TEST_CASE_ID, deletedAt: new Date() };
      mockTx.testCaseHistory.create.mockResolvedValue({});
      mockTx.testCase.update.mockResolvedValue(deleted);

      const result = await service.softDelete(TEST_CASE_ID, TEST_USER_ID);

      expect(result).toEqual(deleted);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('DELETE履歴を作成する', async () => {
      mockTx.testCaseHistory.create.mockResolvedValue({});
      mockTx.testCase.update.mockResolvedValue({});

      await service.softDelete(TEST_CASE_ID, TEST_USER_ID);

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          testCaseId: TEST_CASE_ID,
          changedByUserId: TEST_USER_ID,
          changeType: 'DELETE',
          snapshot: expect.any(Object),
        }),
      });
    });

    it('テストケースが存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestCaseRepo.findById.mockResolvedValue(null);

      await expect(service.softDelete(TEST_CASE_ID, TEST_USER_ID)).rejects.toThrow(NotFoundError);
    });
  });
});
