import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type * as UploadConfig from '../../config/upload.js';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestProjectMember,
  createTestEnvironment,
  createTestExecution,
  createTestSuite,
  createTestExecutionTestSuite,
  createTestExecutionTestCase,
  createTestExecutionTestCaseExpectedResult,
  createTestExecutionExpectedResult,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError } from '@agentest/shared';
import { createApp } from '../../app.js';

// グローバルな認証状態（モック用）
let mockAuthUser: { id: string; email: string } | null = null;
let mockExecutionRole: string | null = null;

// vi.hoistedを使用してモック関数を事前定義
const { mockStorageUpload, mockStorageDelete, mockStorageGetDownloadUrl, mockPublicStorageGetDownloadUrl } = vi.hoisted(() => ({
  mockStorageUpload: vi.fn().mockResolvedValue({ key: 'test-key', url: 'https://example.com/test', size: 1024 }),
  mockStorageDelete: vi.fn().mockResolvedValue(undefined),
  mockStorageGetDownloadUrl: vi.fn().mockResolvedValue('https://internal-minio:9000/signed-url'),
  mockPublicStorageGetDownloadUrl: vi.fn().mockResolvedValue('https://localhost:9002/signed-url'),
}));

vi.mock('@agentest/storage', () => ({
  createStorageClient: vi.fn().mockReturnValue({
    upload: mockStorageUpload,
    delete: mockStorageDelete,
    getDownloadUrl: mockStorageGetDownloadUrl,
  }),
  createPublicStorageClient: vi.fn().mockReturnValue({
    getDownloadUrl: mockPublicStorageGetDownloadUrl,
  }),
}));

// マジックバイト検証をモック（統合テストではストレージ層のテストに集中するため）
vi.mock('../../config/upload.js', async (importOriginal) => {
  const original = await importOriginal<typeof UploadConfig>();
  return {
    ...original,
    validateMagicBytes: vi.fn().mockResolvedValue(undefined),
  };
});

// 認証ミドルウェアをモック
vi.mock('@agentest/auth', () => ({
  requireAuth: () => (req: any, _res: any, next: any) => {
    if (!mockAuthUser) {
      return next(new AuthenticationError('認証が必要です'));
    }
    req.user = mockAuthUser;
    next();
  },
  optionalAuth: () => (_req: any, _res: any, next: any) => next(),
  requireOrgRole: () => (_req: any, _res: any, next: any) => next(),
  requireProjectRole: () => (_req: any, _res: any, next: any) => next(),
  authenticate: (_options: { optional?: boolean } = {}) => (req: any, _res: any, next: any) => { if (mockAuthUser) req.user = mockAuthUser; next(); },
  configurePassport: vi.fn(),
  passport: { initialize: vi.fn(), authenticate: vi.fn() },
  generateTokens: vi.fn(),
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  decodeToken: vi.fn(),
  getTokenExpiry: vi.fn(),
  createAuthConfig: vi.fn(),
  defaultAuthConfig: {},
}));

// Execution Role ミドルウェアをモック
vi.mock('../../middleware/require-execution-role.js', () => ({
  requireExecutionRole: (roles: string[], _options?: any) => (_req: any, _res: any, next: any) => {
    if (!mockExecutionRole || !roles.includes(mockExecutionRole)) {
      return next(new AuthorizationError('権限がありません'));
    }
    next();
  },
}));

// テスト用認証設定関数
function setTestAuth(user: { id: string; email: string } | null, executionRole: string | null = null) {
  mockAuthUser = user;
  mockExecutionRole = executionRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockExecutionRole = null;
}

