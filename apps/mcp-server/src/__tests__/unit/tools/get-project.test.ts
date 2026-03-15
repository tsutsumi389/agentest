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
import { getProjectTool, getProjectInputSchema } from '../../../tools/get-project.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';

// モックプロジェクトを作成するヘルパー
function createMockProject(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_PROJECT_ID,
    name: 'Test Project',
    description: 'Test description',
    organizationId: null,
    organization: null,
    role: 'OWNER',
    environments: [],
    _count: { testSuites: 5 },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getProjectTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(getProjectTool.name).toBe('get_project');
      expect(getProjectTool.description).toContain('プロジェクトの詳細情報を取得');
    });

    it('入力スキーマが定義されている', () => {
      expect(getProjectTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('有効なUUIDを受け付ける', () => {
      const result = getProjectInputSchema.parse({ projectId: TEST_PROJECT_ID });
      expect(result.projectId).toBe(TEST_PROJECT_ID);
    });

    it('projectIdが必須', () => {
      expect(() => getProjectInputSchema.parse({})).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() => getProjectInputSchema.parse({ projectId: 'invalid-uuid' })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { projectId: TEST_PROJECT_ID };

      await expect(getProjectTool.handler(input, context)).rejects.toThrow('認証されていません');
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す', async () => {
      const mockProject = createMockProject();
      const mockResponse = { project: mockProject };
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { projectId: TEST_PROJECT_ID };

      const result = await getProjectTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(`/internal/api/projects/${TEST_PROJECT_ID}`, {
        userId: TEST_USER_ID,
      });
      expect(result).toEqual(mockResponse);
    });

    it('環境設定を含むプロジェクトを返す', async () => {
      const projectWithEnvs = createMockProject({
        environments: [
          {
            id: 'env-1',
            name: 'Development',
            isDefault: true,
            sortOrder: 0,
          },
          {
            id: 'env-2',
            name: 'Production',
            isDefault: false,
            sortOrder: 1,
          },
        ],
      });
      const mockResponse = { project: projectWithEnvs };
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { projectId: TEST_PROJECT_ID };

      const result = await getProjectTool.handler(input, context);

      expect(
        (result as { project: { environments: unknown[] } }).project.environments
      ).toHaveLength(2);
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.get.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Project not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { projectId: TEST_PROJECT_ID };

      await expect(getProjectTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Project not found'
      );
    });

    it('APIエラーを伝播する（403）', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Internal API error: 403 - Access denied'));

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { projectId: TEST_PROJECT_ID };

      await expect(getProjectTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });
  });
});
