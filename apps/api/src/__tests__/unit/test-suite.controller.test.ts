import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { TestSuiteController } from '../../controllers/test-suite.controller.js';
import { NotFoundError } from '@agentest/shared';

// TestSuiteService のモック
const mockTestSuiteService = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  searchTestCases: vi.fn(),
  suggestTestCases: vi.fn(),
  reorderTestCases: vi.fn(),
  getPreconditions: vi.fn(),
  addPrecondition: vi.fn(),
  updatePrecondition: vi.fn(),
  deletePrecondition: vi.fn(),
  reorderPreconditions: vi.fn(),
  getExecutions: vi.fn(),
  startExecution: vi.fn(),
  getHistories: vi.fn(),
  restore: vi.fn(),
};

vi.mock('../../services/test-suite.service.js', () => ({
  TestSuiteService: vi.fn().mockImplementation(() => mockTestSuiteService),
}));

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_PRECONDITION_ID = '44444444-4444-4444-4444-444444444444';

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID, email: 'test@example.com' } as any,
  params: { testSuiteId: TEST_SUITE_ID },
  body: {},
  query: {},
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('TestSuiteController', () => {
  let controller: TestSuiteController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new TestSuiteController();
    mockNext = vi.fn();
  });

  describe('create', () => {
    it('テストスイートを作成できる', async () => {
      const mockSuite = { id: TEST_SUITE_ID, name: 'New Test Suite' };
      mockTestSuiteService.create.mockResolvedValue(mockSuite);

      const req = mockRequest({
        body: { projectId: TEST_PROJECT_ID, name: 'New Test Suite' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.create(req, res, mockNext);

      expect(mockTestSuiteService.create).toHaveBeenCalledWith(TEST_USER_ID, {
        projectId: TEST_PROJECT_ID,
        name: 'New Test Suite',
        status: 'DRAFT',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ testSuite: mockSuite });
    });
  });

  describe('getById', () => {
    it('テストスイート詳細を取得できる', async () => {
      const mockSuite = { id: TEST_SUITE_ID, name: 'Test Suite' };
      mockTestSuiteService.findById.mockResolvedValue(mockSuite);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockTestSuiteService.findById).toHaveBeenCalledWith(TEST_SUITE_ID);
      expect(res.json).toHaveBeenCalledWith({ testSuite: mockSuite });
    });

    it('エラーをnextに渡す', async () => {
      const error = new NotFoundError('TestSuite', TEST_SUITE_ID);
      mockTestSuiteService.findById.mockRejectedValue(error);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('update', () => {
    it('テストスイートを更新できる', async () => {
      const mockSuite = { id: TEST_SUITE_ID, name: 'Updated Suite' };
      mockTestSuiteService.update.mockResolvedValue(mockSuite);

      const req = mockRequest({
        body: { name: 'Updated Suite' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.update(req, res, mockNext);

      expect(mockTestSuiteService.update).toHaveBeenCalledWith(
        TEST_SUITE_ID,
        TEST_USER_ID,
        { name: 'Updated Suite' },
        { groupId: undefined }
      );
      expect(res.json).toHaveBeenCalledWith({ testSuite: mockSuite });
    });
  });

  describe('delete', () => {
    it('テストスイートを削除できる', async () => {
      mockTestSuiteService.softDelete.mockResolvedValue(undefined);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.delete(req, res, mockNext);

      expect(mockTestSuiteService.softDelete).toHaveBeenCalledWith(
        TEST_SUITE_ID,
        TEST_USER_ID,
        { groupId: undefined }
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getTestCases', () => {
    it('テストケース一覧を取得できる', async () => {
      const mockResult = {
        items: [{ id: 'case-1', title: 'Test Case' }],
        total: 1,
      };
      mockTestSuiteService.searchTestCases.mockResolvedValue(mockResult);

      const req = mockRequest({
        query: { limit: '10', offset: '0' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getTestCases(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          testCases: mockResult.items,
          total: 1,
        })
      );
    });
  });

  describe('suggestTestCases', () => {
    it('サジェストを取得できる', async () => {
      const mockSuggestions = [{ id: 'case-1', title: 'Test' }];
      mockTestSuiteService.suggestTestCases.mockResolvedValue(mockSuggestions);

      const req = mockRequest({
        query: { q: 'test' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.suggestTestCases(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({ suggestions: mockSuggestions });
    });
  });

  describe('reorderTestCases', () => {
    it('テストケースを並び替えできる', async () => {
      const caseIds = [
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
      ];
      const mockCases = caseIds.map((id, i) => ({ id, order: i }));
      mockTestSuiteService.reorderTestCases.mockResolvedValue(mockCases);

      const req = mockRequest({
        body: { testCaseIds: caseIds },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.reorderTestCases(req, res, mockNext);

      expect(mockTestSuiteService.reorderTestCases).toHaveBeenCalledWith(
        TEST_SUITE_ID,
        caseIds,
        TEST_USER_ID,
        { groupId: undefined }
      );
      expect(res.json).toHaveBeenCalledWith({ testCases: mockCases });
    });
  });

  describe('getPreconditions', () => {
    it('前提条件一覧を取得できる', async () => {
      const mockPreconditions = [{ id: TEST_PRECONDITION_ID, content: 'Precondition' }];
      mockTestSuiteService.getPreconditions.mockResolvedValue(mockPreconditions);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getPreconditions(req, res, mockNext);

      expect(mockTestSuiteService.getPreconditions).toHaveBeenCalledWith(TEST_SUITE_ID);
      expect(res.json).toHaveBeenCalledWith({ preconditions: mockPreconditions });
    });
  });

  describe('addPrecondition', () => {
    it('前提条件を追加できる', async () => {
      const mockPrecondition = { id: TEST_PRECONDITION_ID, content: 'New precondition' };
      mockTestSuiteService.addPrecondition.mockResolvedValue(mockPrecondition);

      const req = mockRequest({
        body: { content: 'New precondition' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.addPrecondition(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ precondition: mockPrecondition });
    });
  });

  describe('updatePrecondition', () => {
    it('前提条件を更新できる', async () => {
      const mockPrecondition = { id: TEST_PRECONDITION_ID, content: 'Updated' };
      mockTestSuiteService.updatePrecondition.mockResolvedValue(mockPrecondition);

      const req = mockRequest({
        params: { testSuiteId: TEST_SUITE_ID, preconditionId: TEST_PRECONDITION_ID },
        body: { content: 'Updated' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updatePrecondition(req, res, mockNext);

      expect(mockTestSuiteService.updatePrecondition).toHaveBeenCalledWith(
        TEST_SUITE_ID,
        TEST_PRECONDITION_ID,
        TEST_USER_ID,
        { content: 'Updated' },
        { groupId: undefined }
      );
      expect(res.json).toHaveBeenCalledWith({ precondition: mockPrecondition });
    });
  });

  describe('deletePrecondition', () => {
    it('前提条件を削除できる', async () => {
      mockTestSuiteService.deletePrecondition.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { testSuiteId: TEST_SUITE_ID, preconditionId: TEST_PRECONDITION_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deletePrecondition(req, res, mockNext);

      expect(mockTestSuiteService.deletePrecondition).toHaveBeenCalledWith(
        TEST_SUITE_ID,
        TEST_PRECONDITION_ID,
        TEST_USER_ID,
        { groupId: undefined }
      );
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('reorderPreconditions', () => {
    it('前提条件を並び替えできる', async () => {
      const precondIds = [
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      ];
      const mockPreconditions = precondIds.map((id, i) => ({ id, order: i }));
      mockTestSuiteService.reorderPreconditions.mockResolvedValue(mockPreconditions);

      const req = mockRequest({
        body: { preconditionIds: precondIds },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.reorderPreconditions(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({ preconditions: mockPreconditions });
    });
  });

  describe('getExecutions', () => {
    it('実行履歴を取得できる', async () => {
      const mockResult = {
        executions: [{ id: 'exec-1', status: 'COMPLETED' }],
        total: 1,
      };
      mockTestSuiteService.getExecutions.mockResolvedValue(mockResult);

      const req = mockRequest({
        query: { limit: '10', offset: '0' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getExecutions(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          executions: mockResult.executions,
          total: 1,
        })
      );
    });
  });

  describe('startExecution', () => {
    it('テスト実行を開始できる', async () => {
      const mockExecution = { id: 'exec-1', status: 'IN_PROGRESS' };
      const envId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      mockTestSuiteService.startExecution.mockResolvedValue(mockExecution);

      const req = mockRequest({
        body: { environmentId: envId },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.startExecution(req, res, mockNext);

      expect(mockTestSuiteService.startExecution).toHaveBeenCalledWith(
        TEST_SUITE_ID,
        TEST_USER_ID,
        { environmentId: envId }
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ execution: mockExecution });
    });
  });

  describe('getHistories', () => {
    it('変更履歴を取得できる', async () => {
      const mockResult = {
        items: [
          {
            groupId: null,
            categorizedHistories: {
              basicInfo: [{ id: 'history-1' }],
              preconditions: [],
            },
            createdAt: new Date(),
          },
        ],
        totalGroups: 1,
        total: 1,
      };
      mockTestSuiteService.getHistories.mockResolvedValue(mockResult);

      const req = mockRequest({
        query: { limit: '20', offset: '0' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getHistories(req, res, mockNext);

      expect(mockTestSuiteService.getHistories).toHaveBeenCalledWith(TEST_SUITE_ID, {
        limit: 20,
        offset: 0,
      });
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('restore', () => {
    it('削除済みテストスイートを復元できる', async () => {
      const mockSuite = { id: TEST_SUITE_ID, deletedAt: null };
      mockTestSuiteService.restore.mockResolvedValue(mockSuite);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.restore(req, res, mockNext);

      expect(mockTestSuiteService.restore).toHaveBeenCalledWith(
        TEST_SUITE_ID,
        TEST_USER_ID,
        { groupId: undefined }
      );
      expect(res.json).toHaveBeenCalledWith({ testSuite: mockSuite });
    });
  });
});
