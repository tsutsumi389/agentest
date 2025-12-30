import { prisma, type ReviewStatus, type ReviewTargetType, type ReviewTargetField, type Prisma } from '@agentest/db';

/**
 * レビューコメント検索オプション
 */
export interface ReviewCommentSearchOptions {
  status?: 'OPEN' | 'RESOLVED' | 'ALL';
  targetField?: ReviewTargetField;
  limit: number;
  offset: number;
}

/**
 * レビューコメントの共通includeオプション
 */
const commentInclude = {
  author: {
    select: { id: true, name: true, avatarUrl: true },
  },
  agentSession: {
    select: { id: true, clientName: true },
  },
  replies: {
    include: {
      author: {
        select: { id: true, name: true, avatarUrl: true },
      },
      agentSession: {
        select: { id: true, clientName: true },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: {
    select: { replies: true },
  },
};

/**
 * レビューコメントリポジトリ
 */
export class ReviewCommentRepository {
  /**
   * IDでレビューコメントを検索
   */
  async findById(id: string) {
    return prisma.reviewComment.findUnique({
      where: { id },
      include: commentInclude,
    });
  }

  /**
   * 対象リソースのコメント一覧を検索
   */
  async search(
    targetType: ReviewTargetType,
    targetId: string,
    options: ReviewCommentSearchOptions
  ) {
    const { status, targetField, limit, offset } = options;

    // 検索条件を構築
    const where: Prisma.ReviewCommentWhereInput = {
      targetType,
      targetId,
    };

    // ステータスフィルタ（ALLの場合は条件なし）
    if (status && status !== 'ALL') {
      where.status = status as ReviewStatus;
    }

    // 対象フィールドフィルタ
    if (targetField) {
      where.targetField = targetField;
    }

    // 検索実行
    const [items, total] = await Promise.all([
      prisma.reviewComment.findMany({
        where,
        include: commentInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.reviewComment.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * レビューコメントを作成
   */
  async create(data: {
    targetType: ReviewTargetType;
    targetId: string;
    targetField: ReviewTargetField;
    targetItemId?: string;
    authorUserId?: string;
    authorAgentSessionId?: string;
    content: string;
  }) {
    return prisma.reviewComment.create({
      data: {
        targetType: data.targetType,
        targetId: data.targetId,
        targetField: data.targetField,
        targetItemId: data.targetItemId,
        authorUserId: data.authorUserId,
        authorAgentSessionId: data.authorAgentSessionId,
        content: data.content,
        status: 'OPEN',
      },
      include: commentInclude,
    });
  }

  /**
   * レビューコメントを更新
   */
  async update(id: string, data: { content: string }) {
    return prisma.reviewComment.update({
      where: { id },
      data: { content: data.content },
      include: commentInclude,
    });
  }

  /**
   * レビューコメントのステータスを更新
   */
  async updateStatus(id: string, status: ReviewStatus) {
    return prisma.reviewComment.update({
      where: { id },
      data: { status },
      include: commentInclude,
    });
  }

  /**
   * レビューコメントを削除（返信も含めてカスケード削除）
   */
  async delete(id: string) {
    return prisma.reviewComment.delete({
      where: { id },
    });
  }

  /**
   * 返信をIDで検索
   */
  async findReplyById(id: string) {
    return prisma.reviewCommentReply.findUnique({
      where: { id },
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
  }

  /**
   * 返信を作成
   */
  async createReply(data: {
    commentId: string;
    authorUserId?: string;
    authorAgentSessionId?: string;
    content: string;
  }) {
    return prisma.reviewCommentReply.create({
      data: {
        commentId: data.commentId,
        authorUserId: data.authorUserId,
        authorAgentSessionId: data.authorAgentSessionId,
        content: data.content,
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
  }

  /**
   * 返信を更新
   */
  async updateReply(id: string, data: { content: string }) {
    return prisma.reviewCommentReply.update({
      where: { id },
      data: { content: data.content },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
        agentSession: {
          select: { id: true, clientName: true },
        },
      },
    });
  }

  /**
   * 返信を削除
   */
  async deleteReply(id: string) {
    return prisma.reviewCommentReply.delete({
      where: { id },
    });
  }
}
