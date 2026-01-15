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
  updateExecutionPreconditionResultTool,
  updateExecutionPreconditionResultInputSchema,
} from '../../../tools/update-execution-precondition-result.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_EXECUTION_ID = '55555555-5555-5555-5555-555555555555';
const TEST_PRECONDITION_RESULT_ID = '66666666-6666-6666-6666-666666666666';

describe('updateExecutionPreconditionResultTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(updateExecutionPreconditionResultTool.name).toBe('update_execution_precondition_result');
      expect(updateExecutionPreconditionResultTool.description).toContain('前提条件チェック結果を記録');
    });

    it('入力スキーマが定義されている', () => {
      expect(updateExecutionPreconditionResultTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('有効な入力を受け付ける（MET）', () => {
      const result = updateExecutionPreconditionResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'MET',
      });
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
      expect(result.preconditionResultId).toBe(TEST_PRECONDITION_RESULT_ID);
      expect(result.status).toBe('MET');
    });

    it('有効な入力を受け付ける（NOT_MET with note）', () => {
      const result = updateExecutionPreconditionResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'NOT_MET',
        note: 'Precondition not satisfied',
      });
      expect(result.status).toBe('NOT_MET');
      expect(result.note).toBe('Precondition not satisfied');
    });

    it('executionIdとpreconditionResultIdとstatusは必須', () => {
      expect(() => updateExecutionPreconditionResultInputSchema.parse({})).toThrow();
      expect(() => updateExecutionPreconditionResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
      })).toThrow();
      expect(() => updateExecutionPreconditionResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
      })).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() => updateExecutionPreconditionResultInputSchema.parse({
        executionId: 'invalid-uuid',
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'MET',
      })).toThrow();
    });

    it('無効なstatusはエラー', () => {
      expect(() => updateExecutionPreconditionResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'UNCHECKED',
      })).toThrow();
    });

    it('noteは2000文字以下', () => {
      expect(() => updateExecutionPreconditionResultInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'MET',
        note: 'a'.repeat(2001),
      })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = {
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'MET' as const,
      };

      await expect(updateExecutionPreconditionResultTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.patch).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す（MET）', async () => {
      const mockResponse = {
        preconditionResult: {
          id: TEST_PRECONDITION_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'MET',
          note: null,
          checkedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'MET' as const,
      };

      const result = await updateExecutionPreconditionResultTool.handler(input, context);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/precondition-results/${TEST_PRECONDITION_RESULT_ID}`,
        { status: 'MET', note: undefined },
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('正常に内部APIを呼び出す（NOT_MET with note）', async () => {
      const mockResponse = {
        preconditionResult: {
          id: TEST_PRECONDITION_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'NOT_MET',
          note: 'Environment not ready',
          checkedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'NOT_MET' as const,
        note: 'Environment not ready',
      };

      await updateExecutionPreconditionResultTool.handler(input, context);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/precondition-results/${TEST_PRECONDITION_RESULT_ID}`,
        { status: 'NOT_MET', note: 'Environment not ready' },
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
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'MET' as const,
      };

      await expect(updateExecutionPreconditionResultTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied or execution is not in progress'
      );
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.patch.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Precondition result not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'MET' as const,
      };

      await expect(updateExecutionPreconditionResultTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Precondition result not found'
      );
    });
  });
});
