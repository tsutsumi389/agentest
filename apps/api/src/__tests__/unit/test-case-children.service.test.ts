import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestError } from '@agentest/shared';

// ロガーモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});
vi.mock('../../utils/logger.js', () => ({ logger: mockLogger }));

// トランザクション内モック
const mockTx = vi.hoisted(() => ({
  testCasePrecondition: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseStep: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseExpectedResult: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseHistory: { create: vi.fn() },
  testCase: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  testCasePrecondition: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseStep: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseExpectedResult: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseHistory: { create: vi.fn() },
  testCase: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

const mockTestCaseRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

vi.mock('../../repositories/test-case.repository.js', () => ({
  TestCaseRepository: vi.fn().mockImplementation(() => mockTestCaseRepo),
}));

vi.mock('../../lib/redis-publisher.js', () => ({ publishDashboardUpdated: vi.fn() }));
vi.mock('../../lib/events.js', () => ({ publishTestCaseUpdated: vi.fn() }));

import {
  ORDER_KEY_INITIAL,
  ORDER_KEY_PAD_LENGTH,
  getNextOrderKey,
  indexToOrderKey,
  toJsonSnapshot,
  TestCaseChildrenService,
  type TestCaseSnapshot,
  type HistorySnapshot,
  type ChildEntitySnapshot,
} from '../../services/test-case-children.service.js';
import {
  TEST_USER_ID,
  TEST_CASE_ID,
  TEST_SUITE_ID,
  createMockTestCase,
} from './test-case.service.test-helpers.js';

// -------------------------------------------------------
// protectedメソッドをテスト用に公開するサブクラス
// -------------------------------------------------------
class TestableChildrenService extends TestCaseChildrenService {
  public async exposedSyncChildEntitiesWithHistory(
    tx: any,
    testCaseId: string,
    testCase: {
      id: string;
      testSuiteId: string;
      title: string;
      description: string | null;
      priority: string;
      status: string;
    },
    userId: string,
    entityType: 'precondition' | 'step' | 'expectedResult',
    items: { id?: string; content: string }[],
    existingItems: { id: string; content: string; orderKey: string }[],
    groupId: string
  ) {
    return this.syncChildEntitiesWithHistory(
      tx,
      testCaseId,
      testCase,
      userId,
      entityType,
      items,
      existingItems,
      groupId
    );
  }
}

// -------------------------------------------------------
// 定数のテスト
// -------------------------------------------------------
describe('ORDER_KEY定数', () => {
  it('ORDER_KEY_INITIALは"00001"である', () => {
    expect(ORDER_KEY_INITIAL).toBe('00001');
  });

  it('ORDER_KEY_PAD_LENGTHは5である', () => {
    expect(ORDER_KEY_PAD_LENGTH).toBe(5);
  });
});

// -------------------------------------------------------
// getNextOrderKey のテスト
// -------------------------------------------------------
describe('getNextOrderKey', () => {
  it('nullを渡すと初期値"00001"を返す', () => {
    expect(getNextOrderKey(null)).toBe('00001');
  });

  it('"00001"の次は"00002"', () => {
    expect(getNextOrderKey('00001')).toBe('00002');
  });

  it('"00009"の次は"00010"', () => {
    expect(getNextOrderKey('00009')).toBe('00010');
  });

  it('"00099"の次は"00100"', () => {
    expect(getNextOrderKey('00099')).toBe('00100');
  });

  it('"99999"の次は"100000"（5桁を超える）', () => {
    expect(getNextOrderKey('99999')).toBe('100000');
  });

  it('数値として解釈できない文字列("abc")は初期値を返す', () => {
    expect(getNextOrderKey('abc')).toBe('00001');
  });

  it('空文字はfalsy扱いで初期値を返す', () => {
    expect(getNextOrderKey('')).toBe('00001');
  });
});

// -------------------------------------------------------
// indexToOrderKey のテスト
// -------------------------------------------------------
describe('indexToOrderKey', () => {
  it('index=0 → "00001"', () => {
    expect(indexToOrderKey(0)).toBe('00001');
  });

  it('index=1 → "00002"', () => {
    expect(indexToOrderKey(1)).toBe('00002');
  });

  it('index=9 → "00010"', () => {
    expect(indexToOrderKey(9)).toBe('00010');
  });

  it('index=99 → "00100"', () => {
    expect(indexToOrderKey(99)).toBe('00100');
  });

  it('index=99999 → "100000"（5桁を超える）', () => {
    expect(indexToOrderKey(99999)).toBe('100000');
  });
});

// -------------------------------------------------------
// toJsonSnapshot のテスト
// -------------------------------------------------------
describe('toJsonSnapshot', () => {
  it('TestCaseSnapshotを渡すとそのままJSON値として返す', () => {
    const snapshot: TestCaseSnapshot = {
      id: TEST_CASE_ID,
      testSuiteId: TEST_SUITE_ID,
      title: 'テストケース',
      description: 'テスト説明',
      priority: 'MEDIUM',
      status: 'DRAFT',
    };

    const result = toJsonSnapshot(snapshot);

    expect(result).toEqual({
      id: TEST_CASE_ID,
      testSuiteId: TEST_SUITE_ID,
      title: 'テストケース',
      description: 'テスト説明',
      priority: 'MEDIUM',
      status: 'DRAFT',
    });
  });

  it('HistorySnapshotを渡すと子エンティティ情報やchangeDetailも含めて返す', () => {
    const childEntity: ChildEntitySnapshot = {
      id: 'child-1',
      content: '前提条件の内容',
      orderKey: '00001',
    };
    const snapshot: HistorySnapshot = {
      id: TEST_CASE_ID,
      testSuiteId: TEST_SUITE_ID,
      title: 'テストケース',
      description: null,
      priority: 'HIGH',
      status: 'ACTIVE',
      preconditions: [childEntity],
      changeDetail: {
        type: 'PRECONDITION_ADD',
        preconditionId: 'child-1',
        added: { content: '前提条件の内容', orderKey: '00001' },
      },
    };

    const result = toJsonSnapshot(snapshot);

    expect(result).toEqual(snapshot);
  });

  it('deletedAtフィールドがある場合も含めて返す', () => {
    const snapshot: TestCaseSnapshot = {
      id: TEST_CASE_ID,
      testSuiteId: TEST_SUITE_ID,
      title: 'テスト',
      description: null,
      priority: 'LOW',
      status: 'DRAFT',
      deletedAt: '2025-01-01T00:00:00Z',
    };

    const result = toJsonSnapshot(snapshot);

    expect(result).toEqual(
      expect.objectContaining({
        deletedAt: '2025-01-01T00:00:00Z',
      })
    );
  });
});

// -------------------------------------------------------
// syncChildEntitiesWithHistory のテスト
// -------------------------------------------------------
describe('TestCaseChildrenService.syncChildEntitiesWithHistory', () => {
  let service: TestableChildrenService;

  const mockTestCase = {
    id: TEST_CASE_ID,
    testSuiteId: TEST_SUITE_ID,
    title: 'テストケース',
    description: 'テスト説明',
    priority: 'MEDIUM',
    status: 'DRAFT',
  };

  const GROUP_ID = 'test-group-id';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestableChildrenService();
    mockTestCaseRepo.findById.mockResolvedValue(createMockTestCase());
    mockTx.user.findUnique.mockResolvedValue({ id: TEST_USER_ID, name: 'User' });
  });

  // ------- precondition -------
  describe('precondition', () => {
    it('既存の前提条件を削除して履歴を作成する', async () => {
      const existing = [{ id: 'p1', content: '削除対象', orderKey: '00001' }];

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'precondition',
        [],
        existing,
        GROUP_ID
      );

      // 削除が呼ばれる
      expect(mockTx.testCasePrecondition.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      // PRECONDITION_DELETE履歴が作成される
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          testCaseId: TEST_CASE_ID,
          changedByUserId: TEST_USER_ID,
          changeType: 'UPDATE',
          groupId: GROUP_ID,
          snapshot: expect.objectContaining({
            preconditions: [{ id: 'p1', content: '削除対象', orderKey: '00001' }],
            changeDetail: expect.objectContaining({
              type: 'PRECONDITION_DELETE',
              preconditionId: 'p1',
              deleted: { content: '削除対象', orderKey: '00001' },
            }),
          }),
        }),
      });
    });

    it('既存の前提条件を内容変更して更新・履歴を作成する', async () => {
      const existing = [{ id: 'p1', content: '旧内容', orderKey: '00001' }];

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'precondition',
        [{ id: 'p1', content: '新内容' }],
        existing,
        GROUP_ID
      );

      // 更新が呼ばれる（content + orderKey）
      expect(mockTx.testCasePrecondition.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { content: '新内容', orderKey: '00001' },
      });
      // PRECONDITION_UPDATE履歴が作成される
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'PRECONDITION_UPDATE',
              preconditionId: 'p1',
              before: { content: '旧内容' },
              after: { content: '新内容' },
            }),
          }),
        }),
      });
    });

    it('新しい前提条件を作成して履歴を作成する', async () => {
      const mockCreated = { id: 'new-p1', content: '新前提', orderKey: '00001' };
      mockTx.testCasePrecondition.create.mockResolvedValue(mockCreated);

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'precondition',
        [{ content: '新前提' }],
        [],
        GROUP_ID
      );

      // 作成が呼ばれる
      expect(mockTx.testCasePrecondition.create).toHaveBeenCalledWith({
        data: { testCaseId: TEST_CASE_ID, content: '新前提', orderKey: '00001' },
      });
      // PRECONDITION_ADD履歴が作成される
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            preconditions: [{ id: 'new-p1', content: '新前提', orderKey: '00001' }],
            changeDetail: expect.objectContaining({
              type: 'PRECONDITION_ADD',
              preconditionId: 'new-p1',
            }),
          }),
        }),
      });
    });

    it('内容が同じ場合は更新履歴を作成しないがorderKeyは更新する', async () => {
      const existing = [{ id: 'p1', content: '同じ内容', orderKey: '00003' }];

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'precondition',
        [{ id: 'p1', content: '同じ内容' }],
        existing,
        GROUP_ID
      );

      // updateは呼ばれる（orderKeyの再計算のため）
      expect(mockTx.testCasePrecondition.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { content: '同じ内容', orderKey: '00001' },
      });
      // PRECONDITION_UPDATE型の履歴は作成されない
      expect(mockTx.testCaseHistory.create).not.toHaveBeenCalled();
    });

    it('存在しないIDを指定するとBadRequestErrorをスローする', async () => {
      await expect(
        service.exposedSyncChildEntitiesWithHistory(
          mockTx,
          TEST_CASE_ID,
          mockTestCase,
          TEST_USER_ID,
          'precondition',
          [{ id: 'non-existent', content: '不正' }],
          [],
          GROUP_ID
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('存在しないIDのエラーメッセージにエンティティタイプが含まれる', async () => {
      await expect(
        service.exposedSyncChildEntitiesWithHistory(
          mockTx,
          TEST_CASE_ID,
          mockTestCase,
          TEST_USER_ID,
          'precondition',
          [{ id: 'bad-id', content: '不正' }],
          [],
          GROUP_ID
        )
      ).rejects.toThrow('Invalid precondition ID: bad-id');
    });
  });

  // ------- step -------
  describe('step', () => {
    it('既存のステップを削除して履歴を作成する', async () => {
      const existing = [{ id: 's1', content: '削除ステップ', orderKey: '00001' }];

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'step',
        [],
        existing,
        GROUP_ID
      );

      expect(mockTx.testCaseStep.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            steps: [{ id: 's1', content: '削除ステップ', orderKey: '00001' }],
            changeDetail: expect.objectContaining({
              type: 'STEP_DELETE',
              stepId: 's1',
              deleted: { content: '削除ステップ', orderKey: '00001' },
            }),
          }),
        }),
      });
    });

    it('既存のステップを内容変更して更新・履歴を作成する', async () => {
      const existing = [{ id: 's1', content: '旧ステップ', orderKey: '00001' }];

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'step',
        [{ id: 's1', content: '新ステップ' }],
        existing,
        GROUP_ID
      );

      expect(mockTx.testCaseStep.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { content: '新ステップ', orderKey: '00001' },
      });
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'STEP_UPDATE',
              stepId: 's1',
              before: { content: '旧ステップ' },
              after: { content: '新ステップ' },
            }),
          }),
        }),
      });
    });

    it('新しいステップを作成して履歴を作成する', async () => {
      const mockCreated = { id: 'new-s1', content: '新ステップ', orderKey: '00001' };
      mockTx.testCaseStep.create.mockResolvedValue(mockCreated);

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'step',
        [{ content: '新ステップ' }],
        [],
        GROUP_ID
      );

      expect(mockTx.testCaseStep.create).toHaveBeenCalledWith({
        data: { testCaseId: TEST_CASE_ID, content: '新ステップ', orderKey: '00001' },
      });
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            steps: [{ id: 'new-s1', content: '新ステップ', orderKey: '00001' }],
            changeDetail: expect.objectContaining({
              type: 'STEP_ADD',
              stepId: 'new-s1',
            }),
          }),
        }),
      });
    });

    it('内容が同じ場合は更新履歴を作成しないがorderKeyは更新する', async () => {
      const existing = [{ id: 's1', content: '同じステップ', orderKey: '00005' }];

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'step',
        [{ id: 's1', content: '同じステップ' }],
        existing,
        GROUP_ID
      );

      expect(mockTx.testCaseStep.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { content: '同じステップ', orderKey: '00001' },
      });
      expect(mockTx.testCaseHistory.create).not.toHaveBeenCalled();
    });

    it('存在しないIDを指定するとBadRequestErrorをスローする', async () => {
      await expect(
        service.exposedSyncChildEntitiesWithHistory(
          mockTx,
          TEST_CASE_ID,
          mockTestCase,
          TEST_USER_ID,
          'step',
          [{ id: 'non-existent', content: '不正' }],
          [],
          GROUP_ID
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('存在しないIDのエラーメッセージにエンティティタイプが含まれる', async () => {
      await expect(
        service.exposedSyncChildEntitiesWithHistory(
          mockTx,
          TEST_CASE_ID,
          mockTestCase,
          TEST_USER_ID,
          'step',
          [{ id: 'bad-id', content: '不正' }],
          [],
          GROUP_ID
        )
      ).rejects.toThrow('Invalid step ID: bad-id');
    });
  });

  // ------- expectedResult -------
  describe('expectedResult', () => {
    it('既存の期待結果を削除して履歴を作成する', async () => {
      const existing = [{ id: 'e1', content: '削除期待結果', orderKey: '00001' }];

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'expectedResult',
        [],
        existing,
        GROUP_ID
      );

      expect(mockTx.testCaseExpectedResult.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            expectedResults: [{ id: 'e1', content: '削除期待結果', orderKey: '00001' }],
            changeDetail: expect.objectContaining({
              type: 'EXPECTED_RESULT_DELETE',
              expectedResultId: 'e1',
              deleted: { content: '削除期待結果', orderKey: '00001' },
            }),
          }),
        }),
      });
    });

    it('既存の期待結果を内容変更して更新・履歴を作成する', async () => {
      const existing = [{ id: 'e1', content: '旧期待結果', orderKey: '00001' }];

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'expectedResult',
        [{ id: 'e1', content: '新期待結果' }],
        existing,
        GROUP_ID
      );

      expect(mockTx.testCaseExpectedResult.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { content: '新期待結果', orderKey: '00001' },
      });
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'EXPECTED_RESULT_UPDATE',
              expectedResultId: 'e1',
              before: { content: '旧期待結果' },
              after: { content: '新期待結果' },
            }),
          }),
        }),
      });
    });

    it('新しい期待結果を作成して履歴を作成する', async () => {
      const mockCreated = { id: 'new-e1', content: '新期待結果', orderKey: '00001' };
      mockTx.testCaseExpectedResult.create.mockResolvedValue(mockCreated);

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'expectedResult',
        [{ content: '新期待結果' }],
        [],
        GROUP_ID
      );

      expect(mockTx.testCaseExpectedResult.create).toHaveBeenCalledWith({
        data: { testCaseId: TEST_CASE_ID, content: '新期待結果', orderKey: '00001' },
      });
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            expectedResults: [{ id: 'new-e1', content: '新期待結果', orderKey: '00001' }],
            changeDetail: expect.objectContaining({
              type: 'EXPECTED_RESULT_ADD',
              expectedResultId: 'new-e1',
            }),
          }),
        }),
      });
    });

    it('内容が同じ場合は更新履歴を作成しないがorderKeyは更新する', async () => {
      const existing = [{ id: 'e1', content: '同じ期待結果', orderKey: '00010' }];

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'expectedResult',
        [{ id: 'e1', content: '同じ期待結果' }],
        existing,
        GROUP_ID
      );

      expect(mockTx.testCaseExpectedResult.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { content: '同じ期待結果', orderKey: '00001' },
      });
      expect(mockTx.testCaseHistory.create).not.toHaveBeenCalled();
    });

    it('存在しないIDを指定するとBadRequestErrorをスローする', async () => {
      await expect(
        service.exposedSyncChildEntitiesWithHistory(
          mockTx,
          TEST_CASE_ID,
          mockTestCase,
          TEST_USER_ID,
          'expectedResult',
          [{ id: 'non-existent', content: '不正' }],
          [],
          GROUP_ID
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('存在しないIDのエラーメッセージにエンティティタイプが含まれる', async () => {
      await expect(
        service.exposedSyncChildEntitiesWithHistory(
          mockTx,
          TEST_CASE_ID,
          mockTestCase,
          TEST_USER_ID,
          'expectedResult',
          [{ id: 'bad-id', content: '不正' }],
          [],
          GROUP_ID
        )
      ).rejects.toThrow('Invalid expectedResult ID: bad-id');
    });
  });

  // ------- 複合シナリオ -------
  describe('複合シナリオ', () => {
    it('削除・更新・追加を同時に処理できる', async () => {
      const existing = [
        { id: 'p1', content: '削除対象', orderKey: '00001' },
        { id: 'p2', content: '更新対象', orderKey: '00002' },
      ];
      const mockCreated = { id: 'new-p1', content: '新規追加', orderKey: '00002' };
      mockTx.testCasePrecondition.create.mockResolvedValue(mockCreated);

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'precondition',
        [
          { id: 'p2', content: '更新後' }, // p2を更新
          { content: '新規追加' }, // 新規作成（p1は削除）
        ],
        existing,
        GROUP_ID
      );

      // p1は削除される
      expect(mockTx.testCasePrecondition.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      // p2は更新される
      expect(mockTx.testCasePrecondition.update).toHaveBeenCalledWith({
        where: { id: 'p2' },
        data: { content: '更新後', orderKey: '00001' },
      });
      // 新規作成される
      expect(mockTx.testCasePrecondition.create).toHaveBeenCalledWith({
        data: { testCaseId: TEST_CASE_ID, content: '新規追加', orderKey: '00002' },
      });

      // 履歴が3件作成される（DELETE, UPDATE, ADD）
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledTimes(3);

      // 各履歴のchangeDetailタイプを検証
      const historyTypes = mockTx.testCaseHistory.create.mock.calls.map(
        (call: any) => call[0].data.snapshot.changeDetail.type
      );
      expect(historyTypes).toContain('PRECONDITION_DELETE');
      expect(historyTypes).toContain('PRECONDITION_UPDATE');
      expect(historyTypes).toContain('PRECONDITION_ADD');
    });

    it('orderKeyはitems配列のインデックスに基づいて付与される', async () => {
      const mockCreated1 = { id: 'new-1', content: '1番目', orderKey: '00001' };
      const mockCreated2 = { id: 'new-2', content: '2番目', orderKey: '00002' };
      const mockCreated3 = { id: 'new-3', content: '3番目', orderKey: '00003' };
      mockTx.testCaseStep.create
        .mockResolvedValueOnce(mockCreated1)
        .mockResolvedValueOnce(mockCreated2)
        .mockResolvedValueOnce(mockCreated3);

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'step',
        [{ content: '1番目' }, { content: '2番目' }, { content: '3番目' }],
        [],
        GROUP_ID
      );

      // 各createのorderKeyを確認
      expect(mockTx.testCaseStep.create).toHaveBeenNthCalledWith(1, {
        data: { testCaseId: TEST_CASE_ID, content: '1番目', orderKey: '00001' },
      });
      expect(mockTx.testCaseStep.create).toHaveBeenNthCalledWith(2, {
        data: { testCaseId: TEST_CASE_ID, content: '2番目', orderKey: '00002' },
      });
      expect(mockTx.testCaseStep.create).toHaveBeenNthCalledWith(3, {
        data: { testCaseId: TEST_CASE_ID, content: '3番目', orderKey: '00003' },
      });
    });

    it('全ての履歴に同じgroupIdが設定される', async () => {
      const existing = [{ id: 'e1', content: '削除対象', orderKey: '00001' }];
      const mockCreated = { id: 'new-e1', content: '新規', orderKey: '00001' };
      mockTx.testCaseExpectedResult.create.mockResolvedValue(mockCreated);

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'expectedResult',
        [{ content: '新規' }],
        existing,
        GROUP_ID
      );

      // 全ての履歴作成呼び出しで同じgroupIdが使われている
      for (const call of mockTx.testCaseHistory.create.mock.calls) {
        expect((call as any)[0].data.groupId).toBe(GROUP_ID);
      }
    });

    it('空の配列を渡すと既存エンティティが全て削除される', async () => {
      const existing = [
        { id: 's1', content: 'ステップ1', orderKey: '00001' },
        { id: 's2', content: 'ステップ2', orderKey: '00002' },
      ];

      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'step',
        [],
        existing,
        GROUP_ID
      );

      expect(mockTx.testCaseStep.delete).toHaveBeenCalledTimes(2);
      expect(mockTx.testCaseStep.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
      expect(mockTx.testCaseStep.delete).toHaveBeenCalledWith({ where: { id: 's2' } });
      // 削除履歴が2件作成される
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledTimes(2);
    });

    it('既存・リクエストともに空の場合は何も実行しない', async () => {
      await service.exposedSyncChildEntitiesWithHistory(
        mockTx,
        TEST_CASE_ID,
        mockTestCase,
        TEST_USER_ID,
        'precondition',
        [],
        [],
        GROUP_ID
      );

      expect(mockTx.testCasePrecondition.delete).not.toHaveBeenCalled();
      expect(mockTx.testCasePrecondition.update).not.toHaveBeenCalled();
      expect(mockTx.testCasePrecondition.create).not.toHaveBeenCalled();
      expect(mockTx.testCaseHistory.create).not.toHaveBeenCalled();
    });
  });
});
