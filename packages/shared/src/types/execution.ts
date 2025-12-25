import type {
  ExecutionStatus,
  PreconditionStatus,
  StepStatus,
  JudgmentStatus,
} from './enums.js';

export interface Execution {
  id: string;
  testSuiteId: string;
  environmentId: string | null;
  executedByUserId: string | null;
  executedByAgentSessionId: string | null;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionSnapshot {
  id: string;
  executionId: string;
  snapshotData: Record<string, unknown>;
  createdAt: Date;
}

export interface ExecutionPreconditionResult {
  id: string;
  executionId: string;
  snapshotTestCaseId: string | null;
  snapshotPreconditionId: string;
  status: PreconditionStatus;
  checkedAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionStepResult {
  id: string;
  executionId: string;
  snapshotTestCaseId: string;
  snapshotStepId: string;
  status: StepStatus;
  executedAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionExpectedResult {
  id: string;
  executionId: string;
  snapshotTestCaseId: string;
  snapshotExpectedResultId: string;
  status: JudgmentStatus;
  judgedAt: Date | null;
  note: string | null;
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

// API Request/Response types
export interface ExecutionCreateInput {
  testSuiteId: string;
  environmentId?: string | null;
}

export interface ExecutionPublic {
  id: string;
  testSuiteId: string;
  environmentId: string | null;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt: Date | null;
}

export interface ExecutionWithResults extends ExecutionPublic {
  preconditionResults: ExecutionPreconditionResult[];
  stepResults: ExecutionStepResult[];
  expectedResults: ExecutionExpectedResult[];
}
