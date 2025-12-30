import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError, NotFoundError, BadRequestError } from '@agentest/shared';

// prismaのモック（vi.hoistedを使用してホイスト問題を回避）
const mockPrisma = vi.hoisted(() => ({
  reviewComment: {
    findUnique: vi.fn(),
  },
  testSuite: {
    findFirst: vi.fn(),
  },
  testCase: {
    findFirst: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  organizationMember: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

// モック設定後にインポート
import { requireReviewCommentRole } from '../../middleware/require-review-comment-role.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_COMMENT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_CASE_ID = '44444444-4444-4444-4444-444444444444';
const TEST_PROJECT_ID = '55555555-5555-5555-5555-555555555555';
const TEST_ORG_ID = '66666666-6666-6666-6666-666666666666';

// Express req, res, next のモック作成
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    user: { id: TEST_USER_ID } as any,
    params: { commentId: TEST_COMMENT_ID },
    ...overrides,
  };
}

function createMockResponse(): Partial<Response> {
  return {};
}

describe('requireReviewCommentRole', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  describe('認証チェック', () => {
    it('req.userがない場合はAuthenticationErrorを投げる', async () => {
      const req = createMockRequest({ user: undefined });
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Not authenticated');
    });
  });

  describe('パラメータチェック', () => {
    it('commentIdがない場合はAuthorizationErrorを投げる', async () => {
      const req = createMockRequest({ params: {} });
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Comment ID required');
    });

    it('無効なUUID形式はBadRequestErrorを投げる', async () => {
      const req = createMockRequest({ params: { commentId: 'invalid-uuid' } });
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Invalid comment ID format');
    });
  });

  describe('コメント存在チェック', () => {
    it('コメントが存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue(null);

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  describe('テストスイート対象のコメント権限', () => {
    it('テストスイートが存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.testSuite.findFirst.mockResolvedValue(null);

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('プロジェクトメンバーで必要な権限があれば通過する', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.testSuite.findFirst.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        deletedAt: null,
        organizationId: null,
        members: [{ userId: TEST_USER_ID, role: 'WRITE' }],
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['WRITE', 'READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
      expect(req.params?.projectId).toBe(TEST_PROJECT_ID);
    });
  });

  describe('テストケース対象のコメント権限', () => {
    it('テストケースが存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'CASE',
        targetId: TEST_CASE_ID,
      });
      mockPrisma.testCase.findFirst.mockResolvedValue(null);

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('テストケース経由でプロジェクト権限をチェックできる', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'CASE',
        targetId: TEST_CASE_ID,
      });
      mockPrisma.testCase.findFirst.mockResolvedValue({
        id: TEST_CASE_ID,
        testSuite: { projectId: TEST_PROJECT_ID },
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        deletedAt: null,
        organizationId: null,
        members: [{ userId: TEST_USER_ID, role: 'READ' }],
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
    });
  });

  describe('プロジェクト削除チェック', () => {
    it('削除済みプロジェクトはAuthorizationErrorを投げる', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.testSuite.findFirst.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        deletedAt: new Date(), // 削除済み
        organizationId: null,
        members: [{ userId: TEST_USER_ID, role: 'OWNER' }],
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Project has been deleted');
    });
  });

  describe('プロジェクトオーナー権限', () => {
    it('プロジェクトオーナーは全権限を持つ', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.testSuite.findFirst.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        deletedAt: null,
        organizationId: null,
        members: [{ userId: TEST_USER_ID, role: 'OWNER' }],
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['ADMIN']); // ADMIN権限が必要
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
    });
  });

  describe('権限不足', () => {
    it('必要なロールを持たないメンバーはAuthorizationErrorを投げる', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.testSuite.findFirst.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        deletedAt: null,
        organizationId: null,
        members: [{ userId: TEST_USER_ID, role: 'READ' }], // READのみ
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['ADMIN', 'WRITE']); // ADMIN or WRITE必須
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Insufficient permissions');
    });
  });

  describe('組織メンバー権限フォールバック', () => {
    it('プロジェクトメンバーでなくても組織OWNER/ADMINなら通過する', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.testSuite.findFirst.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        deletedAt: null,
        organizationId: TEST_ORG_ID,
        members: [], // プロジェクトメンバーではない
      });
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        role: 'ADMIN', // 組織ADMIN
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['WRITE']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
    });

    it('組織MEMBERはフォールバックでは通過しない', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.testSuite.findFirst.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        deletedAt: null,
        organizationId: TEST_ORG_ID,
        members: [],
      });
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        role: 'MEMBER', // 組織MEMBER（OWNER/ADMINではない）
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });
  });

  describe('エラーハンドリング', () => {
    it('prismaエラーはnextに渡される', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.reviewComment.findUnique.mockRejectedValue(dbError);

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireReviewCommentRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });
});
