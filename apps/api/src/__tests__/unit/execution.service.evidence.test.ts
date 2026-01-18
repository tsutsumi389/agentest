import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, BadRequestError } from '@agentest/shared';

// vi.hoistedを使用してモック関数を事前定義
const {
  mockFindById,
  mockFindByIdWithDetails,
  mockStorageUpload,
  mockStorageDelete,
  mockStorageGetDownloadUrl,
  mockExpectedResultFindFirst,
  mockEvidenceCreate,
  mockEvidenceDelete,
  mockEvidenceFindFirst,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindByIdWithDetails: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockStorageDelete: vi.fn(),
  mockStorageGetDownloadUrl: vi.fn(),
  mockExpectedResultFindFirst: vi.fn(),
  mockEvidenceCreate: vi.fn(),
  mockEvidenceDelete: vi.fn(),
  mockEvidenceFindFirst: vi.fn(),
}));

// ExecutionRepository のモック
vi.mock('../../repositories/execution.repository.js', () => ({
  ExecutionRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
    findByIdWithDetails: mockFindByIdWithDetails,
  })),
}));

// Storage のモック
vi.mock('@agentest/storage', () => ({
  createStorageClient: vi.fn().mockReturnValue({
    upload: mockStorageUpload,
    delete: mockStorageDelete,
    getDownloadUrl: mockStorageGetDownloadUrl,
  }),
}));

// prismaのモック
vi.mock('@agentest/db', () => ({
  prisma: {
    execution: {
      update: vi.fn(),
    },
    executionExpectedResult: {
      findFirst: mockExpectedResultFindFirst,
    },
    executionEvidence: {
      create: mockEvidenceCreate,
      delete: mockEvidenceDelete,
      findFirst: mockEvidenceFindFirst,
    },
  },
}));

// モック設定後にインポート
import { ExecutionService } from '../../services/execution.service.js';

// テスト用の固定ID
const TEST_EXECUTION_ID = '11111111-1111-1111-1111-111111111111';
const TEST_EXPECTED_RESULT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_EVIDENCE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_USER_ID = '44444444-4444-4444-4444-444444444444';

// モックファイルを作成するヘルパー
function createMockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test-screenshot.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('test file content'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
    ...overrides,
  };
}

