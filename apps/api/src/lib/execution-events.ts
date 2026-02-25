import { Channels } from '@agentest/ws-types';
import type {
  ExecutionPreconditionUpdatedEvent,
  ExecutionStepUpdatedEvent,
  ExecutionExpectedResultUpdatedEvent,
  ExecutionEvidenceAddedEvent,
} from '@agentest/ws-types';
import type { PreconditionStatus, StepStatus, JudgmentStatus } from '@agentest/shared';
import { randomUUID } from 'node:crypto';
import { publishEvent } from './redis-publisher.js';

/**
 * 実行の前提条件更新イベントを発行
 */
export async function publishExecutionPreconditionUpdated(params: {
  executionId: string;
  resultId: string;
  snapshotPreconditionId: string;
  status: PreconditionStatus;
  note: string | null;
}): Promise<void> {
  const event: ExecutionPreconditionUpdatedEvent = {
    type: 'execution:precondition_updated',
    eventId: randomUUID(),
    timestamp: Date.now(),
    ...params,
  };
  await publishEvent(Channels.execution(params.executionId), event);
}

/**
 * 実行のステップ更新イベントを発行
 */
export async function publishExecutionStepUpdated(params: {
  executionId: string;
  resultId: string;
  snapshotTestCaseId: string;
  snapshotStepId: string;
  status: StepStatus;
  note: string | null;
}): Promise<void> {
  const event: ExecutionStepUpdatedEvent = {
    type: 'execution:step_updated',
    eventId: randomUUID(),
    timestamp: Date.now(),
    ...params,
  };
  await publishEvent(Channels.execution(params.executionId), event);
}

/**
 * 実行の期待結果更新イベントを発行
 */
export async function publishExecutionExpectedResultUpdated(params: {
  executionId: string;
  resultId: string;
  snapshotTestCaseId: string;
  snapshotExpectedResultId: string;
  status: JudgmentStatus;
  note: string | null;
}): Promise<void> {
  const event: ExecutionExpectedResultUpdatedEvent = {
    type: 'execution:expected_result_updated',
    eventId: randomUUID(),
    timestamp: Date.now(),
    ...params,
  };
  await publishEvent(Channels.execution(params.executionId), event);
}

/**
 * 実行のエビデンス追加イベントを発行
 */
export async function publishExecutionEvidenceAdded(params: {
  executionId: string;
  expectedResultId: string;
  evidence: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
  };
}): Promise<void> {
  const event: ExecutionEvidenceAddedEvent = {
    type: 'execution:evidence_added',
    eventId: randomUUID(),
    timestamp: Date.now(),
    ...params,
  };
  await publishEvent(Channels.execution(params.executionId), event);
}
