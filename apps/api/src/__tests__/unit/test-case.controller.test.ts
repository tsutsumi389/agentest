import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { TestCaseController } from '../../controllers/test-case.controller.js';
import { NotFoundError } from '@agentest/shared';

// TestCaseService のモック
const mockTestCaseService = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  getPreconditions: vi.fn(),
  addPrecondition: vi.fn(),
  updatePrecondition: vi.fn(),
  deletePrecondition: vi.fn(),
  reorderPreconditions: vi.fn(),
  getSteps: vi.fn(),
  addStep: vi.fn(),
  updateStep: vi.fn(),
  deleteStep: vi.fn(),
  reorderSteps: vi.fn(),
  getExpectedResults: vi.fn(),
  addExpectedResult: vi.fn(),
  updateExpectedResult: vi.fn(),
  deleteExpectedResult: vi.fn(),
  reorderExpectedResults: vi.fn(),
  copy: vi.fn(),
  getHistories: vi.fn(),
  restore: vi.fn(),
};

vi.mock('../../services/test-case.service.js', () => ({
  TestCaseService: vi.fn().mockImplementation(() => mockTestCaseService),
}));

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_CASE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_PRECONDITION_ID = '44444444-4444-4444-4444-444444444444';
const TEST_STEP_ID = '55555555-5555-5555-5555-555555555555';
const TEST_EXPECTED_ID = '66666666-6666-6666-6666-666666666666';

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID, email: 'test@example.com' } as any,
  params: { testCaseId: TEST_CASE_ID },
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

