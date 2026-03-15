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
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError } from '@agentest/shared';
import { createApp } from '../../app.js';

// グローバルな認証状態（モック用）
let mockAuthUser: { id: string; email: string } | null = null;
let mockProjectRole: string | null = null;

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
  requireProjectRole: (roles: string[]) => (_req: any, _res: any, next: any) => {
    if (!mockProjectRole || !roles.includes(mockProjectRole)) {
      return next(new AuthorizationError('権限がありません'));
    }
    next();
  },
  authenticate:
    (_options: { optional?: boolean } = {}) =>
    (req: any, _res: any, next: any) => {
      if (mockAuthUser) req.user = mockAuthUser;
      next();
    },
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

// テスト用認証設定関数
function setTestAuth(
  user: { id: string; email: string } | null,
  projectRole: string | null = null
) {
  mockAuthUser = user;
  mockProjectRole = projectRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockProjectRole = null;
}

describe('Project Environments API Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let writer: Awaited<ReturnType<typeof createTestUser>>;
  let reader: Awaited<ReturnType<typeof createTestUser>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let devEnv: Awaited<ReturnType<typeof createTestEnvironment>>;
  let stagingEnv: Awaited<ReturnType<typeof createTestEnvironment>>;

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
    owner = await createTestUser({ email: 'owner@example.com', name: 'Owner' });
    admin = await createTestUser({ email: 'admin@example.com', name: 'Admin' });
    writer = await createTestUser({ email: 'writer@example.com', name: 'Writer' });
    reader = await createTestUser({ email: 'reader@example.com', name: 'Reader' });

    // プロジェクトを作成
    project = await createTestProject(owner.id, {
      name: 'Test Project',
      description: 'Test description',
    });

    // メンバーを追加
    await createTestProjectMember(project.id, admin.id, 'ADMIN');
    await createTestProjectMember(project.id, writer.id, 'WRITE');
    await createTestProjectMember(project.id, reader.id, 'READ');

    // 環境を作成
    devEnv = await createTestEnvironment(project.id, {
      name: 'Development',
      baseUrl: 'http://localhost:3000',
      isDefault: true,
      sortOrder: 0,
    });
    stagingEnv = await createTestEnvironment(project.id, {
      name: 'Staging',
      baseUrl: 'http://staging.example.com',
      isDefault: false,
      sortOrder: 1,
    });

    // デフォルトでオーナーとして認証（ADMIN権限相当）
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN');
  });

  // ============================================================
  // GET /api/projects/:projectId/environments - 環境一覧取得
  // ============================================================
  describe('GET /api/projects/:projectId/environments', () => {
    it('環境一覧を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .get(`/api/projects/${project.id}/environments`)
        .expect(200);

      expect(response.body.environments).toHaveLength(2);
      expect(response.body.environments[0].name).toBe('Development');
      expect(response.body.environments[0].isDefault).toBe(true);
      expect(response.body.environments[1].name).toBe('Staging');
    });

    it('sortOrderの昇順で返される', async () => {
      const response = await request(app)
        .get(`/api/projects/${project.id}/environments`)
        .expect(200);

      expect(response.body.environments[0].sortOrder).toBe(0);
      expect(response.body.environments[1].sortOrder).toBe(1);
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .get(`/api/projects/${project.id}/environments`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('権限がない場合は403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, null);

      const response = await request(app)
        .get(`/api/projects/${project.id}/environments`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // POST /api/projects/:projectId/environments - 環境作成
  // ============================================================
  describe('POST /api/projects/:projectId/environments', () => {
    it('環境を作成できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .post(`/api/projects/${project.id}/environments`)
        .send({
          name: 'Production',
          baseUrl: 'https://example.com',
          description: 'Production environment',
        })
        .expect(201);

      expect(response.body.environment.name).toBe('Production');
      expect(response.body.environment.sortOrder).toBe(2); // 既存は0, 1なので次は2
      expect(response.body.environment.isDefault).toBe(false);
    });

    it('デフォルト環境として作成すると他のデフォルトが解除される', async () => {
      const response = await request(app)
        .post(`/api/projects/${project.id}/environments`)
        .send({
          name: 'Production',
          isDefault: true,
        })
        .expect(201);

      expect(response.body.environment.isDefault).toBe(true);

      // 元のデフォルト環境が解除されていることを確認
      const updatedDevEnv = await prisma.projectEnvironment.findUnique({
        where: { id: devEnv.id },
      });
      expect(updatedDevEnv?.isDefault).toBe(false);
    });

    it('必須フィールドがない場合は400エラー', async () => {
      const response = await request(app)
        .post(`/api/projects/${project.id}/environments`)
        .send({
          // nameがない
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('READ権限では作成できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .post(`/api/projects/${project.id}/environments`)
        .send({
          name: 'Test',
        })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // PATCH /api/projects/:projectId/environments/:environmentId - 環境更新
  // ============================================================
  describe('PATCH /api/projects/:projectId/environments/:environmentId', () => {
    it('環境を更新できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .patch(`/api/projects/${project.id}/environments/${devEnv.id}`)
        .send({
          name: 'Development Updated',
          description: 'Updated description',
        })
        .expect(200);

      expect(response.body.environment.name).toBe('Development Updated');
      expect(response.body.environment.description).toBe('Updated description');
    });

    it('デフォルト環境に設定すると他のデフォルトが解除される', async () => {
      const response = await request(app)
        .patch(`/api/projects/${project.id}/environments/${stagingEnv.id}`)
        .send({
          isDefault: true,
        })
        .expect(200);

      expect(response.body.environment.isDefault).toBe(true);

      // 元のデフォルト環境が解除されていることを確認
      const updatedDevEnv = await prisma.projectEnvironment.findUnique({
        where: { id: devEnv.id },
      });
      expect(updatedDevEnv?.isDefault).toBe(false);
    });

    it('baseUrlを更新できる', async () => {
      const response = await request(app)
        .patch(`/api/projects/${project.id}/environments/${devEnv.id}`)
        .send({
          baseUrl: 'http://localhost:4000',
        })
        .expect(200);

      expect(response.body.environment.baseUrl).toBe('http://localhost:4000');
    });

    it('baseUrlをnullに設定できる', async () => {
      const response = await request(app)
        .patch(`/api/projects/${project.id}/environments/${devEnv.id}`)
        .send({
          baseUrl: null,
        })
        .expect(200);

      expect(response.body.environment.baseUrl).toBeNull();
    });

    it('存在しない環境は404エラー', async () => {
      const response = await request(app)
        .patch(`/api/projects/${project.id}/environments/non-existent-id`)
        .send({
          name: 'Test',
        })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('READ権限では更新できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .patch(`/api/projects/${project.id}/environments/${devEnv.id}`)
        .send({
          name: 'Test',
        })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // DELETE /api/projects/:projectId/environments/:environmentId - 環境削除
  // ============================================================
  describe('DELETE /api/projects/:projectId/environments/:environmentId', () => {
    it('環境を削除できる', async () => {
      await request(app)
        .delete(`/api/projects/${project.id}/environments/${stagingEnv.id}`)
        .expect(204);

      const deletedEnv = await prisma.projectEnvironment.findUnique({
        where: { id: stagingEnv.id },
      });
      expect(deletedEnv).toBeNull();
    });

    it('デフォルト環境を削除すると次の環境が昇格する', async () => {
      await request(app)
        .delete(`/api/projects/${project.id}/environments/${devEnv.id}`)
        .expect(204);

      // staging環境がデフォルトに昇格していることを確認
      const updatedStagingEnv = await prisma.projectEnvironment.findUnique({
        where: { id: stagingEnv.id },
      });
      expect(updatedStagingEnv?.isDefault).toBe(true);
    });

    it('テストがある環境も削除できる', async () => {
      // テストスイートを作成
      const testSuite = await createTestSuite(project.id);
      // テストを作成
      await createTestExecution(stagingEnv.id, testSuite.id);

      await request(app)
        .delete(`/api/projects/${project.id}/environments/${stagingEnv.id}`)
        .expect(204);
    });

    it('存在しない環境は404エラー', async () => {
      const response = await request(app)
        .delete(`/api/projects/${project.id}/environments/non-existent-id`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('WRITE権限では削除できない', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .delete(`/api/projects/${project.id}/environments/${stagingEnv.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('READ権限では削除できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .delete(`/api/projects/${project.id}/environments/${stagingEnv.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // POST /api/projects/:projectId/environments/reorder - 環境並替
  // ============================================================
  describe('POST /api/projects/:projectId/environments/reorder', () => {
    let prodEnv: Awaited<ReturnType<typeof createTestEnvironment>>;

    beforeEach(async () => {
      // 3つ目の環境を追加
      prodEnv = await createTestEnvironment(project.id, {
        name: 'Production',
        sortOrder: 2,
      });
    });

    it('環境の並び順を変更できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .post(`/api/projects/${project.id}/environments/reorder`)
        .send({
          environmentIds: [prodEnv.id, devEnv.id, stagingEnv.id],
        })
        .expect(200);

      expect(response.body.environments).toHaveLength(3);
      expect(response.body.environments[0].id).toBe(prodEnv.id);
      expect(response.body.environments[0].sortOrder).toBe(0);
      expect(response.body.environments[1].id).toBe(devEnv.id);
      expect(response.body.environments[1].sortOrder).toBe(1);
      expect(response.body.environments[2].id).toBe(stagingEnv.id);
      expect(response.body.environments[2].sortOrder).toBe(2);
    });

    it('一部の環境のみ指定しても並替できる', async () => {
      await request(app)
        .post(`/api/projects/${project.id}/environments/reorder`)
        .send({
          environmentIds: [stagingEnv.id, devEnv.id],
        })
        .expect(200);

      // 指定された2つの環境のsortOrderが更新される
      const updatedStaging = await prisma.projectEnvironment.findUnique({
        where: { id: stagingEnv.id },
      });
      const updatedDev = await prisma.projectEnvironment.findUnique({
        where: { id: devEnv.id },
      });
      expect(updatedStaging?.sortOrder).toBe(0);
      expect(updatedDev?.sortOrder).toBe(1);
    });

    it('存在しない環境IDを含む場合は404エラー', async () => {
      // 有効なUUID形式だが存在しない環境ID
      const response = await request(app)
        .post(`/api/projects/${project.id}/environments/reorder`)
        .send({
          environmentIds: [devEnv.id, '00000000-0000-0000-0000-000000000000'],
        })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('無効なUUID形式はバリデーションエラー', async () => {
      const response = await request(app)
        .post(`/api/projects/${project.id}/environments/reorder`)
        .send({
          environmentIds: [devEnv.id, 'non-existent-id'],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('environmentIdsが配列でない場合は400エラー', async () => {
      const response = await request(app)
        .post(`/api/projects/${project.id}/environments/reorder`)
        .send({
          environmentIds: 'not-an-array',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('空の配列は400エラー（min(1)制約）', async () => {
      const response = await request(app)
        .post(`/api/projects/${project.id}/environments/reorder`)
        .send({
          environmentIds: [],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('READ権限では並替できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ');

      const response = await request(app)
        .post(`/api/projects/${project.id}/environments/reorder`)
        .send({
          environmentIds: [stagingEnv.id, devEnv.id],
        })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // 権限マトリクステスト
  // ============================================================
  describe('Permission Matrix', () => {
    describe('ADMIN role', () => {
      beforeEach(() => {
        setTestAuth({ id: admin.id, email: admin.email }, 'ADMIN');
      });

      it('環境一覧を取得できる', async () => {
        await request(app).get(`/api/projects/${project.id}/environments`).expect(200);
      });

      it('環境を作成できる', async () => {
        await request(app)
          .post(`/api/projects/${project.id}/environments`)
          .send({ name: 'Test' })
          .expect(201);
      });

      it('環境を更新できる', async () => {
        await request(app)
          .patch(`/api/projects/${project.id}/environments/${devEnv.id}`)
          .send({ name: 'Updated' })
          .expect(200);
      });

      it('環境を削除できる', async () => {
        await request(app)
          .delete(`/api/projects/${project.id}/environments/${stagingEnv.id}`)
          .expect(204);
      });

      it('環境を並替できる', async () => {
        await request(app)
          .post(`/api/projects/${project.id}/environments/reorder`)
          .send({ environmentIds: [stagingEnv.id, devEnv.id] })
          .expect(200);
      });
    });

    describe('WRITE role', () => {
      beforeEach(() => {
        setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');
      });

      it('環境一覧を取得できる', async () => {
        await request(app).get(`/api/projects/${project.id}/environments`).expect(200);
      });

      it('環境を作成できる', async () => {
        await request(app)
          .post(`/api/projects/${project.id}/environments`)
          .send({ name: 'Test' })
          .expect(201);
      });

      it('環境を更新できる', async () => {
        await request(app)
          .patch(`/api/projects/${project.id}/environments/${devEnv.id}`)
          .send({ name: 'Updated' })
          .expect(200);
      });

      it('環境を削除できない', async () => {
        await request(app)
          .delete(`/api/projects/${project.id}/environments/${stagingEnv.id}`)
          .expect(403);
      });

      it('環境を並替できる', async () => {
        await request(app)
          .post(`/api/projects/${project.id}/environments/reorder`)
          .send({ environmentIds: [stagingEnv.id, devEnv.id] })
          .expect(200);
      });
    });

    describe('READ role', () => {
      beforeEach(() => {
        setTestAuth({ id: reader.id, email: reader.email }, 'READ');
      });

      it('環境一覧を取得できる', async () => {
        await request(app).get(`/api/projects/${project.id}/environments`).expect(200);
      });

      it('環境を作成できない', async () => {
        await request(app)
          .post(`/api/projects/${project.id}/environments`)
          .send({ name: 'Test' })
          .expect(403);
      });

      it('環境を更新できない', async () => {
        await request(app)
          .patch(`/api/projects/${project.id}/environments/${devEnv.id}`)
          .send({ name: 'Updated' })
          .expect(403);
      });

      it('環境を削除できない', async () => {
        await request(app)
          .delete(`/api/projects/${project.id}/environments/${stagingEnv.id}`)
          .expect(403);
      });

      it('環境を並替できない', async () => {
        await request(app)
          .post(`/api/projects/${project.id}/environments/reorder`)
          .send({ environmentIds: [stagingEnv.id, devEnv.id] })
          .expect(403);
      });
    });
  });
});
