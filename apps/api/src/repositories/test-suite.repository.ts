import { prisma, type EntityStatus, type Prisma } from '@agentest/db';
import type { TestSuiteCategorizedHistories } from '@agentest/shared';

/**
 * グループ化された履歴アイテム内の履歴レコード
 */
export interface GroupedTestSuiteHistoryRecord {
  id: string;
  testSuiteId: string;
  changedByUserId: string | null;
  changedByAgentSessionId: string | null;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  snapshot: Record<string, unknown>;
  changeReason: string | null;
  groupId: string | null;
  createdAt: Date;
  changedBy: { id: string; name: string; avatarUrl: string | null } | null;
  agentSession: { id: string; clientName: string | null } | null;
}

/**
 * グループ化された履歴アイテム
 */
export interface GroupedTestSuiteHistoryItem {
  groupId: string | null;
  categorizedHistories: {
    basicInfo: GroupedTestSuiteHistoryRecord[];
    preconditions: GroupedTestSuiteHistoryRecord[];
  };
  createdAt: Date;
}

/**
 * グループ化された履歴一覧の戻り値
 */
export interface GroupedTestSuiteHistoriesResult {
  items: GroupedTestSuiteHistoryItem[];
  totalGroups: number;
  totalHistories: number;
}

/**
 * changeDetail.typeからカテゴリを判定
 */
function getCategoryFromChangeDetail(snapshot: Record<string, unknown>): keyof TestSuiteCategorizedHistories {
  const changeDetail = snapshot.changeDetail as { type?: string } | undefined;
  if (!changeDetail?.type) {
    return 'basicInfo';
  }

  const type = changeDetail.type;

  // 前提条件関連
  if (type.startsWith('PRECONDITION_')) {
    return 'preconditions';
  }

  // その他（BASIC_INFO_UPDATE, TEST_CASE_REORDER, CREATE, DELETE, RESTOREなど）
  return 'basicInfo';
}

/**
 * テストスイート検索オプション
 */
export interface TestSuiteSearchOptions {
  q?: string;
  status?: EntityStatus;
  createdBy?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
  sortBy: 'name' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
  includeDeleted: boolean;
}

/**
 * テストスイート検索結果のラベル情報
 */
export interface TestSuiteSearchLabel {
  id: string;
  name: string;
  color: string;
}

/**
 * テストスイート検索結果の最終実行情報
 */
export interface TestSuiteSearchExecution {
  id: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
}

/**
 * テストスイート検索結果アイテム
 */
export interface TestSuiteSearchItem {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: EntityStatus;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdByUser: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { testCases: number; preconditions: number };
  testSuiteLabels: Array<{ label: TestSuiteSearchLabel }>;
  executions: TestSuiteSearchExecution[];
}

/**
 * テストスイートリポジトリ
 */
