import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
  createTestCaseStep,
  createTestCaseExpectedResult,
  createTestPrecondition,
  createTestExecution,
  createTestExecutionTestSuite,
  createTestExecutionTestSuitePrecondition,
  createTestExecutionTestCase,
  createTestExecutionTestCaseStep,
  createTestExecutionTestCaseExpectedResult,
  createTestExecutionPreconditionResult,
  createTestExecutionStepResult,
  createTestExecutionExpectedResult,
  createTestEnvironment,
  cleanupTestData,
} from './test-helpers.js';

describe('Internal API Update Endpoints Integration Tests', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testProject: Awaited<ReturnType<typeof createTestProject>>;
  let testSuite: Awaited<ReturnType<typeof createTestSuite>>;
  let testCase: Awaited<ReturnType<typeof createTestCase>>;
  let testEnvironment: Awaited<ReturnType<typeof createTestEnvironment>>;
  let execution: Awaited<ReturnType<typeof createTestExecution>>;
  let executionTestSuite: Awaited<ReturnType<typeof createTestExecutionTestSuite>>;
  let executionTestCase: Awaited<ReturnType<typeof createTestExecutionTestCase>>;
  let suitePreconditionResult: Awaited<ReturnType<typeof createTestExecutionPreconditionResult>>;
  let stepResult: Awaited<ReturnType<typeof createTestExecutionStepResult>>;
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

    // テストスイートを作成（事前条件付き）
    testSuite = await createTestSuite(testProject.id);
    const suitePrecondition = await createTestPrecondition(testSuite.id, { content: 'Suite precondition' });

    // テストケースを作成
    testCase = await createTestCase(testSuite.id, { title: 'Test Case for Update' });
    const testStep = await createTestCaseStep(testCase.id, { content: 'Step 1' });
    const testExpectedResult = await createTestCaseExpectedResult(testCase.id, { content: 'Expected result 1' });

    // 実行を作成（IN_PROGRESS状態）
    execution = await createTestExecution(testEnvironment.id, testSuite.id, { status: 'IN_PROGRESS' });

    // 実行時スナップショットを作成
    executionTestSuite = await createTestExecutionTestSuite(
      execution.id,
      testSuite.id,
      { name: testSuite.name }
    );

    const executionSuitePrecondition = await createTestExecutionTestSuitePrecondition(
      executionTestSuite.id,
      suitePrecondition.id,
      { content: suitePrecondition.content }
    );

    executionTestCase = await createTestExecutionTestCase(
      executionTestSuite.id,
      testCase.id,
      { title: testCase.title }
    );

    const executionStep = await createTestExecutionTestCaseStep(
      executionTestCase.id,
      testStep.id,
      { content: testStep.content }
    );

    const executionExpectedResult = await createTestExecutionTestCaseExpectedResult(
      executionTestCase.id,
      testExpectedResult.id,
      { content: testExpectedResult.content }
    );

    // 結果レコードを作成
    suitePreconditionResult = await createTestExecutionPreconditionResult(execution.id, {
      executionSuitePreconditionId: executionSuitePrecondition.id,
    });

    stepResult = await createTestExecutionStepResult(
      execution.id,
      executionTestCase.id,
      executionStep.id
    );

    expectedResultResult = await createTestExecutionExpectedResult(
      execution.id,
      executionTestCase.id,
      executionExpectedResult.id
    );
  });

  describe('PATCH /internal/api/test-suites/:testSuiteId', () => {
    describe('正常系', () => {
      it('テストスイートのnameを更新できる', async () => {
        const response = await request(app)
          .patch(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            name: 'Updated Suite Name',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('testSuite');
        expect(response.body.testSuite.name).toBe('Updated Suite Name');
      });

      it('テストスイートの複数フィールドを更新できる', async () => {
        const response = await request(app)
          .patch(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            name: 'Updated Name',
            description: 'Updated Description',
            status: 'ACTIVE',
          });

        expect(response.status).toBe(200);
        expect(response.body.testSuite.name).toBe('Updated Name');
        expect(response.body.testSuite.description).toBe('Updated Description');
        expect(response.body.testSuite.status).toBe('ACTIVE');
      });

      it('descriptionをnullにできる', async () => {
        const response = await request(app)
          .patch(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            description: null,
          });

        expect(response.status).toBe(200);
        expect(response.body.testSuite.description).toBeNull();
      });
    });

    describe('異常系', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        const anotherUser = await createTestUser();

        const response = await request(app)
          .patch(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            name: 'Unauthorized Update',
          });

        expect(response.status).toBe(403);
      });

      it('更新フィールドがない場合は400を返す', async () => {
        const response = await request(app)
          .patch(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({});

        expect(response.status).toBe(400);
      });
    });
  });

  describe('PATCH /internal/api/test-cases/:testCaseId', () => {
    describe('正常系', () => {
      it('テストケースのtitleを更新できる', async () => {
        const response = await request(app)
          .patch(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            title: 'Updated Case Title',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('testCase');
        expect(response.body.testCase.title).toBe('Updated Case Title');
      });

      it('テストケースの複数フィールドを更新できる', async () => {
        const response = await request(app)
          .patch(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            title: 'Updated Title',
            description: 'Updated Description',
            priority: 'CRITICAL',
            status: 'ARCHIVED',
          });

        expect(response.status).toBe(200);
        expect(response.body.testCase.title).toBe('Updated Title');
        expect(response.body.testCase.description).toBe('Updated Description');
        expect(response.body.testCase.priority).toBe('CRITICAL');
        expect(response.body.testCase.status).toBe('ARCHIVED');
      });
    });

    describe('異常系', () => {
      it('存在しないテストケースは404を返す', async () => {
        const response = await request(app)
          .patch('/internal/api/test-cases/00000000-0000-0000-0000-000000000000')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            title: 'Update Nonexistent',
          });

        expect(response.status).toBe(404);
      });
    });
  });

  describe('PATCH /internal/api/executions/:executionId/precondition-results/:preconditionResultId', () => {
    describe('正常系', () => {
      it('事前条件結果をMETに更新できる', async () => {
        const response = await request(app)
          .patch(`/internal/api/executions/${execution.id}/precondition-results/${suitePreconditionResult.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            status: 'MET',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('preconditionResult');
        expect(response.body.preconditionResult.status).toBe('MET');
        expect(response.body.preconditionResult.checkedAt).not.toBeNull();
      });

      it('事前条件結果をNOT_METに更新できる（noteあり）', async () => {
        const response = await request(app)
          .patch(`/internal/api/executions/${execution.id}/precondition-results/${suitePreconditionResult.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            status: 'NOT_MET',
            note: 'Environment not ready',
          });

        expect(response.status).toBe(200);
        expect(response.body.preconditionResult.status).toBe('NOT_MET');
        expect(response.body.preconditionResult.note).toBe('Environment not ready');
      });
    });

    describe('異常系', () => {
      it('完了済み実行は403を返す', async () => {
        // 実行を完了状態にする
        await prisma.execution.update({
          where: { id: execution.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });

        const response = await request(app)
          .patch(`/internal/api/executions/${execution.id}/precondition-results/${suitePreconditionResult.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            status: 'MET',
          });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain('not in progress');
      });
    });
  });

  describe('PATCH /internal/api/executions/:executionId/step-results/:stepResultId', () => {
    describe('正常系', () => {
      it('ステップ結果をDONEに更新できる', async () => {
        const response = await request(app)
          .patch(`/internal/api/executions/${execution.id}/step-results/${stepResult.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            status: 'DONE',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('stepResult');
        expect(response.body.stepResult.status).toBe('DONE');
        expect(response.body.stepResult.executedAt).not.toBeNull();
      });

      it('ステップ結果をSKIPPEDに更新できる（noteあり）', async () => {
        const response = await request(app)
          .patch(`/internal/api/executions/${execution.id}/step-results/${stepResult.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            status: 'SKIPPED',
            note: 'Skipped due to dependency failure',
          });

        expect(response.status).toBe(200);
        expect(response.body.stepResult.status).toBe('SKIPPED');
        expect(response.body.stepResult.note).toBe('Skipped due to dependency failure');
      });
    });

    describe('異常系', () => {
      it('存在しないステップ結果は404を返す', async () => {
        const response = await request(app)
          .patch(`/internal/api/executions/${execution.id}/step-results/00000000-0000-0000-0000-000000000000`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            status: 'DONE',
          });

        expect(response.status).toBe(404);
      });
    });
  });

  describe('PATCH /internal/api/executions/:executionId/expected-results/:expectedResultId', () => {
    describe('正常系', () => {
      it('期待結果をPASSに更新できる', async () => {
        const response = await request(app)
          .patch(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            status: 'PASS',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('expectedResult');
        expect(response.body.expectedResult.status).toBe('PASS');
        expect(response.body.expectedResult.judgedAt).not.toBeNull();
      });

      it('期待結果をFAILに更新できる（noteあり）', async () => {
        const response = await request(app)
          .patch(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            status: 'FAIL',
            note: 'Button color is incorrect',
          });

        expect(response.status).toBe(200);
        expect(response.body.expectedResult.status).toBe('FAIL');
        expect(response.body.expectedResult.note).toBe('Button color is incorrect');
      });

      it('期待結果をNOT_EXECUTABLEに更新できる', async () => {
        const response = await request(app)
          .patch(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            status: 'NOT_EXECUTABLE',
            note: 'Feature not available',
          });

        expect(response.status).toBe(200);
        expect(response.body.expectedResult.status).toBe('NOT_EXECUTABLE');
      });
    });

    describe('異常系', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        const anotherUser = await createTestUser();

        const response = await request(app)
          .patch(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}`)
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            status: 'PASS',
          });

        expect(response.status).toBe(403);
      });

      it('中止済み実行は403を返す', async () => {
        // 実行を中止状態にする
        await prisma.execution.update({
          where: { id: execution.id },
          data: { status: 'ABORTED', completedAt: new Date() },
        });

        const response = await request(app)
          .patch(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            status: 'PASS',
          });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain('not in progress');
      });
    });
  });
});
