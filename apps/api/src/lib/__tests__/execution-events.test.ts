import { describe, it, expect, vi, beforeEach } from 'vitest';

// publishEventのモック
const { mockPublishEvent } = vi.hoisted(() => {
  const mockPublishEvent = vi.fn().mockResolvedValue(undefined);
  return { mockPublishEvent };
});

vi.mock('../redis-publisher.js', () => ({
  publishEvent: mockPublishEvent,
}));

import {
  publishExecutionPreconditionUpdated,
  publishExecutionStepUpdated,
  publishExecutionExpectedResultUpdated,
  publishExecutionEvidenceAdded,
} from '../execution-events.js';

describe('execution-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('publishExecutionPreconditionUpdated', () => {
    it('execution:{executionId}チャンネルにprecondition_updatedイベントを発行する', async () => {
      await publishExecutionPreconditionUpdated({
        executionId: 'exec-1',
        resultId: 'result-1',
        snapshotPreconditionId: 'snap-pre-1',
        status: 'MET',
        note: 'テスト備考',
      });

      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
      expect(mockPublishEvent).toHaveBeenCalledWith(
        'execution:exec-1',
        expect.objectContaining({
          type: 'execution:precondition_updated',
          executionId: 'exec-1',
          resultId: 'result-1',
          snapshotPreconditionId: 'snap-pre-1',
          status: 'MET',
          note: 'テスト備考',
          eventId: expect.any(String),
          timestamp: expect.any(Number),
        })
      );
    });

    it('noteがnullの場合もイベントを発行する', async () => {
      await publishExecutionPreconditionUpdated({
        executionId: 'exec-1',
        resultId: 'result-1',
        snapshotPreconditionId: 'snap-pre-1',
        status: 'NOT_MET',
        note: null,
      });

      expect(mockPublishEvent).toHaveBeenCalledWith(
        'execution:exec-1',
        expect.objectContaining({
          note: null,
        })
      );
    });
  });

  describe('publishExecutionStepUpdated', () => {
    it('execution:{executionId}チャンネルにstep_updatedイベントを発行する', async () => {
      await publishExecutionStepUpdated({
        executionId: 'exec-1',
        resultId: 'step-result-1',
        snapshotTestCaseId: 'snap-tc-1',
        snapshotStepId: 'snap-step-1',
        status: 'DONE',
        note: null,
      });

      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
      expect(mockPublishEvent).toHaveBeenCalledWith(
        'execution:exec-1',
        expect.objectContaining({
          type: 'execution:step_updated',
          executionId: 'exec-1',
          resultId: 'step-result-1',
          snapshotTestCaseId: 'snap-tc-1',
          snapshotStepId: 'snap-step-1',
          status: 'DONE',
          note: null,
        })
      );
    });
  });

  describe('publishExecutionExpectedResultUpdated', () => {
    it('execution:{executionId}チャンネルにexpected_result_updatedイベントを発行する', async () => {
      await publishExecutionExpectedResultUpdated({
        executionId: 'exec-1',
        resultId: 'er-result-1',
        snapshotTestCaseId: 'snap-tc-1',
        snapshotExpectedResultId: 'snap-er-1',
        status: 'PASS',
        note: '期待通り',
      });

      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
      expect(mockPublishEvent).toHaveBeenCalledWith(
        'execution:exec-1',
        expect.objectContaining({
          type: 'execution:expected_result_updated',
          executionId: 'exec-1',
          resultId: 'er-result-1',
          snapshotTestCaseId: 'snap-tc-1',
          snapshotExpectedResultId: 'snap-er-1',
          status: 'PASS',
          note: '期待通り',
        })
      );
    });
  });

  describe('publishExecutionEvidenceAdded', () => {
    it('execution:{executionId}チャンネルにevidence_addedイベントを発行する', async () => {
      await publishExecutionEvidenceAdded({
        executionId: 'exec-1',
        expectedResultId: 'er-1',
        evidence: {
          id: 'ev-1',
          fileName: 'screenshot.png',
          fileUrl: 'evidences/exec-1/er-1/abc_screenshot.png',
          fileType: 'image/png',
        },
      });

      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
      expect(mockPublishEvent).toHaveBeenCalledWith(
        'execution:exec-1',
        expect.objectContaining({
          type: 'execution:evidence_added',
          executionId: 'exec-1',
          expectedResultId: 'er-1',
          evidence: {
            id: 'ev-1',
            fileName: 'screenshot.png',
            fileUrl: 'evidences/exec-1/er-1/abc_screenshot.png',
            fileType: 'image/png',
          },
        })
      );
    });
  });
});
