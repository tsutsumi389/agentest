import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ExecutionController } from '../../controllers/execution.controller.js';
import { BadRequestError, NotFoundError } from '@agentest/shared';

// ExecutionService のモック
const mockExecutionService = {
  findById: vi.fn(),
  findByIdWithDetails: vi.fn(),
  abort: vi.fn(),
  complete: vi.fn(),
  updatePreconditionResult: vi.fn(),
  updateStepResult: vi.fn(),
  updateExpectedResult: vi.fn(),
  uploadEvidence: vi.fn(),
  deleteEvidence: vi.fn(),
  getEvidenceDownloadUrl: vi.fn(),
};

vi.mock('../../services/execution.service.js', () => ({
  ExecutionService: vi.fn().mockImplementation(() => mockExecutionService),
}));

// upload configのモック
vi.mock('../../config/upload.js', () => ({
  evidenceUpload: {
    single: vi.fn().mockReturnValue(vi.fn()),
  },
}));

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_EXECUTION_ID = '22222222-2222-2222-2222-222222222222';
const TEST_PRECOND_RESULT_ID = '33333333-3333-3333-3333-333333333333';
const TEST_STEP_RESULT_ID = '44444444-4444-4444-4444-444444444444';
const TEST_EXPECTED_RESULT_ID = '55555555-5555-5555-5555-555555555555';
const TEST_EVIDENCE_ID = '66666666-6666-6666-6666-666666666666';

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID, email: 'test@example.com' } as any,
  params: { executionId: TEST_EXECUTION_ID },
  body: {},
  query: {},
  file: undefined,
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('ExecutionController', () => {
  let controller: ExecutionController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ExecutionController();
    mockNext = vi.fn();
  });

  describe('getById', () => {
    it('実行詳細（軽量版）を取得できる', async () => {
      const mockExecution = { id: TEST_EXECUTION_ID, status: 'IN_PROGRESS' };
      mockExecutionService.findById.mockResolvedValue(mockExecution);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockExecutionService.findById).toHaveBeenCalledWith(TEST_EXECUTION_ID);
      expect(res.json).toHaveBeenCalledWith({ execution: mockExecution });
    });

    it('エラーをnextに渡す', async () => {
      const error = new NotFoundError('Execution', TEST_EXECUTION_ID);
      mockExecutionService.findById.mockRejectedValue(error);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getByIdWithDetails', () => {
    it('実行詳細（全データ）を取得できる', async () => {
      const mockExecution = {
        id: TEST_EXECUTION_ID,
        status: 'IN_PROGRESS',
        executionTestSuite: {},
        preconditionResults: [],
        stepResults: [],
        expectedResults: [],
      };
      mockExecutionService.findByIdWithDetails.mockResolvedValue(mockExecution);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getByIdWithDetails(req, res, mockNext);

      expect(mockExecutionService.findByIdWithDetails).toHaveBeenCalledWith(TEST_EXECUTION_ID);
      expect(res.json).toHaveBeenCalledWith({ execution: mockExecution });
    });
  });

  describe('abort', () => {
    it('実行を中止できる', async () => {
      const mockExecution = { id: TEST_EXECUTION_ID, status: 'ABORTED' };
      mockExecutionService.abort.mockResolvedValue(mockExecution);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.abort(req, res, mockNext);

      expect(mockExecutionService.abort).toHaveBeenCalledWith(TEST_EXECUTION_ID);
      expect(res.json).toHaveBeenCalledWith({ execution: mockExecution });
    });
  });

  describe('complete', () => {
    it('実行を完了できる', async () => {
      const mockExecution = { id: TEST_EXECUTION_ID, status: 'COMPLETED' };
      mockExecutionService.complete.mockResolvedValue(mockExecution);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.complete(req, res, mockNext);

      expect(mockExecutionService.complete).toHaveBeenCalledWith(TEST_EXECUTION_ID);
      expect(res.json).toHaveBeenCalledWith({ execution: mockExecution });
    });
  });

  describe('updatePreconditionResult', () => {
    it('前提条件結果を更新できる', async () => {
      const mockResult = { id: TEST_PRECOND_RESULT_ID, status: 'MET' };
      mockExecutionService.updatePreconditionResult.mockResolvedValue(mockResult);

      const req = mockRequest({
        params: { executionId: TEST_EXECUTION_ID, preconditionResultId: TEST_PRECOND_RESULT_ID },
        body: { status: 'MET', note: 'All conditions met' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updatePreconditionResult(req, res, mockNext);

      expect(mockExecutionService.updatePreconditionResult).toHaveBeenCalledWith(
        TEST_EXECUTION_ID,
        TEST_PRECOND_RESULT_ID,
        { status: 'MET', note: 'All conditions met' }
      );
      expect(res.json).toHaveBeenCalledWith({ result: mockResult });
    });
  });

  describe('updateStepResult', () => {
    it('ステップ結果を更新できる', async () => {
      const mockResult = { id: TEST_STEP_RESULT_ID, status: 'DONE' };
      mockExecutionService.updateStepResult.mockResolvedValue(mockResult);

      const req = mockRequest({
        params: { executionId: TEST_EXECUTION_ID, stepResultId: TEST_STEP_RESULT_ID },
        body: { status: 'DONE' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateStepResult(req, res, mockNext);

      expect(mockExecutionService.updateStepResult).toHaveBeenCalledWith(
        TEST_EXECUTION_ID,
        TEST_STEP_RESULT_ID,
        { status: 'DONE' }
      );
      expect(res.json).toHaveBeenCalledWith({ result: mockResult });
    });
  });

  describe('updateExpectedResult', () => {
    it('期待結果を更新できる', async () => {
      const mockResult = { id: TEST_EXPECTED_RESULT_ID, status: 'PASS' };
      mockExecutionService.updateExpectedResult.mockResolvedValue(mockResult);

      const req = mockRequest({
        params: { executionId: TEST_EXECUTION_ID, expectedResultId: TEST_EXPECTED_RESULT_ID },
        body: { status: 'PASS', note: 'Test passed successfully' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateExpectedResult(req, res, mockNext);

      expect(mockExecutionService.updateExpectedResult).toHaveBeenCalledWith(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        { status: 'PASS', note: 'Test passed successfully' }
      );
      expect(res.json).toHaveBeenCalledWith({ result: mockResult });
    });
  });

  describe('uploadEvidence', () => {
    it('エビデンスをアップロードできる', async () => {
      const mockEvidence = {
        id: TEST_EVIDENCE_ID,
        fileName: 'screenshot.png',
        fileSize: BigInt(1024),
      };
      mockExecutionService.uploadEvidence.mockResolvedValue(mockEvidence);

      const mockFile = {
        originalname: 'screenshot.png',
        buffer: Buffer.from('test'),
        mimetype: 'image/png',
        size: 1024,
      };

      const req = mockRequest({
        params: { executionId: TEST_EXECUTION_ID, expectedResultId: TEST_EXPECTED_RESULT_ID },
        file: mockFile,
        body: { description: 'Screenshot of result' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.uploadEvidence(req, res, mockNext);

      expect(mockExecutionService.uploadEvidence).toHaveBeenCalledWith(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        TEST_USER_ID,
        mockFile,
        'Screenshot of result'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        evidence: {
          ...mockEvidence,
          fileSize: 1024, // BigIntをnumberに変換
        },
      });
    });

    it('ファイルがない場合BadRequestError', async () => {
      const req = mockRequest({
        params: { executionId: TEST_EXECUTION_ID, expectedResultId: TEST_EXPECTED_RESULT_ID },
        file: undefined,
      }) as Request;
      const res = mockResponse() as Response;

      await controller.uploadEvidence(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('deleteEvidence', () => {
    it('エビデンスを削除できる', async () => {
      mockExecutionService.deleteEvidence.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { executionId: TEST_EXECUTION_ID, evidenceId: TEST_EVIDENCE_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deleteEvidence(req, res, mockNext);

      expect(mockExecutionService.deleteEvidence).toHaveBeenCalledWith(
        TEST_EXECUTION_ID,
        TEST_EVIDENCE_ID
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getEvidenceDownloadUrl', () => {
    it('ダウンロードURLを取得できる', async () => {
      const mockUrl = 'https://storage.example.com/evidence/screenshot.png';
      mockExecutionService.getEvidenceDownloadUrl.mockResolvedValue(mockUrl);

      const req = mockRequest({
        params: { executionId: TEST_EXECUTION_ID, evidenceId: TEST_EVIDENCE_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getEvidenceDownloadUrl(req, res, mockNext);

      expect(mockExecutionService.getEvidenceDownloadUrl).toHaveBeenCalledWith(
        TEST_EXECUTION_ID,
        TEST_EVIDENCE_ID
      );
      expect(res.json).toHaveBeenCalledWith({ downloadUrl: mockUrl });
    });
  });
});
