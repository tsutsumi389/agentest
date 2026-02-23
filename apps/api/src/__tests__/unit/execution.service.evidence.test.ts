import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as UploadConfig from '../../config/upload.js';
import { NotFoundError, BadRequestError } from '@agentest/shared';

// vi.hoistedを使用してモック関数を事前定義
const {
  mockFindById,
  mockFindByIdWithDetails,
  mockStorageUpload,
  mockStorageDelete,
  mockStorageGetDownloadUrl,
  mockStorageGetMetadata,
  mockPublicStorageGetUploadUrl,
  mockExpectedResultFindFirst,
  mockEvidenceCreate,
  mockEvidenceDelete,
  mockEvidenceFindFirst,
  mockEvidenceUpdate,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindByIdWithDetails: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockStorageDelete: vi.fn(),
  mockStorageGetDownloadUrl: vi.fn(),
  mockStorageGetMetadata: vi.fn(),
  mockPublicStorageGetUploadUrl: vi.fn(),
  mockExpectedResultFindFirst: vi.fn(),
  mockEvidenceCreate: vi.fn(),
  mockEvidenceDelete: vi.fn(),
  mockEvidenceFindFirst: vi.fn(),
  mockEvidenceUpdate: vi.fn(),
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
    getMetadata: mockStorageGetMetadata,
  }),
  createPublicStorageClient: vi.fn().mockReturnValue({
    getUploadUrl: mockPublicStorageGetUploadUrl,
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
      update: mockEvidenceUpdate,
    },
  },
}));

// validateMagicBytes のモック
vi.mock('../../config/upload.js', async (importOriginal) => {
  const original = await importOriginal<typeof UploadConfig>();
  return {
    ...original,
    validateMagicBytes: vi.fn().mockResolvedValue(undefined),
  };
});

// モック設定後にインポート
import { ExecutionService } from '../../services/execution.service.js';
import { validateMagicBytes } from '../../config/upload.js';

