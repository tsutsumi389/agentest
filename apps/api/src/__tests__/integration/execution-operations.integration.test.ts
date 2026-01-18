import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
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
  createTestExecutionTestCaseStep,
  createTestExecutionTestCaseExpectedResult,
  createTestExecutionPreconditionResult,
  createTestExecutionStepResult,
  createTestExecutionExpectedResult,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError } from '@agentest/shared';
import { createApp } from '../../app.js';

// グローバルな認証状態（モック用）
let mockAuthUser: { id: string; email: string } | null = null;
let mockExecutionRole: string | null = null;

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

describe('Execution Operations API Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let writer: Awaited<ReturnType<typeof createTestUser>>;
  let reader: Awaited<ReturnType<typeof createTestUser>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let testSuite: Awaited<ReturnType<typeof createTestSuite>>;
  let environment: Awaited<ReturnType<typeof createTestEnvironment>>;
  let execution: Awaited<ReturnType<typeof createTestExecution>>;

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
    execution = await createTestExecution(environment.id, testSuite.id, {
      status: 'IN_PROGRESS',
    });
  });

  describe('GET /api/executions/:executionId', () => {
    it('READ権限で実行詳細（軽量版）を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).get(`/api/executions/${execution.id}`);

      expect(response.status).toBe(200);
      expect(response.body.execution).toBeDefined();
      expect(response.body.execution.id).toBe(execution.id);
      expect(response.body.execution.status).toBe('IN_PROGRESS');
    });

    it('WRITE権限でも実行詳細を取得できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app).get(`/api/executions/${execution.id}`);

      expect(response.status).toBe(200);
      expect(response.body.execution.id).toBe(execution.id);
    });

    it('ADMIN権限でも実行詳細を取得できる', async () => {
      setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN');

      const response = await request(app).get(`/api/executions/${execution.id}`);

      expect(response.status).toBe(200);
      expect(response.body.execution.id).toBe(execution.id);
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app).get(`/api/executions/${execution.id}`);

      expect(response.status).toBe(401);
    });

    it('権限なしの場合は403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, null);

      const response = await request(app).get(`/api/executions/${execution.id}`);

      expect(response.status).toBe(403);
    });

    it('存在しない実行IDは404エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).get('/api/executions/non-existent-id');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/executions/:executionId/details', () => {
    it('正規化テーブルを含む全詳細データを取得できる', async () => {
      // 正規化テーブルを作成
      const execTestSuite = await createTestExecutionTestSuite(execution.id, testSuite.id, {
        name: 'Test Suite',
      });
      const execTestCase = await createTestExecutionTestCase(execTestSuite.id, 'tc-1', {
        title: 'Test Case 1',
      });
      const execStep = await createTestExecutionTestCaseStep(execTestCase.id, 'step-1', {
        content: 'Step 1',
      });
      const execExpectedResult = await createTestExecutionTestCaseExpectedResult(execTestCase.id, 'expected-1', {
        content: 'Expected 1',
      });

      // 前提条件結果を作成
      await createTestExecutionPreconditionResult(execution.id, {});

      // ステップ結果を作成
      await createTestExecutionStepResult(execution.id, execTestCase.id, execStep.id, {
        status: 'PENDING',
      });

      // 期待結果を作成
      await createTestExecutionExpectedResult(execution.id, execTestCase.id, execExpectedResult.id, {
        status: 'PENDING',
      });

      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).get(`/api/executions/${execution.id}/details`);

      expect(response.status).toBe(200);
      expect(response.body.execution).toBeDefined();
      expect(response.body.execution.id).toBe(execution.id);
      expect(response.body.execution.executionTestSuite).toBeDefined();
      expect(response.body.execution.preconditionResults).toBeDefined();
      expect(response.body.execution.stepResults).toBeDefined();
      expect(response.body.execution.expectedResults).toBeDefined();
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app).get(`/api/executions/${execution.id}/details`);

      expect(response.status).toBe(401);
    });

    it('存在しない実行IDは404エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).get('/api/executions/non-existent-id/details');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/executions/:executionId/abort', () => {
    it('WRITE権限で進行中の実行を中止できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app).post(`/api/executions/${execution.id}/abort`);

      expect(response.status).toBe(200);
      expect(response.body.execution.status).toBe('ABORTED');
      expect(response.body.execution.completedAt).toBeDefined();
    });

    it('中止後のステータスがABORTEDになる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      await request(app).post(`/api/executions/${execution.id}/abort`);

      const updatedExecution = await prisma.execution.findUnique({
        where: { id: execution.id },
      });

      expect(updatedExecution?.status).toBe('ABORTED');
      expect(updatedExecution?.completedAt).not.toBeNull();
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app).post(`/api/executions/${execution.id}/abort`);

      expect(response.status).toBe(401);
    });

    it('READ権限では403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).post(`/api/executions/${execution.id}/abort`);

      expect(response.status).toBe(403);
    });

    it('完了済み実行は409エラー', async () => {
      // 実行を完了状態に更新
      await prisma.execution.update({
        where: { id: execution.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app).post(`/api/executions/${execution.id}/abort`);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toBe('進行中の実行のみ中止できます');
    });

    it('既に中止済みの実行は409エラー', async () => {
      // 実行を中止状態に更新
      await prisma.execution.update({
        where: { id: execution.id },
        data: { status: 'ABORTED', completedAt: new Date() },
      });

      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app).post(`/api/executions/${execution.id}/abort`);

      expect(response.status).toBe(409);
    });

    it('存在しない実行IDは404エラー', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app).post('/api/executions/non-existent-id/abort');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/executions/:executionId/complete', () => {
    it('WRITE権限で進行中の実行を完了できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app).post(`/api/executions/${execution.id}/complete`);

      expect(response.status).toBe(200);
      expect(response.body.execution.status).toBe('COMPLETED');
      expect(response.body.execution.completedAt).toBeDefined();
    });

    it('完了後のステータスがCOMPLETEDになる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      await request(app).post(`/api/executions/${execution.id}/complete`);

      const updatedExecution = await prisma.execution.findUnique({
        where: { id: execution.id },
      });

      expect(updatedExecution?.status).toBe('COMPLETED');
      expect(updatedExecution?.completedAt).not.toBeNull();
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app).post(`/api/executions/${execution.id}/complete`);

      expect(response.status).toBe(401);
    });

    it('READ権限では403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app).post(`/api/executions/${execution.id}/complete`);

      expect(response.status).toBe(403);
    });

    it('中止済み実行は409エラー', async () => {
      // 実行を中止状態に更新
      await prisma.execution.update({
        where: { id: execution.id },
        data: { status: 'ABORTED', completedAt: new Date() },
      });

      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app).post(`/api/executions/${execution.id}/complete`);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toBe('進行中の実行のみ完了できます');
    });

    it('存在しない実行IDは404エラー', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app).post('/api/executions/non-existent-id/complete');

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/executions/:executionId/preconditions/:preconditionResultId', () => {
    let preconditionResult: Awaited<ReturnType<typeof createTestExecutionPreconditionResult>>;

    beforeEach(async () => {
      preconditionResult = await createTestExecutionPreconditionResult(execution.id, {
        status: 'UNCHECKED',
      });
    });

    it('前提条件結果のステータスをMETに更新できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/preconditions/${preconditionResult.id}`)
        .send({ status: 'MET' });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe('MET');
      expect(response.body.result.checkedAt).toBeDefined();
    });

    it('前提条件結果のステータスをNOT_METに更新できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/preconditions/${preconditionResult.id}`)
        .send({ status: 'NOT_MET' });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe('NOT_MET');
    });

    it('前提条件結果のステータスをUNCHECKEDに戻せる', async () => {
      // まずMETに更新
      await prisma.executionPreconditionResult.update({
        where: { id: preconditionResult.id },
        data: { status: 'MET', checkedAt: new Date() },
      });

      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/preconditions/${preconditionResult.id}`)
        .send({ status: 'UNCHECKED' });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe('UNCHECKED');
      expect(response.body.result.checkedAt).toBeNull();
    });

    it('noteを設定できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/preconditions/${preconditionResult.id}`)
        .send({ status: 'MET', note: 'テストメモ' });

      expect(response.status).toBe(200);
      expect(response.body.result.note).toBe('テストメモ');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/preconditions/${preconditionResult.id}`)
        .send({ status: 'MET' });

      expect(response.status).toBe(401);
    });

    it('READ権限では403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/preconditions/${preconditionResult.id}`)
        .send({ status: 'MET' });

      expect(response.status).toBe(403);
    });

    it('存在しない前提条件結果IDは404エラー', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/preconditions/non-existent-id`)
        .send({ status: 'MET' });

      expect(response.status).toBe(404);
    });

    it('不正なステータス値は400エラー', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/preconditions/${preconditionResult.id}`)
        .send({ status: 'INVALID_STATUS' });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/executions/:executionId/steps/:stepResultId', () => {
    let stepResult: Awaited<ReturnType<typeof createTestExecutionStepResult>>;

    beforeEach(async () => {
      // 正規化テーブルを作成
      const execTestSuite = await createTestExecutionTestSuite(execution.id, testSuite.id, {
        name: 'Test Suite',
      });
      const execTestCase = await createTestExecutionTestCase(execTestSuite.id, 'tc-1', {
        title: 'Test Case 1',
      });
      const execStep = await createTestExecutionTestCaseStep(execTestCase.id, 'step-1', {
        content: 'Step 1',
      });
      stepResult = await createTestExecutionStepResult(execution.id, execTestCase.id, execStep.id, {
        status: 'PENDING',
      });
    });

    it('ステップ結果のステータスをDONEに更新できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/steps/${stepResult.id}`)
        .send({ status: 'DONE' });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe('DONE');
      expect(response.body.result.executedAt).toBeDefined();
    });

    it('ステップ結果のステータスをSKIPPEDに更新できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/steps/${stepResult.id}`)
        .send({ status: 'SKIPPED' });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe('SKIPPED');
    });

    it('ステップ結果のステータスをPENDINGに戻せる', async () => {
      // まずDONEに更新
      await prisma.executionStepResult.update({
        where: { id: stepResult.id },
        data: { status: 'DONE', executedAt: new Date() },
      });

      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/steps/${stepResult.id}`)
        .send({ status: 'PENDING' });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe('PENDING');
      expect(response.body.result.executedAt).toBeNull();
    });

    it('noteを設定できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/steps/${stepResult.id}`)
        .send({ status: 'DONE', note: 'ステップ実行メモ' });

      expect(response.status).toBe(200);
      expect(response.body.result.note).toBe('ステップ実行メモ');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/steps/${stepResult.id}`)
        .send({ status: 'DONE' });

      expect(response.status).toBe(401);
    });

    it('READ権限では403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/steps/${stepResult.id}`)
        .send({ status: 'DONE' });

      expect(response.status).toBe(403);
    });

    it('存在しないステップ結果IDは404エラー', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/steps/non-existent-id`)
        .send({ status: 'DONE' });

      expect(response.status).toBe(404);
    });

    it('不正なステータス値は400エラー', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/steps/${stepResult.id}`)
        .send({ status: 'INVALID_STATUS' });

      expect(response.status).toBe(400);
    });

    it('noteが2000文字を超える場合は400エラー', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/steps/${stepResult.id}`)
        .send({ status: 'DONE', note: 'a'.repeat(2001) });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/executions/:executionId/expected-results/:expectedResultId', () => {
    let expectedResult: Awaited<ReturnType<typeof createTestExecutionExpectedResult>>;

    beforeEach(async () => {
      // 正規化テーブルを作成
      const execTestSuite = await createTestExecutionTestSuite(execution.id, testSuite.id, {
        name: 'Test Suite',
      });
      const execTestCase = await createTestExecutionTestCase(execTestSuite.id, 'tc-1', {
        title: 'Test Case 1',
      });
      const execExpectedResultSnapshot = await createTestExecutionTestCaseExpectedResult(execTestCase.id, 'expected-1', {
        content: 'Expected 1',
      });
      expectedResult = await createTestExecutionExpectedResult(execution.id, execTestCase.id, execExpectedResultSnapshot.id, {
        status: 'PENDING',
      });
    });

    it('期待結果のステータスをPASSに更新できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/expected-results/${expectedResult.id}`)
        .send({ status: 'PASS' });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe('PASS');
      expect(response.body.result.judgedAt).toBeDefined();
    });

    it('期待結果のステータスをFAILに更新できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/expected-results/${expectedResult.id}`)
        .send({ status: 'FAIL' });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe('FAIL');
    });

    it('期待結果のステータスをSKIPPEDに更新できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/expected-results/${expectedResult.id}`)
        .send({ status: 'SKIPPED' });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe('SKIPPED');
    });

    it('期待結果のステータスをSKIPPEDに更新できる（別パターン）', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/expected-results/${expectedResult.id}`)
        .send({ status: 'SKIPPED', note: 'Feature not available' });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe('SKIPPED');
    });

    it('期待結果のステータスをPENDINGに戻せる', async () => {
      // まずPASSに更新
      await prisma.executionExpectedResult.update({
        where: { id: expectedResult.id },
        data: { status: 'PASS', judgedAt: new Date() },
      });

      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/expected-results/${expectedResult.id}`)
        .send({ status: 'PENDING' });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe('PENDING');
      expect(response.body.result.judgedAt).toBeNull();
    });

    it('noteを設定できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/expected-results/${expectedResult.id}`)
        .send({ status: 'PASS', note: '期待結果確認メモ' });

      expect(response.status).toBe(200);
      expect(response.body.result.note).toBe('期待結果確認メモ');
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/expected-results/${expectedResult.id}`)
        .send({ status: 'PASS' });

      expect(response.status).toBe(401);
    });

    it('READ権限では403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/expected-results/${expectedResult.id}`)
        .send({ status: 'PASS' });

      expect(response.status).toBe(403);
    });

    it('存在しない期待結果IDは404エラー', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/expected-results/non-existent-id`)
        .send({ status: 'PASS' });

      expect(response.status).toBe(404);
    });

    it('不正なステータス値は400エラー', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/executions/${execution.id}/expected-results/${expectedResult.id}`)
        .send({ status: 'INVALID_STATUS' });

      expect(response.status).toBe(400);
    });
  });
});