export class TestSuiteRepository {
  /**
   * IDでテストスイートを検索
   */
  async findById(id: string) {
    return prisma.testSuite.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        createdByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: { testCases: true, preconditions: true },
        },
      },
    });
  }

  /**
   * テストスイートを更新
   */
  async update(id: string, data: { name?: string; description?: string | null; status?: EntityStatus }) {
    return prisma.testSuite.update({
      where: { id },
      data,
    });
  }

  /**
   * テストスイートを論理削除
   */
  async softDelete(id: string) {
    return prisma.testSuite.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * 削除済みテストスイートをIDで検索
   */
  async findDeletedById(id: string) {
    return prisma.testSuite.findFirst({
      where: {
        id,
        deletedAt: { not: null },
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        createdByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: { testCases: true, preconditions: true },
        },
      },
    });
  }

  /**
   * テストスイートを復元（deletedAtをnullに設定）
   */
  async restore(id: string) {
    return prisma.testSuite.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * 履歴一覧を取得
   */
  async getHistories(id: string, options: { limit: number; offset: number }) {
    return prisma.testSuiteHistory.findMany({
      where: { testSuiteId: id },
      include: {
        changedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
        agentSession: {
          select: { id: true, clientName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      skip: options.offset,
    });
  }

  /**
   * 履歴件数を取得
   */
  async countHistories(id: string) {
    return prisma.testSuiteHistory.count({
      where: { testSuiteId: id },
    });
  }

  /**
   * サジェスト用テストスイート検索
   */
  async suggest(projectId: string, options: { q?: string; limit: number }) {
    const where: Prisma.TestSuiteWhereInput = {
      projectId,
      deletedAt: null,
    };

    if (options.q) {
      where.OR = [
        { name: { contains: options.q, mode: 'insensitive' } },
        { description: { contains: options.q, mode: 'insensitive' } },
      ];
    }

    return prisma.testSuite.findMany({
      where,
      select: { id: true, name: true, description: true, status: true },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      take: options.limit,
    });
  }

  /**
   * テストスイートを検索
   */
  async search(projectId: string, options: TestSuiteSearchOptions): Promise<{ items: TestSuiteSearchItem[]; total: number }> {
    const { q, status, createdBy, from, to, limit, offset, sortBy, sortOrder, includeDeleted } = options;

    // 検索条件を構築
    const where: Prisma.TestSuiteWhereInput = {
      projectId,
      // 削除済みを含めるかどうか
      deletedAt: includeDeleted ? undefined : null,
    };

    // ステータスフィルタ
    if (status) {
      where.status = status;
    }

    // 作成者フィルタ
    if (createdBy) {
      where.createdByUserId = createdBy;
    }

    // 日付フィルタ
    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(from);
      }
      if (to) {
        where.createdAt.lte = new Date(to);
      }
    }

    // キーワード検索（名前または前提条件内容）
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        {
          preconditions: {
            some: {
              content: { contains: q, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    // ソート条件
    const orderBy: Prisma.TestSuiteOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // 検索実行
    const [items, total] = await Promise.all([
      prisma.testSuite.findMany({
        where,
        include: {
          createdByUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { testCases: true, preconditions: true },
          },
          // ラベル情報
          testSuiteLabels: {
            include: {
              label: { select: { id: true, name: true, color: true } },
            },
            orderBy: { label: { name: 'asc' } },
          },
          // 最終実行情報（最新1件）
          executions: {
            orderBy: { startedAt: 'desc' },
            take: 1,
            select: { id: true, status: true, startedAt: true, completedAt: true },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.testSuite.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * グループ化された履歴一覧を取得
   * グループ単位でのページネーションを行い、ページ境界をまたぐグループの分断を防ぐ
   */
  async getHistoriesGrouped(testSuiteId: string, options: { limit: number; offset: number }): Promise<GroupedTestSuiteHistoriesResult> {
    // 1. グループ総数を取得（groupIdがnullの場合はidをグループとして扱う）
    const countResult = await prisma.$queryRaw<[{ group_count: bigint }]>`
      SELECT COUNT(DISTINCT COALESCE(group_id, id::text)) as group_count
      FROM test_suite_histories WHERE test_suite_id::text = ${testSuiteId}
    `;
    const totalGroups = Number(countResult[0]?.group_count ?? 0);

    // 履歴レコード総数（後方互換性のため）
    const totalHistories = await prisma.testSuiteHistory.count({
      where: { testSuiteId },
    });

    // 2. 対象グループに属する履歴を取得（ページネーション）
    const limitNum = options.limit;
    const offsetNum = options.offset;
    const rawHistories = await prisma.$queryRaw<
      {
        id: string;
        test_suite_id: string;
        changed_by_user_id: string | null;
        changed_by_agent_session_id: string | null;
        change_type: string;
        snapshot: unknown;
        change_reason: string | null;
        group_id: string | null;
        created_at: Date;
        effective_group_id: string;
      }[]
    >`
      WITH grouped AS (
        SELECT
          id,
          test_suite_id,
          changed_by_user_id,
          changed_by_agent_session_id,
          change_type,
          snapshot,
          change_reason,
          group_id,
          created_at,
          COALESCE(group_id, id::text) as effective_group_id
        FROM test_suite_histories
        WHERE test_suite_id::text = ${testSuiteId}
      ),
      group_times AS (
        SELECT
          effective_group_id,
          MAX(created_at) as latest_created_at
        FROM grouped
        GROUP BY effective_group_id
      ),
      paginated_groups AS (
        SELECT effective_group_id
        FROM group_times
        ORDER BY latest_created_at DESC
        LIMIT ${limitNum} OFFSET ${offsetNum}
      )
      SELECT g.*
      FROM grouped g
      INNER JOIN paginated_groups pg ON g.effective_group_id = pg.effective_group_id
      ORDER BY g.created_at DESC
    `;

    if (rawHistories.length === 0) {
      return { items: [], totalGroups, totalHistories };
    }

    const targetGroupIds = [...new Set(rawHistories.map((r) => r.effective_group_id))];

    // 3. 関連データ（ユーザー、エージェントセッション）を別途取得
    const userIds = [...new Set(rawHistories.map((h) => h.changed_by_user_id).filter((id): id is string => id !== null))];
    const sessionIds = [...new Set(rawHistories.map((h) => h.changed_by_agent_session_id).filter((id): id is string => id !== null))];

    const [users, sessions] = await Promise.all([
      userIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, avatarUrl: true },
          })
        : [],
      sessionIds.length > 0
        ? prisma.agentSession.findMany({
            where: { id: { in: sessionIds } },
            select: { id: true, clientName: true },
          })
        : [],
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    // 履歴データを整形
    const histories = rawHistories.map((h) => ({
      id: h.id,
      testSuiteId: h.test_suite_id,
      changedByUserId: h.changed_by_user_id,
      changedByAgentSessionId: h.changed_by_agent_session_id,
      changeType: h.change_type as 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
      snapshot: h.snapshot as Record<string, unknown>,
      changeReason: h.change_reason,
      groupId: h.group_id,
      createdAt: h.created_at,
      changedBy: h.changed_by_user_id ? userMap.get(h.changed_by_user_id) ?? null : null,
      agentSession: h.changed_by_agent_session_id ? sessionMap.get(h.changed_by_agent_session_id) ?? null : null,
    }));

    // 4. グループ化してカテゴリ別に振り分け
    const groupMap = new Map<
      string,
      {
        groupId: string | null;
        categorizedHistories: {
          basicInfo: GroupedTestSuiteHistoryRecord[];
          preconditions: GroupedTestSuiteHistoryRecord[];
        };
        createdAt: Date;
      }
    >();

    for (const history of histories) {
      const effectiveGroupId = history.groupId ?? history.id;
      const category = getCategoryFromChangeDetail(history.snapshot);
      const existing = groupMap.get(effectiveGroupId);

      if (existing) {
        existing.categorizedHistories[category].push(history);
        // より新しい日時を保持
        if (history.createdAt > existing.createdAt) {
          existing.createdAt = history.createdAt;
        }
      } else {
        // 空のカテゴリ別履歴を初期化
        const categorizedHistories = {
          basicInfo: [] as GroupedTestSuiteHistoryRecord[],
          preconditions: [] as GroupedTestSuiteHistoryRecord[],
        };
        categorizedHistories[category].push(history);

        groupMap.set(effectiveGroupId, {
          groupId: history.groupId,
          categorizedHistories,
          createdAt: history.createdAt,
        });
      }
    }

    // targetGroupIdsの順序を維持
    const items = targetGroupIds
      .map((gid) => groupMap.get(gid))
      .filter((item): item is NonNullable<typeof item> => item !== undefined);

    return { items, totalGroups, totalHistories };
  }
}
