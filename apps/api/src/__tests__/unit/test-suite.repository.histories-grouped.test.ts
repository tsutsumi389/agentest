import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestSuiteRepository } from '../../repositories/test-suite.repository.js';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  testSuiteHistory: {
    count: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  agentSession: {
    findMany: vi.fn(),
  },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

describe('TestSuiteRepository - getHistoriesGrouped', () => {
  let repository: TestSuiteRepository;

  const TEST_SUITE_ID = '11111111-1111-1111-1111-111111111111';
  const USER_ID = '22222222-2222-2222-2222-222222222222';
  const GROUP_ID = 'group-1';

  const mockUser = {
    id: USER_ID,
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.png',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TestSuiteRepository();
  });

  describe('空の履歴', () => {
    it('履歴がない場合は空の配列を返す', async () => {
      // グループ総数クエリ: 0を返す
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ group_count: BigInt(0) }]);
      // 履歴レコード総数: 0を返す
      mockPrisma.testSuiteHistory.count.mockResolvedValueOnce(0);
      // 履歴クエリ: 空配列を返す
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await repository.getHistoriesGrouped(TEST_SUITE_ID, { limit: 20, offset: 0 });

      expect(result).toEqual({
        items: [],
        totalGroups: 0,
        totalHistories: 0,
      });
    });
  });

  describe('groupIdがNULLの履歴（単一履歴）', () => {
    it('groupIdがnullの場合は各履歴が個別のグループとして扱われる', async () => {
      const rawHistory1 = {
        id: 'history-1',
        test_suite_id: TEST_SUITE_ID,
        changed_by_user_id: USER_ID,
        changed_by_agent_session_id: null,
        change_type: 'CREATE',
        snapshot: { name: 'Test Suite' },
        change_reason: null,
        group_id: null,
        created_at: new Date('2025-01-15T10:00:00Z'),
        effective_group_id: 'history-1',
      };

      const rawHistory2 = {
        id: 'history-2',
        test_suite_id: TEST_SUITE_ID,
        changed_by_user_id: USER_ID,
        changed_by_agent_session_id: null,
        change_type: 'UPDATE',
        snapshot: { name: 'Updated Suite' },
        change_reason: null,
        group_id: null,
        created_at: new Date('2025-01-16T10:00:00Z'),
        effective_group_id: 'history-2',
      };

      // グループ総数: 2
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ group_count: BigInt(2) }]);
      // 履歴レコード総数: 2
      mockPrisma.testSuiteHistory.count.mockResolvedValueOnce(2);
      // 履歴クエリ（createdAt降順）
      mockPrisma.$queryRaw.mockResolvedValueOnce([rawHistory2, rawHistory1]);
      // ユーザー取得
      mockPrisma.user.findMany.mockResolvedValueOnce([mockUser]);
      // エージェントセッション取得（空）
      mockPrisma.agentSession.findMany.mockResolvedValueOnce([]);

      const result = await repository.getHistoriesGrouped(TEST_SUITE_ID, { limit: 20, offset: 0 });

      expect(result.items).toHaveLength(2);
      expect(result.totalGroups).toBe(2);
      expect(result.totalHistories).toBe(2);

      // 各グループは1件ずつの履歴を持つ（changeDetailがないのでbasicInfoに分類）
      expect(result.items[0].categorizedHistories.basicInfo).toHaveLength(1);
      expect(result.items[0].groupId).toBeNull();
      expect(result.items[1].categorizedHistories.basicInfo).toHaveLength(1);
      expect(result.items[1].groupId).toBeNull();
    });
  });

  describe('グループ化された履歴', () => {
    it('同じgroupIdの履歴が1つのグループにまとめられる', async () => {
      const rawHistories = [
        {
          id: 'history-1',
          test_suite_id: TEST_SUITE_ID,
          changed_by_user_id: USER_ID,
          changed_by_agent_session_id: null,
          change_type: 'UPDATE',
          snapshot: { name: 'Suite', description: 'Updated' },
          change_reason: null,
          group_id: GROUP_ID,
          created_at: new Date('2025-01-15T10:00:01Z'),
          effective_group_id: GROUP_ID,
        },
        {
          id: 'history-2',
          test_suite_id: TEST_SUITE_ID,
          changed_by_user_id: USER_ID,
          changed_by_agent_session_id: null,
          change_type: 'UPDATE',
          snapshot: { name: 'Updated Name' },
          change_reason: null,
          group_id: GROUP_ID,
          created_at: new Date('2025-01-15T10:00:00Z'),
          effective_group_id: GROUP_ID,
        },
      ];

      // グループ総数: 1
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ group_count: BigInt(1) }]);
      // 履歴レコード総数: 2
      mockPrisma.testSuiteHistory.count.mockResolvedValueOnce(2);
      // 履歴クエリ
      mockPrisma.$queryRaw.mockResolvedValueOnce(rawHistories);
      // ユーザー取得
      mockPrisma.user.findMany.mockResolvedValueOnce([mockUser]);

      const result = await repository.getHistoriesGrouped(TEST_SUITE_ID, { limit: 20, offset: 0 });

      expect(result.items).toHaveLength(1);
      expect(result.totalGroups).toBe(1);
      expect(result.totalHistories).toBe(2);

      // 1つのグループに2件の履歴が含まれる（changeDetailがないのでbasicInfoに分類）
      const group = result.items[0];
      expect(group.groupId).toBe(GROUP_ID);
      expect(group.categorizedHistories.basicInfo).toHaveLength(2);
      expect(group.categorizedHistories.basicInfo[0].id).toBe('history-1');
      expect(group.categorizedHistories.basicInfo[1].id).toBe('history-2');
    });
  });

  describe('カテゴリ分類', () => {
    it('changeDetail.typeに基づいて正しいカテゴリに分類される', async () => {
      const rawHistories = [
        {
          id: 'history-precondition',
          test_suite_id: TEST_SUITE_ID,
          changed_by_user_id: USER_ID,
          changed_by_agent_session_id: null,
          change_type: 'UPDATE',
          snapshot: {
            changeDetail: {
              type: 'PRECONDITION_ADD',
              preconditionId: 'pre-1',
              added: { content: '前提条件1', orderKey: '00001' },
            },
          },
          change_reason: null,
          group_id: GROUP_ID,
          created_at: new Date('2025-01-15T10:00:01Z'),
          effective_group_id: GROUP_ID,
        },
        {
          id: 'history-basic',
          test_suite_id: TEST_SUITE_ID,
          changed_by_user_id: USER_ID,
          changed_by_agent_session_id: null,
          change_type: 'UPDATE',
          snapshot: {
            changeDetail: {
              type: 'BASIC_INFO_UPDATE',
              fields: { name: { before: '旧', after: '新' } },
            },
          },
          change_reason: null,
          group_id: GROUP_ID,
          created_at: new Date('2025-01-15T10:00:00Z'),
          effective_group_id: GROUP_ID,
        },
      ];

      mockPrisma.$queryRaw.mockResolvedValueOnce([{ group_count: BigInt(1) }]);
      mockPrisma.testSuiteHistory.count.mockResolvedValueOnce(2);
      mockPrisma.$queryRaw.mockResolvedValueOnce(rawHistories);
      mockPrisma.user.findMany.mockResolvedValueOnce([mockUser]);

      const result = await repository.getHistoriesGrouped(TEST_SUITE_ID, { limit: 20, offset: 0 });

      expect(result.items).toHaveLength(1);
      const group = result.items[0];

      // 各カテゴリに正しく分類されていることを確認
      expect(group.categorizedHistories.basicInfo).toHaveLength(1);
      expect(group.categorizedHistories.basicInfo[0].id).toBe('history-basic');

      expect(group.categorizedHistories.preconditions).toHaveLength(1);
      expect(group.categorizedHistories.preconditions[0].id).toBe('history-precondition');
    });

    it('PRECONDITION_*はpreconditionsに分類される', async () => {
      const rawHistories = [
        {
          id: 'history-add',
          test_suite_id: TEST_SUITE_ID,
          changed_by_user_id: USER_ID,
          changed_by_agent_session_id: null,
          change_type: 'UPDATE',
          snapshot: {
            changeDetail: {
              type: 'PRECONDITION_ADD',
              preconditionId: 'pre-1',
              added: { content: '追加', orderKey: '00001' },
            },
          },
          change_reason: null,
          group_id: GROUP_ID,
          created_at: new Date('2025-01-15T10:00:03Z'),
          effective_group_id: GROUP_ID,
        },
        {
          id: 'history-update',
          test_suite_id: TEST_SUITE_ID,
          changed_by_user_id: USER_ID,
          changed_by_agent_session_id: null,
          change_type: 'UPDATE',
          snapshot: {
            changeDetail: {
              type: 'PRECONDITION_UPDATE',
              preconditionId: 'pre-2',
              before: { content: '旧' },
              after: { content: '新' },
            },
          },
          change_reason: null,
          group_id: GROUP_ID,
          created_at: new Date('2025-01-15T10:00:02Z'),
          effective_group_id: GROUP_ID,
        },
        {
          id: 'history-delete',
          test_suite_id: TEST_SUITE_ID,
          changed_by_user_id: USER_ID,
          changed_by_agent_session_id: null,
          change_type: 'UPDATE',
          snapshot: {
            changeDetail: {
              type: 'PRECONDITION_DELETE',
              preconditionId: 'pre-3',
              deleted: { content: '削除', orderKey: '00003' },
            },
          },
          change_reason: null,
          group_id: GROUP_ID,
          created_at: new Date('2025-01-15T10:00:01Z'),
          effective_group_id: GROUP_ID,
        },
        {
          id: 'history-reorder',
          test_suite_id: TEST_SUITE_ID,
          changed_by_user_id: USER_ID,
          changed_by_agent_session_id: null,
          change_type: 'UPDATE',
          snapshot: {
            changeDetail: {
              type: 'PRECONDITION_REORDER',
              before: ['pre-1', 'pre-2'],
              after: ['pre-2', 'pre-1'],
            },
          },
          change_reason: null,
          group_id: GROUP_ID,
          created_at: new Date('2025-01-15T10:00:00Z'),
          effective_group_id: GROUP_ID,
        },
      ];

      mockPrisma.$queryRaw.mockResolvedValueOnce([{ group_count: BigInt(1) }]);
      mockPrisma.testSuiteHistory.count.mockResolvedValueOnce(4);
      mockPrisma.$queryRaw.mockResolvedValueOnce(rawHistories);
      mockPrisma.user.findMany.mockResolvedValueOnce([mockUser]);

      const result = await repository.getHistoriesGrouped(TEST_SUITE_ID, { limit: 20, offset: 0 });

      // 全てpreconditionsカテゴリに分類される
      expect(result.items[0].categorizedHistories.preconditions).toHaveLength(4);
      expect(result.items[0].categorizedHistories.basicInfo).toHaveLength(0);
    });

    it('TEST_CASE_REORDERはbasicInfoに分類される', async () => {
      const rawHistory = {
        id: 'history-tc-reorder',
        test_suite_id: TEST_SUITE_ID,
        changed_by_user_id: USER_ID,
        changed_by_agent_session_id: null,
        change_type: 'UPDATE',
        snapshot: {
          changeDetail: {
            type: 'TEST_CASE_REORDER',
            before: ['tc-1', 'tc-2'],
            after: ['tc-2', 'tc-1'],
          },
        },
        change_reason: null,
        group_id: null,
        created_at: new Date('2025-01-15T10:00:00Z'),
        effective_group_id: 'history-tc-reorder',
      };

      mockPrisma.$queryRaw.mockResolvedValueOnce([{ group_count: BigInt(1) }]);
      mockPrisma.testSuiteHistory.count.mockResolvedValueOnce(1);
      mockPrisma.$queryRaw.mockResolvedValueOnce([rawHistory]);
      mockPrisma.user.findMany.mockResolvedValueOnce([mockUser]);

      const result = await repository.getHistoriesGrouped(TEST_SUITE_ID, { limit: 20, offset: 0 });

      expect(result.items[0].categorizedHistories.basicInfo).toHaveLength(1);
      expect(result.items[0].categorizedHistories.preconditions).toHaveLength(0);
    });

    it('changeDetailがない場合はbasicInfoに分類される', async () => {
      const rawHistory = {
        id: 'history-no-detail',
        test_suite_id: TEST_SUITE_ID,
        changed_by_user_id: USER_ID,
        changed_by_agent_session_id: null,
        change_type: 'UPDATE',
        snapshot: { name: 'テスト' }, // changeDetailなし
        change_reason: null,
        group_id: null,
        created_at: new Date('2025-01-15T10:00:00Z'),
        effective_group_id: 'history-no-detail',
      };

      mockPrisma.$queryRaw.mockResolvedValueOnce([{ group_count: BigInt(1) }]);
      mockPrisma.testSuiteHistory.count.mockResolvedValueOnce(1);
      mockPrisma.$queryRaw.mockResolvedValueOnce([rawHistory]);
      mockPrisma.user.findMany.mockResolvedValueOnce([mockUser]);

      const result = await repository.getHistoriesGrouped(TEST_SUITE_ID, { limit: 20, offset: 0 });

      expect(result.items[0].categorizedHistories.basicInfo).toHaveLength(1);
      expect(result.items[0].categorizedHistories.preconditions).toHaveLength(0);
    });
  });

  describe('関連データの取得', () => {
    it('changedByユーザー情報が含まれる', async () => {
      const rawHistory = {
        id: 'history-1',
        test_suite_id: TEST_SUITE_ID,
        changed_by_user_id: USER_ID,
        changed_by_agent_session_id: null,
        change_type: 'CREATE',
        snapshot: { name: 'Test' },
        change_reason: null,
        group_id: null,
        created_at: new Date('2025-01-15T10:00:00Z'),
        effective_group_id: 'history-1',
      };

      mockPrisma.$queryRaw.mockResolvedValueOnce([{ group_count: BigInt(1) }]);
      mockPrisma.testSuiteHistory.count.mockResolvedValueOnce(1);
      mockPrisma.$queryRaw.mockResolvedValueOnce([rawHistory]);
      mockPrisma.user.findMany.mockResolvedValueOnce([mockUser]);

      const result = await repository.getHistoriesGrouped(TEST_SUITE_ID, { limit: 20, offset: 0 });

      expect(result.items[0].categorizedHistories.basicInfo[0].changedBy).toEqual(mockUser);
    });
  });

  describe('ページネーション', () => {
    it('offsetとlimitが正しくSQLに渡される', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ group_count: BigInt(0) }]);
      mockPrisma.testSuiteHistory.count.mockResolvedValueOnce(0);
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      await repository.getHistoriesGrouped(TEST_SUITE_ID, { limit: 10, offset: 5 });

      // 2番目の$queryRaw呼び出し（履歴取得）にLIMIT/OFFSETが渡されることを確認
      const secondCall = mockPrisma.$queryRaw.mock.calls[1];
      expect(secondCall).toBeDefined();
      // テンプレートリテラルの中にlimitとoffsetが含まれている
      const sqlStrings = secondCall[0];
      expect(sqlStrings.join('')).toContain('LIMIT');
      expect(sqlStrings.join('')).toContain('OFFSET');
    });
  });
});
