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
  updateExecutionExpectedResultTool,
  updateExecutionExpectedResultInputSchema,
} from '../../../tools/update-execution-expected-result.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_EXECUTION_ID = '55555555-5555-5555-5555-555555555555';
const TEST_EXPECTED_RESULT_ID = '88888888-8888-8888-8888-888888888888';

describe('updateExecutionExpectedResultTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(updateExecutionExpectedResultTool.name).toBe('update_execution_expected_result');
      expect(updateExecutionExpectedResultTool.description).toContain('期待結果を更新');
    });

    it('入力スキーマが定義されている', () => {
      expect(updateExecutionExpectedResultTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('有効な入力を受け付ける（PASS）', () => {
      const result = updateExecutionExpectedResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'PASS',
      });
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
      expect(result.expectedResultId).toBe(TEST_EXPECTED_RESULT_ID);
      expect(result.status).toBe('PASS');
    });

    it('有効な入力を受け付ける（FAIL with note）', () => {
      const result = updateExecutionExpectedResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'FAIL',
        note: 'Expected value did not match',
      });
      expect(result.status).toBe('FAIL');
      expect(result.note).toBe('Expected value did not match');
    });

    it('SKIPPED and NOT_EXECUTABLEも受け付ける', () => {
      const skippedResult = updateExecutionExpectedResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'SKIPPED',
      });
      expect(skippedResult.status).toBe('SKIPPED');

      const notExecResult = updateExecutionExpectedResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'NOT_EXECUTABLE',
      });
      expect(notExecResult.status).toBe('NOT_EXECUTABLE');
    });

    it('executionIdとexpectedResultIdとstatusは必須', () => {
      expect(() => updateExecutionExpectedResultInputSchema.parse({})).toThrow();
      expect(() => updateExecutionExpectedResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
      })).toThrow();
      expect(() => updateExecutionExpectedResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
      })).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() => updateExecutionExpectedResultInputSchema.parse({
        executionId: 'invalid-uuid',
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'PASS',
      })).toThrow();
    });

    it('無効なstatusはエラー', () => {
      expect(() => updateExecutionExpectedResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'PENDING',
      })).toThrow();
    });

    it('noteは2000文字以下', () => {
      expect(() => updateExecutionExpectedResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'PASS',
        note: 'a'.repeat(2001),
      })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'PASS' as const,
      };

      await expect(updateExecutionExpectedResultTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.patch).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す（PASS）', async () => {
      const mockResponse = {
        expectedResult: {
          id: TEST_EXPECTED_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'PASS',
          note: null,
          judgedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'PASS' as const,
      };

      const result = await updateExecutionExpectedResultTool.handler(input, context);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/expected-results/${TEST_EXPECTED_RESULT_ID}`,
        { status: 'PASS', note: undefined },
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('正常に内部APIを呼び出す（FAIL with note）', async () => {
      const mockResponse = {
        expectedResult: {
          id: TEST_EXPECTED_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'FAIL',
          note: 'Button color is wrong',
          judgedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'FAIL' as const,
        note: 'Button color is wrong',
      };

      await updateExecutionExpectedResultTool.handler(input, context);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/expected-results/${TEST_EXPECTED_RESULT_ID}`,
        { status: 'FAIL', note: 'Button color is wrong' },
        { userId: TEST_USER_ID }
      );
    });

    it('正常に内部APIを呼び出す（NOT_EXECUTABLE）', async () => {
      const mockResponse = {
        expectedResult: {
          id: TEST_EXPECTED_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'NOT_EXECUTABLE',
          note: 'Feature not available in test environment',
          judgedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'NOT_EXECUTABLE' as const,
        note: 'Feature not available in test environment',
      };

      await updateExecutionExpectedResultTool.handler(input, context);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/expected-results/${TEST_EXPECTED_RESULT_ID}`,
        { status: 'NOT_EXECUTABLE', note: 'Feature not available in test environment' },
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
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'PASS' as const,
      };

      await expect(updateExecutionExpectedResultTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied or execution is not in progress'
      );
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.patch.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Expected result not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'PASS' as const,
      };

      await expect(updateExecutionExpectedResultTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Expected result not found'
      );
    });
  });
});
