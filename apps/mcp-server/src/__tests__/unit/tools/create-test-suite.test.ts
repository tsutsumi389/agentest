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
import { createTestSuiteTool, createTestSuiteInputSchema } from '../../../tools/create-test-suite.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';

describe('createTestSuiteTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(createTestSuiteTool.name).toBe('create_test_suite');
      expect(createTestSuiteTool.description).toContain('テストスイートを作成');
    });

    it('入力スキーマが定義されている', () => {
      expect(createTestSuiteTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('有効な入力を受け付ける', () => {
      const result = createTestSuiteInputSchema.parse({
        projectId: TEST_PROJECT_ID,
        name: 'Test Suite',
        description: 'Description',
        status: 'ACTIVE',
      });
      expect(result.projectId).toBe(TEST_PROJECT_ID);
      expect(result.name).toBe('Test Suite');
      expect(result.description).toBe('Description');
      expect(result.status).toBe('ACTIVE');
    });

    it('projectIdとnameは必須', () => {
      expect(() => createTestSuiteInputSchema.parse({})).toThrow();
      expect(() => createTestSuiteInputSchema.parse({ projectId: TEST_PROJECT_ID })).toThrow();
      expect(() => createTestSuiteInputSchema.parse({ name: 'Test' })).toThrow();
    });

    it('descriptionはオプショナル', () => {
      const result = createTestSuiteInputSchema.parse({
        projectId: TEST_PROJECT_ID,
        name: 'Test Suite',
      });
      expect(result.description).toBeUndefined();
    });

    it('statusのデフォルトはDRAFT', () => {
      const result = createTestSuiteInputSchema.parse({
        projectId: TEST_PROJECT_ID,
        name: 'Test Suite',
      });
      expect(result.status).toBe('DRAFT');
    });

    it('無効なUUIDはエラー', () => {
      expect(() => createTestSuiteInputSchema.parse({
        projectId: 'invalid-uuid',
        name: 'Test Suite',
      })).toThrow();
    });

    it('無効なstatusはエラー', () => {
      expect(() => createTestSuiteInputSchema.parse({
        projectId: TEST_PROJECT_ID,
        name: 'Test Suite',
        status: 'INVALID',
      })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { projectId: TEST_PROJECT_ID, name: 'Test Suite', status: 'DRAFT' as const };

      await expect(createTestSuiteTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す', async () => {
      const mockResponse = {
        testSuite: {
          id: TEST_SUITE_ID,
          projectId: TEST_PROJECT_ID,
          name: 'Test Suite',
          description: 'Description',
          status: 'DRAFT',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };
      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        projectId: TEST_PROJECT_ID,
        name: 'Test Suite',
        description: 'Description',
        status: 'DRAFT' as const,
      };

      const result = await createTestSuiteTool.handler(input, context);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/internal/api/test-suites',
        {
          projectId: TEST_PROJECT_ID,
          name: 'Test Suite',
          description: 'Description',
          status: 'DRAFT',
        },
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('descriptionなしで呼び出せる', async () => {
      const mockResponse = {
        testSuite: {
          id: TEST_SUITE_ID,
          projectId: TEST_PROJECT_ID,
          name: 'Test Suite',
          description: null,
          status: 'DRAFT',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };
      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        projectId: TEST_PROJECT_ID,
        name: 'Test Suite',
        status: 'DRAFT' as const,
      };

      await createTestSuiteTool.handler(input, context);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/internal/api/test-suites',
        {
          projectId: TEST_PROJECT_ID,
          name: 'Test Suite',
          description: undefined,
          status: 'DRAFT',
        },
        { userId: TEST_USER_ID }
      );
    });

    it('APIエラーを伝播する（403）', async () => {
      mockApiClient.post.mockRejectedValueOnce(
        new Error('Internal API error: 403 - Access denied')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { projectId: TEST_PROJECT_ID, name: 'Test Suite', status: 'DRAFT' as const };

      await expect(createTestSuiteTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.post.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Project not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { projectId: TEST_PROJECT_ID, name: 'Test Suite', status: 'DRAFT' as const };

      await expect(createTestSuiteTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Project not found'
      );
    });
  });
});
