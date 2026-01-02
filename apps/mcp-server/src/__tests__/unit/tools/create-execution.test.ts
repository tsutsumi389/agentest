import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// apiClientのモック
const mockApiClient = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('../../../clients/api-client.js', () => ({
  apiClient: mockApiClient,
}));

// モック設定後にインポート
import { createExecutionTool, createExecutionInputSchema } from '../../../tools/create-execution.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_EXECUTION_ID = '33333333-3333-3333-3333-333333333333';
const TEST_ENVIRONMENT_ID = '44444444-4444-4444-4444-444444444444';

describe('createExecutionTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(createExecutionTool.name).toBe('create_execution');
      expect(createExecutionTool.description).toBe(
        'テスト実行を開始します。テストスイートIDを指定すると、スナップショットと全結果行が自動作成されます。'
      );
    });

    it('入力スキーマが定義されている', () => {
      expect(createExecutionTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('有効な入力を受け付ける', () => {
      const result = createExecutionInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        environmentId: TEST_ENVIRONMENT_ID,
      });
      expect(result.testSuiteId).toBe(TEST_SUITE_ID);
      expect(result.environmentId).toBe(TEST_ENVIRONMENT_ID);
    });

    it('testSuiteIdは必須', () => {
      expect(() => createExecutionInputSchema.parse({})).toThrow();
    });

    it('environmentIdはオプショナル', () => {
      const result = createExecutionInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
      });
      expect(result.environmentId).toBeUndefined();
    });

    it('無効なtestSuiteIdはエラー', () => {
      expect(() => createExecutionInputSchema.parse({
        testSuiteId: 'invalid-uuid',
      })).toThrow();
    });

    it('無効なenvironmentIdはエラー', () => {
      expect(() => createExecutionInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        environmentId: 'invalid-uuid',
      })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { testSuiteId: TEST_SUITE_ID };

      await expect(createExecutionTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す（environmentIdなし）', async () => {
      const mockResponse = {
        execution: {
          id: TEST_EXECUTION_ID,
          testSuiteId: TEST_SUITE_ID,
          environmentId: null,
          status: 'IN_PROGRESS',
          startedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };
      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID };

      const result = await createExecutionTool.handler(input, context);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}/executions`,
        { environmentId: undefined },
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('正常に内部APIを呼び出す（environmentIdあり）', async () => {
      const mockResponse = {
        execution: {
          id: TEST_EXECUTION_ID,
          testSuiteId: TEST_SUITE_ID,
          environmentId: TEST_ENVIRONMENT_ID,
          status: 'IN_PROGRESS',
          startedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };
      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        environmentId: TEST_ENVIRONMENT_ID,
      };

      const result = await createExecutionTool.handler(input, context);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}/executions`,
        { environmentId: TEST_ENVIRONMENT_ID },
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('APIエラーを伝播する（403）', async () => {
      mockApiClient.post.mockRejectedValueOnce(
        new Error('Internal API error: 403 - Access denied')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID };

      await expect(createExecutionTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.post.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Test suite not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID };

      await expect(createExecutionTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Test suite not found'
      );
    });
  });
});
