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
  createdAt: Date;
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
