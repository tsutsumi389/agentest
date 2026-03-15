import {
  prisma,
  type ReviewStatus,
  type ReviewTargetType,
  type ReviewTargetField,
  type Prisma,
} from '@agentest/db';
import { enrichCommentsWithTargetName } from './review-comment-enrichment.js';

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
    const comment = await prisma.reviewComment.findUnique({
      where: { id },
      include: commentInclude,
    });
    if (!comment) return null;
    const [enriched] = await enrichCommentsWithTargetName([comment]);
    return enriched;
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
    const [rawItems, total] = await Promise.all([
      prisma.reviewComment.findMany({
        where,
        include: commentInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.reviewComment.count({ where }),
    ]);

    const items = await enrichCommentsWithTargetName(rawItems);
    return { items, total };
  }

  /**
   * レビューコメントを作成
   * @deprecated 新しいReviewRepositoryを使用してください
   */
  async create(data: {
    reviewId: string;
    targetType: ReviewTargetType;
    targetId: string;
    targetField: ReviewTargetField;
    targetItemId?: string;
    authorUserId?: string;
    authorAgentSessionId?: string;
    content: string;
  }) {
    const comment = await prisma.reviewComment.create({
      data: {
        reviewId: data.reviewId,
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
    const [enriched] = await enrichCommentsWithTargetName([comment]);
    return enriched;
  }

  /**
   * レビューコメントを更新
   */
  async update(id: string, data: { content: string }) {
    const comment = await prisma.reviewComment.update({
      where: { id },
      data: { content: data.content },
      include: commentInclude,
    });
    const [enriched] = await enrichCommentsWithTargetName([comment]);
    return enriched;
  }

  /**
   * レビューコメントのステータスを更新
   */
  async updateStatus(id: string, status: ReviewStatus) {
    const comment = await prisma.reviewComment.update({
      where: { id },
      data: { status },
      include: commentInclude,
    });
    const [enriched] = await enrichCommentsWithTargetName([comment]);
    return enriched;
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