const mockValidateMagicBytes = vi.mocked(validateMagicBytes);

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

    it('マジックバイト検証に失敗した場合はBadRequestErrorを投げる', async () => {
      const mockExecution = createMockExecution();
      const mockFile = createMockFile();
      const mockExpectedResult = {
        id: TEST_EXPECTED_RESULT_ID,
        executionId: TEST_EXECUTION_ID,
        evidences: [],
      };

      mockFindById.mockResolvedValue(mockExecution);
      mockExpectedResultFindFirst.mockResolvedValue(mockExpectedResult);
      mockValidateMagicBytes.mockRejectedValueOnce(
        new BadRequestError('ファイルの内容が宣言されたMIMEタイプと一致しません')
      );

      await expect(
        service.uploadEvidence(TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID, mockFile)
      ).rejects.toThrow(BadRequestError);

      // ストレージにはアップロードされていないことを確認
      expect(mockStorageUpload).not.toHaveBeenCalled();
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

  describe('createEvidenceUploadUrl', () => {
    it('presigned URLとevidenceIdを返す', async () => {
      const mockExecution = createMockExecution();
      const mockExpectedResult = {
        id: TEST_EXPECTED_RESULT_ID,
        executionId: TEST_EXECUTION_ID,
        evidences: [],
      };
      const mockEvidence = {
        id: TEST_EVIDENCE_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
      };

      mockFindById.mockResolvedValue(mockExecution);
      mockExpectedResultFindFirst.mockResolvedValue(mockExpectedResult);
      mockPublicStorageGetUploadUrl.mockResolvedValue('https://minio.example.com/presigned-url');
      mockEvidenceCreate.mockResolvedValue(mockEvidence);

      const result = await service.createEvidenceUploadUrl(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        TEST_USER_ID,
        { fileName: 'screenshot.png', fileType: 'image/png', description: 'テスト' }
      );

      expect(result.evidenceId).toBe(TEST_EVIDENCE_ID);
      expect(result.uploadUrl).toBe('https://minio.example.com/presigned-url');
      expect(mockPublicStorageGetUploadUrl).toHaveBeenCalledWith(
        expect.stringMatching(/^evidences\//),
        { expiresIn: 300, contentType: 'image/png' }
      );
      expect(mockEvidenceCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expectedResultId: TEST_EXPECTED_RESULT_ID,
          fileName: 'screenshot.png',
          fileType: 'image/png',
          fileSize: BigInt(0),
          description: 'テスト',
          uploadedByUserId: TEST_USER_ID,
        }),
      });
    });

    it('実行が存在しない場合はNotFoundErrorを投げる', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        service.createEvidenceUploadUrl(TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID, {
          fileName: 'test.png',
          fileType: 'image/png',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('期待結果が存在しない場合はNotFoundErrorを投げる', async () => {
      mockFindById.mockResolvedValue(createMockExecution());
      mockExpectedResultFindFirst.mockResolvedValue(null);

      await expect(
        service.createEvidenceUploadUrl(TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID, {
          fileName: 'test.png',
          fileType: 'image/png',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('許可されていないMIMEタイプはBadRequestErrorを投げる', async () => {
      mockFindById.mockResolvedValue(createMockExecution());
      mockExpectedResultFindFirst.mockResolvedValue({
        id: TEST_EXPECTED_RESULT_ID,
        executionId: TEST_EXECUTION_ID,
        evidences: [],
      });

      await expect(
        service.createEvidenceUploadUrl(TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID, {
          fileName: 'malware.exe',
          fileType: 'application/x-executable',
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('エビデンス上限（アクティブカウント）に達している場合はBadRequestErrorを投げる', async () => {
      mockFindById.mockResolvedValue(createMockExecution());
      const recentDate = new Date();
      mockExpectedResultFindFirst.mockResolvedValue({
        id: TEST_EXPECTED_RESULT_ID,
        executionId: TEST_EXECUTION_ID,
        evidences: Array(10).fill({ id: 'e', fileSize: BigInt(100), createdAt: recentDate }),
      });

      await expect(
        service.createEvidenceUploadUrl(TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID, {
          fileName: 'test.png',
          fileType: 'image/png',
        })
      ).rejects.toThrow('エビデンスの上限');
    });

    it('古いPENDINGレコード（10分超）はカウントから除外する', async () => {
      mockFindById.mockResolvedValue(createMockExecution());
      // 15分前の fileSize:0 レコードが10件 → orphanなのでカウントされない
      const oldDate = new Date(Date.now() - 15 * 60 * 1000);
      mockExpectedResultFindFirst.mockResolvedValue({
        id: TEST_EXPECTED_RESULT_ID,
        executionId: TEST_EXECUTION_ID,
        evidences: Array(10).fill({ id: 'e', fileSize: BigInt(0), createdAt: oldDate }),
      });
      mockPublicStorageGetUploadUrl.mockResolvedValue('https://presigned-url');
      mockEvidenceCreate.mockResolvedValue({ id: TEST_EVIDENCE_ID });

      // エラーにならずに成功する
      const result = await service.createEvidenceUploadUrl(
        TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID,
        { fileName: 'test.png', fileType: 'image/png' }
      );

      expect(result.evidenceId).toBe(TEST_EVIDENCE_ID);
    });

    it('ファイル名をサニタイズしてS3キーに使用する', async () => {
      mockFindById.mockResolvedValue(createMockExecution());
      mockExpectedResultFindFirst.mockResolvedValue({
        id: TEST_EXPECTED_RESULT_ID,
        executionId: TEST_EXECUTION_ID,
        evidences: [],
      });
      mockPublicStorageGetUploadUrl.mockResolvedValue('https://presigned-url');
      mockEvidenceCreate.mockResolvedValue({ id: TEST_EVIDENCE_ID });

      await service.createEvidenceUploadUrl(
        TEST_EXECUTION_ID, TEST_EXPECTED_RESULT_ID, TEST_USER_ID,
        { fileName: '../../../etc/passwd', fileType: 'image/png' }
      );

      // サニタイズされたファイル名がS3キーに含まれること（パス区切り文字が除去されている）
      const callArgs = mockPublicStorageGetUploadUrl.mock.calls[0];
      const s3Key = callArgs[0] as string;
      // S3キーのフォーマット: evidences/{executionId}/{expectedResultId}/{UUID}_{sanitizedFileName}
      expect(s3Key).toMatch(/^evidences\//);
      // ファイル名部分にスラッシュが含まれないこと
      const fileNamePart = s3Key.split('/').pop()!;
      expect(fileNamePart).not.toContain('/');
      expect(fileNamePart).not.toContain('\\');
    });
  });

  describe('confirmEvidenceUpload', () => {
    it('S3メタデータからファイルサイズを取得して更新する', async () => {
      mockFindById.mockResolvedValue(createMockExecution());
      mockEvidenceFindFirst.mockResolvedValue({
        id: TEST_EVIDENCE_ID,
        fileUrl: 'evidences/xxx/yyy/uuid_test.png',
        expectedResult: { executionId: TEST_EXECUTION_ID },
      });
      mockStorageGetMetadata.mockResolvedValue({
        contentLength: 12345,
        contentType: 'image/png',
      });
      mockEvidenceUpdate.mockResolvedValue({
        id: TEST_EVIDENCE_ID,
        fileSize: BigInt(12345),
      });

      const result = await service.confirmEvidenceUpload(
        TEST_EXECUTION_ID,
        TEST_EVIDENCE_ID,
        TEST_USER_ID
      );

      expect(result.fileSize).toBe(12345);
      expect(mockStorageGetMetadata).toHaveBeenCalledWith('evidences/xxx/yyy/uuid_test.png');
      expect(mockEvidenceUpdate).toHaveBeenCalledWith({
        where: { id: TEST_EVIDENCE_ID },
        data: { fileSize: BigInt(12345) },
      });
    });

    it('実行が存在しない場合はNotFoundErrorを投げる', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        service.confirmEvidenceUpload(TEST_EXECUTION_ID, TEST_EVIDENCE_ID, TEST_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('エビデンスが存在しない場合はNotFoundErrorを投げる', async () => {
      mockFindById.mockResolvedValue(createMockExecution());
      mockEvidenceFindFirst.mockResolvedValue(null);

      await expect(
        service.confirmEvidenceUpload(TEST_EXECUTION_ID, TEST_EVIDENCE_ID, TEST_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('S3にファイルが存在しない場合はBadRequestErrorを投げる', async () => {
      mockFindById.mockResolvedValue(createMockExecution());
      mockEvidenceFindFirst.mockResolvedValue({
        id: TEST_EVIDENCE_ID,
        fileUrl: 'evidences/xxx/yyy/uuid_test.png',
        expectedResult: { executionId: TEST_EXECUTION_ID },
      });
      mockStorageGetMetadata.mockResolvedValue(null);

      await expect(
        service.confirmEvidenceUpload(TEST_EXECUTION_ID, TEST_EVIDENCE_ID, TEST_USER_ID)
      ).rejects.toThrow(BadRequestError);
    });
  });
});
