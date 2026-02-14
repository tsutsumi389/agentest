import { prisma, type TestCasePriority, type EntityStatus, type Prisma } from '@agentest/db';

/**
 * グループ化された履歴アイテム内の履歴レコード
 */
export interface GroupedHistoryRecord {
  id: string;
  testCaseId: string;
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
 * カテゴリ別履歴（内部用）
 * 外部向けには@agentest/sharedのCategorizedHistoriesを使用
 */
interface CategorizedHistories {
  basicInfo: GroupedHistoryRecord[];
  preconditions: GroupedHistoryRecord[];
  steps: GroupedHistoryRecord[];
  expectedResults: GroupedHistoryRecord[];
}

/**
 * グループ化された履歴アイテム
 */
export interface GroupedHistoryItem {
  groupId: string | null;
  categorizedHistories: CategorizedHistories;
  createdAt: Date;
}

/**
 * changeDetail.typeからカテゴリを判定
 */
function getCategoryFromChangeDetail(snapshot: Record<string, unknown>): keyof CategorizedHistories {
  const changeDetail = snapshot.changeDetail as { type?: string } | undefined;
  if (!changeDetail?.type) {
    return 'basicInfo';
  }

  const type = changeDetail.type;

  // 前提条件関連
  if (type.startsWith('PRECONDITION_')) {
    return 'preconditions';
  }

  // ステップ関連
  if (type.startsWith('STEP_')) {
    return 'steps';
  }

  // 期待結果関連
  if (type.startsWith('EXPECTED_RESULT_')) {
    return 'expectedResults';
  }

  // その他（BASIC_INFO_UPDATE, COPY, CREATE, DELETE, RESTOREなど）
  return 'basicInfo';
}

/**
 * グループ化された履歴一覧の戻り値
 */
export interface GroupedHistoriesResult {
  items: GroupedHistoryItem[];
  totalGroups: number;
  totalHistories: number;
}

/**
 * テストケース検索オプション
 */
export interface TestCaseSearchOptions {
  q?: string;
  status?: EntityStatus[];
  priority?: TestCasePriority[];
  limit: number;
  offset: number;
  sortBy: 'title' | 'createdAt' | 'updatedAt' | 'priority' | 'orderKey';
  sortOrder: 'asc' | 'desc';
  includeDeleted: boolean;
}

/**
 * テストケースリポジトリ
 */
export class TestCaseRepository {
  /**
   * IDでテストケースを検索
   * @param includeDeleted trueの場合、削除済みテストケースも含めて検索する
   */
  async findById(id: string, options?: { includeDeleted?: boolean }) {
    return prisma.testCase.findFirst({
      where: {
        id,
        ...(options?.includeDeleted ? {} : { deletedAt: null }),
      },
      include: {
        testSuite: {
          select: { id: true, name: true, projectId: true },
        },
        createdByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
        preconditions: {
          orderBy: { orderKey: 'asc' },
        },
        steps: {
          orderBy: { orderKey: 'asc' },
        },
        expectedResults: {
          orderBy: { orderKey: 'asc' },
        },
      },
    });
  }

  /**
   * テストケースを更新
   */
  async update(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      priority?: TestCasePriority;
      status?: EntityStatus;
    }
  ) {
    return prisma.testCase.update({
      where: { id },
      data,
    });
  }

