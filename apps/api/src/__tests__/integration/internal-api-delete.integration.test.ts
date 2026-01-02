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
  cleanupTestData,
} from './test-helpers.js';

describe('Internal API Delete Endpoints Integration Tests', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testProject: Awaited<ReturnType<typeof createTestProject>>;
  let testSuite: Awaited<ReturnType<typeof createTestSuite>>;
  let testCase: Awaited<ReturnType<typeof createTestCase>>;

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

    // テストスイートを作成
    testSuite = await createTestSuite(testProject.id);

    // テストケースを作成
    testCase = await createTestCase(testSuite.id, { title: 'Test Case for Delete' });
  });

  describe('DELETE /internal/api/test-suites/:testSuiteId', () => {
    describe('正常系', () => {
      it('テストスイートを削除できる', async () => {
        const response = await request(app)
          .delete(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          deletedId: testSuite.id,
        });

        // DBで論理削除されていることを確認
        const deletedSuite = await prisma.testSuite.findUnique({
          where: { id: testSuite.id },
        });
        expect(deletedSuite?.deletedAt).not.toBeNull();
      });

      it('削除後はGET APIで取得できない', async () => {
        // 削除
        await request(app)
          .delete(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        // 取得を試みる（削除済みエンティティへのアクセスは403になる）
        const response = await request(app)
          .get(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        // 認可チェックで403になる（論理削除済みのため）
        expect(response.status).toBe(403);
      });
    });

    describe('異常系', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        const anotherUser = await createTestUser();

        const response = await request(app)
          .delete(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });

      it('存在しないテストスイートは403を返す', async () => {
        // 認可チェックで403になる（存在しない場合もアクセス権限なしとなる）
        const response = await request(app)
          .delete('/internal/api/test-suites/00000000-0000-0000-0000-000000000000')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(403);
      });

      it('userIdがないと400を返す', async () => {
        const response = await request(app)
          .delete(`/internal/api/test-suites/${testSuite.id}`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      });

      it('内部APIキーがないと403を返す', async () => {
        const response = await request(app)
          .delete(`/internal/api/test-suites/${testSuite.id}`)
          .query({ userId: testUser.id });

        expect(response.status).toBe(403);
      });
    });
  });

  describe('DELETE /internal/api/test-cases/:testCaseId', () => {
    describe('正常系', () => {
      it('テストケースを削除できる', async () => {
        const response = await request(app)
          .delete(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          deletedId: testCase.id,
        });

        // DBで論理削除されていることを確認
        const deletedCase = await prisma.testCase.findUnique({
          where: { id: testCase.id },
        });
        expect(deletedCase?.deletedAt).not.toBeNull();
      });

      it('削除後はGET APIで取得できない', async () => {
        // 削除
        await request(app)
          .delete(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        // 取得を試みる
        const response = await request(app)
          .get(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(404);
      });
    });

    describe('異常系', () => {
      it('アクセス権のないユーザーは403を返す', async () => {
        const anotherUser = await createTestUser();

        const response = await request(app)
          .delete(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: anotherUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
      });

      it('存在しないテストケースは404を返す', async () => {
        const response = await request(app)
          .delete('/internal/api/test-cases/00000000-0000-0000-0000-000000000000')
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(404);
      });

      it('既に削除済みのテストケースは404を返す', async () => {
        // 先に削除
        await request(app)
          .delete(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        // 再度削除を試みる
        const response = await request(app)
          .delete(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id })
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(404);
      });

      it('userIdがないと400を返す', async () => {
        const response = await request(app)
          .delete(`/internal/api/test-cases/${testCase.id}`)
          .set('X-Internal-API-Key', env.INTERNAL_API_SECRET);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      });

      it('内部APIキーがないと403を返す', async () => {
        const response = await request(app)
          .delete(`/internal/api/test-cases/${testCase.id}`)
          .query({ userId: testUser.id });

        expect(response.status).toBe(403);
      });
    });
  });
});
