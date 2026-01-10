import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestProjectMember,
  createTestSuite,
  createTestCase,
  createTestReviewComment,
  createTestReviewReply,
  cleanupTestData,
} from './test-helpers.js';

import { AuthenticationError, AuthorizationError, NotFoundError } from '@agentest/shared';
import { createApp } from '../../app.js';

// グローバルな認証状態（モック用）
let mockAuthUser: { id: string; email: string } | null = null;
let mockProjectRole: string | null = null;
let mockTestSuiteRole: string | null = null;
let mockTestCaseRole: string | null = null;
let mockReviewCommentRole: string | null = null;

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

// テストスイート権限ミドルウェアをモック
vi.mock('../../middleware/require-test-suite-role.js', () => ({
  requireTestSuiteRole: (roles: string[], _options?: { allowDeletedSuite?: boolean }) => async (req: any, _res: any, next: any) => {
    if (!mockTestSuiteRole || !roles.includes(mockTestSuiteRole)) {
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
  requireTestCaseRole: (roles: string[], _options?: { allowDeletedTestCase?: boolean }) => async (req: any, _res: any, next: any) => {
    if (!mockTestCaseRole || !roles.includes(mockTestCaseRole)) {
      return next(new AuthorizationError('権限がありません'));
    }
    const testCaseId = req.params.testCaseId;
    if (testCaseId) {
      const testCase = await prisma.testCase.findUnique({ where: { id: testCaseId } });
      if (!testCase) {
        return next(new NotFoundError('TestCase', testCaseId));
      }
    }
    next();
  },
}));

// レビューコメント権限ミドルウェアをモック
vi.mock('../../middleware/require-review-comment-role.js', () => ({
  requireReviewCommentRole: (roles: string[]) => async (req: any, _res: any, next: any) => {
    if (!mockReviewCommentRole || !roles.includes(mockReviewCommentRole)) {
      return next(new AuthorizationError('権限がありません'));
    }
    const commentId = req.params.commentId;
    if (commentId) {
      const comment = await prisma.reviewComment.findUnique({ where: { id: commentId } });
      if (!comment) {
        return next(new NotFoundError('ReviewComment', commentId));
      }
    }
    next();
  },
}));

// テスト用認証設定関数
function setTestAuth(
  user: { id: string; email: string } | null,
  projectRole: string | null = null,
  testSuiteRole: string | null = null,
  testCaseRole: string | null = null,
  reviewCommentRole: string | null = null
) {
  mockAuthUser = user;
  mockProjectRole = projectRole;
  mockTestSuiteRole = testSuiteRole;
  mockTestCaseRole = testCaseRole;
  mockReviewCommentRole = reviewCommentRole;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockProjectRole = null;
  mockTestSuiteRole = null;
  mockTestCaseRole = null;
  mockReviewCommentRole = null;
}

describe('Review Comments API Integration Tests', () => {
  let app: Express;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let writer: Awaited<ReturnType<typeof createTestUser>>;
  let reader: Awaited<ReturnType<typeof createTestUser>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;
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
      description: 'Test suite description',
    });

    // テストケースを作成
    testCase = await createTestCase(testSuite.id, {
      title: 'Test Case',
      description: 'Test case description',
    });

    // デフォルトでオーナーとして認証
    setTestAuth({ id: owner.id, email: owner.email }, 'ADMIN', 'ADMIN', 'ADMIN', 'ADMIN');
  });

  // ============================================================
  // POST /api/review-comments - コメント作成
  // ============================================================
  describe('POST /api/review-comments', () => {
    it('テストスイートへのコメントを作成できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE', 'WRITE', 'WRITE');

      const response = await request(app)
        .post('/api/review-comments')
        .send({
          targetType: 'SUITE',
          targetId: testSuite.id,
          targetField: 'TITLE',
          content: 'This is a test comment',
        })
        .expect(201);

      expect(response.body.comment.content).toBe('This is a test comment');
      expect(response.body.comment.targetType).toBe('SUITE');
      expect(response.body.comment.targetId).toBe(testSuite.id);
      expect(response.body.comment.status).toBe('OPEN');
    });

    it('テストケースへのコメントを作成できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE', 'WRITE', 'WRITE');

      const response = await request(app)
        .post('/api/review-comments')
        .send({
          targetType: 'CASE',
          targetId: testCase.id,
          targetField: 'DESCRIPTION',
          content: 'Test case comment',
        })
        .expect(201);

      expect(response.body.comment.targetType).toBe('CASE');
      expect(response.body.comment.targetId).toBe(testCase.id);
    });

    it('未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .post('/api/review-comments')
        .send({
          targetType: 'SUITE',
          targetId: testSuite.id,
          targetField: 'TITLE',
          content: 'Test comment',
        })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('空のcontentは400エラー', async () => {
      const response = await request(app)
        .post('/api/review-comments')
        .send({
          targetType: 'SUITE',
          targetId: testSuite.id,
          targetField: 'TITLE',
          content: '',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('無効なtargetTypeは400エラー', async () => {
      const response = await request(app)
        .post('/api/review-comments')
        .send({
          targetType: 'INVALID',
          targetId: testSuite.id,
          targetField: 'TITLE',
          content: 'Test comment',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('存在しないターゲットには404エラー', async () => {
      const response = await request(app)
        .post('/api/review-comments')
        .send({
          targetType: 'SUITE',
          targetId: '00000000-0000-0000-0000-000000000000',
          targetField: 'TITLE',
          content: 'Test comment',
        })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ============================================================
  // GET /api/review-comments/:commentId - コメント詳細取得
  // ============================================================
  describe('GET /api/review-comments/:commentId', () => {
    let comment: Awaited<ReturnType<typeof createTestReviewComment>>;

    beforeEach(async () => {
      comment = await createTestReviewComment({
        targetType: 'SUITE',
        targetId: testSuite.id,
        targetField: 'TITLE',
        authorUserId: owner.id,
        content: 'Existing comment',
      });
    });

    it('コメント詳細を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ', 'READ', 'READ');

      const response = await request(app)
        .get(`/api/review-comments/${comment.id}`)
        .expect(200);

      expect(response.body.comment.id).toBe(comment.id);
      expect(response.body.comment.content).toBe('Existing comment');
    });

    it('存在しないコメントは404エラー', async () => {
      const response = await request(app)
        .get('/api/review-comments/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('権限がない場合は403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ', 'READ', null);

      const response = await request(app)
        .get(`/api/review-comments/${comment.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // PATCH /api/review-comments/:commentId - コメント編集
  // ============================================================
  describe('PATCH /api/review-comments/:commentId', () => {
    let comment: Awaited<ReturnType<typeof createTestReviewComment>>;

    beforeEach(async () => {
      comment = await createTestReviewComment({
        targetType: 'SUITE',
        targetId: testSuite.id,
        targetField: 'TITLE',
        authorUserId: owner.id,
        content: 'Original content',
      });
    });

    it('投稿者本人はコメントを編集できる', async () => {
      const response = await request(app)
        .patch(`/api/review-comments/${comment.id}`)
        .send({ content: 'Updated content' })
        .expect(200);

      expect(response.body.comment.content).toBe('Updated content');
    });

    it('他人のコメントは編集できない', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE', 'WRITE', 'WRITE');

      const response = await request(app)
        .patch(`/api/review-comments/${comment.id}`)
        .send({ content: 'Updated content' })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('空のcontentへの更新は400エラー', async () => {
      const response = await request(app)
        .patch(`/api/review-comments/${comment.id}`)
        .send({ content: '' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ============================================================
  // DELETE /api/review-comments/:commentId - コメント削除
  // ============================================================
  describe('DELETE /api/review-comments/:commentId', () => {
    let comment: Awaited<ReturnType<typeof createTestReviewComment>>;

    beforeEach(async () => {
      comment = await createTestReviewComment({
        targetType: 'SUITE',
        targetId: testSuite.id,
        targetField: 'TITLE',
        authorUserId: owner.id,
        content: 'To be deleted',
      });
    });

    it('投稿者本人はコメントを削除できる', async () => {
      await request(app)
        .delete(`/api/review-comments/${comment.id}`)
        .expect(204);

      // DBから削除されていることを確認
      const deleted = await prisma.reviewComment.findUnique({
        where: { id: comment.id },
      });
      expect(deleted).toBeNull();
    });

    it('他人のコメントは削除できない', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE', 'WRITE', 'WRITE');

      const response = await request(app)
        .delete(`/api/review-comments/${comment.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('削除時に返信も一緒に削除される', async () => {
      const reply = await createTestReviewReply(comment.id, {
        authorUserId: writer.id,
        content: 'Reply to be deleted',
      });

      await request(app)
        .delete(`/api/review-comments/${comment.id}`)
        .expect(204);

      // 返信も削除されていることを確認
      const deletedReply = await prisma.reviewCommentReply.findUnique({
        where: { id: reply.id },
      });
      expect(deletedReply).toBeNull();
    });
  });

  // ============================================================
  // PATCH /api/review-comments/:commentId/status - ステータス変更
  // ============================================================
  describe('PATCH /api/review-comments/:commentId/status', () => {
    let comment: Awaited<ReturnType<typeof createTestReviewComment>>;

    beforeEach(async () => {
      comment = await createTestReviewComment({
        targetType: 'SUITE',
        targetId: testSuite.id,
        targetField: 'TITLE',
        authorUserId: owner.id,
        content: 'Status change test',
        status: 'OPEN',
      });
    });

    it('WRITE権限以上でステータスを変更できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE', 'WRITE', 'WRITE');

      const response = await request(app)
        .patch(`/api/review-comments/${comment.id}/status`)
        .send({ status: 'RESOLVED' })
        .expect(200);

      expect(response.body.comment.status).toBe('RESOLVED');
    });

    it('OPEN → RESOLVED に変更できる', async () => {
      const response = await request(app)
        .patch(`/api/review-comments/${comment.id}/status`)
        .send({ status: 'RESOLVED' })
        .expect(200);

      expect(response.body.comment.status).toBe('RESOLVED');
    });

    it('RESOLVED → OPEN に変更できる', async () => {
      // まずRESOLVEDに変更
      await prisma.reviewComment.update({
        where: { id: comment.id },
        data: { status: 'RESOLVED' },
      });

      const response = await request(app)
        .patch(`/api/review-comments/${comment.id}/status`)
        .send({ status: 'OPEN' })
        .expect(200);

      expect(response.body.comment.status).toBe('OPEN');
    });

    it('READ権限ではステータス変更できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ', 'READ', 'READ');

      const response = await request(app)
        .patch(`/api/review-comments/${comment.id}/status`)
        .send({ status: 'RESOLVED' })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('無効なステータスは400エラー', async () => {
      const response = await request(app)
        .patch(`/api/review-comments/${comment.id}/status`)
        .send({ status: 'INVALID' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ============================================================
  // POST /api/review-comments/:commentId/replies - 返信作成
  // ============================================================
  describe('POST /api/review-comments/:commentId/replies', () => {
    let comment: Awaited<ReturnType<typeof createTestReviewComment>>;

    beforeEach(async () => {
      comment = await createTestReviewComment({
        targetType: 'SUITE',
        targetId: testSuite.id,
        targetField: 'TITLE',
        authorUserId: owner.id,
        content: 'Parent comment',
      });
    });

    it('返信を作成できる', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE', 'WRITE', 'WRITE');

      const response = await request(app)
        .post(`/api/review-comments/${comment.id}/replies`)
        .send({ content: 'This is a reply' })
        .expect(201);

      expect(response.body.reply.content).toBe('This is a reply');
    });

    it('空のcontentは400エラー', async () => {
      const response = await request(app)
        .post(`/api/review-comments/${comment.id}/replies`)
        .send({ content: '' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('READ権限では返信作成できない', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ', 'READ', 'READ');

      const response = await request(app)
        .post(`/api/review-comments/${comment.id}/replies`)
        .send({ content: 'Reply' })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // PATCH /api/review-comments/:commentId/replies/:replyId - 返信編集
  // ============================================================
  describe('PATCH /api/review-comments/:commentId/replies/:replyId', () => {
    let comment: Awaited<ReturnType<typeof createTestReviewComment>>;
    let reply: Awaited<ReturnType<typeof createTestReviewReply>>;

    beforeEach(async () => {
      comment = await createTestReviewComment({
        targetType: 'SUITE',
        targetId: testSuite.id,
        targetField: 'TITLE',
        authorUserId: owner.id,
        content: 'Parent comment',
      });
      reply = await createTestReviewReply(comment.id, {
        authorUserId: owner.id,
        content: 'Original reply',
      });
    });

    it('投稿者本人は返信を編集できる', async () => {
      const response = await request(app)
        .patch(`/api/review-comments/${comment.id}/replies/${reply.id}`)
        .send({ content: 'Updated reply' })
        .expect(200);

      expect(response.body.reply.content).toBe('Updated reply');
    });

    it('他人の返信は編集できない', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE', 'WRITE', 'WRITE');

      const response = await request(app)
        .patch(`/api/review-comments/${comment.id}/replies/${reply.id}`)
        .send({ content: 'Updated reply' })
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // DELETE /api/review-comments/:commentId/replies/:replyId - 返信削除
  // ============================================================
  describe('DELETE /api/review-comments/:commentId/replies/:replyId', () => {
    let comment: Awaited<ReturnType<typeof createTestReviewComment>>;
    let reply: Awaited<ReturnType<typeof createTestReviewReply>>;

    beforeEach(async () => {
      comment = await createTestReviewComment({
        targetType: 'SUITE',
        targetId: testSuite.id,
        targetField: 'TITLE',
        authorUserId: owner.id,
        content: 'Parent comment',
      });
      reply = await createTestReviewReply(comment.id, {
        authorUserId: owner.id,
        content: 'Reply to delete',
      });
    });

    it('投稿者本人は返信を削除できる', async () => {
      await request(app)
        .delete(`/api/review-comments/${comment.id}/replies/${reply.id}`)
        .expect(204);

      // DBから削除されていることを確認
      const deleted = await prisma.reviewCommentReply.findUnique({
        where: { id: reply.id },
      });
      expect(deleted).toBeNull();
    });

    it('他人の返信は削除できない', async () => {
      setTestAuth({ id: writer.id, email: writer.email }, 'WRITE', 'WRITE', 'WRITE', 'WRITE');

      const response = await request(app)
        .delete(`/api/review-comments/${comment.id}/replies/${reply.id}`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // GET /api/test-suites/:testSuiteId/comments - スイートのコメント一覧
  // ============================================================
  describe('GET /api/test-suites/:testSuiteId/comments', () => {
    beforeEach(async () => {
      await createTestReviewComment({
        targetType: 'SUITE',
        targetId: testSuite.id,
        targetField: 'TITLE',
        authorUserId: owner.id,
        content: 'Comment 1',
        status: 'OPEN',
      });
      await createTestReviewComment({
        targetType: 'SUITE',
        targetId: testSuite.id,
        targetField: 'DESCRIPTION',
        authorUserId: writer.id,
        content: 'Comment 2',
        status: 'RESOLVED',
      });
    });

    it('スイートのコメント一覧を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ', 'READ', 'READ');

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/comments`)
        .expect(200);

      expect(response.body.comments).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('ステータスでフィルタできる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/comments?status=OPEN`)
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].status).toBe('OPEN');
    });

    it('対象フィールドでフィルタできる', async () => {
      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/comments?targetField=TITLE`)
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].targetField).toBe('TITLE');
    });

    it('権限がない場合は403エラー', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', null, 'READ', 'READ');

      const response = await request(app)
        .get(`/api/test-suites/${testSuite.id}/comments`)
        .expect(403);

      expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================================
  // GET /api/test-cases/:testCaseId/comments - ケースのコメント一覧
  // ============================================================
  describe('GET /api/test-cases/:testCaseId/comments', () => {
    beforeEach(async () => {
      await createTestReviewComment({
        targetType: 'CASE',
        targetId: testCase.id,
        targetField: 'STEP',
        authorUserId: owner.id,
        content: 'Step comment',
      });
    });

    it('ケースのコメント一覧を取得できる', async () => {
      setTestAuth({ id: reader.id, email: reader.email }, 'READ', 'READ', 'READ', 'READ');

      const response = await request(app)
        .get(`/api/test-cases/${testCase.id}/comments`)
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].content).toBe('Step comment');
    });
  });
});
