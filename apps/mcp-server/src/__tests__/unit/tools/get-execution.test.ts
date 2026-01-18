import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// apiClientのモック
const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../../../clients/api-client.js', () => ({
  apiClient: mockApiClient,
}));

// モック設定後にインポート
import { getExecutionTool, getExecutionInputSchema } from '../../../tools/get-execution.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_EXECUTION_ID = '55555555-5555-5555-5555-555555555555';
const TEST_TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';

// モック実行を作成するヘルパー
function createMockExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_EXECUTION_ID,
    testSuiteId: TEST_TEST_SUITE_ID,
    testSuite: { id: TEST_TEST_SUITE_ID, name: 'Test Suite', projectId: TEST_PROJECT_ID },
    executedByUser: { id: TEST_USER_ID, name: 'Test User', avatarUrl: null },
    environment: null,
    executionTestSuite: null,
    preconditionResults: [],
    stepResults: [],
    expectedResults: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getExecutionTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(getExecutionTool.name).toBe('get_execution');
      expect(getExecutionTool.description).toContain('テスト実行の詳細情報を取得');
    });

    it('入力スキーマが定義されている', () => {
      expect(getExecutionTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('有効なUUIDを受け付ける', () => {
      const result = getExecutionInputSchema.parse({ executionId: TEST_EXECUTION_ID });
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
    });

    it('executionIdが必須', () => {
      expect(() => getExecutionInputSchema.parse({})).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() => getExecutionInputSchema.parse({ executionId: 'invalid-uuid' })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { executionId: TEST_EXECUTION_ID };

      await expect(getExecutionTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す', async () => {
      const mockExecution = createMockExecution();
      const mockResponse = { execution: mockExecution };
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { executionId: TEST_EXECUTION_ID };

      const result = await getExecutionTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}`,
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('環境情報を含む実行を返す', async () => {
      const executionWithEnv = createMockExecution({
        environment: {
          id: 'env-1',
          name: 'Development',
          slug: 'dev',
        },
      });
      const mockResponse = { execution: executionWithEnv };
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { executionId: TEST_EXECUTION_ID };

      const result = await getExecutionTool.handler(input, context);

      const typedResult = result as {
        execution: { environment: { id: string; name: string; slug: string } };
      };
      expect(typedResult.execution.environment).toEqual({
        id: 'env-1',
        name: 'Development',
        slug: 'dev',
      });
    });

    it('結果データとエビデンスを含む実行を返す', async () => {
      const executionWithResults = createMockExecution({
        preconditionResults: [
          { id: 'pr-1', status: 'OK', note: null },
        ],
        stepResults: [
          { id: 'sr-1', status: 'DONE', note: 'Executed successfully' },
        ],
        expectedResults: [
          {
            id: 'er-1',
            status: 'PASS',
            note: null,
            evidences: [
              { id: 'ev-1', fileName: 'screenshot.png', fileSize: 12345 },
            ],
          },
        ],
      });
      const mockResponse = { execution: executionWithResults };
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { executionId: TEST_EXECUTION_ID };

      const result = await getExecutionTool.handler(input, context);

      const typedResult = result as {
        execution: {
          preconditionResults: unknown[];
          stepResults: unknown[];
          expectedResults: Array<{ evidences: unknown[] }>;
        };
      };
      expect(typedResult.execution.preconditionResults).toHaveLength(1);
      expect(typedResult.execution.stepResults).toHaveLength(1);
      expect(typedResult.execution.expectedResults).toHaveLength(1);
      expect(typedResult.execution.expectedResults[0].evidences).toHaveLength(1);
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.get.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Execution not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { executionId: TEST_EXECUTION_ID };

      await expect(getExecutionTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Execution not found'
      );
    });

    it('APIエラーを伝播する（403）', async () => {
      mockApiClient.get.mockRejectedValueOnce(
        new Error('Internal API error: 403 - Access denied')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { executionId: TEST_EXECUTION_ID };

      await expect(getExecutionTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });
  });
});