// 標準的な実行データを作成するヘルパー
function createMockExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_EXECUTION_ID,
    testSuiteId: 'suite-1',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('ExecutionService - Evidence', () => {
  let service: ExecutionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExecutionService();
  });

  describe('uploadEvidence', () => {
    it('エビデンスをアップロードできる', async () => {
      const mockExecution = createMockExecution();
      const mockFile = createMockFile();
      const mockExpectedResult = {
        id: TEST_EXPECTED_RESULT_ID,
        executionId: TEST_EXECUTION_ID,
        evidences: [],
      };
      const mockEvidence = {
        id: TEST_EVIDENCE_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: mockFile.originalname,
        fileType: mockFile.mimetype,
        fileSize: BigInt(mockFile.size),
        description: 'Test description',
        uploadedByUserId: TEST_USER_ID,
      };

      mockFindById.mockResolvedValue(mockExecution);
      mockExpectedResultFindFirst.mockResolvedValue(mockExpectedResult);
      mockStorageUpload.mockResolvedValue({});
      mockEvidenceCreate.mockResolvedValue(mockEvidence);

      const result = await service.uploadEvidence(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        TEST_USER_ID,
        mockFile,
        'Test description'
      );

      expect(mockFindById).toHaveBeenCalledWith(TEST_EXECUTION_ID);
      expect(mockExpectedResultFindFirst).toHaveBeenCalledWith({
        where: { id: TEST_EXPECTED_RESULT_ID, executionId: TEST_EXECUTION_ID },
        include: { evidences: true },
      });
      expect(mockStorageUpload).toHaveBeenCalled();
      expect(mockEvidenceCreate).toHaveBeenCalled();
      expect(result).toEqual(mockEvidence);
    });

    it('実行が存在しない場合はNotFoundErrorを投げる', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        service.uploadEvidence(TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID, createMockFile())
      ).rejects.toThrow(NotFoundError);
    });

    it('期待結果が存在しない場合はNotFoundErrorを投げる', async () => {
      const mockExecution = createMockExecution();
      mockFindById.mockResolvedValue(mockExecution);
      mockExpectedResultFindFirst.mockResolvedValue(null);

      await expect(
        service.uploadEvidence(TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID, createMockFile())
      ).rejects.toThrow(NotFoundError);
      await expect(
        service.uploadEvidence(TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID, createMockFile())
      ).rejects.toThrow('ExecutionExpectedResult');
    });

    it('エビデンス上限（10件）に達している場合はBadRequestErrorを投げる', async () => {
      const mockExecution = createMockExecution();
      const mockExpectedResult = {
        id: TEST_EXPECTED_RESULT_ID,
        executionId: TEST_EXECUTION_ID,
        evidences: Array(10).fill({ id: 'evidence' }), // 10件のエビデンス
      };

      mockFindById.mockResolvedValue(mockExecution);
      mockExpectedResultFindFirst.mockResolvedValue(mockExpectedResult);

      await expect(
        service.uploadEvidence(TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID, createMockFile())
      ).rejects.toThrow(BadRequestError);
      await expect(
        service.uploadEvidence(TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID, createMockFile())
      ).rejects.toThrow('エビデンスの上限（10件）に達しています');
    });

    it('MinIOへのアップロードが正しいパスで行われる', async () => {
      const mockExecution = createMockExecution();
      const mockFile = createMockFile({ originalname: 'screenshot.png', mimetype: 'image/png' });
      const mockExpectedResult = {
        id: TEST_EXPECTED_RESULT_ID,
        executionId: TEST_EXECUTION_ID,
        evidences: [],
      };

      mockFindById.mockResolvedValue(mockExecution);
      mockExpectedResultFindFirst.mockResolvedValue(mockExpectedResult);
      mockStorageUpload.mockResolvedValue({});
      mockEvidenceCreate.mockResolvedValue({});

      await service.uploadEvidence(TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID, mockFile);

      expect(mockStorageUpload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^evidences/${TEST_EXECUTION_ID}/${TEST_EXPECTED_RESULT_ID}/.*_screenshot.png$`)),
        mockFile.buffer,
        { contentType: 'image/png' }
      );
    });
  });

  describe('deleteEvidence', () => {
    it('エビデンスを削除できる', async () => {
      const mockExecution = createMockExecution();
      const mockEvidence = {
        id: TEST_EVIDENCE_ID,
        fileUrl: `evidences/${TEST_EXECUTION_ID}/${TEST_EXPECTED_RESULT_ID}/uuid_test.png`,
        expectedResult: { executionId: TEST_EXECUTION_ID },
      };

      mockFindById.mockResolvedValue(mockExecution);
      mockEvidenceFindFirst.mockResolvedValue(mockEvidence);
      mockStorageDelete.mockResolvedValue(undefined);
      mockEvidenceDelete.mockResolvedValue(mockEvidence);

      await service.deleteEvidence(TEST_EXECUTION_ID, TEST_EVIDENCE_ID);

      expect(mockStorageDelete).toHaveBeenCalledWith(mockEvidence.fileUrl);
      expect(mockEvidenceDelete).toHaveBeenCalledWith({
        where: { id: TEST_EVIDENCE_ID },
      });
    });

    it('実行が存在しない場合はNotFoundErrorを投げる', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.deleteEvidence(TEST_EXECUTION_ID, TEST_EVIDENCE_ID)).rejects.toThrow(NotFoundError);
    });

    it('エビデンスが存在しない場合はNotFoundErrorを投げる', async () => {
      const mockExecution = createMockExecution();
      mockFindById.mockResolvedValue(mockExecution);
      mockEvidenceFindFirst.mockResolvedValue(null);

      await expect(service.deleteEvidence(TEST_EXECUTION_ID, TEST_EVIDENCE_ID)).rejects.toThrow(NotFoundError);
      await expect(service.deleteEvidence(TEST_EXECUTION_ID, TEST_EVIDENCE_ID)).rejects.toThrow('ExecutionEvidence');
    });
  });

  describe('getEvidenceDownloadUrl', () => {
    it('署名付きダウンロードURLを取得できる', async () => {
      const mockExecution = createMockExecution();
      const mockEvidence = {
        id: TEST_EVIDENCE_ID,
        fileUrl: `evidences/${TEST_EXECUTION_ID}/${TEST_EXPECTED_RESULT_ID}/uuid_test.png`,
      };
      const expectedUrl = 'https://minio.example.com/signed-url';

      mockFindById.mockResolvedValue(mockExecution);
      mockEvidenceFindFirst.mockResolvedValue(mockEvidence);
      mockStorageGetDownloadUrl.mockResolvedValue(expectedUrl);

      const result = await service.getEvidenceDownloadUrl(TEST_EXECUTION_ID, TEST_EVIDENCE_ID);

      expect(mockStorageGetDownloadUrl).toHaveBeenCalledWith(mockEvidence.fileUrl, { expiresIn: 3600 });
      expect(result).toBe(expectedUrl);
    });

    it('実行が存在しない場合はNotFoundErrorを投げる', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.getEvidenceDownloadUrl(TEST_EXECUTION_ID, TEST_EVIDENCE_ID)).rejects.toThrow(NotFoundError);
    });

    it('エビデンスが存在しない場合はNotFoundErrorを投げる', async () => {
      const mockExecution = createMockExecution();
      mockFindById.mockResolvedValue(mockExecution);
      mockEvidenceFindFirst.mockResolvedValue(null);

      await expect(service.getEvidenceDownloadUrl(TEST_EXECUTION_ID, TEST_EVIDENCE_ID)).rejects.toThrow(NotFoundError);
      await expect(service.getEvidenceDownloadUrl(TEST_EXECUTION_ID, TEST_EVIDENCE_ID)).rejects.toThrow(
        'ExecutionEvidence'
      );
    });

  });
});
