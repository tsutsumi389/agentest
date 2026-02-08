import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TEST_PROJECT_ID,
  TEST_SUITE_ID,
  TEST_EXECUTION_ID,
  TEST_USER_ID,
} from '../helpers.js';

// crypto.randomUUIDをモック
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-event-uuid',
});

// Redisモジュールをモック
vi.mock('../../redis.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

import { publishEvent } from '../../redis.js';
import {
  publishExecutionStarted,
  publishPreconditionUpdated,
  publishStepUpdated,
  publishExpectedResultUpdated,
  publishEvidenceAdded,
} from '../../handlers/execution.js';

describe('handlers/execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('publishExecutionStarted', () => {
    it('実行開始イベントを3つのチャンネルにパブリッシュ', async () => {
      const executedBy = { type: 'user' as const, id: TEST_USER_ID, name: 'Test User' };
      const environmentId = 'env-123';

      await publishExecutionStarted(
        TEST_EXECUTION_ID,
        TEST_SUITE_ID,
        TEST_PROJECT_ID,
        environmentId,
        executedBy
      );

      expect(publishEvent).toHaveBeenCalledTimes(3);

      // プロジェクトチャンネルへのパブリッシュを確認
      expect(publishEvent).toHaveBeenCalledWith(
        `project:${TEST_PROJECT_ID}`,
        expect.objectContaining({
          type: 'execution:started',
          executionId: TEST_EXECUTION_ID,
          testSuiteId: TEST_SUITE_ID,
          environmentId,
          executedBy,
        })
      );

      // スイートチャンネルへのパブリッシュを確認
      expect(publishEvent).toHaveBeenCalledWith(
        `test_suite:${TEST_SUITE_ID}`,
        expect.objectContaining({
          type: 'execution:started',
        })
      );

      // 実行チャンネルへのパブリッシュを確認
      expect(publishEvent).toHaveBeenCalledWith(
        `execution:${TEST_EXECUTION_ID}`,
        expect.objectContaining({
          type: 'execution:started',
        })
      );
    });

    it('environmentIdがnullでも正しくパブリッシュ', async () => {
      const executedBy = { type: 'agent' as const, id: 'agent-1', name: 'Test Agent' };

      await publishExecutionStarted(
        TEST_EXECUTION_ID,
        TEST_SUITE_ID,
        TEST_PROJECT_ID,
        null,
        executedBy
      );

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          environmentId: null,
        })
      );
    });

    it('イベントにeventIdとtimestampが含まれる', async () => {
      const executedBy = { type: 'user' as const, id: TEST_USER_ID, name: 'Test User' };

      await publishExecutionStarted(
        TEST_EXECUTION_ID,
        TEST_SUITE_ID,
        TEST_PROJECT_ID,
        null,
        executedBy
      );

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          eventId: 'test-event-uuid',
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('publishPreconditionUpdated', () => {
    it('前提条件更新イベントを実行チャンネルにパブリッシュ', async () => {
      const resultId = 'result-123';
      const snapshotPreconditionId = 'precond-123';

      await publishPreconditionUpdated(
        TEST_EXECUTION_ID,
        resultId,
        snapshotPreconditionId,
        'MET',
        'テスト環境が準備完了'
      );

      expect(publishEvent).toHaveBeenCalledTimes(1);
      expect(publishEvent).toHaveBeenCalledWith(
        `execution:${TEST_EXECUTION_ID}`,
        expect.objectContaining({
          type: 'execution:precondition_updated',
          executionId: TEST_EXECUTION_ID,
          resultId,
          snapshotPreconditionId,
          status: 'MET',
          note: 'テスト環境が準備完了',
        })
      );
    });

    it('noteがnullでも正しくパブリッシュ', async () => {
      await publishPreconditionUpdated(
        TEST_EXECUTION_ID,
        'result-123',
        'precond-123',
        'NOT_MET',
        null
      );

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          note: null,
        })
      );
    });

    it('UNCHECKEDステータスを正しくパブリッシュ', async () => {
      await publishPreconditionUpdated(
        TEST_EXECUTION_ID,
        'result-123',
        'precond-123',
        'UNCHECKED',
        null
      );

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'UNCHECKED',
        })
      );
    });
  });

  describe('publishStepUpdated', () => {
    it('ステップ更新イベントを実行チャンネルにパブリッシュ', async () => {
      const resultId = 'result-123';
      const snapshotTestCaseId = 'case-123';
      const snapshotStepId = 'step-123';

      await publishStepUpdated(
        TEST_EXECUTION_ID,
        resultId,
        snapshotTestCaseId,
        snapshotStepId,
        'DONE',
        'ステップ完了'
      );

      expect(publishEvent).toHaveBeenCalledTimes(1);
      expect(publishEvent).toHaveBeenCalledWith(
        `execution:${TEST_EXECUTION_ID}`,
        expect.objectContaining({
          type: 'execution:step_updated',
          executionId: TEST_EXECUTION_ID,
          resultId,
          snapshotTestCaseId,
          snapshotStepId,
          status: 'DONE',
          note: 'ステップ完了',
        })
      );
    });

    it('PENDINGステータスを正しくパブリッシュ', async () => {
      await publishStepUpdated(
        TEST_EXECUTION_ID,
        'result-123',
        'case-123',
        'step-123',
        'PENDING',
        null
      );

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'PENDING',
        })
      );
    });

    it('SKIPPEDステータスを正しくパブリッシュ', async () => {
      await publishStepUpdated(
        TEST_EXECUTION_ID,
        'result-123',
        'case-123',
        'step-123',
        'SKIPPED',
        '前提条件が満たされなかったためスキップ'
      );

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'SKIPPED',
          note: '前提条件が満たされなかったためスキップ',
        })
      );
    });
  });

  describe('publishExpectedResultUpdated', () => {
    it('期待結果更新イベントを実行チャンネルにパブリッシュ', async () => {
      const resultId = 'result-123';
      const snapshotTestCaseId = 'case-123';
      const snapshotExpectedResultId = 'expected-123';

      await publishExpectedResultUpdated(
        TEST_EXECUTION_ID,
        resultId,
        snapshotTestCaseId,
        snapshotExpectedResultId,
        'PASS',
        '期待通りの結果'
      );

      expect(publishEvent).toHaveBeenCalledTimes(1);
      expect(publishEvent).toHaveBeenCalledWith(
        `execution:${TEST_EXECUTION_ID}`,
        expect.objectContaining({
          type: 'execution:expected_result_updated',
          executionId: TEST_EXECUTION_ID,
          resultId,
          snapshotTestCaseId,
          snapshotExpectedResultId,
          status: 'PASS',
          note: '期待通りの結果',
        })
      );
    });

    it('FAILステータスを正しくパブリッシュ', async () => {
      await publishExpectedResultUpdated(
        TEST_EXECUTION_ID,
        'result-123',
        'case-123',
        'expected-123',
        'FAIL',
        '期待と異なる結果'
      );

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'FAIL',
          note: '期待と異なる結果',
        })
      );
    });

    it('PENDINGとSKIPPEDステータスを正しくパブリッシュ', async () => {
      await publishExpectedResultUpdated(
        TEST_EXECUTION_ID,
        'result-123',
        'case-123',
        'expected-123',
        'PENDING',
        null
      );

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'PENDING',
        })
      );

      vi.clearAllMocks();

      await publishExpectedResultUpdated(
        TEST_EXECUTION_ID,
        'result-123',
        'case-123',
        'expected-123',
        'SKIPPED',
        null
      );

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'SKIPPED',
        })
      );
    });
  });

  describe('パブリッシュ失敗時の動作', () => {
    it('一部のパブリッシュが失敗してもPromise.allSettledで処理される', async () => {
      // 1回目は成功、2回目は失敗、3回目は成功
      vi.mocked(publishEvent)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Redis error'))
        .mockResolvedValueOnce(undefined);

      const executedBy = { type: 'user' as const, id: TEST_USER_ID, name: 'Test User' };

      // Promise.allSettledを使用しているのでエラーにならない
      await expect(
        publishExecutionStarted(
          TEST_EXECUTION_ID,
          TEST_SUITE_ID,
          TEST_PROJECT_ID,
          null,
          executedBy
        )
      ).resolves.not.toThrow();

      // 3つのチャンネルにパブリッシュが試行されたことを確認
      expect(publishEvent).toHaveBeenCalledTimes(3);
    });
  });

  describe('publishEvidenceAdded', () => {
    it('エビデンス追加イベントを実行チャンネルにパブリッシュ', async () => {
      const expectedResultId = 'expected-result-123';
      const evidence = {
        id: 'evidence-123',
        fileName: 'screenshot.png',
        fileUrl: 'https://storage.example.com/evidence/screenshot.png',
        fileType: 'image/png',
      };

      await publishEvidenceAdded(TEST_EXECUTION_ID, expectedResultId, evidence);

      expect(publishEvent).toHaveBeenCalledTimes(1);
      expect(publishEvent).toHaveBeenCalledWith(
        `execution:${TEST_EXECUTION_ID}`,
        expect.objectContaining({
          type: 'execution:evidence_added',
          executionId: TEST_EXECUTION_ID,
          expectedResultId,
          evidence,
        })
      );
    });

    it('イベントにeventIdとtimestampが含まれる', async () => {
      const evidence = {
        id: 'evidence-123',
        fileName: 'video.mp4',
        fileUrl: 'https://storage.example.com/evidence/video.mp4',
        fileType: 'video/mp4',
      };

      await publishEvidenceAdded(TEST_EXECUTION_ID, 'expected-result-123', evidence);

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          eventId: 'test-event-uuid',
          timestamp: expect.any(Number),
        })
      );
    });
  });
});
