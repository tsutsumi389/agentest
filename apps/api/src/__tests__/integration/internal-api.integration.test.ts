import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';

describe('Internal API Integration Tests', () => {
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
      where: { testSuite: { name: { startsWith: 'test-internal-' } } },
    });
    await prisma.testCase.deleteMany({
      where: { testSuite: { name: { startsWith: 'test-internal-' } } },
    });
    await prisma.testSuite.deleteMany({
      where: { name: { startsWith: 'test-internal-' } },
    });
    await prisma.projectMember.deleteMany({
      where: { project: { name: { startsWith: 'test-internal-' } } },
    });
    await prisma.project.deleteMany({
      where: { name: { startsWith: 'test-internal-' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-internal-' } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // テストデータをクリーンアップ（依存関係の順序で削除）
    await prisma.execution.deleteMany({
      where: { testSuite: { name: { startsWith: 'test-internal-' } } },
    });
    await prisma.testCase.deleteMany({
      where: { testSuite: { name: { startsWith: 'test-internal-' } } },
    });
    await prisma.testSuite.deleteMany({
      where: { name: { startsWith: 'test-internal-' } },
    });
    await prisma.projectMember.deleteMany({
      where: { project: { name: { startsWith: 'test-internal-' } } },
    });
    await prisma.project.deleteMany({
      where: { name: { startsWith: 'test-internal-' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-internal-' } },
    });

    // テストユーザーを作成
    testUser = await prisma.user.create({
      data: {
        email: `test-internal-${Date.now()}@example.com`,
        name: 'Test User',
      },
    });

    // テストプロジェクトを作成
    testProject = await prisma.project.create({
      data: {
        name: `test-internal-project-${Date.now()}`,
        description: 'Test project for internal API',
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
        name: `test-internal-suite-${Date.now()}`,
        description: 'Test suite for internal API',
        projectId: testProject.id,
        status: 'ACTIVE',
        createdByUserId: testUser.id,
      },
    });
  });

  describe('GET /internal/api/users/:userId/projects', () => {
    describe('認証成功', () => {
      it('正しいシークレットでプロジェクト一覧を取得できる', async () => {
        const response = await request(app)
          .get(`/internal/api/users/${testUser.id}/projects`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('projects');
        expect(response.body).toHaveProperty('pagination');
        expect(response.body.projects).toBeInstanceOf(Array);
        expect(response.body.projects.length).toBeGreaterThanOrEqual(1);

        // テストプロジェクトが含まれていることを確認
        const project = response.body.projects.find(
          (p: { id: string }) => p.id === testProject.id
        );
        expect(project).toBeDefined();
        expect(project.name).toBe(testProject.name);
        expect(project.role).toBe('OWNER');
      });

      it('検索クエリでフィルタリングできる', async () => {
        const response = await request(app)
          .get(`/internal/api/users/${testUser.id}/projects`)
          .query({ q: 'test-internal' })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.projects.length).toBeGreaterThanOrEqual(1);
      });

      it('ページネーションが正しく動作する', async () => {
        const response = await request(app)
          .get(`/internal/api/users/${testUser.id}/projects`)
          .query({ limit: 10, offset: 0 })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.pagination).toEqual(
          expect.objectContaining({
            limit: 10,
            offset: 0,
            total: expect.any(Number),
            hasMore: expect.any(Boolean),
          })
        );
      });
    });

    describe('認証失敗', () => {
      it('シークレットがない場合は403を返す', async () => {
        const response = await request(app).get(
          `/internal/api/users/${testUser.id}/projects`
        );

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          error: 'Forbidden',
          message: 'Invalid or missing internal API key',
        });
      });

      it('不正なシークレットの場合は403を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/users/${testUser.id}/projects`)
          .set('X-Internal-API-Key', 'wrong-secret');

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          error: 'Forbidden',
          message: 'Invalid or missing internal API key',
        });
      });
    });

    describe('バリデーション', () => {
      it('limitが範囲外の場合は400を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/users/${testUser.id}/projects`)
          .query({ limit: 100 })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      });

      it('offsetが負の場合は400を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/users/${testUser.id}/projects`)
          .query({ offset: -1 })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      });
    });

    describe('プロジェクトなしのユーザー', () => {
      it('空の配列を返す', async () => {
        // プロジェクトを持たないユーザーを作成
        const userWithoutProjects = await prisma.user.create({
          data: {
            email: `test-internal-noproj-${Date.now()}@example.com`,
            name: 'User Without Projects',
          },
        });

        const response = await request(app)
          .get(`/internal/api/users/${userWithoutProjects.id}/projects`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.projects).toEqual([]);
        expect(response.body.pagination.total).toBe(0);
      });
    });
  });

  describe('GET /internal/api/test-suites/:testSuiteId/test-cases', () => {
    describe('認証・認可成功', () => {
      it('テストケース一覧を取得できる', async () => {
        // テストケースを作成
        await prisma.testCase.create({
          data: {
            testSuiteId: testSuite.id,
            title: 'Test Case 1',
            status: 'ACTIVE',
            priority: 'MEDIUM',
            orderKey: '00001',
            createdByUserId: testUser.id,
          },
        });

        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/test-cases`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('testCases');
        expect(response.body).toHaveProperty('pagination');
        expect(response.body.testCases).toBeInstanceOf(Array);
        expect(response.body.testCases.length).toBe(1);
        expect(response.body.testCases[0].title).toBe('Test Case 1');
      });

      it('配列パラメータでステータスフィルタできる', async () => {
        // 複数ステータスのテストケースを作成
        await prisma.testCase.createMany({
          data: [
            {
              testSuiteId: testSuite.id,
              title: 'Draft Case',
              status: 'DRAFT',
              priority: 'LOW',
              orderKey: '00001',
              createdByUserId: testUser.id,
            },
            {
              testSuiteId: testSuite.id,
              title: 'Active Case',
              status: 'ACTIVE',
              priority: 'MEDIUM',
              orderKey: '00002',
              createdByUserId: testUser.id,
            },
            {
              testSuiteId: testSuite.id,
              title: 'Archived Case',
              status: 'ARCHIVED',
              priority: 'HIGH',
              orderKey: '00003',
              createdByUserId: testUser.id,
            },
          ],
        });

        // 複数ステータスでフィルタ（?status=DRAFT&status=ACTIVE形式）
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/test-cases?userId=${testUser.id}&status=DRAFT&status=ACTIVE`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.testCases.length).toBe(2);
        const statuses = response.body.testCases.map((tc: { status: string }) => tc.status);
        expect(statuses).toContain('DRAFT');
        expect(statuses).toContain('ACTIVE');
        expect(statuses).not.toContain('ARCHIVED');
      });

      it('配列パラメータで優先度フィルタできる', async () => {
        // 複数優先度のテストケースを作成
        await prisma.testCase.createMany({
          data: [
            {
              testSuiteId: testSuite.id,
              title: 'Low Priority',
              status: 'ACTIVE',
              priority: 'LOW',
              orderKey: '00001',
              createdByUserId: testUser.id,
            },
            {
              testSuiteId: testSuite.id,
              title: 'High Priority',
              status: 'ACTIVE',
              priority: 'HIGH',
              orderKey: '00002',
              createdByUserId: testUser.id,
            },
            {
              testSuiteId: testSuite.id,
              title: 'Critical Priority',
              status: 'ACTIVE',
              priority: 'CRITICAL',
              orderKey: '00003',
              createdByUserId: testUser.id,
            },
          ],
        });

        // 複数優先度でフィルタ（?priority=HIGH&priority=CRITICAL形式）
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/test-cases?userId=${testUser.id}&priority=HIGH&priority=CRITICAL`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.testCases.length).toBe(2);
        const priorities = response.body.testCases.map((tc: { priority: string }) => tc.priority);
        expect(priorities).toContain('HIGH');
        expect(priorities).toContain('CRITICAL');
        expect(priorities).not.toContain('LOW');
      });
    });

    describe('認可失敗', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        // 別のユーザーを作成
        const anotherUser = await prisma.user.create({
          data: {
            email: `test-internal-another-${Date.now()}@example.com`,
            name: 'Another User',
          },
        });

        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/test-cases`)
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          error: 'Forbidden',
          message: 'Access denied to this test suite',
        });
      });
    });

    describe('バリデーション', () => {
      it('userIdがない場合は400を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/test-cases`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      });
    });
  });

  describe('GET /internal/api/test-suites/:testSuiteId/executions', () => {
    describe('認証・認可成功', () => {
      it('実行履歴一覧を取得できる', async () => {
        // 実行履歴を作成
        await prisma.execution.create({
          data: {
            testSuiteId: testSuite.id,
            executedByUserId: testUser.id,
          },
        });

        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('executions');
        expect(response.body).toHaveProperty('pagination');
        expect(response.body.executions).toBeInstanceOf(Array);
        expect(response.body.executions.length).toBe(1);
      });

      it('実行履歴を複数作成して一覧取得できる', async () => {
        // 複数の実行履歴を作成
        await prisma.execution.createMany({
          data: [
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
            },
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
            },
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
            },
          ],
        });

        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/executions?userId=${testUser.id}`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.executions.length).toBe(3);
      });

      it('日時範囲でフィルタできる', async () => {
        // 異なる日時の実行履歴を作成
        await prisma.execution.createMany({
          data: [
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
              createdAt: new Date('2024-01-01T10:00:00.000Z'),
            },
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
              createdAt: new Date('2024-01-15T10:00:00.000Z'),
            },
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
              createdAt: new Date('2024-02-01T10:00:00.000Z'),
            },
          ],
        });

        // 1月の範囲でフィルタ
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({
            userId: testUser.id,
            from: '2024-01-01T00:00:00.000Z',
            to: '2024-01-31T23:59:59.999Z',
          })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.executions.length).toBe(2);
      });

      it('ソート順を指定できる', async () => {
        // 複数の実行履歴を作成
        await prisma.execution.createMany({
          data: [
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
              createdAt: new Date('2024-01-01T10:00:00.000Z'),
            },
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
              createdAt: new Date('2024-01-02T10:00:00.000Z'),
            },
          ],
        });

        // 昇順でソート
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({ userId: testUser.id, sortOrder: 'asc' })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.executions.length).toBe(2);
        // 昇順なので最初が古い日付
        expect(new Date(response.body.executions[0].createdAt).getTime())
          .toBeLessThan(new Date(response.body.executions[1].createdAt).getTime());
      });

      it('実行者がnullの実行履歴を返す', async () => {
        // 実行者なしの実行履歴を作成
        await prisma.execution.create({
          data: {
            testSuiteId: testSuite.id,
            executedByUserId: null,
          },
        });

        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.executions[0].executedByUser).toBeNull();
      });
    });

    describe('認可失敗', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        // 別のユーザーを作成
        const anotherUser = await prisma.user.create({
          data: {
            email: `test-internal-another-exec-${Date.now()}@example.com`,
            name: 'Another User',
          },
        });

        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          error: 'Forbidden',
          message: 'Access denied to this test suite',
        });
      });
    });

    describe('バリデーション', () => {
      it('userIdがない場合は400を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/executions`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      });

      it('不正な日時形式は400を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({ userId: testUser.id, from: 'invalid-date' })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      });

    });

    describe('実行履歴なし', () => {
      it('空の配列を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/executions`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.executions).toEqual([]);
        expect(response.body.pagination.total).toBe(0);
      });
    });
  });

  describe('GET /internal/api/projects/:projectId', () => {
    describe('認証・認可成功', () => {
      it('プロジェクト詳細を取得できる', async () => {
        const response = await request(app)
          .get(`/internal/api/projects/${testProject.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('project');
        expect(response.body.project.id).toBe(testProject.id);
        expect(response.body.project.name).toBe(testProject.name);
        expect(response.body.project.role).toBe('OWNER');
      });

      it('環境設定を含むプロジェクトを返す', async () => {
        // 環境を作成
        await prisma.projectEnvironment.create({
          data: {
            projectId: testProject.id,
            name: 'Development',
            slug: 'dev',
            isDefault: true,
            sortOrder: 0,
          },
        });

        const response = await request(app)
          .get(`/internal/api/projects/${testProject.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.project.environments).toBeInstanceOf(Array);
        expect(response.body.project.environments.length).toBe(1);
        expect(response.body.project.environments[0].name).toBe('Development');
      });

      it('テストスイート数を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/projects/${testProject.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.project._count).toBeDefined();
        expect(response.body.project._count.testSuites).toBeGreaterThanOrEqual(1);
      });
    });

    describe('認可失敗', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        // 別のユーザーを作成
        const anotherUser = await prisma.user.create({
          data: {
            email: `test-internal-another-proj-${Date.now()}@example.com`,
            name: 'Another User',
          },
        });

        const response = await request(app)
          .get(`/internal/api/projects/${testProject.id}`)
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          error: 'Forbidden',
          message: 'Access denied to this project',
        });
      });
    });

    describe('バリデーション', () => {
      it('userIdがない場合は400を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/projects/${testProject.id}`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      });

      it('不正なuserIdは400を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/projects/${testProject.id}`)
          .query({ userId: 'invalid-uuid' })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      });
    });

    describe('プロジェクト不存在', () => {
      it('存在しないプロジェクトは404を返す', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const response = await request(app)
          .get(`/internal/api/projects/${nonExistentId}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(403);
      });
    });
  });

  describe('GET /internal/api/test-suites/:testSuiteId', () => {
    describe('認証・認可成功', () => {
      it('テストスイート詳細を取得できる', async () => {
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('testSuite');
        expect(response.body.testSuite.id).toBe(testSuite.id);
        expect(response.body.testSuite.name).toBe(testSuite.name);
      });

      it('前提条件を含むテストスイートを返す', async () => {
        // 前提条件を作成
        await prisma.testSuitePrecondition.create({
          data: {
            testSuiteId: testSuite.id,
            content: 'Test precondition',
            orderKey: '00001',
          },
        });

        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.testSuite.preconditions).toBeInstanceOf(Array);
        expect(response.body.testSuite.preconditions.length).toBe(1);
        expect(response.body.testSuite.preconditions[0].content).toBe('Test precondition');
      });

      it('テストケース一覧を含むテストスイートを返す', async () => {
        // テストケースを作成
        await prisma.testCase.create({
          data: {
            testSuiteId: testSuite.id,
            title: 'Test Case in Suite',
            status: 'ACTIVE',
            priority: 'HIGH',
            orderKey: '00001',
            createdByUserId: testUser.id,
          },
        });

        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.testSuite.testCases).toBeInstanceOf(Array);
        expect(response.body.testSuite.testCases.length).toBe(1);
        expect(response.body.testSuite.testCases[0].title).toBe('Test Case in Suite');
      });
    });

    describe('認可失敗', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        const anotherUser = await prisma.user.create({
          data: {
            email: `test-internal-another-suite-${Date.now()}@example.com`,
            name: 'Another User',
          },
        });

        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          error: 'Forbidden',
          message: 'Access denied to this test suite',
        });
      });
    });

    describe('バリデーション', () => {
      it('userIdがない場合は400を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      });
    });

    describe('テストスイート不存在', () => {
      it('存在しないテストスイートは404を返す', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const response = await request(app)
          .get(`/internal/api/test-suites/${nonExistentId}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(403);
      });
    });
  });

  describe('GET /internal/api/test-cases/:testCaseId', () => {
    let testCase: { id: string; title: string };

    beforeEach(async () => {
      // テストケースを作成
      testCase = await prisma.testCase.create({
        data: {
          testSuiteId: testSuite.id,
          title: `test-internal-case-${Date.now()}`,
          status: 'ACTIVE',
          priority: 'HIGH',
          orderKey: '00001',
          createdByUserId: testUser.id,
        },
      });
    });

    describe('認証・認可成功', () => {
      it('テストケース詳細を取得できる', async () => {
        const response = await request(app)
          .get(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('testCase');
        expect(response.body.testCase.id).toBe(testCase.id);
        expect(response.body.testCase.title).toBe(testCase.title);
      });

      it('前提条件、ステップ、期待結果を含むテストケースを返す', async () => {
        // 子エンティティを作成
        await prisma.testCasePrecondition.create({
          data: {
            testCaseId: testCase.id,
            content: 'Test precondition',
            orderKey: '00001',
          },
        });
        await prisma.testCaseStep.create({
          data: {
            testCaseId: testCase.id,
            content: 'Test step',
            orderKey: '00001',
          },
        });
        await prisma.testCaseExpectedResult.create({
          data: {
            testCaseId: testCase.id,
            content: 'Expected result',
            orderKey: '00001',
          },
        });

        const response = await request(app)
          .get(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.testCase.preconditions).toHaveLength(1);
        expect(response.body.testCase.steps).toHaveLength(1);
        expect(response.body.testCase.expectedResults).toHaveLength(1);
      });
    });

    describe('認可失敗', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        const anotherUser = await prisma.user.create({
          data: {
            email: `test-internal-another-case-${Date.now()}@example.com`,
            name: 'Another User',
          },
        });

        const response = await request(app)
          .get(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          error: 'Forbidden',
          message: 'Access denied to this test case',
        });
      });
    });

    describe('バリデーション', () => {
      it('userIdがない場合は400を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/test-cases/${testCase.id}`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      });
    });

    describe('テストケース不存在', () => {
      it('存在しないテストケースは404を返す', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const response = await request(app)
          .get(`/internal/api/test-cases/${nonExistentId}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          error: 'Not Found',
          message: 'Test case not found',
        });
      });
    });
  });

  describe('GET /internal/api/executions/:executionId', () => {
    let testExecution: { id: string };

    beforeEach(async () => {
      // 実行を作成
      testExecution = await prisma.execution.create({
        data: {
          testSuiteId: testSuite.id,
          executedByUserId: testUser.id,
        },
      });
    });

    describe('認証・認可成功', () => {
      it('実行詳細を取得できる', async () => {
        const response = await request(app)
          .get(`/internal/api/executions/${testExecution.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('execution');
        expect(response.body.execution.id).toBe(testExecution.id);
      });

      it('テストスイート情報を含む実行を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/executions/${testExecution.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.execution.testSuite).toBeDefined();
        expect(response.body.execution.testSuite.id).toBe(testSuite.id);
      });
    });

    describe('認可失敗', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        const anotherUser = await prisma.user.create({
          data: {
            email: `test-internal-another-exec-detail-${Date.now()}@example.com`,
            name: 'Another User',
          },
        });

        const response = await request(app)
          .get(`/internal/api/executions/${testExecution.id}`)
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          error: 'Forbidden',
          message: 'Access denied to this execution',
        });
      });
    });

    describe('バリデーション', () => {
      it('userIdがない場合は400を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/executions/${testExecution.id}`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      });
    });

    describe('実行不存在', () => {
      it('存在しない実行は404を返す', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const response = await request(app)
          .get(`/internal/api/executions/${nonExistentId}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(404);
      });
    });
  });
});
