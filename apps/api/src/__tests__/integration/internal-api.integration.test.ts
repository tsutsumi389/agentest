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
            status: 'COMPLETED',
            startedAt: new Date('2024-01-01T10:00:00.000Z'),
            completedAt: new Date('2024-01-01T11:00:00.000Z'),
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
        expect(response.body.executions[0].status).toBe('COMPLETED');
      });

      it('配列パラメータでステータスフィルタできる', async () => {
        // 複数ステータスの実行履歴を作成
        await prisma.execution.createMany({
          data: [
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
              status: 'IN_PROGRESS',
              startedAt: new Date('2024-01-01T10:00:00.000Z'),
            },
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
              status: 'COMPLETED',
              startedAt: new Date('2024-01-01T11:00:00.000Z'),
              completedAt: new Date('2024-01-01T12:00:00.000Z'),
            },
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
              status: 'ABORTED',
              startedAt: new Date('2024-01-01T13:00:00.000Z'),
              completedAt: new Date('2024-01-01T13:30:00.000Z'),
            },
          ],
        });

        // 複数ステータスでフィルタ（?status=IN_PROGRESS&status=COMPLETED形式）
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/executions?userId=${testUser.id}&status=IN_PROGRESS&status=COMPLETED`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body.executions.length).toBe(2);
        const statuses = response.body.executions.map((e: { status: string }) => e.status);
        expect(statuses).toContain('IN_PROGRESS');
        expect(statuses).toContain('COMPLETED');
        expect(statuses).not.toContain('ABORTED');
      });

      it('日時範囲でフィルタできる', async () => {
        // 異なる日時の実行履歴を作成
        await prisma.execution.createMany({
          data: [
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
              status: 'COMPLETED',
              startedAt: new Date('2024-01-01T10:00:00.000Z'),
              completedAt: new Date('2024-01-01T11:00:00.000Z'),
            },
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
              status: 'COMPLETED',
              startedAt: new Date('2024-01-15T10:00:00.000Z'),
              completedAt: new Date('2024-01-15T11:00:00.000Z'),
            },
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
              status: 'COMPLETED',
              startedAt: new Date('2024-02-01T10:00:00.000Z'),
              completedAt: new Date('2024-02-01T11:00:00.000Z'),
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
              status: 'COMPLETED',
              startedAt: new Date('2024-01-01T10:00:00.000Z'),
              completedAt: new Date('2024-01-01T11:00:00.000Z'),
            },
            {
              testSuiteId: testSuite.id,
              executedByUserId: testUser.id,
              status: 'COMPLETED',
              startedAt: new Date('2024-01-02T10:00:00.000Z'),
              completedAt: new Date('2024-01-02T11:00:00.000Z'),
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
        expect(new Date(response.body.executions[0].startedAt).getTime())
          .toBeLessThan(new Date(response.body.executions[1].startedAt).getTime());
      });

      it('実行者がnullの実行履歴を返す', async () => {
        // 実行者なしの実行履歴を作成
        await prisma.execution.create({
          data: {
            testSuiteId: testSuite.id,
            executedByUserId: null,
            status: 'COMPLETED',
            startedAt: new Date('2024-01-01T10:00:00.000Z'),
            completedAt: new Date('2024-01-01T11:00:00.000Z'),
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

      it('不正なステータスは400を返す', async () => {
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}/executions?userId=${testUser.id}&status=INVALID`)
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
});
