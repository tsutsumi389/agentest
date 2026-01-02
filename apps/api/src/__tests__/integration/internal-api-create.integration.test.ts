import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';

describe('Internal API Create Endpoints Integration Tests', () => {
  let app: Express;
  let testUser: { id: string; email: string };
  let testProject: { id: string; name: string };
  let testSuite: { id: string; name: string };

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    // テストデータをクリーンアップ（依存関係の順序で削除）
    await prisma.execution.deleteMany({
      where: { testSuite: { name: { startsWith: 'test-create-' } } },
    });
    await prisma.testCase.deleteMany({
      where: { testSuite: { name: { startsWith: 'test-create-' } } },
    });
    await prisma.testSuite.deleteMany({
      where: { name: { startsWith: 'test-create-' } },
    });
    await prisma.projectMember.deleteMany({
      where: { project: { name: { startsWith: 'test-create-' } } },
    });
    await prisma.project.deleteMany({
      where: { name: { startsWith: 'test-create-' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-create-' } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // テストデータをクリーンアップ（依存関係の順序で削除）
    await prisma.execution.deleteMany({
      where: { testSuite: { name: { startsWith: 'test-create-' } } },
    });
    await prisma.testCase.deleteMany({
      where: { testSuite: { name: { startsWith: 'test-create-' } } },
    });
    await prisma.testSuite.deleteMany({
      where: { name: { startsWith: 'test-create-' } },
    });
    await prisma.projectMember.deleteMany({
      where: { project: { name: { startsWith: 'test-create-' } } },
    });
    await prisma.project.deleteMany({
      where: { name: { startsWith: 'test-create-' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-create-' } },
    });

    // テストユーザーを作成
    testUser = await prisma.user.create({
      data: {
        email: `test-create-${Date.now()}@example.com`,
        name: 'Test User',
      },
    });

    // テストプロジェクトを作成
    testProject = await prisma.project.create({
      data: {
        name: `test-create-project-${Date.now()}`,
        description: 'Test project for create API',
        members: {
          create: {
            userId: testUser.id,
            role: 'OWNER',
          },
        },
      },
    });

    // テストスイートを作成
    testSuite = await prisma.testSuite.create({
      data: {
        name: `test-create-suite-${Date.now()}`,
        description: 'Test suite for create API',
        projectId: testProject.id,
        status: 'ACTIVE',
        createdByUserId: testUser.id,
      },
    });
  });

  describe('POST /internal/api/test-suites', () => {
    describe('正常系', () => {
      it('テストスイートを作成できる', async () => {
        const response = await request(app)
          .post('/internal/api/test-suites')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            projectId: testProject.id,
            name: 'New Test Suite',
            description: 'New test suite description',
            status: 'DRAFT',
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('testSuite');
        expect(response.body.testSuite.name).toBe('New Test Suite');
        expect(response.body.testSuite.description).toBe('New test suite description');
        expect(response.body.testSuite.status).toBe('DRAFT');
        expect(response.body.testSuite.projectId).toBe(testProject.id);
      });

      it('descriptionなしでも作成できる', async () => {
        const response = await request(app)
          .post('/internal/api/test-suites')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            projectId: testProject.id,
            name: 'Suite Without Description',
          });

        expect(response.status).toBe(201);
        expect(response.body.testSuite.name).toBe('Suite Without Description');
        expect(response.body.testSuite.description).toBeNull();
        expect(response.body.testSuite.status).toBe('DRAFT'); // デフォルト値
      });

      it('WRITEロールのユーザーも作成できる', async () => {
        // WRITEロールのユーザーを作成
        const writeUser = await prisma.user.create({
          data: {
            email: `test-create-write-${Date.now()}@example.com`,
            name: 'Write User',
          },
        });
        await prisma.projectMember.create({
          data: {
            projectId: testProject.id,
            userId: writeUser.id,
            role: 'WRITE',
          },
        });

        const response = await request(app)
          .post('/internal/api/test-suites')
          .query({ userId: writeUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            projectId: testProject.id,
            name: 'Suite by Write User',
          });

        expect(response.status).toBe(201);
      });
    });

    describe('認可失敗', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        const anotherUser = await prisma.user.create({
          data: {
            email: `test-create-another-${Date.now()}@example.com`,
            name: 'Another User',
          },
        });

        const response = await request(app)
          .post('/internal/api/test-suites')
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            projectId: testProject.id,
            name: 'Unauthorized Suite',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });

      it('READロールのユーザーは403を返す', async () => {
        const readUser = await prisma.user.create({
          data: {
            email: `test-create-read-${Date.now()}@example.com`,
            name: 'Read User',
          },
        });
        await prisma.projectMember.create({
          data: {
            projectId: testProject.id,
            userId: readUser.id,
            role: 'READ',
          },
        });

        const response = await request(app)
          .post('/internal/api/test-suites')
          .query({ userId: readUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            projectId: testProject.id,
            name: 'Suite by Read User',
          });

        expect(response.status).toBe(403);
      });
    });

    describe('バリデーション', () => {
      it('userIdがない場合は400を返す', async () => {
        const response = await request(app)
          .post('/internal/api/test-suites')
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            projectId: testProject.id,
            name: 'Test Suite',
          });

        expect(response.status).toBe(400);
      });

      it('nameがない場合は400を返す', async () => {
        const response = await request(app)
          .post('/internal/api/test-suites')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            projectId: testProject.id,
          });

        expect(response.status).toBe(400);
      });

      it('nameが空の場合は400を返す', async () => {
        const response = await request(app)
          .post('/internal/api/test-suites')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            projectId: testProject.id,
            name: '',
          });

        expect(response.status).toBe(400);
      });

      it('projectIdがない場合は400を返す', async () => {
        const response = await request(app)
          .post('/internal/api/test-suites')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            name: 'Test Suite',
          });

        expect(response.status).toBe(400);
      });

      it('不正なstatusは400を返す', async () => {
        const response = await request(app)
          .post('/internal/api/test-suites')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            projectId: testProject.id,
            name: 'Test Suite',
            status: 'INVALID',
          });

        expect(response.status).toBe(400);
      });
    });
  });

  describe('POST /internal/api/test-cases', () => {
    describe('正常系', () => {
      it('テストケースを作成できる', async () => {
        const response = await request(app)
          .post('/internal/api/test-cases')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            testSuiteId: testSuite.id,
            title: 'New Test Case',
            description: 'New test case description',
            priority: 'HIGH',
            status: 'DRAFT',
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('testCase');
        expect(response.body.testCase.title).toBe('New Test Case');
        expect(response.body.testCase.description).toBe('New test case description');
        expect(response.body.testCase.priority).toBe('HIGH');
        expect(response.body.testCase.status).toBe('DRAFT');
        expect(response.body.testCase.testSuiteId).toBe(testSuite.id);
      });

      it('descriptionなしでも作成できる', async () => {
        const response = await request(app)
          .post('/internal/api/test-cases')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            testSuiteId: testSuite.id,
            title: 'Case Without Description',
          });

        expect(response.status).toBe(201);
        expect(response.body.testCase.title).toBe('Case Without Description');
        expect(response.body.testCase.description).toBeNull();
        expect(response.body.testCase.priority).toBe('MEDIUM'); // デフォルト値
        expect(response.body.testCase.status).toBe('DRAFT'); // デフォルト値
      });

      it('orderKeyが自動採番される', async () => {
        // 1つ目のテストケース
        const response1 = await request(app)
          .post('/internal/api/test-cases')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            testSuiteId: testSuite.id,
            title: 'Test Case 1',
          });

        expect(response1.status).toBe(201);
        expect(response1.body.testCase.orderKey).toBe('00001');

        // 2つ目のテストケース
        const response2 = await request(app)
          .post('/internal/api/test-cases')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            testSuiteId: testSuite.id,
            title: 'Test Case 2',
          });

        expect(response2.status).toBe(201);
        expect(response2.body.testCase.orderKey).toBe('00002');
      });

      it('子エンティティを含めてテストケースを作成できる', async () => {
        const response = await request(app)
          .post('/internal/api/test-cases')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            testSuiteId: testSuite.id,
            title: 'Test Case with Children',
            preconditions: [
              { content: 'Precondition 1' },
              { content: 'Precondition 2' },
            ],
            steps: [
              { content: 'Step 1' },
              { content: 'Step 2' },
              { content: 'Step 3' },
            ],
            expectedResults: [
              { content: 'Expected Result 1' },
            ],
          });

        expect(response.status).toBe(201);
        expect(response.body.testCase.title).toBe('Test Case with Children');
        expect(response.body.testCase.preconditions).toHaveLength(2);
        expect(response.body.testCase.preconditions[0].content).toBe('Precondition 1');
        expect(response.body.testCase.preconditions[0].orderKey).toBe('00001');
        expect(response.body.testCase.preconditions[1].orderKey).toBe('00002');
        expect(response.body.testCase.steps).toHaveLength(3);
        expect(response.body.testCase.steps[0].content).toBe('Step 1');
        expect(response.body.testCase.steps[2].content).toBe('Step 3');
        expect(response.body.testCase.expectedResults).toHaveLength(1);
      });

      it('空の子エンティティ配列を指定して作成できる', async () => {
        const response = await request(app)
          .post('/internal/api/test-cases')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            testSuiteId: testSuite.id,
            title: 'Test Case with Empty Children',
            preconditions: [],
            steps: [],
            expectedResults: [],
          });

        expect(response.status).toBe(201);
        // 空配列を指定しても、子エンティティなしで作成される
        expect(response.body.testCase.title).toBe('Test Case with Empty Children');
      });
    });

    describe('認可失敗', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        const anotherUser = await prisma.user.create({
          data: {
            email: `test-create-another-case-${Date.now()}@example.com`,
            name: 'Another User',
          },
        });

        const response = await request(app)
          .post('/internal/api/test-cases')
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            testSuiteId: testSuite.id,
            title: 'Unauthorized Case',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });
    });

    describe('バリデーション', () => {
      it('userIdがない場合は400を返す', async () => {
        const response = await request(app)
          .post('/internal/api/test-cases')
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            testSuiteId: testSuite.id,
            title: 'Test Case',
          });

        expect(response.status).toBe(400);
      });

      it('titleがない場合は400を返す', async () => {
        const response = await request(app)
          .post('/internal/api/test-cases')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            testSuiteId: testSuite.id,
          });

        expect(response.status).toBe(400);
      });

      it('testSuiteIdがない場合は400を返す', async () => {
        const response = await request(app)
          .post('/internal/api/test-cases')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            title: 'Test Case',
          });

        expect(response.status).toBe(400);
      });

      it('不正なpriorityは400を返す', async () => {
        const response = await request(app)
          .post('/internal/api/test-cases')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            testSuiteId: testSuite.id,
            title: 'Test Case',
            priority: 'INVALID',
          });

        expect(response.status).toBe(400);
      });
    });
  });

  describe('POST /internal/api/test-suites/:testSuiteId/executions', () => {
    beforeEach(async () => {
      // ステップ付きのテストケースを作成
      await prisma.testCase.create({
        data: {
          testSuiteId: testSuite.id,
          title: 'Test Case with Steps',
          status: 'ACTIVE',
          priority: 'HIGH',
          orderKey: '00001',
          createdByUserId: testUser.id,
          steps: {
            create: [
              { content: 'Step 1', orderKey: '00001' },
              { content: 'Step 2', orderKey: '00002' },
            ],
          },
          expectedResults: {
            create: [
              { content: 'Expected 1', orderKey: '00001' },
            ],
          },
        },
      });
    });

    describe('正常系', () => {
      it('テスト実行を開始できる', async () => {
        const response = await request(app)
          .post(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({});

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('execution');
        expect(response.body.execution.testSuiteId).toBe(testSuite.id);
        expect(response.body.execution.status).toBe('IN_PROGRESS');
      });

      it('environmentIdを指定して実行できる', async () => {
        // 環境を作成
        const environment = await prisma.projectEnvironment.create({
          data: {
            projectId: testProject.id,
            name: 'Development',
            slug: 'dev',
            isDefault: true,
            sortOrder: 0,
          },
        });

        const response = await request(app)
          .post(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            environmentId: environment.id,
          });

        expect(response.status).toBe(201);
        expect(response.body.execution.environmentId).toBe(environment.id);
      });

      it('スナップショットが作成される', async () => {
        const response = await request(app)
          .post(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({});

        expect(response.status).toBe(201);

        // スナップショットの存在を確認
        const executionTestSuite = await prisma.executionTestSuite.findFirst({
          where: { executionId: response.body.execution.id },
        });
        expect(executionTestSuite).not.toBeNull();
        expect(executionTestSuite!.name).toBe(testSuite.name);
      });

      it('結果行が自動作成される', async () => {
        const response = await request(app)
          .post(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({});

        expect(response.status).toBe(201);

        // ステップ結果の存在を確認
        const stepResults = await prisma.executionStepResult.findMany({
          where: { executionId: response.body.execution.id },
        });
        expect(stepResults.length).toBe(2); // 2つのステップ

        // 期待結果の結果の存在を確認
        const expectedResults = await prisma.executionExpectedResult.findMany({
          where: { executionId: response.body.execution.id },
        });
        expect(expectedResults.length).toBe(1);
      });
    });

    describe('認可失敗', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        const anotherUser = await prisma.user.create({
          data: {
            email: `test-create-another-exec-${Date.now()}@example.com`,
            name: 'Another User',
          },
        });

        const response = await request(app)
          .post(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({});

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });
    });

    describe('バリデーション', () => {
      it('userIdがない場合は400を返す', async () => {
        const response = await request(app)
          .post(`/internal/api/test-suites/${testSuite.id}/executions`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({});

        expect(response.status).toBe(400);
      });

      it('不正なenvironmentIdは400を返す', async () => {
        const response = await request(app)
          .post(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({
            environmentId: 'invalid-uuid',
          });

        expect(response.status).toBe(400);
      });
    });

    describe('テストスイート不存在', () => {
      it('存在しないテストスイートは403を返す', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const response = await request(app)
          .post(`/internal/api/test-suites/${nonExistentId}/executions`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET)
          .send({});

        expect(response.status).toBe(403);
      });
    });
  });
});
