import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestProjectMember,
  createTestSuite,
  createTestReview,
  createTestReviewComment,
  createTestReviewReply,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError, NotFoundError } from '@agentest/shared';
import { createApp } from '../../app.js';

// グローバルな認証状態（モック用）- vi.hoisted()でvi.mock()ファクトリから安全に参照
const mockState = vi.hoisted(() => ({
  authUser: null as { id: string; email: string } | null,
  testSuiteRole: null as string | null,
}));

// 認証ミドルウェアをモック
vi.mock('@agentest/auth', () => ({
  requireAuth: () => (req: any, _res: any, next: any) => {
    if (!mockState.authUser) {
      return next(new AuthenticationError('認証が必要です'));
    }
    req.user = mockState.authUser;
    next();
  },
  optionalAuth: () => (_req: any, _res: any, next: any) => next(),
  requireOrgRole: () => (_req: any, _res: any, next: any) => next(),
  requireProjectRole: () => (_req: any, _res: any, next: any) => next(),
  authenticate:
    (_options: { optional?: boolean } = {}) =>
    (req: any, _res: any, next: any) => {
      if (mockState.authUser) req.user = mockState.authUser;
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

// テストスイート権限ミドルウェアをモック
vi.mock('../../middleware/require-test-suite-role.js', () => ({
  requireTestSuiteRole:
    (roles: string[], _options?: { allowDeletedSuite?: boolean }) =>
    async (req: any, _res: any, next: any) => {
      if (!mockState.testSuiteRole || !roles.includes(mockState.testSuiteRole)) {
        return next(new AuthorizationError('権限がありません'));
      }
      const testSuiteId = req.params.testSuiteId;
      if (testSuiteId) {
        const testSuite = await prisma.testSuite.findUnique({ where: { id: testSuiteId } });
        if (!testSuite) {
          return next(new NotFoundError('TestSuite', testSuiteId));
        }
      }
      next();
    },
}));

// テストケース権限ミドルウェアをモック
vi.mock('../../middleware/require-test-case-role.js', () => ({
  requireTestCaseRole: () => async (_req: any, _res: any, next: any) => next(),
}));

// レビューコメント権限ミドルウェアをモック
vi.mock('../../middleware/require-review-comment-role.js', () => ({
  requireReviewCommentRole: () => async (_req: any, _res: any, next: any) => next(),
}));

function setTestAuth(
  user: { id: string; email: string } | null,
  testSuiteRole: string | null = null
) {
  mockState.authUser = user;
  mockState.testSuiteRole = testSuiteRole;
}

function clearTestAuth() {
  mockState.authUser = null;
  mockState.testSuiteRole = null;
}

describe('Reviews API Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let writer: Awaited<ReturnType<typeof createTestUser>>;
  let otherUser: Awaited<ReturnType<typeof createTestUser>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
  let testSuite: Awaited<ReturnType<typeof createTestSuite>>;

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
    writer = await createTestUser({ email: 'writer@example.com', name: 'Writer' });
    otherUser = await createTestUser({ email: 'other@example.com', name: 'Other' });

    // プロジェクトを作成
    project = await createTestProject(owner.id, { name: 'Test Project' });
    await createTestProjectMember(project.id, writer.id, 'WRITE');

    // テストスイートを作成
    testSuite = await createTestSuite(project.id, { name: 'Test Suite' });

    // デフォルトでオーナーとして認証
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN');
  });

  // ============================================================
  // POST /api/test-suites/:testSuiteId/reviews - レビュー開始
  // ============================================================
  describe('POST /api/test-suites/:testSuiteId/reviews', () => {
    it('レビューを開始できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      const response = await request(app)
        .post(`/api/test-suites/${testSuite.id}/reviews`)
        .send({ summary: 'テストレビュー' });

      expect(response.status).toBe(201);
      expect(response.body.review).toBeDefined();
      expect(response.body.review.status).toBe('DRAFT');
      expect(response.body.review.summary).toBe('テストレビュー');
    });

    it('未認証の場合は401を返す', async () => {
      clearTestAuth();

      const response = await request(app).post(`/api/test-suites/${testSuite.id}/reviews`).send({});

      expect(response.status).toBe(401);
    });

    it('同じテストスイートに複数の下書きを作成できない', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      // 最初のレビュー作成
      await request(app).post(`/api/test-suites/${testSuite.id}/reviews`).send({});

      // 2つ目のレビュー作成（失敗するはず）
      const response = await request(app).post(`/api/test-suites/${testSuite.id}/reviews`).send({});

      expect(response.status).toBe(400);
    });
  });

  // ============================================================
  // GET /api/test-suites/:testSuiteId/reviews - レビュー一覧取得
  // ============================================================
  describe('GET /api/test-suites/:testSuiteId/reviews', () => {
    it('SUBMITTEDレビュー一覧を取得できる', async () => {
      // SUBMITTEDレビューを作成
      await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'SUBMITTED',
        verdict: 'APPROVED',
        submittedAt: new Date(),
      });
      // DRAFTレビュー（一覧に含まれない）
      await createTestReview(testSuite.id, {
        authorUserId: writer.id,
        status: 'DRAFT',
      });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/reviews`)
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.reviews).toHaveLength(1);
      expect(response.body.reviews[0].status).toBe('SUBMITTED');
      expect(response.body.total).toBe(1);
    });

    it('verdictでフィルタできる', async () => {
      await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'SUBMITTED',
        verdict: 'APPROVED',
        submittedAt: new Date(),
      });
      await createTestReview(testSuite.id, {
        authorUserId: writer.id,
        status: 'SUBMITTED',
        verdict: 'CHANGES_REQUESTED',
        submittedAt: new Date(),
      });

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/reviews`)
        .query({ limit: 10, offset: 0, verdict: 'APPROVED' });

      expect(response.status).toBe(200);
      expect(response.body.reviews).toHaveLength(1);
      expect(response.body.reviews[0].verdict).toBe('APPROVED');
    });
  });

  // ============================================================
  // GET /api/reviews/drafts - 下書き一覧取得
  // ============================================================
  describe('GET /api/reviews/drafts', () => {
    it('自分の下書きレビュー一覧を取得できる', async () => {
      await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'DRAFT',
      });
      // 他人の下書き
      await createTestReview(testSuite.id, {
        authorUserId: writer.id,
        status: 'DRAFT',
      });

      const response = await request(app).get('/api/reviews/drafts');

      expect(response.status).toBe(200);
      expect(response.body.reviews).toHaveLength(1);
      expect(response.body.reviews[0].authorUserId).toBe(owner.id);
    });
  });

  // ============================================================
  // GET /api/reviews/:reviewId - レビュー詳細取得
  // ============================================================
  describe('GET /api/reviews/:reviewId', () => {
    it('SUBMITTEDレビューは誰でも取得できる', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'SUBMITTED',
        verdict: 'APPROVED',
        submittedAt: new Date(),
      });

      setTestAuth({ id: otherUser.id, email: otherUser.email }, 'READ');

      const response = await request(app).get(`/api/reviews/${review.id}`);

      expect(response.status).toBe(200);
      expect(response.body.review.id).toBe(review.id);
    });

    it('DRAFTレビューは投稿者本人のみ取得できる', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'DRAFT',
      });

      const response = await request(app).get(`/api/reviews/${review.id}`);

      expect(response.status).toBe(200);
      expect(response.body.review.id).toBe(review.id);
    });

    it('他人のDRAFTレビューは404を返す', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'DRAFT',
      });

      setTestAuth({ id: otherUser.id, email: otherUser.email });

      const response = await request(app).get(`/api/reviews/${review.id}`);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================
  // PATCH /api/reviews/:reviewId - レビュー更新
  // ============================================================
  describe('PATCH /api/reviews/:reviewId', () => {
    it('DRAFTレビューを更新できる', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'DRAFT',
      });

      const response = await request(app)
        .patch(`/api/reviews/${review.id}`)
        .send({ summary: '更新サマリー' });

      expect(response.status).toBe(200);
      expect(response.body.review.summary).toBe('更新サマリー');
    });

    it('他人のレビューは更新できない', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: writer.id,
        status: 'DRAFT',
      });

      const response = await request(app)
        .patch(`/api/reviews/${review.id}`)
        .send({ summary: '更新' });

      expect(response.status).toBe(403);
    });

    it('SUBMITTEDレビューは更新できない', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'SUBMITTED',
        verdict: 'APPROVED',
        submittedAt: new Date(),
      });

      const response = await request(app)
        .patch(`/api/reviews/${review.id}`)
        .send({ summary: '更新' });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================
  // POST /api/reviews/:reviewId/submit - レビュー提出
  // ============================================================
  describe('POST /api/reviews/:reviewId/submit', () => {
    it('DRAFTレビューを提出できる', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'DRAFT',
      });

      const response = await request(app)
        .post(`/api/reviews/${review.id}/submit`)
        .send({ verdict: 'APPROVED', summary: '最終サマリー' });

      expect(response.status).toBe(200);
      expect(response.body.review.status).toBe('SUBMITTED');
      expect(response.body.review.verdict).toBe('APPROVED');
    });

    it('他人のレビューは提出できない', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: writer.id,
        status: 'DRAFT',
      });

      const response = await request(app)
        .post(`/api/reviews/${review.id}/submit`)
        .send({ verdict: 'APPROVED' });

      expect(response.status).toBe(403);
    });
  });

  // ============================================================
  // PATCH /api/reviews/:reviewId/verdict - 評価変更
  // ============================================================
  describe('PATCH /api/reviews/:reviewId/verdict', () => {
    it('SUBMITTEDレビューの評価を変更できる', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'SUBMITTED',
        verdict: 'APPROVED',
        submittedAt: new Date(),
      });

      const response = await request(app)
        .patch(`/api/reviews/${review.id}/verdict`)
        .send({ verdict: 'CHANGES_REQUESTED' });

      expect(response.status).toBe(200);
      expect(response.body.review.verdict).toBe('CHANGES_REQUESTED');
    });

    it('DRAFTレビューの評価は変更できない', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'DRAFT',
      });

      const response = await request(app)
        .patch(`/api/reviews/${review.id}/verdict`)
        .send({ verdict: 'APPROVED' });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================
  // DELETE /api/reviews/:reviewId - レビュー削除
  // ============================================================
  describe('DELETE /api/reviews/:reviewId', () => {
    it('DRAFTレビューを削除できる', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'DRAFT',
      });

      const response = await request(app).delete(`/api/reviews/${review.id}`);

      expect(response.status).toBe(204);

      // 削除確認
      const deleted = await prisma.review.findUnique({ where: { id: review.id } });
      expect(deleted).toBeNull();
    });

    it('SUBMITTEDレビューは削除できない', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'SUBMITTED',
        verdict: 'APPROVED',
        submittedAt: new Date(),
      });

      const response = await request(app).delete(`/api/reviews/${review.id}`);

      expect(response.status).toBe(400);
    });

    it('他人のレビューは削除できない', async () => {
      const review = await createTestReview(testSuite.id, {
        authorUserId: writer.id,
        status: 'DRAFT',
      });

      const response = await request(app).delete(`/api/reviews/${review.id}`);

      expect(response.status).toBe(403);
    });
  });

  // ============================================================
  // レビューコメント操作
  // ============================================================
  describe('レビューコメント操作', () => {
    let review: Awaited<ReturnType<typeof createTestReview>>;

    beforeEach(async () => {
      review = await createTestReview(testSuite.id, {
        authorUserId: owner.id,
        status: 'SUBMITTED',
        verdict: 'APPROVED',
        submittedAt: new Date(),
      });
    });

    describe('POST /api/reviews/:reviewId/comments', () => {
      it('SUBMITTEDレビューにコメントを追加できる', async () => {
        const response = await request(app).post(`/api/reviews/${review.id}/comments`).send({
          targetType: 'SUITE',
          targetId: testSuite.id,
          targetField: 'TITLE',
          content: 'テストコメント',
        });

        expect(response.status).toBe(201);
        expect(response.body.comment).toBeDefined();
        expect(response.body.comment.content).toBe('テストコメント');
        expect(response.body.comment.status).toBe('OPEN');
      });
    });

    describe('PATCH /api/reviews/:reviewId/comments/:commentId', () => {
      it('自分のコメントを更新できる', async () => {
        const comment = await createTestReviewComment(review.id, {
          authorUserId: owner.id,
          targetType: 'SUITE',
          targetId: testSuite.id,
          content: '元コメント',
        });

        const response = await request(app)
          .patch(`/api/reviews/${review.id}/comments/${comment.id}`)
          .send({ content: '更新コメント' });

        expect(response.status).toBe(200);
        expect(response.body.comment.content).toBe('更新コメント');
      });

      it('他人のコメントは更新できない', async () => {
        const comment = await createTestReviewComment(review.id, {
          authorUserId: writer.id,
          targetType: 'SUITE',
          targetId: testSuite.id,
          content: '元コメント',
        });

        const response = await request(app)
          .patch(`/api/reviews/${review.id}/comments/${comment.id}`)
          .send({ content: '更新' });

        expect(response.status).toBe(403);
      });
    });

    describe('DELETE /api/reviews/:reviewId/comments/:commentId', () => {
      it('自分のコメントを削除できる', async () => {
        const comment = await createTestReviewComment(review.id, {
          authorUserId: owner.id,
          targetType: 'SUITE',
          targetId: testSuite.id,
        });

        const response = await request(app).delete(
          `/api/reviews/${review.id}/comments/${comment.id}`
        );

        expect(response.status).toBe(204);
      });
    });

    describe('返信操作', () => {
      let comment: Awaited<ReturnType<typeof createTestReviewComment>>;

      beforeEach(async () => {
        comment = await createTestReviewComment(review.id, {
          authorUserId: owner.id,
          targetType: 'SUITE',
          targetId: testSuite.id,
        });
      });

      it('返信を追加できる', async () => {
        const response = await request(app)
          .post(`/api/reviews/${review.id}/comments/${comment.id}/replies`)
          .send({ content: '返信内容' });

        expect(response.status).toBe(201);
        expect(response.body.reply.content).toBe('返信内容');
      });

      it('返信を更新できる', async () => {
        const reply = await createTestReviewReply(comment.id, {
          authorUserId: owner.id,
          content: '元返信',
        });

        const response = await request(app)
          .patch(`/api/reviews/${review.id}/comments/${comment.id}/replies/${reply.id}`)
          .send({ content: '更新返信' });

        expect(response.status).toBe(200);
        expect(response.body.reply.content).toBe('更新返信');
      });

      it('返信を削除できる', async () => {
        const reply = await createTestReviewReply(comment.id, {
          authorUserId: owner.id,
        });

        const response = await request(app).delete(
          `/api/reviews/${review.id}/comments/${comment.id}/replies/${reply.id}`
        );

        expect(response.status).toBe(204);
      });

      it('他人の返信は更新できない', async () => {
        const reply = await createTestReviewReply(comment.id, {
          authorUserId: writer.id,
          content: '他人返信',
        });

        const response = await request(app)
          .patch(`/api/reviews/${review.id}/comments/${comment.id}/replies/${reply.id}`)
          .send({ content: '更新' });

        expect(response.status).toBe(403);
      });
    });
  });

  // ============================================================
  // レビューライフサイクル
  // ============================================================
  describe('レビューライフサイクル', () => {
    it('作成→更新→提出→評価変更の一連のフローが動作する', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      // 1. レビュー作成
      const createRes = await request(app)
        .post(`/api/test-suites/${testSuite.id}/reviews`)
        .send({ summary: '初期サマリー' });
      expect(createRes.status).toBe(201);
      const reviewId = createRes.body.review.id;

      // 2. レビュー更新
      const updateRes = await request(app)
        .patch(`/api/reviews/${reviewId}`)
        .send({ summary: '更新サマリー' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.review.summary).toBe('更新サマリー');

      // 3. レビュー提出
      const submitRes = await request(app)
        .post(`/api/reviews/${reviewId}/submit`)
        .send({ verdict: 'APPROVED' });
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.review.status).toBe('SUBMITTED');

      // 4. 評価変更
      const verdictRes = await request(app)
        .patch(`/api/reviews/${reviewId}/verdict`)
        .send({ verdict: 'CHANGES_REQUESTED' });
      expect(verdictRes.status).toBe(200);
      expect(verdictRes.body.review.verdict).toBe('CHANGES_REQUESTED');
    });

    it('作成→削除のフローが動作する', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE');

      // 1. レビュー作成
      const createRes = await request(app)
        .post(`/api/test-suites/${testSuite.id}/reviews`)
        .send({});
      expect(createRes.status).toBe(201);
      const reviewId = createRes.body.review.id;

      // 2. レビュー削除
      const deleteRes = await request(app).delete(`/api/reviews/${reviewId}`);
      expect(deleteRes.status).toBe(204);

      // 3. 削除確認
      const getRes = await request(app).get(`/api/reviews/${reviewId}`);
      expect(getRes.status).toBe(404);
    });
  });
});
