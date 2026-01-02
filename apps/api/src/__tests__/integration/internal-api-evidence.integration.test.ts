import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  createTestUser,
  createTestProject,
  createTestSuite,
  createTestCase,
  createTestCaseExpectedResult,
  createTestExecution,
  createTestExecutionTestSuite,
  createTestExecutionTestCase,
  createTestExecutionTestCaseExpectedResult,
  createTestExecutionExpectedResult,
  createTestEnvironment,
  cleanupTestData,
} from './test-helpers.js';

// vi.hoistedを使用してモック関数を事前定義
const { mockStorageUpload, mockStorageDelete, mockStorageGetDownloadUrl } = vi.hoisted(() => ({
  mockStorageUpload: vi.fn().mockResolvedValue({ key: 'test-key', url: 'https://example.com/test', size: 1024 }),
  mockStorageDelete: vi.fn().mockResolvedValue(undefined),
  mockStorageGetDownloadUrl: vi.fn().mockResolvedValue('https://minio.example.com/signed-url'),
}));

vi.mock('@agentest/storage', () => ({
  createStorageClient: vi.fn().mockReturnValue({
    upload: mockStorageUpload,
    delete: mockStorageDelete,
    getDownloadUrl: mockStorageGetDownloadUrl,
  }),
}));

// テスト用Base64データ（1x1ピクセルのPNG画像）
const TEST_BASE64_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Internal API Evidence Upload Integration Tests', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testProject: Awaited<ReturnType<typeof createTestProject>>;
  let testSuite: Awaited<ReturnType<typeof createTestSuite>>;
  let testCase: Awaited<ReturnType<typeof createTestCase>>;
  let testEnvironment: Awaited<ReturnType<typeof createTestEnvironment>>;
  let execution: Awaited<ReturnType<typeof createTestExecution>>;
  let expectedResultResult: Awaited<ReturnType<typeof createTestExecutionExpectedResult>>;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();

    // テストユーザーを作成
    testUser = await createTestUser();

    // テストプロジェクトを作成
    testProject = await createTestProject(testUser.id);

    // テスト環境を作成
    testEnvironment = await createTestEnvironment(testProject.id);

    // テストスイートを作成
    testSuite = await createTestSuite(testProject.id);

    // テストケースを作成
    testCase = await createTestCase(testSuite.id, { title: 'Test Case for Evidence' });
    const testExpectedResult = await createTestCaseExpectedResult(testCase.id, { content: 'Expected result 1' });

    // 実行を作成（IN_PROGRESS状態）
    execution = await createTestExecution(testEnvironment.id, testSuite.id, { status: 'IN_PROGRESS' });

    // 実行時スナップショットを作成
    const executionTestSuite = await createTestExecutionTestSuite(
      execution.id,
      testSuite.id,
      { name: testSuite.name }
    );

    const executionTestCase = await createTestExecutionTestCase(
      executionTestSuite.id,
      testCase.id,
      { title: testCase.title }
    );

    const executionExpectedResult = await createTestExecutionTestCaseExpectedResult(
      executionTestCase.id,
      testExpectedResult.id,
      { content: testExpectedResult.content }
    );

    // 結果レコードを作成
    expectedResultResult = await createTestExecutionExpectedResult(
      execution.id,
      executionTestCase.id,
      executionExpectedResult.id
    );
  });

  describe('POST /internal/api/executions/:executionId/expected-results/:expectedResultId/evidences', () => {
    describe('正常系', () => {
      it('PNG画像をアップロードできる', async () => {
        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'screenshot.png',
            fileData: TEST_BASE64_PNG,
            fileType: 'image/png',
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('evidence');
        expect(response.body.evidence.fileName).toBe('screenshot.png');
        expect(response.body.evidence.fileType).toBe('image/png');
        expect(response.body.evidence.expectedResultId).toBe(expectedResultResult.id);
        expect(response.body.evidence.uploadedByUserId).toBe(testUser.id);
        expect(response.body.evidence.fileSize).toBeGreaterThan(0);
      });

      it('説明付きでアップロードできる', async () => {
        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'error_screen.png',
            fileData: TEST_BASE64_PNG,
            fileType: 'image/png',
            description: 'エラー画面のスクリーンショット',
          });

        expect(response.status).toBe(201);
        expect(response.body.evidence.description).toBe('エラー画面のスクリーンショット');
      });

      it('JPEG画像をアップロードできる', async () => {
        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'photo.jpg',
            fileData: TEST_BASE64_PNG, // テスト用なのでPNGデータを使用
            fileType: 'image/jpeg',
          });

        expect(response.status).toBe(201);
        expect(response.body.evidence.fileType).toBe('image/jpeg');
      });

      it('PDFファイルをアップロードできる', async () => {
        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'report.pdf',
            fileData: TEST_BASE64_PNG, // テスト用
            fileType: 'application/pdf',
          });

        expect(response.status).toBe(201);
        expect(response.body.evidence.fileType).toBe('application/pdf');
      });

      it('複数のエビデンスをアップロードできる', async () => {
        // 1つ目
        const response1 = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'screenshot1.png',
            fileData: TEST_BASE64_PNG,
            fileType: 'image/png',
          });

        expect(response1.status).toBe(201);

        // 2つ目
        const response2 = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'screenshot2.png',
            fileData: TEST_BASE64_PNG,
            fileType: 'image/png',
          });

        expect(response2.status).toBe(201);
        expect(response2.body.evidence.id).not.toBe(response1.body.evidence.id);
      });
    });

    describe('異常系', () => {
      it('userIdがない場合は400を返す', async () => {
        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'screenshot.png',
            fileData: TEST_BASE64_PNG,
            fileType: 'image/png',
          });

        expect(response.status).toBe(400);
      });

      it('アクセス権のないユーザーは403を返す', async () => {
        const anotherUser = await createTestUser();

        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'screenshot.png',
            fileData: TEST_BASE64_PNG,
            fileType: 'image/png',
          });

        expect(response.status).toBe(403);
      });

      it('完了済みの実行にはアップロードできない', async () => {
        // 実行を完了状態に更新
        await prisma.execution.update({
          where: { id: execution.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });

        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'screenshot.png',
            fileData: TEST_BASE64_PNG,
            fileType: 'image/png',
          });

        expect(response.status).toBe(403);
      });

      it('許可されていないMIMEタイプは400を返す', async () => {
        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'malicious.exe',
            fileData: TEST_BASE64_PNG,
            fileType: 'application/x-executable',
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('許可されていないファイル形式');
      });

      it('不正なBase64データは400を返す', async () => {
        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'screenshot.png',
            fileData: '!!!invalid-base64!!!',
            fileType: 'image/png',
          });

        // 正規表現でBase64形式を事前検証するため400エラーを返す
        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Base64');
      });

      it('fileNameが空の場合は400を返す', async () => {
        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: '',
            fileData: TEST_BASE64_PNG,
            fileType: 'image/png',
          });

        expect(response.status).toBe(400);
      });

      it('存在しない実行IDは404を返す', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';

        const response = await request(app)
          .post(`/internal/api/executions/${nonExistentId}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'screenshot.png',
            fileData: TEST_BASE64_PNG,
            fileType: 'image/png',
          });

        // 403か404のどちらかが返される（権限チェックが先に行われる可能性がある）
        expect([403, 404]).toContain(response.status);
      });

      it('存在しない期待結果IDは404を返す', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';

        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${nonExistentId}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'screenshot.png',
            fileData: TEST_BASE64_PNG,
            fileType: 'image/png',
          });

        expect(response.status).toBe(404);
      });

      it('内部APIキーがない場合は認証エラーを返す', async () => {
        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .send({
            fileName: 'screenshot.png',
            fileData: TEST_BASE64_PNG,
            fileType: 'image/png',
          });

        // 内部APIミドルウェアは401または403を返す
        expect([401, 403]).toContain(response.status);
      });

      it('エビデンス上限（10件）を超えるとエラーを返す', async () => {
        // 10件のエビデンスをアップロード
        for (let i = 0; i < 10; i++) {
          const response = await request(app)
            .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
            .query({ userId: testUser.id })
            .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
            .send({
              fileName: `screenshot${i}.png`,
              fileData: TEST_BASE64_PNG,
              fileType: 'image/png',
            });

          expect(response.status).toBe(201);
        }

        // 11件目はエラー
        const response = await request(app)
          .post(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}/evidences`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            fileName: 'screenshot11.png',
            fileData: TEST_BASE64_PNG,
            fileType: 'image/png',
          });

        expect(response.status).toBe(400);
        // エラーメッセージに「上限」が含まれることを確認
        const errorMessage = response.body.message || JSON.stringify(response.body);
        expect(errorMessage).toContain('上限');
      });
    });
  });
});