describe('Execution Evidence API Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let writer: Awaited<ReturnType<typeof createTestUser>>;
  let reader: Awaited<ReturnType<typeof createTestUser>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let testSuite: Awaited<ReturnType<typeof createTestSuite>>;
  let environment: Awaited<ReturnType<typeof createTestEnvironment>>;
  let execution: Awaited<ReturnType<typeof createTestExecution>>;
  let expectedResult: any;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
    clearTestAuth();

    // テストユーザーを作成
    owner = await createTestUser({ email: 'owner@example.com', name: 'Owner' });
    writer = await createTestUser({ email: 'writer@example.com', name: 'Writer' });
    reader = await createTestUser({ email: 'reader@example.com', name: 'Reader' });

    // プロジェクトを作成
    project = await createTestProject(owner.id, {
      name: 'Test Project',
      description: 'Test description',
    });

    // メンバーを追加
    await createTestProjectMember(project.id, writer.id, 'WRITE');
    await createTestProjectMember(project.id, reader.id, 'READ');

    // テストスイートを作成
    testSuite = await createTestSuite(project.id, {
      name: 'Test Suite',
    });

    // 環境を作成
    environment = await createTestEnvironment(project.id, {
      name: 'Development',
      isDefault: true,
    });

    // 実行を作成
    execution = await createTestExecution(environment.id, testSuite.id);

    // 正規化テーブルを作成
    const execTestSuite = await createTestExecutionTestSuite(execution.id, testSuite.id, {
      name: testSuite.name,
    });
    const execTestCase = await createTestExecutionTestCase(execTestSuite.id, 'original-test-case-1', {
      title: 'Test Case 1',
    });
    const execExpectedResultSnapshot = await createTestExecutionTestCaseExpectedResult(
      execTestCase.id,
      'original-expected-result-1',
      { content: 'Expected Result 1' }
    );

    // 期待結果を作成
    expectedResult = await createTestExecutionExpectedResult(
      execution.id,
      execTestCase.id,
      execExpectedResultSnapshot.id,
      { status: 'PENDING' }
    );
  });

  describe('POST /api/executions/:executionId/expected-results/:expectedResultId/evidences', () => {
    it('エビデンスをアップロードできる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .post(`/api/executions/${execution.id}/expected-results/${expectedResult.id}/evidences`)
        .attach('file', Buffer.from('test file content'), {
          filename: 'screenshot.png',
          contentType: 'image/png',
        })
        .field('description', 'Test screenshot');

      expect(response.status).toBe(201);
      expect(response.body.evidence).toBeDefined();
      expect(response.body.evidence.fileName).toBe('screenshot.png');
      expect(response.body.evidence.fileType).toBe('image/png');
      expect(response.body.evidence.description).toBe('Test screenshot');
      expect(mockStorageUpload).toHaveBeenCalled();
    });

    it('ファイルなしの場合は400エラー', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .post(`/api/executions/${execution.id}/expected-results/${expectedResult.id}/evidences`)
        .field('description', 'No file');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('ファイルが指定されていません');
    });

    it('認証なしの場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .post(`/api/executions/${execution.id}/expected-results/${expectedResult.id}/evidences`)
        .attach('file', Buffer.from('test'), { filename: 'test.png', contentType: 'image/png' });

      expect(response.status).toBe(401);
    });

    it('READ権限のみでは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .post(`/api/executions/${execution.id}/expected-results/${expectedResult.id}/evidences`)
        .attach('file', Buffer.from('test'), { filename: 'test.png', contentType: 'image/png' });

      expect(response.status).toBe(403);
    });


    it('存在しない期待結果には404エラー', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .post(`/api/executions/${execution.id}/expected-results/non-existent-id/evidences`)
        .attach('file', Buffer.from('test'), { filename: 'test.png', contentType: 'image/png' });

      expect(response.status).toBe(404);
    });

    it('エビデンス上限（10件）に達している場合は400エラー', async () => {
      // 10件のエビデンスを作成
      for (let i = 0; i < 10; i++) {
        await prisma.executionEvidence.create({
          data: {
            expectedResultId: expectedResult.id,
            fileName: `file${i}.png`,
            fileUrl: `evidences/test/${i}.png`,
            fileType: 'image/png',
            fileSize: BigInt(1024),
            uploadedByUserId: owner.id,
          },
        });
      }

      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .post(`/api/executions/${execution.id}/expected-results/${expectedResult.id}/evidences`)
        .attach('file', Buffer.from('test'), { filename: 'test.png', contentType: 'image/png' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('エビデンスの上限');
    });
  });

  describe('DELETE /api/executions/:executionId/evidences/:evidenceId', () => {
    let evidence: any;

    beforeEach(async () => {
      evidence = await prisma.executionEvidence.create({
        data: {
          expectedResultId: expectedResult.id,
          fileName: 'test.png',
          fileUrl: 'evidences/test.png',
          fileType: 'image/png',
          fileSize: BigInt(1024),
          uploadedByUserId: owner.id,
        },
      });
    });

    it('エビデンスを削除できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app).delete(`/api/executions/${execution.id}/evidences/${evidence.id}`);

      expect(response.status).toBe(204);
      expect(mockStorageDelete).toHaveBeenCalledWith('evidences/test.png');

      // DBから削除されていることを確認
      const deleted = await prisma.executionEvidence.findUnique({ where: { id: evidence.id } });
      expect(deleted).toBeNull();
    });

    it('認証なしの場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app).delete(`/api/executions/${execution.id}/evidences/${evidence.id}`);

      expect(response.status).toBe(401);
    });

    it('READ権限のみでは403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).delete(`/api/executions/${execution.id}/evidences/${evidence.id}`);

      expect(response.status).toBe(403);
    });


    it('存在しないエビデンスは404エラー', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app).delete(`/api/executions/${execution.id}/evidences/non-existent-id`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/executions/:executionId/evidences/:evidenceId/download-url', () => {
    let evidence: any;

    beforeEach(async () => {
      evidence = await prisma.executionEvidence.create({
        data: {
          expectedResultId: expectedResult.id,
          fileName: 'test.png',
          fileUrl: 'evidences/test.png',
          fileType: 'image/png',
          fileSize: BigInt(1024),
          uploadedByUserId: owner.id,
        },
      });
    });

    it('署名付きダウンロードURLを取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).get(`/api/executions/${execution.id}/evidences/${evidence.id}/download-url`);

      expect(response.status).toBe(200);
      expect(response.body.downloadUrl).toBe('https://localhost:9002/signed-url');
      expect(mockPublicStorageGetDownloadUrl).toHaveBeenCalledWith('evidences/test.png', { expiresIn: 3600 });
    });

    it('WRITE権限でもダウンロードできる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app).get(`/api/executions/${execution.id}/evidences/${evidence.id}/download-url`);

      expect(response.status).toBe(200);
      expect(response.body.downloadUrl).toBeDefined();
    });

    it('認証なしの場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app).get(`/api/executions/${execution.id}/evidences/${evidence.id}/download-url`);

      expect(response.status).toBe(401);
    });

    it('存在しないエビデンスは404エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).get(
        `/api/executions/${execution.id}/evidences/non-existent-id/download-url`
      );

      expect(response.status).toBe(404);
    });

  });
});
