import type { EntityStatus, TestCasePriority, ChangeType } from './enums.js';

export interface TestCase {
  id: string;
  testSuiteId: string;
  title: string;
  description: string | null;
  priority: TestCasePriority;
  status: EntityStatus;
  orderKey: string;
  createdByUserId: string | null;
  createdByAgentSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestCasePrecondition {
  id: string;
  testCaseId: string;
  content: string;
  orderKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCaseStep {
  id: string;
  testCaseId: string;
  content: string;
  orderKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCaseExpectedResult {
  id: string;
  testCaseId: string;
  content: string;
  orderKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCaseHistory {
  id: string;
  testCaseId: string;
  changedByUserId: string | null;
  changedByAgentSessionId: string | null;
  changeType: ChangeType;
  snapshot: Record<string, unknown>;
  changeReason: string | null;
  groupId: string | null;
  createdAt: Date;
}

/**
 * カテゴリ別履歴
 * グループ内の履歴を4つのカテゴリに分類
 */
export interface CategorizedHistories {
  basicInfo: TestCaseHistory[];
  preconditions: TestCaseHistory[];
  steps: TestCaseHistory[];
  expectedResults: TestCaseHistory[];
}

/**
 * グループ化された履歴アイテム（APIレスポンス用）
 * groupIdがnullの場合は単一履歴を含むグループ
 */
export interface TestCaseHistoryGroupedItem {
  groupId: string | null;
  categorizedHistories: CategorizedHistories;
  createdAt: Date;
}

/**
 * 履歴一覧レスポンス（グループ化版）
 */
export interface TestCaseHistoriesGroupedResponse {
  items: TestCaseHistoryGroupedItem[];
  totalGroups: number;
  total: number; // 後方互換性のため履歴レコード総数も含める
}

// APIリクエスト/レスポンス型
export interface TestCaseCreateInput {
  title: string;
  description?: string | null;
  priority?: TestCasePriority;
  status?: EntityStatus;
  preconditions?: { content: string }[];
  steps?: { content: string }[];
  expectedResults?: { content: string }[];
}

// 子エンティティ作成用入力型
export interface ChildEntityCreateInput {
  content: string;
}

// 子エンティティ更新用入力型（idあり→更新、idなし→追加）
export interface ChildEntityUpdateInput {
  id?: string;
  content: string;
}

export interface TestCaseUpdateInput {
  title?: string;
  description?: string | null;
  priority?: TestCasePriority;
  status?: EntityStatus;
  preconditions?: ChildEntityUpdateInput[];
  steps?: ChildEntityUpdateInput[];
  expectedResults?: ChildEntityUpdateInput[];
}

export interface TestCasePublic {
  id: string;
  testSuiteId: string;
  title: string;
  description: string | null;
  priority: TestCasePriority;
  status: EntityStatus;
  orderKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCaseWithDetails extends TestCasePublic {
  preconditions: { id: string; content: string; orderKey: string }[];
  steps: { id: string; content: string; orderKey: string }[];
  expectedResults: { id: string; content: string; orderKey: string }[];
}

/**
 * テストケース変更履歴の詳細情報
 * バックエンドで履歴保存時に使用し、フロントエンドで差分表示に使用
 */
export type TestCaseChangeDetail =
  | {
      type: 'BASIC_INFO_UPDATE';
      fields: {
        title?: { before: string; after: string };
        description?: { before: string | null; after: string | null };
        priority?: { before: string; after: string };
        status?: { before: string; after: string };
      };
    }
  | {
      type: 'PRECONDITION_ADD';
      preconditionId: string;
      added: { content: string; orderKey: string };
    }
  | {
      type: 'PRECONDITION_UPDATE';
      preconditionId: string;
      before: { content: string };
      after: { content: string };
    }
  | {
      type: 'PRECONDITION_DELETE';
      preconditionId: string;
      deleted: { content: string; orderKey: string };
    }
  | {
      type: 'PRECONDITION_REORDER';
      before: string[];
      after: string[];
    }
  | {
      type: 'STEP_ADD';
      stepId: string;
      added: { content: string; orderKey: string };
    }
  | {
      type: 'STEP_UPDATE';
      stepId: string;
      before: { content: string };
      after: { content: string };
    }
  | {
      type: 'STEP_DELETE';
      stepId: string;
      deleted: { content: string; orderKey: string };
    }
  | {
      type: 'STEP_REORDER';
      before: string[];
      after: string[];
    }
  | {
      type: 'EXPECTED_RESULT_ADD';
      expectedResultId: string;
      added: { content: string; orderKey: string };
    }
  | {
      type: 'EXPECTED_RESULT_UPDATE';
      expectedResultId: string;
      before: { content: string };
      after: { content: string };
    }
  | {
      type: 'EXPECTED_RESULT_DELETE';
      expectedResultId: string;
      deleted: { content: string; orderKey: string };
    }
  | {
      type: 'EXPECTED_RESULT_REORDER';
      before: string[];
      after: string[];
    }
  | {
      type: 'COPY';
      sourceTestCaseId: string;
      sourceTitle: string;
      targetTestSuiteId: string;
    };
