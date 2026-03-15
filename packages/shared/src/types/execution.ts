import type { PreconditionStatus, StepStatus, JudgmentStatus, TestCasePriority } from './enums.js';

export interface Execution {
  id: string;
  testSuiteId: string;
  environmentId: string | null;
  executedByUserId: string | null;
  executedByAgentSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// 実行時スナップショット: テストスイート
export interface ExecutionTestSuite {
  id: string;
  executionId: string;
  originalTestSuiteId: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

// 実行時スナップショット: テストスイート事前条件
export interface ExecutionTestSuitePrecondition {
  id: string;
  executionTestSuiteId: string;
  originalPreconditionId: string;
  content: string;
  orderKey: string;
  createdAt: Date;
}

// 実行時スナップショット: テストケース
export interface ExecutionTestCase {
  id: string;
  executionTestSuiteId: string;
  originalTestCaseId: string;
  title: string;
  description: string | null;
  priority: TestCasePriority;
  orderKey: string;
  createdAt: Date;
}

// 実行時スナップショット: テストケース事前条件
export interface ExecutionTestCasePrecondition {
  id: string;
  executionTestCaseId: string;
  originalPreconditionId: string;
  content: string;
  orderKey: string;
  createdAt: Date;
}

// 実行時スナップショット: テストケースステップ
export interface ExecutionTestCaseStep {
  id: string;
  executionTestCaseId: string;
  originalStepId: string;
  content: string;
  orderKey: string;
  createdAt: Date;
}

// 実行時スナップショット: テストケース期待結果
export interface ExecutionTestCaseExpectedResult {
  id: string;
  executionTestCaseId: string;
  originalExpectedResultId: string;
  content: string;
  orderKey: string;
  createdAt: Date;
}

// ネストされた実行時テストケース（詳細含む）
export interface ExecutionTestCaseWithDetails extends ExecutionTestCase {
  preconditions: ExecutionTestCasePrecondition[];
  steps: ExecutionTestCaseStep[];
  expectedResults: ExecutionTestCaseExpectedResult[];
}

// ネストされた実行時テストスイート（詳細含む）
export interface ExecutionTestSuiteWithDetails extends ExecutionTestSuite {
  preconditions: ExecutionTestSuitePrecondition[];
  testCases: ExecutionTestCaseWithDetails[];
}

export interface ExecutionPreconditionResult {
  id: string;
  executionId: string;
  executionTestCaseId: string | null;
  executionSuitePreconditionId: string | null;
  executionCasePreconditionId: string | null;
  status: PreconditionStatus;
  checkedAt: Date | null;
  note: string | null;
  // 実施者情報
  checkedByUserId: string | null;
  checkedByAgentName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionStepResult {
  id: string;
  executionId: string;
  executionTestCaseId: string;
  executionStepId: string;
  status: StepStatus;
  executedAt: Date | null;
  note: string | null;
  // 実施者情報
  executedByUserId: string | null;
  executedByAgentName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionExpectedResult {
  id: string;
  executionId: string;
  executionTestCaseId: string;
  executionExpectedResultId: string;
  status: JudgmentStatus;
  judgedAt: Date | null;
  note: string | null;
  // 実施者情報
  judgedByUserId: string | null;
  judgedByAgentName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionEvidence {
  id: string;
  expectedResultId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: bigint;
  description: string | null;
  uploadedByUserId: string | null;
  uploadedByAgentSessionId: string | null;
  createdAt: Date;
}

// APIリクエスト/レスポンス型
export interface ExecutionCreateInput {
  testSuiteId: string;
  environmentId?: string | null;
}

export interface ExecutionPublic {
  id: string;
  testSuiteId: string;
  environmentId: string | null;
  createdAt: Date;
}

export interface ExecutionWithResults extends ExecutionPublic {
  executionTestSuite: ExecutionTestSuiteWithDetails | null;
  preconditionResults: ExecutionPreconditionResult[];
  stepResults: ExecutionStepResult[];
  expectedResults: ExecutionExpectedResult[];
}
