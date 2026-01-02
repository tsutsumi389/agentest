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
import { createTestCaseTool, createTestCaseInputSchema } from '../../../tools/create-test-case.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_CASE_ID = '33333333-3333-3333-3333-333333333333';

describe('createTestCaseTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(createTestCaseTool.name).toBe('create_test_case');
      expect(createTestCaseTool.description).toContain('テストケースを作成します');
      expect(createTestCaseTool.description).toContain('前提条件');
      expect(createTestCaseTool.description).toContain('テスト手順');
      expect(createTestCaseTool.description).toContain('期待結果');
    });

    it('入力スキーマが定義されている', () => {
      expect(createTestCaseTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('有効な入力を受け付ける', () => {
      const result = createTestCaseInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
        description: 'Description',
        priority: 'HIGH',
        status: 'ACTIVE',
      });
      expect(result.testSuiteId).toBe(TEST_SUITE_ID);
      expect(result.title).toBe('Test Case');
      expect(result.description).toBe('Description');
      expect(result.priority).toBe('HIGH');
      expect(result.status).toBe('ACTIVE');
    });

    it('testSuiteIdとtitleは必須', () => {
      expect(() => createTestCaseInputSchema.parse({})).toThrow();
      expect(() => createTestCaseInputSchema.parse({ testSuiteId: TEST_SUITE_ID })).toThrow();
      expect(() => createTestCaseInputSchema.parse({ title: 'Test' })).toThrow();
    });

    it('descriptionはオプショナル', () => {
      const result = createTestCaseInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
      });
      expect(result.description).toBeUndefined();
    });

    it('priorityのデフォルトはMEDIUM', () => {
      const result = createTestCaseInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
      });
      expect(result.priority).toBe('MEDIUM');
    });

    it('statusのデフォルトはDRAFT', () => {
      const result = createTestCaseInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
      });
      expect(result.status).toBe('DRAFT');
    });

    it('無効なUUIDはエラー', () => {
      expect(() => createTestCaseInputSchema.parse({
        testSuiteId: 'invalid-uuid',
        title: 'Test Case',
      })).toThrow();
    });

    it('無効なpriorityはエラー', () => {
      expect(() => createTestCaseInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
        priority: 'INVALID',
      })).toThrow();
    });

    it('無効なstatusはエラー', () => {
      expect(() => createTestCaseInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
        status: 'INVALID',
      })).toThrow();
    });

    it('子エンティティを受け付ける', () => {
      const result = createTestCaseInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
        preconditions: [{ content: 'Precondition 1' }],
        steps: [{ content: 'Step 1' }, { content: 'Step 2' }],
        expectedResults: [{ content: 'Expected 1' }],
      });
      expect(result.preconditions).toHaveLength(1);
      expect(result.steps).toHaveLength(2);
      expect(result.expectedResults).toHaveLength(1);
    });

    it('空の子エンティティ配列を受け付ける', () => {
      const result = createTestCaseInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
        preconditions: [],
        steps: [],
        expectedResults: [],
      });
      expect(result.preconditions).toHaveLength(0);
    });

    it('子エンティティのcontentが空の場合はエラー', () => {
      expect(() => createTestCaseInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
        steps: [{ content: '' }],
      })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
        priority: 'MEDIUM' as const,
        status: 'DRAFT' as const,
      };

      await expect(createTestCaseTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す', async () => {
      const mockResponse = {
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId: TEST_SUITE_ID,
          title: 'Test Case',
          description: 'Description',
          priority: 'HIGH',
          status: 'DRAFT',
          orderKey: '00001',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };
      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
        description: 'Description',
        priority: 'HIGH' as const,
        status: 'DRAFT' as const,
      };

      const result = await createTestCaseTool.handler(input, context);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/internal/api/test-cases',
        {
          testSuiteId: TEST_SUITE_ID,
          title: 'Test Case',
          description: 'Description',
          priority: 'HIGH',
          status: 'DRAFT',
        },
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('descriptionなしで呼び出せる', async () => {
      const mockResponse = {
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId: TEST_SUITE_ID,
          title: 'Test Case',
          description: null,
          priority: 'MEDIUM',
          status: 'DRAFT',
          orderKey: '00001',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };
      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
        priority: 'MEDIUM' as const,
        status: 'DRAFT' as const,
      };

      await createTestCaseTool.handler(input, context);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/internal/api/test-cases',
        {
          testSuiteId: TEST_SUITE_ID,
          title: 'Test Case',
          description: undefined,
          priority: 'MEDIUM',
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
      const input = {
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
        priority: 'MEDIUM' as const,
        status: 'DRAFT' as const,
      };

      await expect(createTestCaseTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.post.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Test suite not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
        priority: 'MEDIUM' as const,
        status: 'DRAFT' as const,
      };

      await expect(createTestCaseTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Test suite not found'
      );
    });

    it('子エンティティを含めて内部APIを呼び出す', async () => {
      const mockResponse = {
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId: TEST_SUITE_ID,
          title: 'Test Case',
          description: null,
          priority: 'MEDIUM',
          status: 'DRAFT',
          orderKey: '00001',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          preconditions: [{ id: 'p1', content: 'Precondition 1', orderKey: '00001' }],
          steps: [{ id: 's1', content: 'Step 1', orderKey: '00001' }],
          expectedResults: [{ id: 'e1', content: 'Expected 1', orderKey: '00001' }],
        },
      };
      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        title: 'Test Case',
        priority: 'MEDIUM' as const,
        status: 'DRAFT' as const,
        preconditions: [{ content: 'Precondition 1' }],
        steps: [{ content: 'Step 1' }],
        expectedResults: [{ content: 'Expected 1' }],
      };

      const result = await createTestCaseTool.handler(input, context) as typeof mockResponse;

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/internal/api/test-cases',
        {
          testSuiteId: TEST_SUITE_ID,
          title: 'Test Case',
          description: undefined,
          priority: 'MEDIUM',
          status: 'DRAFT',
          preconditions: [{ content: 'Precondition 1' }],
          steps: [{ content: 'Step 1' }],
          expectedResults: [{ content: 'Expected 1' }],
        },
        { userId: TEST_USER_ID }
      );
      expect(result.testCase.preconditions).toHaveLength(1);
      expect(result.testCase.steps).toHaveLength(1);
      expect(result.testCase.expectedResults).toHaveLength(1);
    });
  });
});
