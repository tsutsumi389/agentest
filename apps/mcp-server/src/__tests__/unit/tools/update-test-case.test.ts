import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// apiClientのモック
const mockApiClient = vi.hoisted(() => ({
  patch: vi.fn(),
}));

const mockCheckLockStatus = vi.hoisted(() => vi.fn());

vi.mock('../../../clients/api-client.js', () => ({
  apiClient: mockApiClient,
  checkLockStatus: mockCheckLockStatus,
}));

// モック設定後にインポート
import { updateTestCaseTool, updateTestCaseInputSchema } from '../../../tools/update-test-case.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_CASE_ID = '44444444-4444-4444-4444-444444444444';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';

describe('updateTestCaseTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckLockStatus.mockResolvedValue(undefined);
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(updateTestCaseTool.name).toBe('update_test_case');
      expect(updateTestCaseTool.description).toContain('テストケースの情報を更新');
    });

    it('入力スキーマが定義されている', () => {
      expect(updateTestCaseTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('testCaseIdと更新フィールドで有効', () => {
      const result = updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        title: 'Updated Case',
      });
      expect(result.testCaseId).toBe(TEST_CASE_ID);
      expect(result.title).toBe('Updated Case');
    });

    it('testCaseIdは必須', () => {
      expect(() => updateTestCaseInputSchema.parse({})).toThrow();
      expect(() => updateTestCaseInputSchema.parse({ title: 'Test' })).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() => updateTestCaseInputSchema.parse({
        testCaseId: 'invalid-uuid',
        title: 'Test Case',
      })).toThrow();
    });

    it('titleは1-200文字', () => {
      expect(() => updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        title: '',
      })).toThrow();

      expect(() => updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        title: 'a'.repeat(201),
      })).toThrow();
    });

    it('descriptionは2000文字以下', () => {
      expect(() => updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        description: 'a'.repeat(2001),
      })).toThrow();
    });

    it('descriptionはnullを許容', () => {
      const result = updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        description: null,
      });
      expect(result.description).toBeNull();
    });

    it('有効なpriorityを受け付ける', () => {
      const result = updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        priority: 'CRITICAL',
      });
      expect(result.priority).toBe('CRITICAL');
    });

    it('無効なpriorityはエラー', () => {
      expect(() => updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        priority: 'INVALID',
      })).toThrow();
    });

    it('有効なstatusを受け付ける', () => {
      const result = updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        status: 'ARCHIVED',
      });
      expect(result.status).toBe('ARCHIVED');
    });

    it('子エンティティを受け付ける（新規作成用: idなし）', () => {
      const result = updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        preconditions: [{ content: 'New precondition' }],
        steps: [{ content: 'New step' }],
        expectedResults: [{ content: 'New expected result' }],
      });
      expect(result.preconditions).toHaveLength(1);
      expect(result.preconditions![0].id).toBeUndefined();
      expect(result.preconditions![0].content).toBe('New precondition');
    });

    it('子エンティティを受け付ける（更新用: idあり）', () => {
      const result = updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        steps: [
          { id: '11111111-1111-1111-1111-111111111111', content: 'Updated step' },
          { content: 'New step' },
        ],
      });
      expect(result.steps).toHaveLength(2);
      expect(result.steps![0].id).toBe('11111111-1111-1111-1111-111111111111');
      expect(result.steps![1].id).toBeUndefined();
    });

    it('空の子エンティティ配列を受け付ける（全削除を意味する）', () => {
      const result = updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        steps: [],
      });
      expect(result.steps).toHaveLength(0);
    });

    it('子エンティティのcontentが空の場合はエラー', () => {
      expect(() => updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        steps: [{ content: '' }],
      })).toThrow();
    });

    it('子エンティティのidが不正なUUIDの場合はエラー', () => {
      expect(() => updateTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
        steps: [{ id: 'invalid-uuid', content: 'Step' }],
      })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { testCaseId: TEST_CASE_ID, title: 'Updated Case' };

      await expect(updateTestCaseTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.patch).not.toHaveBeenCalled();
    });

    it('更新フィールドが0個の場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testCaseId: TEST_CASE_ID };

      await expect(updateTestCaseTool.handler(input, context)).rejects.toThrow(
        '少なくとも1つの更新フィールドを指定してください'
      );
      expect(mockApiClient.patch).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す（title更新）', async () => {
      const mockResponse = {
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId: TEST_SUITE_ID,
          title: 'Updated Case',
          description: 'Description',
          priority: 'MEDIUM',
          status: 'DRAFT',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testCaseId: TEST_CASE_ID, title: 'Updated Case' };

      const result = await updateTestCaseTool.handler(input, context);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/test-cases/${TEST_CASE_ID}`,
        expect.objectContaining({ title: 'Updated Case', groupId: expect.stringMatching(/^[0-9a-f-]{36}$/) }),
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('正常に内部APIを呼び出す（複数フィールド更新）', async () => {
      const mockResponse = {
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId: TEST_SUITE_ID,
          title: 'Updated Case',
          description: 'New Description',
          priority: 'HIGH',
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testCaseId: TEST_CASE_ID,
        title: 'Updated Case',
        description: 'New Description',
        priority: 'HIGH' as const,
        status: 'ACTIVE' as const,
      };

      await updateTestCaseTool.handler(input, context);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/test-cases/${TEST_CASE_ID}`,
        expect.objectContaining({ title: 'Updated Case', description: 'New Description', priority: 'HIGH', status: 'ACTIVE', groupId: expect.stringMatching(/^[0-9a-f-]{36}$/) }),
        { userId: TEST_USER_ID }
      );
    });

    it('APIエラーを伝播する（403）', async () => {
      mockApiClient.patch.mockRejectedValueOnce(
        new Error('Internal API error: 403 - Access denied')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testCaseId: TEST_CASE_ID, title: 'Updated Case' };

      await expect(updateTestCaseTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.patch.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Test case not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testCaseId: TEST_CASE_ID, title: 'Updated Case' };

      await expect(updateTestCaseTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Test case not found'
      );
    });

    it('子エンティティの差分更新を内部APIに渡す', async () => {
      const stepId = '55555555-5555-5555-5555-555555555555';
      const mockResponse = {
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId: TEST_SUITE_ID,
          title: 'Updated Case',
          description: null,
          priority: 'MEDIUM',
          status: 'DRAFT',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          preconditions: [],
          steps: [
            { id: stepId, content: 'Updated step', orderKey: '00001' },
            { id: '66666666-6666-6666-6666-666666666666', content: 'New step', orderKey: '00002' },
          ],
          expectedResults: [],
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testCaseId: TEST_CASE_ID,
        steps: [
          { id: stepId, content: 'Updated step' },
          { content: 'New step' },
        ],
      };

      const result = await updateTestCaseTool.handler(input, context) as typeof mockResponse;

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/test-cases/${TEST_CASE_ID}`,
        expect.objectContaining({
          steps: [
            { id: stepId, content: 'Updated step' },
            { content: 'New step' },
          ],
          groupId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
        { userId: TEST_USER_ID }
      );
      expect(result.testCase.steps).toHaveLength(2);
    });

    it('空配列で全ての子エンティティを削除できる', async () => {
      const mockResponse = {
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId: TEST_SUITE_ID,
          title: 'Case',
          description: null,
          priority: 'MEDIUM',
          status: 'DRAFT',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          preconditions: [],
          steps: [],
          expectedResults: [],
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testCaseId: TEST_CASE_ID,
        steps: [],
        expectedResults: [],
      };

      const result = await updateTestCaseTool.handler(input, context) as typeof mockResponse;

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/test-cases/${TEST_CASE_ID}`,
        expect.objectContaining({ steps: [], expectedResults: [], groupId: expect.stringMatching(/^[0-9a-f-]{36}$/) }),
        { userId: TEST_USER_ID }
      );
      expect(result.testCase.steps).toHaveLength(0);
      expect(result.testCase.expectedResults).toHaveLength(0);
    });
  });
});
