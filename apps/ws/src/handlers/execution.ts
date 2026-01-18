import type {
  ExecutionStartedEvent,
  ExecutionStatusChangedEvent,
  ExecutionPreconditionUpdatedEvent,
  ExecutionStepUpdatedEvent,
  ExecutionExpectedResultUpdatedEvent,
  ExecutionEvidenceAddedEvent,
} from '@agentest/ws-types';
import { Channels } from '@agentest/ws-types';
import { publishEvent } from '../redis.js';

/**
 * 実行開始イベントをパブリッシュ
 */
export async function publishExecutionStarted(
  executionId: string,
  testSuiteId: string,
  projectId: string,
  environmentId: string | null,
  executedBy: { type: 'user' | 'agent'; id: string; name: string }
): Promise<void> {
  const event: ExecutionStartedEvent = {
    type: 'execution:started',
    eventId: crypto.randomUUID(),
    timestamp: Date.now(),
    executionId,
    testSuiteId,
    environmentId,
    executedBy,
  };

  // プロジェクトチャンネルと実行チャンネルにパブリッシュ
  await Promise.all([
    publishEvent(Channels.project(projectId), event),
    publishEvent(Channels.testSuite(testSuiteId), event),
    publishEvent(Channels.execution(executionId), event),
  ]);
}

/**
 * 実行ステータス変更イベントをパブリッシュ
 */
export async function publishExecutionStatusChanged(
  executionId: string,
  testSuiteId: string,
  projectId: string,
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED',
  completedAt?: Date
): Promise<void> {
  const event: ExecutionStatusChangedEvent = {
    type: 'execution:status_changed',
    eventId: crypto.randomUUID(),
    timestamp: Date.now(),
    executionId,
    status,
    completedAt: completedAt?.toISOString(),
  };

  await Promise.all([
    publishEvent(Channels.project(projectId), event),
    publishEvent(Channels.testSuite(testSuiteId), event),
    publishEvent(Channels.execution(executionId), event),
  ]);
}

/**
 * 前提条件結果更新イベントをパブリッシュ
 */
export async function publishPreconditionUpdated(
  executionId: string,
  resultId: string,
  snapshotPreconditionId: string,
  status: 'UNCHECKED' | 'MET' | 'NOT_MET',
  note: string | null
): Promise<void> {
  const event: ExecutionPreconditionUpdatedEvent = {
    type: 'execution:precondition_updated',
    eventId: crypto.randomUUID(),
    timestamp: Date.now(),
    executionId,
    resultId,
    snapshotPreconditionId,
    status,
    note,
  };

  await publishEvent(Channels.execution(executionId), event);
}

/**
 * ステップ結果更新イベントをパブリッシュ
 */
export async function publishStepUpdated(
  executionId: string,
  resultId: string,
  snapshotTestCaseId: string,
  snapshotStepId: string,
  status: 'PENDING' | 'DONE' | 'SKIPPED',
  note: string | null
): Promise<void> {
  const event: ExecutionStepUpdatedEvent = {
    type: 'execution:step_updated',
    eventId: crypto.randomUUID(),
    timestamp: Date.now(),
    executionId,
    resultId,
    snapshotTestCaseId,
    snapshotStepId,
    status,
    note,
  };

  await publishEvent(Channels.execution(executionId), event);
}

/**
 * 期待結果更新イベントをパブリッシュ
 */
export async function publishExpectedResultUpdated(
  executionId: string,
  resultId: string,
  snapshotTestCaseId: string,
  snapshotExpectedResultId: string,
  status: 'PENDING' | 'PASS' | 'FAIL' | 'SKIPPED',
  note: string | null
): Promise<void> {
  const event: ExecutionExpectedResultUpdatedEvent = {
    type: 'execution:expected_result_updated',
    eventId: crypto.randomUUID(),
    timestamp: Date.now(),
    executionId,
    resultId,
    snapshotTestCaseId,
    snapshotExpectedResultId,
    status,
    note,
  };

  await publishEvent(Channels.execution(executionId), event);
}

/**
 * エビデンス追加イベントをパブリッシュ
 */
export async function publishEvidenceAdded(
  executionId: string,
  expectedResultId: string,
  evidence: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
  }
): Promise<void> {
  const event: ExecutionEvidenceAddedEvent = {
    type: 'execution:evidence_added',
    eventId: crypto.randomUUID(),
    timestamp: Date.now(),
    executionId,
    expectedResultId,
    evidence,
  };

  await publishEvent(Channels.execution(executionId), event);
}
