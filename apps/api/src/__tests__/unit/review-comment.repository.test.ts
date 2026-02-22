import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewCommentRepository } from '../../repositories/review-comment.repository.js';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaReviewComment = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

const mockPrismaReviewCommentReply = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    reviewComment: mockPrismaReviewComment,
    reviewCommentReply: mockPrismaReviewCommentReply,
  },
}));

// エンリッチメントをパススルーにモック（リポジトリ単体テストでは不要）
vi.mock('../../repositories/review-comment-enrichment.js', () => ({
  enrichCommentsWithTargetName: vi.fn((comments: unknown) => Promise.resolve(comments)),
}));

describe('ReviewCommentRepository', () => {
  let repository: ReviewCommentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ReviewCommentRepository();
  });

  describe('findById', () => {
    it('IDでコメントを取得できる', async () => {
      const mockComment = {
        id: 'comment-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        targetField: 'TITLE',
        content: 'Test comment',
        status: 'OPEN',
        author: { id: 'user-1', name: 'User 1', avatarUrl: null },
        agentSession: null,
        replies: [],
        _count: { replies: 0 },
      };
      mockPrismaReviewComment.findUnique.mockResolvedValue(mockComment);

      const result = await repository.findById('comment-1');

      expect(mockPrismaReviewComment.findUnique).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        include: expect.objectContaining({
          author: expect.any(Object),
          agentSession: expect.any(Object),
          replies: expect.any(Object),
          _count: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockComment);
    });

    it('author, agentSession, repliesがincludeされる', async () => {
      const mockComment = {
        id: 'comment-1',
        author: { id: 'user-1', name: 'User', avatarUrl: null },
        agentSession: { id: 'agent-1', clientName: 'Claude' },
        replies: [
          {
            id: 'reply-1',
            author: { id: 'user-2', name: 'User 2', avatarUrl: null },
            agentSession: null,
          },
        ],
        _count: { replies: 1 },
      };
      mockPrismaReviewComment.findUnique.mockResolvedValue(mockComment);

      const result = await repository.findById('comment-1');

      expect(result?.author).toBeDefined();
      expect(result?.agentSession).toBeDefined();
      expect(result?.replies).toBeDefined();
    });

    it('存在しない場合はnullを返す', async () => {
      mockPrismaReviewComment.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('対象リソースのコメント一覧を取得できる', async () => {
      const mockComments = [
        { id: 'comment-1', content: 'Comment 1', status: 'OPEN' },
        { id: 'comment-2', content: 'Comment 2', status: 'RESOLVED' },
      ];
      mockPrismaReviewComment.findMany.mockResolvedValue(mockComments);
      mockPrismaReviewComment.count.mockResolvedValue(2);

      const result = await repository.search('SUITE', 'suite-1', {
        limit: 10,
        offset: 0,
      });

      expect(mockPrismaReviewComment.findMany).toHaveBeenCalledWith({
        where: {
          targetType: 'SUITE',
          targetId: 'suite-1',
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });
      expect(result.items).toEqual(mockComments);
      expect(result.total).toBe(2);
    });

    it('statusでフィルタできる（OPEN）', async () => {
      mockPrismaReviewComment.findMany.mockResolvedValue([]);
      mockPrismaReviewComment.count.mockResolvedValue(0);

      await repository.search('SUITE', 'suite-1', {
        status: 'OPEN',
        limit: 10,
        offset: 0,
      });

      expect(mockPrismaReviewComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            targetType: 'SUITE',
            targetId: 'suite-1',
            status: 'OPEN',
          },
        })
      );
    });

    it('statusでフィルタできる（RESOLVED）', async () => {
      mockPrismaReviewComment.findMany.mockResolvedValue([]);
      mockPrismaReviewComment.count.mockResolvedValue(0);

      await repository.search('CASE', 'case-1', {
        status: 'RESOLVED',
        limit: 10,
        offset: 0,
      });

      expect(mockPrismaReviewComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            targetType: 'CASE',
            targetId: 'case-1',
            status: 'RESOLVED',
          },
        })
      );
    });

    it('status=ALLの場合はステータスフィルタなし', async () => {
      mockPrismaReviewComment.findMany.mockResolvedValue([]);
      mockPrismaReviewComment.count.mockResolvedValue(0);

      await repository.search('SUITE', 'suite-1', {
        status: 'ALL',
        limit: 10,
        offset: 0,
      });

      expect(mockPrismaReviewComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            targetType: 'SUITE',
            targetId: 'suite-1',
          },
        })
      );
    });

    it('targetFieldでフィルタできる', async () => {
      mockPrismaReviewComment.findMany.mockResolvedValue([]);
      mockPrismaReviewComment.count.mockResolvedValue(0);

      await repository.search('CASE', 'case-1', {
        targetField: 'PRECONDITION',
        limit: 10,
        offset: 0,
      });

      expect(mockPrismaReviewComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            targetType: 'CASE',
            targetId: 'case-1',
            targetField: 'PRECONDITION',
          },
        })
      );
    });

    it('ページネーションが動作する', async () => {
      mockPrismaReviewComment.findMany.mockResolvedValue([]);
      mockPrismaReviewComment.count.mockResolvedValue(50);

      await repository.search('SUITE', 'suite-1', {
        limit: 20,
        offset: 40,
      });

      expect(mockPrismaReviewComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 40,
        })
      );
    });

    it('totalが正しく返される', async () => {
      mockPrismaReviewComment.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrismaReviewComment.count.mockResolvedValue(100);

      const result = await repository.search('SUITE', 'suite-1', {
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(100);
    });
  });

  describe('create', () => {
    it('コメントを作成できる', async () => {
      const mockComment = {
        id: 'comment-1',
        reviewId: 'review-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        targetField: 'TITLE',
        content: 'New comment',
        status: 'OPEN',
        authorUserId: 'user-1',
      };
      mockPrismaReviewComment.create.mockResolvedValue(mockComment);

      const result = await repository.create({
        reviewId: 'review-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        targetField: 'TITLE',
        authorUserId: 'user-1',
        content: 'New comment',
      });

      expect(mockPrismaReviewComment.create).toHaveBeenCalledWith({
        data: {
          reviewId: 'review-1',
          targetType: 'SUITE',
          targetId: 'suite-1',
          targetField: 'TITLE',
          targetItemId: undefined,
          authorUserId: 'user-1',
          authorAgentSessionId: undefined,
          content: 'New comment',
          status: 'OPEN',
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockComment);
    });

    it('初期statusはOPEN', async () => {
      mockPrismaReviewComment.create.mockResolvedValue({ status: 'OPEN' });

      await repository.create({
        reviewId: 'review-1',
        targetType: 'CASE',
        targetId: 'case-1',
        targetField: 'STEP',
        targetItemId: 'step-1',
        authorUserId: 'user-1',
        content: 'Comment on step',
      });

      expect(mockPrismaReviewComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'OPEN',
          }),
        })
      );
    });

    it('authorAgentSessionIdでコメントを作成できる', async () => {
      mockPrismaReviewComment.create.mockResolvedValue({ id: 'comment-1' });

      await repository.create({
        reviewId: 'review-1',
        targetType: 'SUITE',
        targetId: 'suite-1',
        targetField: 'DESCRIPTION',
        authorAgentSessionId: 'agent-session-1',
        content: 'Agent comment',
      });

      expect(mockPrismaReviewComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorAgentSessionId: 'agent-session-1',
          }),
        })
      );
    });
  });

  describe('update', () => {
    it('contentを更新できる', async () => {
      const mockComment = {
        id: 'comment-1',
        content: 'Updated content',
      };
      mockPrismaReviewComment.update.mockResolvedValue(mockComment);

      const result = await repository.update('comment-1', { content: 'Updated content' });

      expect(mockPrismaReviewComment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { content: 'Updated content' },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockComment);
    });
  });

  describe('updateStatus', () => {
    it('ステータスを更新できる', async () => {
      const mockComment = {
        id: 'comment-1',
        status: 'RESOLVED',
      };
      mockPrismaReviewComment.update.mockResolvedValue(mockComment);

      const result = await repository.updateStatus('comment-1', 'RESOLVED');

      expect(mockPrismaReviewComment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { status: 'RESOLVED' },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockComment);
    });

    it('OPENに戻すことができる', async () => {
      const mockComment = {
        id: 'comment-1',
        status: 'OPEN',
      };
      mockPrismaReviewComment.update.mockResolvedValue(mockComment);

      const result = await repository.updateStatus('comment-1', 'OPEN');

      expect(mockPrismaReviewComment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { status: 'OPEN' },
        include: expect.any(Object),
      });
      expect(result.status).toBe('OPEN');
    });
  });

  describe('delete', () => {
    it('コメントを削除できる', async () => {
      const mockDeletedComment = { id: 'comment-1' };
      mockPrismaReviewComment.delete.mockResolvedValue(mockDeletedComment);

      const result = await repository.delete('comment-1');

      expect(mockPrismaReviewComment.delete).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
      });
      expect(result).toEqual(mockDeletedComment);
    });
  });

  describe('findReplyById', () => {
    it('IDで返信を取得できる', async () => {
      const mockReply = {
        id: 'reply-1',
        commentId: 'comment-1',
        content: 'Reply content',
        comment: { id: 'comment-1', targetType: 'SUITE' },
        author: { id: 'user-1', name: 'User', avatarUrl: null },
        agentSession: null,
      };
      mockPrismaReviewCommentReply.findUnique.mockResolvedValue(mockReply);

      const result = await repository.findReplyById('reply-1');

      expect(mockPrismaReviewCommentReply.findUnique).toHaveBeenCalledWith({
        where: { id: 'reply-1' },
        include: {
          comment: true,
          author: {
            select: { id: true, name: true, avatarUrl: true },
          },
          agentSession: {
            select: { id: true, clientName: true },
          },
        },
      });
      expect(result).toEqual(mockReply);
    });

    it('comment, author, agentSessionがincludeされる', async () => {
      const mockReply = {
        id: 'reply-1',
        comment: { id: 'comment-1' },
        author: { id: 'user-1', name: 'User', avatarUrl: null },
        agentSession: { id: 'agent-1', clientName: 'Agent' },
      };
      mockPrismaReviewCommentReply.findUnique.mockResolvedValue(mockReply);

      const result = await repository.findReplyById('reply-1');

      expect(result?.comment).toBeDefined();
      expect(result?.author).toBeDefined();
      expect(result?.agentSession).toBeDefined();
    });

    it('存在しない場合はnullを返す', async () => {
      mockPrismaReviewCommentReply.findUnique.mockResolvedValue(null);

      const result = await repository.findReplyById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createReply', () => {
    it('返信を作成できる', async () => {
      const mockReply = {
        id: 'reply-1',
        commentId: 'comment-1',
        content: 'Reply content',
        authorUserId: 'user-1',
        author: { id: 'user-1', name: 'User', avatarUrl: null },
        agentSession: null,
      };
      mockPrismaReviewCommentReply.create.mockResolvedValue(mockReply);

      const result = await repository.createReply({
        commentId: 'comment-1',
        authorUserId: 'user-1',
        content: 'Reply content',
      });

      expect(mockPrismaReviewCommentReply.create).toHaveBeenCalledWith({
        data: {
          commentId: 'comment-1',
          authorUserId: 'user-1',
          authorAgentSessionId: undefined,
          content: 'Reply content',
        },
        include: {
          author: {
            select: { id: true, name: true, avatarUrl: true },
          },
          agentSession: {
            select: { id: true, clientName: true },
          },
        },
      });
      expect(result).toEqual(mockReply);
    });

    it('authorAgentSessionIdで返信を作成できる', async () => {
      mockPrismaReviewCommentReply.create.mockResolvedValue({ id: 'reply-1' });

      await repository.createReply({
        commentId: 'comment-1',
        authorAgentSessionId: 'agent-session-1',
        content: 'Agent reply',
      });

      expect(mockPrismaReviewCommentReply.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorAgentSessionId: 'agent-session-1',
          }),
        })
      );
    });
  });

  describe('updateReply', () => {
    it('返信のcontentを更新できる', async () => {
      const mockReply = {
        id: 'reply-1',
        content: 'Updated reply',
      };
      mockPrismaReviewCommentReply.update.mockResolvedValue(mockReply);

      const result = await repository.updateReply('reply-1', { content: 'Updated reply' });

      expect(mockPrismaReviewCommentReply.update).toHaveBeenCalledWith({
        where: { id: 'reply-1' },
        data: { content: 'Updated reply' },
        include: {
          author: {
            select: { id: true, name: true, avatarUrl: true },
          },
          agentSession: {
            select: { id: true, clientName: true },
          },
        },
      });
      expect(result).toEqual(mockReply);
    });
  });

  describe('deleteReply', () => {
    it('返信を削除できる', async () => {
      const mockDeletedReply = { id: 'reply-1' };
      mockPrismaReviewCommentReply.delete.mockResolvedValue(mockDeletedReply);

      const result = await repository.deleteReply('reply-1');

      expect(mockPrismaReviewCommentReply.delete).toHaveBeenCalledWith({
        where: { id: 'reply-1' },
      });
      expect(result).toEqual(mockDeletedReply);
    });
  });
});
