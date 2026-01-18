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

    // 実行を作成
    execution = await createTestExecution(testEnvironment.id, testSuite.id);

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

    describe('子エンティティの差分更新', () => {
      it('新しい子エンティティを追加できる', async () => {
        const response = await request(app)
          .patch(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            steps: [
              { content: 'New Step 1' },
              { content: 'New Step 2' },
            ],
          });

        expect(response.status).toBe(200);
        expect(response.body.testCase.steps).toHaveLength(2);
        expect(response.body.testCase.steps[0].content).toBe('New Step 1');
        expect(response.body.testCase.steps[0].orderKey).toBe('00001');
        expect(response.body.testCase.steps[1].content).toBe('New Step 2');
        expect(response.body.testCase.steps[1].orderKey).toBe('00002');
      });

      it('既存の子エンティティを更新できる', async () => {
        // 先にステップを追加
        const createResponse = await request(app)
          .patch(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            steps: [{ content: 'Original Step' }],
          });

        const stepId = createResponse.body.testCase.steps[0].id;

        // 更新
        const updateResponse = await request(app)
          .patch(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            steps: [{ id: stepId, content: 'Updated Step' }],
          });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.testCase.steps).toHaveLength(1);
        expect(updateResponse.body.testCase.steps[0].id).toBe(stepId);
        expect(updateResponse.body.testCase.steps[0].content).toBe('Updated Step');
      });

      it('リクエストにないidの子エンティティは削除される', async () => {
        // 先にステップを2つ追加
        const createResponse = await request(app)
          .patch(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            steps: [{ content: 'Step 1' }, { content: 'Step 2' }],
          });

        const step1Id = createResponse.body.testCase.steps[0].id;

        // step1Idのみを残す（step2は削除される）
        const updateResponse = await request(app)
          .patch(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            steps: [{ id: step1Id, content: 'Step 1 Updated' }],
          });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.testCase.steps).toHaveLength(1);
        expect(updateResponse.body.testCase.steps[0].id).toBe(step1Id);
      });

      it('空配列で全ての子エンティティを削除できる', async () => {
        // 先にステップを追加
        await request(app)
          .patch(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            steps: [{ content: 'Step 1' }, { content: 'Step 2' }],
          });

        // 空配列で全削除
        const deleteResponse = await request(app)
          .patch(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            steps: [],
          });

        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body.testCase.steps).toHaveLength(0);
      });

      it('複数種類の子エンティティを同時に更新できる', async () => {
        const response = await request(app)
          .patch(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            title: 'Updated Title',
            preconditions: [{ content: 'Precondition 1' }],
            steps: [{ content: 'Step 1' }, { content: 'Step 2' }],
            expectedResults: [{ content: 'Expected 1' }],
          });

        expect(response.status).toBe(200);
        expect(response.body.testCase.title).toBe('Updated Title');
        expect(response.body.testCase.preconditions).toHaveLength(1);
        expect(response.body.testCase.steps).toHaveLength(2);
        expect(response.body.testCase.expectedResults).toHaveLength(1);
      });

      it('他のテストケースのIDを指定するとエラーになる', async () => {
        // 別のテストケースを作成
        const otherTestCase = await prisma.testCase.create({
          data: {
            testSuiteId: testSuite.id,
            title: 'Other Test Case',
            priority: 'MEDIUM',
            status: 'DRAFT',
            orderKey: '00099',
            steps: {
              create: [{ content: 'Other Step', orderKey: '00001' }],
            },
          },
          include: { steps: true },
        });

        // 他のテストケースのステップIDを使おうとする
        const response = await request(app)
          .patch(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            steps: [{ id: otherTestCase.steps[0].id, content: 'Hijacked Step' }],
          });

        expect(response.status).toBe(400);
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

      it('期待結果をSKIPPEDに更新できる', async () => {
        const response = await request(app)
          .patch(`/internal/api/executions/${execution.id}/expected-results/${expectedResultResult.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            status: 'SKIPPED',
            note: 'Feature not available',
          });

        expect(response.status).toBe(200);
        expect(response.body.expectedResult.status).toBe('SKIPPED');
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
    });
  });
});
