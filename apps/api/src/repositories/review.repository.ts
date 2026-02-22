import {
  prisma,
  type ReviewVerdict,
  type ReviewTargetType,
  type ReviewTargetField,
  type Prisma,
} from '@agentest/db';
import {
  enrichReviewWithTargetNames,
  enrichCommentsWithTargetName,
} from './review-comment-enrichment.js';

/**
 * レビュー検索オプション
 */
export interface ReviewSearchOptions {
  verdict?: ReviewVerdict;
  limit: number;
  offset: number;
}

/**
 * レビューの共通includeオプション
 */
const reviewInclude = {
  author: {
    select: { id: true, name: true, avatarUrl: true },
  },
  agentSession: {
    select: { id: true, clientName: true },
  },
  _count: {
    select: { comments: true },
  },
};

/**
 * レビュー詳細の共通includeオプション（コメント含む）
 */
const reviewDetailInclude = {
  author: {
    select: { id: true, name: true, avatarUrl: true },
  },
  agentSession: {
    select: { id: true, clientName: true },
  },
  comments: {
    include: {
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
    },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: {
    select: { comments: true },
  },
};

/**
 * レビューリポジトリ
 */
export class ReviewRepository {
  /**
   * IDでレビューを検索
   */
  async findById(id: string) {
    const review = await prisma.review.findUnique({
      where: { id },
      include: reviewDetailInclude,
    });
    return enrichReviewWithTargetNames(review);
  }

  /**
   * テストスイートの公開済みレビュー一覧を検索
   */
  async searchByTestSuite(testSuiteId: string, options: ReviewSearchOptions) {
    const { verdict, limit, offset } = options;

    // 検索条件を構築（SUBMITTEDのみ）
    const where: Prisma.ReviewWhereInput = {
      testSuiteId,
      status: 'SUBMITTED',
    };

    // 評価フィルタ
    if (verdict) {
      where.verdict = verdict;
    }

    // 検索実行
    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { submittedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.review.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * ユーザーの下書きレビュー一覧を取得
   */
  async findDraftsByUser(userId: string) {
    return prisma.review.findMany({
      where: {
        authorUserId: userId,
        status: 'DRAFT',
      },
      include: {
        ...reviewInclude,
        testSuite: {
          select: {
            id: true,
            name: true,
            project: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 特定テストスイートに対するユーザーの下書きレビューを取得
   */
  async findDraftByUserAndTestSuite(userId: string, testSuiteId: string) {
    const review = await prisma.review.findFirst({
      where: {
        testSuiteId,
        authorUserId: userId,
        status: 'DRAFT',
      },
      include: reviewDetailInclude,
    });
    return enrichReviewWithTargetNames(review);
  }

  /**
   * レビューを作成
   */
  async create(data: {
    testSuiteId: string;
    authorUserId?: string;
    authorAgentSessionId?: string;
    summary?: string;
  }) {
    const review = await prisma.review.create({
      data: {
        testSuiteId: data.testSuiteId,
        authorUserId: data.authorUserId,
        authorAgentSessionId: data.authorAgentSessionId,
        summary: data.summary,
        status: 'DRAFT',
      },
      include: reviewDetailInclude,
    });
    return enrichReviewWithTargetNames(review) as Promise<typeof review>;
  }

  /**
   * レビューを更新
   */
  async update(id: string, data: { summary?: string }) {
    const review = await prisma.review.update({
      where: { id },
      data: { summary: data.summary },
      include: reviewDetailInclude,
    });
    return enrichReviewWithTargetNames(review) as Promise<typeof review>;
  }

  /**
   * 提出済みレビューの評価を更新
   */
  async updateVerdict(id: string, verdict: ReviewVerdict) {
    const review = await prisma.review.update({
      where: { id },
      data: { verdict },
      include: reviewDetailInclude,
    });
    return enrichReviewWithTargetNames(review) as Promise<typeof review>;
  }

  /**
   * レビューを提出（DRAFT → SUBMITTED）
   */
  async submit(id: string, data: { verdict: ReviewVerdict; summary?: string }) {
    const review = await prisma.review.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        verdict: data.verdict,
        summary: data.summary,
        submittedAt: new Date(),
      },
      include: reviewDetailInclude,
    });
    return enrichReviewWithTargetNames(review) as Promise<typeof review>;
  }

  /**
   * レビューを削除（DRAFTのみ）
   */
  async delete(id: string) {
    return prisma.review.delete({
      where: { id },
    });
  }

  /**
   * レビューにコメントを追加
   */
  async addComment(data: {
    reviewId: string;
    targetType: ReviewTargetType;
    targetId: string;
    targetField: ReviewTargetField;
    targetItemId?: string;
    targetItemContent?: string;
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
        targetItemContent: data.targetItemContent,
        authorUserId: data.authorUserId,
        authorAgentSessionId: data.authorAgentSessionId,
        content: data.content,
        status: 'OPEN',
      },
      include: {
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
      },
    });
    const [enriched] = await enrichCommentsWithTargetName([comment]);
    return enriched;
  }

  /**
   * コメントをIDで検索
   */
  async findCommentById(id: string) {
    const comment = await prisma.reviewComment.findUnique({
      where: { id },
      include: {
        review: true,
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
      },
    });
    if (!comment) return null;
    const [enriched] = await enrichCommentsWithTargetName([comment]);
    return enriched;
  }

  /**
   * コメントを更新
   */
  async updateComment(id: string, data: { content: string }) {
    const comment = await prisma.reviewComment.update({
      where: { id },
      data: { content: data.content },
      include: {
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
      },
    });
    const [enriched] = await enrichCommentsWithTargetName([comment]);
    return enriched;
  }

  /**
   * コメントのステータスを更新
   */
  async updateCommentStatus(id: string, status: 'OPEN' | 'RESOLVED') {
    const comment = await prisma.reviewComment.update({
      where: { id },
      data: { status },
      include: {
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
      },
    });
    const [enriched] = await enrichCommentsWithTargetName([comment]);
    return enriched;
  }

  /**
   * コメントを削除
   */
  async deleteComment(id: string) {
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
        comment: {
          include: {
            review: true,
          },
        },
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
   * 返信を追加
   */
  async addReply(data: {
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

  /**
   * レビューの未解決コメント数を取得
   */
  async getOpenCommentCount(reviewId: string): Promise<number> {
    return prisma.reviewComment.count({
      where: {
        reviewId,
        status: 'OPEN',
      },
    });
  }
}
