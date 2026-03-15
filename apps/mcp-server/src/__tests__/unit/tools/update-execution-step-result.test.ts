import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// apiClientのモック
const mockApiClient = vi.hoisted(() => ({
  patch: vi.fn(),
}));

vi.mock('../../../clients/api-client.js', () => ({
  apiClient: mockApiClient,
}));

// モック設定後にインポート
import {
  updateExecutionStepResultTool,
  updateExecutionStepResultInputSchema,
} from '../../../tools/update-execution-step-result.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_EXECUTION_ID = '55555555-5555-5555-5555-555555555555';
const TEST_STEP_RESULT_ID = '77777777-7777-7777-7777-777777777777';

describe('updateExecutionStepResultTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(updateExecutionStepResultTool.name).toBe('update_execution_step_result');
      expect(updateExecutionStepResultTool.description).toContain('ステップ実行結果を記録');
    });

    it('入力スキーマが定義されている', () => {
      expect(updateExecutionStepResultTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('有効な入力を受け付ける（DONE）', () => {
      const result = updateExecutionStepResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        stepResultId: TEST_STEP_RESULT_ID,
        status: 'DONE',
      });
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
      expect(result.stepResultId).toBe(TEST_STEP_RESULT_ID);
      expect(result.status).toBe('DONE');
    });

    it('有効な入力を受け付ける（SKIPPED with note）', () => {
      const result = updateExecutionStepResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        stepResultId: TEST_STEP_RESULT_ID,
        status: 'SKIPPED',
        note: 'Skipped due to environment issue',
      });
      expect(result.status).toBe('SKIPPED');
      expect(result.note).toBe('Skipped due to environment issue');
    });

    it('executionIdとstepResultIdとstatusは必須', () => {
      expect(() => updateExecutionStepResultInputSchema.parse({})).toThrow();
      expect(() =>
        updateExecutionStepResultInputSchema.parse({
          executionId: TEST_EXECUTION_ID,
        })
      ).toThrow();
      expect(() =>
        updateExecutionStepResultInputSchema.parse({
          executionId: TEST_EXECUTION_ID,
          stepResultId: TEST_STEP_RESULT_ID,
        })
      ).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() =>
        updateExecutionStepResultInputSchema.parse({
          executionId: 'invalid-uuid',
          stepResultId: TEST_STEP_RESULT_ID,
          status: 'DONE',
        })
      ).toThrow();
    });

    it('無効なstatusはエラー', () => {
      expect(() =>
        updateExecutionStepResultInputSchema.parse({
          executionId: TEST_EXECUTION_ID,
          stepResultId: TEST_STEP_RESULT_ID,
          status: 'PENDING',
        })
      ).toThrow();
    });

    it('noteは2000文字以下', () => {
      expect(() =>
        updateExecutionStepResultInputSchema.parse({
          executionId: TEST_EXECUTION_ID,
          stepResultId: TEST_STEP_RESULT_ID,
          status: 'DONE',
          note: 'a'.repeat(2001),
        })
      ).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = {
        executionId: TEST_EXECUTION_ID,
        stepResultId: TEST_STEP_RESULT_ID,
        status: 'DONE' as const,
      };

      await expect(updateExecutionStepResultTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.patch).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す（DONE）', async () => {
      const mockResponse = {
        stepResult: {
          id: TEST_STEP_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'DONE',
          note: null,
          executedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        stepResultId: TEST_STEP_RESULT_ID,
        status: 'DONE' as const,
      };

      const result = await updateExecutionStepResultTool.handler(input, context);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/step-results/${TEST_STEP_RESULT_ID}`,
        { status: 'DONE', note: undefined },
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('正常に内部APIを呼び出す（SKIPPED with note）', async () => {
      const mockResponse = {
        stepResult: {
          id: TEST_STEP_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'SKIPPED',
          note: 'Cannot execute due to missing data',
          executedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        stepResultId: TEST_STEP_RESULT_ID,
        status: 'SKIPPED' as const,
        note: 'Cannot execute due to missing data',
      };

      await updateExecutionStepResultTool.handler(input, context);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/step-results/${TEST_STEP_RESULT_ID}`,
        { status: 'SKIPPED', note: 'Cannot execute due to missing data' },
        { userId: TEST_USER_ID }
      );
    });

    it('APIエラーを伝播する（403: 実行がIN_PROGRESS以外）', async () => {
      mockApiClient.patch.mockRejectedValueOnce(
        new Error('Internal API error: 403 - Access denied or execution is not in progress')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        stepResultId: TEST_STEP_RESULT_ID,
        status: 'DONE' as const,
      };

      await expect(updateExecutionStepResultTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied or execution is not in progress'
      );
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.patch.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Step result not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        stepResultId: TEST_STEP_RESULT_ID,
        status: 'DONE' as const,
      };

      await expect(updateExecutionStepResultTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Step result not found'
      );
    });
  });
});
