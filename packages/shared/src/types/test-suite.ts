import type { EntityStatus, ChangeType } from './enums.js';

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: EntityStatus;
  createdByUserId: string | null;
  createdByAgentSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestSuitePrecondition {
  id: string;
  testSuiteId: string;
  content: string;
  orderKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestSuiteHistory {
  id: string;
  testSuiteId: string;
  changedByUserId: string | null;
  changedByAgentSessionId: string | null;
  changeType: ChangeType;
  snapshot: Record<string, unknown>;
  changeReason: string | null;
  groupId: string | null;
  createdAt: Date;
}

/**
 * テストスイート変更履歴の詳細情報
 * バックエンドで履歴保存時に使用し、フロントエンドで差分表示に使用
 */
export type TestSuiteChangeDetail =
  | {
      type: 'BASIC_INFO_UPDATE';
      fields: {
        name?: { before: string; after: string };
        description?: { before: string | null; after: string | null };
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
      type: 'TEST_CASE_REORDER';
      before: string[];
      after: string[];
    };

/**
 * テストスイートのカテゴリ別履歴
 * グループ内の履歴を2つのカテゴリに分類
 */
export interface TestSuiteCategorizedHistories {
  basicInfo: TestSuiteHistory[];
  preconditions: TestSuiteHistory[];
}

/**
 * グループ化されたテストスイート履歴アイテム（APIレスポンス用）
 * groupIdがnullの場合は単一履歴を含むグループ
 */
export interface TestSuiteHistoryGroupedItem {
  groupId: string | null;
  categorizedHistories: TestSuiteCategorizedHistories;
  createdAt: Date;
}

/**
 * テストスイート履歴一覧レスポンス（グループ化版）
 */
export interface TestSuiteHistoriesGroupedResponse {
  items: TestSuiteHistoryGroupedItem[];
  totalGroups: number;
  total: number; // 後方互換性のため履歴レコード総数も含める
}

// APIリクエスト/レスポンス型
export interface TestSuiteCreateInput {
  name: string;
  description?: string | null;
  status?: EntityStatus;
  preconditions?: { content: string }[];
}

export interface TestSuiteUpdateInput {
  name?: string;
  description?: string | null;
  status?: EntityStatus;
}

export interface TestSuitePublic {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
}