describe('TestCaseController', () => {
  let controller: TestCaseController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new TestCaseController();
    mockNext = vi.fn();
  });

  describe('create', () => {
    it('テストケースを作成できる', async () => {
      const mockCase = { id: TEST_CASE_ID, title: 'New Test Case' };
      mockTestCaseService.create.mockResolvedValue(mockCase);

      const req = mockRequest({
        body: { testSuiteId: TEST_SUITE_ID, title: 'New Test Case' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.create(req, res, mockNext);

      expect(mockTestCaseService.create).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining({
        testSuiteId: TEST_SUITE_ID,
        title: 'New Test Case',
      }));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ testCase: mockCase });
    });

    it('priority/statusのデフォルト値が設定される', async () => {
      mockTestCaseService.create.mockResolvedValue({ id: TEST_CASE_ID });

      const req = mockRequest({
        body: { testSuiteId: TEST_SUITE_ID, title: 'Test' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.create(req, res, mockNext);

      expect(mockTestCaseService.create).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining({
        priority: 'MEDIUM',
        status: 'DRAFT',
      }));
    });
  });

  describe('getById', () => {
    it('テストケース詳細を取得できる', async () => {
      const mockCase = { id: TEST_CASE_ID, title: 'Test Case' };
      mockTestCaseService.findById.mockResolvedValue(mockCase);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockTestCaseService.findById).toHaveBeenCalledWith(TEST_CASE_ID);
      expect(res.json).toHaveBeenCalledWith({ testCase: mockCase });
    });

    it('エラーをnextに渡す', async () => {
      const error = new NotFoundError('TestCase', TEST_CASE_ID);
      mockTestCaseService.findById.mockRejectedValue(error);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('update', () => {
    it('テストケースを更新できる', async () => {
      const mockCase = { id: TEST_CASE_ID, title: 'Updated' };
      mockTestCaseService.update.mockResolvedValue(mockCase);

      const req = mockRequest({
        body: { title: 'Updated' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.update(req, res, mockNext);

      expect(mockTestCaseService.update).toHaveBeenCalledWith(TEST_CASE_ID, TEST_USER_ID, { title: 'Updated' });
      expect(res.json).toHaveBeenCalledWith({ testCase: mockCase });
    });
  });

  describe('delete', () => {
    it('テストケースを削除できる', async () => {
      mockTestCaseService.softDelete.mockResolvedValue(undefined);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.delete(req, res, mockNext);

      expect(mockTestCaseService.softDelete).toHaveBeenCalledWith(TEST_CASE_ID, TEST_USER_ID);
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('Preconditions CRUD', () => {
    it('前提条件一覧を取得できる', async () => {
      const mockPreconditions = [{ id: TEST_PRECONDITION_ID }];
      mockTestCaseService.getPreconditions.mockResolvedValue(mockPreconditions);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getPreconditions(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({ preconditions: mockPreconditions });
    });

    it('前提条件を追加できる', async () => {
      const mockPrecondition = { id: TEST_PRECONDITION_ID, content: 'New' };
      mockTestCaseService.addPrecondition.mockResolvedValue(mockPrecondition);

      const req = mockRequest({
        body: { content: 'New' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.addPrecondition(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('前提条件を削除できる', async () => {
      mockTestCaseService.deletePrecondition.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { testCaseId: TEST_CASE_ID, preconditionId: TEST_PRECONDITION_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deletePrecondition(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('Steps CRUD', () => {
    it('ステップ一覧を取得できる', async () => {
      const mockSteps = [{ id: TEST_STEP_ID }];
      mockTestCaseService.getSteps.mockResolvedValue(mockSteps);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getSteps(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({ steps: mockSteps });
    });

    it('ステップを追加できる', async () => {
      const mockStep = { id: TEST_STEP_ID, content: 'Step 1' };
      mockTestCaseService.addStep.mockResolvedValue(mockStep);

      const req = mockRequest({
        body: { content: 'Step 1' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.addStep(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('ステップを削除できる', async () => {
      mockTestCaseService.deleteStep.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { testCaseId: TEST_CASE_ID, stepId: TEST_STEP_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deleteStep(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('ExpectedResults CRUD', () => {
    it('期待結果一覧を取得できる', async () => {
      const mockResults = [{ id: TEST_EXPECTED_ID }];
      mockTestCaseService.getExpectedResults.mockResolvedValue(mockResults);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getExpectedResults(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({ expectedResults: mockResults });
    });

    it('期待結果を追加できる', async () => {
      const mockResult = { id: TEST_EXPECTED_ID, content: 'Expected' };
      mockTestCaseService.addExpectedResult.mockResolvedValue(mockResult);

      const req = mockRequest({
        body: { content: 'Expected' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.addExpectedResult(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('期待結果を削除できる', async () => {
      mockTestCaseService.deleteExpectedResult.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { testCaseId: TEST_CASE_ID, expectedResultId: TEST_EXPECTED_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deleteExpectedResult(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('copy', () => {
    it('テストケースをコピーできる', async () => {
      const mockCase = { id: 'new-case-id', title: 'Copy of Test Case' };
      mockTestCaseService.copy.mockResolvedValue(mockCase);

      const req = mockRequest({
        body: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.copy(req, res, mockNext);

      expect(mockTestCaseService.copy).toHaveBeenCalledWith(TEST_CASE_ID, TEST_USER_ID, {});
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ testCase: mockCase });
    });

    it('targetTestSuiteIdを指定できる', async () => {
      const targetSuiteId = '77777777-7777-7777-7777-777777777777';
      mockTestCaseService.copy.mockResolvedValue({ id: 'new-case' });

      const req = mockRequest({
        body: { targetTestSuiteId: targetSuiteId },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.copy(req, res, mockNext);

      expect(mockTestCaseService.copy).toHaveBeenCalledWith(TEST_CASE_ID, TEST_USER_ID, {
        targetTestSuiteId: targetSuiteId,
      });
    });

    it('titleを指定できる', async () => {
      mockTestCaseService.copy.mockResolvedValue({ id: 'new-case' });

      const req = mockRequest({
        body: { title: 'Custom Title' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.copy(req, res, mockNext);

      expect(mockTestCaseService.copy).toHaveBeenCalledWith(TEST_CASE_ID, TEST_USER_ID, {
        title: 'Custom Title',
      });
    });
  });

  describe('getHistories', () => {
    it('履歴を取得できる', async () => {
      const mockResult = { histories: [{ id: 'h1' }], total: 1 };
      mockTestCaseService.getHistories.mockResolvedValue(mockResult);

      const req = mockRequest({
        query: { limit: '20', offset: '0' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getHistories(req, res, mockNext);

      expect(mockTestCaseService.getHistories).toHaveBeenCalledWith(TEST_CASE_ID, { limit: 20, offset: 0 });
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('restore', () => {
    it('削除済みテストケースを復元できる', async () => {
      const mockCase = { id: TEST_CASE_ID, deletedAt: null };
      mockTestCaseService.restore.mockResolvedValue(mockCase);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.restore(req, res, mockNext);

      expect(mockTestCaseService.restore).toHaveBeenCalledWith(TEST_CASE_ID, TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ testCase: mockCase });
    });
  });
});