  /**
   * テストケースを論理削除
   */
  async softDelete(id: string) {
    return prisma.testCase.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * サジェスト用テストケース検索
   */
  async suggest(testSuiteId: string, options: { q?: string; limit: number }) {
    const where: Prisma.TestCaseWhereInput = {
      testSuiteId,
      deletedAt: null,
    };

    if (options.q) {
      where.OR = [
        { title: { contains: options.q, mode: 'insensitive' } },
        { description: { contains: options.q, mode: 'insensitive' } },
      ];
    }

    return prisma.testCase.findMany({
      where,
      select: { id: true, title: true, description: true, priority: true, status: true },
      orderBy: [{ status: 'asc' }, { orderKey: 'asc' }],
      take: options.limit,
    });
  }

  /**
   * テストケースを検索
   */
  async search(testSuiteId: string, options: TestCaseSearchOptions) {
    const where: Prisma.TestCaseWhereInput = {
      testSuiteId,
      deletedAt: options.includeDeleted ? undefined : null,
    };

    // 複数選択フィルタ
    if (options.status?.length) {
      where.status = { in: options.status };
    }
    if (options.priority?.length) {
      where.priority = { in: options.priority };
    }

    // キーワード検索（タイトル、手順、期待結果）
    if (options.q) {
      where.OR = [
        { title: { contains: options.q, mode: 'insensitive' } },
        { steps: { some: { content: { contains: options.q, mode: 'insensitive' } } } },
        { expectedResults: { some: { content: { contains: options.q, mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.testCase.findMany({
        where,
        include: {
          createdByUser: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { preconditions: true, steps: true, expectedResults: true } },
        },
        orderBy: { [options.sortBy]: options.sortOrder },
        take: options.limit,
        skip: options.offset,
      }),
      prisma.testCase.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * 削除済みテストケースをIDで検索
   */
  async findDeletedById(id: string) {
    return prisma.testCase.findFirst({
      where: {
        id,
        deletedAt: { not: null },
      },
      include: {
        testSuite: {
          select: { id: true, name: true, projectId: true },
        },
        createdByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
        preconditions: {
          orderBy: { orderKey: 'asc' },
        },
        steps: {
          orderBy: { orderKey: 'asc' },
        },
        expectedResults: {
          orderBy: { orderKey: 'asc' },
        },
      },
    });
  }

  /**
   * テストケースを復元（deletedAtをnullに設定）
   */
  async restore(id: string) {
    return prisma.testCase.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * 履歴一覧を取得
   */
  async getHistories(id: string, options: { limit: number; offset: number }) {
    return prisma.testCaseHistory.findMany({
      where: { testCaseId: id },
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
    return prisma.testCaseHistory.count({
      where: { testCaseId: id },
    });
  }

  /**
   * グループ化された履歴一覧を取得
   * グループ単位でのページネーションを行い、ページ境界をまたぐグループの分断を防ぐ
   */
  async getHistoriesGrouped(testCaseId: string, options: { limit: number; offset: number }): Promise<GroupedHistoriesResult> {
    // 1. グループ総数を取得（groupIdがnullの場合はidをグループとして扱う）
    // カラム側をtextにキャストしてパラメータと比較（text = text）
    const countResult = await prisma.$queryRaw<[{ group_count: bigint }]>`
      SELECT COUNT(DISTINCT COALESCE(group_id, id::text)) as group_count
      FROM test_case_histories WHERE test_case_id::text = ${testCaseId}
    `;
    const totalGroups = Number(countResult[0]?.group_count ?? 0);

    // 履歴レコード総数（後方互換性のため）
    const totalHistories = await prisma.testCaseHistory.count({
      where: { testCaseId },
    });

    // 2. 対象グループに属する履歴を取得（ページネーション）
    // グループごとの最新createdAtで降順ソートし、offset/limitでページネーション
    // Raw SQLでフィルタリングした履歴情報を取得
    const limitNum = options.limit;
    const offsetNum = options.offset;
    const rawHistories = await prisma.$queryRaw<
      {
        id: string;
        test_case_id: string;
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
          test_case_id,
          changed_by_user_id,
          changed_by_agent_session_id,
          change_type,
          snapshot,
          change_reason,
          group_id,
          created_at,
          COALESCE(group_id, id::text) as effective_group_id
        FROM test_case_histories
        WHERE test_case_id::text = ${testCaseId}
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
      testCaseId: h.test_case_id,
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
        categorizedHistories: CategorizedHistories;
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
        const categorizedHistories: CategorizedHistories = {
          basicInfo: [],
          preconditions: [],
          steps: [],
          expectedResults: [],
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
