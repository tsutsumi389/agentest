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
  createdAt: Date;
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
