import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, AuthorizationError, BadRequestError } from '@agentest/shared';

// prismaのモック
const mockPrisma = vi.hoisted(() => ({
  testSuite: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  testCase: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  projectMember: {
    findUnique: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  organizationMember: {
    findUnique: vi.fn(),
  },
  testSuitePrecondition: {
    findFirst: vi.fn(),
  },
  testCasePrecondition: {
    findFirst: vi.fn(),
  },
  testCaseStep: {
    findFirst: vi.fn(),
  },
  testCaseExpectedResult: {
    findFirst: vi.fn(),
  },
  reviewComment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  reviewCommentReply: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

// モック設定後にインポート
import { ReviewCommentService } from '../../services/review-comment.service.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_PROJECT_ID = '55555555-5555-5555-5555-555555555555';
const TEST_COMMENT_ID = '66666666-6666-6666-6666-666666666666';
const TEST_REPLY_ID = '77777777-7777-7777-7777-777777777777';

describe('ReviewCommentService', () => {
  let service: ReviewCommentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReviewCommentService();
    // エンリッチメント用デフォルト（空配列を返す）
    mockPrisma.testCase.findMany.mockResolvedValue([]);
    mockPrisma.testSuite.findMany.mockResolvedValue([]);
  });

  describe('findById', () => {
    it('コメントを取得できる', async () => {
      const mockComment = {
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
        content: 'Test comment',
        status: 'OPEN',
        authorUserId: TEST_USER_ID,
        author: { id: TEST_USER_ID, name: 'Test User', avatarUrl: null },
        agentSession: null,
        replies: [],
        _count: { replies: 0 },
      };
      mockPrisma.reviewComment.findUnique.mockResolvedValue(mockComment);

      const result = await service.findById(TEST_COMMENT_ID);

      expect(result).toEqual({ ...mockComment, targetName: null });
      expect(mockPrisma.reviewComment.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_COMMENT_ID },
        include: expect.any(Object),
      });
    });

    it('存在しないコメントはNotFoundErrorを投げる', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue(null);

      await expect(service.findById(TEST_COMMENT_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('create (deprecated)', () => {
    it('BadRequestErrorを投げる（非推奨）', async () => {
      // 旧APIは非推奨となり、BadRequestErrorを投げるようになった
      // 新しい /api/reviews/:reviewId/comments エンドポイントを使用する必要がある
      await expect(
        service.create(TEST_USER_ID, {
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
          targetField: 'TITLE',
          content: 'New comment',
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('update', () => {
    it('投稿者本人はコメントを編集できる', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        authorUserId: TEST_USER_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.reviewComment.update.mockResolvedValue({
        id: TEST_COMMENT_ID,
        content: 'Updated content',
      });

      const result = await service.update(TEST_COMMENT_ID, TEST_USER_ID, {
        content: 'Updated content',
      });

      expect(result.content).toBe('Updated content');
    });

    it('他人のコメントは編集できない', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        authorUserId: OTHER_USER_ID, // 別のユーザー
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });

      await expect(
        service.update(TEST_COMMENT_ID, TEST_USER_ID, {
          content: 'Updated content',
        })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('updateStatus', () => {
    beforeEach(() => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        authorUserId: TEST_USER_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
        status: 'OPEN',
      });
      mockPrisma.testSuite.findFirst.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        projectId: TEST_PROJECT_ID,
        role: 'WRITE',
      });
    });

    it('WRITE以上の権限でステータスを変更できる', async () => {
      mockPrisma.reviewComment.update.mockResolvedValue({
        id: TEST_COMMENT_ID,
        status: 'RESOLVED',
      });

      const result = await service.updateStatus(TEST_COMMENT_ID, TEST_USER_ID, 'RESOLVED');

      expect(result.status).toBe('RESOLVED');
    });

    it('READ権限ではステータスを変更できない', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        projectId: TEST_PROJECT_ID,
        role: 'READ',
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
      });

      await expect(service.updateStatus(TEST_COMMENT_ID, TEST_USER_ID, 'RESOLVED')).rejects.toThrow(
        AuthorizationError
      );
    });
  });

  describe('delete', () => {
    it('投稿者本人はコメントを削除できる', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        authorUserId: TEST_USER_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.reviewComment.delete.mockResolvedValue({
        id: TEST_COMMENT_ID,
      });

      await service.delete(TEST_COMMENT_ID, TEST_USER_ID);

      expect(mockPrisma.reviewComment.delete).toHaveBeenCalledWith({
        where: { id: TEST_COMMENT_ID },
      });
    });

    it('他人のコメントは削除できない', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        authorUserId: OTHER_USER_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });

      await expect(service.delete(TEST_COMMENT_ID, TEST_USER_ID)).rejects.toThrow(AuthorizationError);
    });
  });

  describe('createReply', () => {
    beforeEach(() => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.testSuite.findFirst.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        projectId: TEST_PROJECT_ID,
        role: 'WRITE',
      });
    });

    it('返信を作成できる', async () => {
      mockPrisma.reviewCommentReply.create.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: TEST_COMMENT_ID,
        authorUserId: TEST_USER_ID,
        content: 'Reply content',
      });

      const result = await service.createReply(TEST_COMMENT_ID, TEST_USER_ID, {
        content: 'Reply content',
      });

      expect(result.content).toBe('Reply content');
    });

    it('READ権限では返信を作成できない', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        projectId: TEST_PROJECT_ID,
        role: 'READ',
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
      });

      await expect(
        service.createReply(TEST_COMMENT_ID, TEST_USER_ID, {
          content: 'Reply content',
        })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('updateReply', () => {
    it('投稿者本人は返信を編集できる', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.reviewCommentReply.findUnique.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: TEST_COMMENT_ID,
        authorUserId: TEST_USER_ID,
      });
      mockPrisma.reviewCommentReply.update.mockResolvedValue({
        id: TEST_REPLY_ID,
        content: 'Updated reply',
      });

      const result = await service.updateReply(TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID, {
        content: 'Updated reply',
      });

      expect(result.content).toBe('Updated reply');
    });

    it('他人の返信は編集できない', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.reviewCommentReply.findUnique.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: TEST_COMMENT_ID,
        authorUserId: OTHER_USER_ID,
      });

      await expect(
        service.updateReply(TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID, {
          content: 'Updated reply',
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('別のコメントの返信は編集できない', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.reviewCommentReply.findUnique.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: 'another-comment-id', // 別のコメント
        authorUserId: TEST_USER_ID,
      });

      await expect(
        service.updateReply(TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID, {
          content: 'Updated reply',
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('deleteReply', () => {
    it('投稿者本人は返信を削除できる', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.reviewCommentReply.findUnique.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: TEST_COMMENT_ID,
        authorUserId: TEST_USER_ID,
      });
      mockPrisma.reviewCommentReply.delete.mockResolvedValue({
        id: TEST_REPLY_ID,
      });

      await service.deleteReply(TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID);

      expect(mockPrisma.reviewCommentReply.delete).toHaveBeenCalledWith({
        where: { id: TEST_REPLY_ID },
      });
    });

    it('他人の返信は削除できない', async () => {
      mockPrisma.reviewComment.findUnique.mockResolvedValue({
        id: TEST_COMMENT_ID,
        targetType: 'SUITE',
        targetId: TEST_SUITE_ID,
      });
      mockPrisma.reviewCommentReply.findUnique.mockResolvedValue({
        id: TEST_REPLY_ID,
        commentId: TEST_COMMENT_ID,
        authorUserId: OTHER_USER_ID,
      });

      await expect(service.deleteReply(TEST_COMMENT_ID, TEST_REPLY_ID, TEST_USER_ID)).rejects.toThrow(
        AuthorizationError
      );
    });
  });

  describe('search', () => {
    beforeEach(() => {
      mockPrisma.testSuite.findFirst.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
      });
    });

    it('コメント一覧を検索できる', async () => {
      const mockComments = [
        { id: '1', content: 'Comment 1', status: 'OPEN' },
        { id: '2', content: 'Comment 2', status: 'RESOLVED' },
      ];
      mockPrisma.reviewComment.findMany.mockResolvedValue(mockComments);
      mockPrisma.reviewComment.count.mockResolvedValue(2);

      const result = await service.search('SUITE', TEST_SUITE_ID, {
        limit: 50,
        offset: 0,
      });

      expect(result.items).toEqual(
        mockComments.map((c) => ({ ...c, targetName: null }))
      );
      expect(result.total).toBe(2);
    });

    it('ステータスでフィルタできる', async () => {
      mockPrisma.reviewComment.findMany.mockResolvedValue([]);
      mockPrisma.reviewComment.count.mockResolvedValue(0);

      await service.search('SUITE', TEST_SUITE_ID, {
        status: 'OPEN',
        limit: 50,
        offset: 0,
      });

      expect(mockPrisma.reviewComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetType: 'SUITE',
            targetId: TEST_SUITE_ID,
            status: 'OPEN',
          }),
        })
      );
    });

    it('対象フィールドでフィルタできる', async () => {
      mockPrisma.reviewComment.findMany.mockResolvedValue([]);
      mockPrisma.reviewComment.count.mockResolvedValue(0);

      await service.search('SUITE', TEST_SUITE_ID, {
        targetField: 'DESCRIPTION',
        limit: 50,
        offset: 0,
      });

      expect(mockPrisma.reviewComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetField: 'DESCRIPTION',
          }),
        })
      );
    });
  });
});
