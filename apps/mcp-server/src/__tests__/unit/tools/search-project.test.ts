import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// レスポンス型
interface SearchProjectResponse {
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    organizationId: string | null;
    organization: {
      id: string;
      name: string;
    } | null;
    role: string;
    _count: {
      testSuites: number;
    };
    createdAt: string;
    updatedAt: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// apiClientのモック
const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../../../clients/api-client.js', () => ({
  apiClient: mockApiClient,
}));

// モック設定後にインポート
import { searchProjectTool, searchProjectInputSchema } from '../../../tools/search-project.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';

// モックレスポンスを作成するヘルパー
function createMockResponse(projects: unknown[] = []) {
  return {
    projects,
    pagination: {
      total: projects.length,
      limit: 50,
      offset: 0,
      hasMore: false,
    },
  };
}

// モックプロジェクトを作成するヘルパー
function createMockProject(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_PROJECT_ID,
    name: 'Test Project',
    description: 'Test description',
    organizationId: null,
    organization: null,
    role: 'OWNER',
    _count: { testSuites: 5 },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('searchProjectTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(searchProjectTool.name).toBe('search_project');
      expect(searchProjectTool.description).toContain('プロジェクト一覧を検索');
    });

    it('入力スキーマが定義されている', () => {
      expect(searchProjectTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('デフォルト値が設定される', () => {
      const result = searchProjectInputSchema.parse({});
      expect(result).toEqual({
        q: undefined,
        limit: 50,
        offset: 0,
      });
    });

    it('検索クエリを受け付ける', () => {
      const result = searchProjectInputSchema.parse({ q: 'test' });
      expect(result.q).toBe('test');
    });

    it('limitとoffsetをオーバーライドできる', () => {
      const result = searchProjectInputSchema.parse({ limit: 10, offset: 20 });
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
    });

    it('qが100文字を超えるとエラー', () => {
      const longQuery = 'a'.repeat(101);
      expect(() => searchProjectInputSchema.parse({ q: longQuery })).toThrow();
    });

    it('limitが50を超えるとエラー', () => {
      expect(() => searchProjectInputSchema.parse({ limit: 51 })).toThrow();
    });

    it('limitが0以下だとエラー', () => {
      expect(() => searchProjectInputSchema.parse({ limit: 0 })).toThrow();
    });

    it('offsetが負の値だとエラー', () => {
      expect(() => searchProjectInputSchema.parse({ offset: -1 })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { limit: 50, offset: 0 };

      await expect(searchProjectTool.handler(input, context)).rejects.toThrow('認証されていません');
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す', async () => {
      const mockProject = createMockProject();
      const mockResponse = createMockResponse([mockProject]);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { limit: 50, offset: 0 };

      const result = await searchProjectTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/users/${TEST_USER_ID}/projects`,
        {
          q: undefined,
          limit: 50,
          offset: 0,
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('検索クエリを渡す', async () => {
      mockApiClient.get.mockResolvedValueOnce(createMockResponse([]));

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { q: 'search-term', limit: 10, offset: 5 };

      await searchProjectTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/users/${TEST_USER_ID}/projects`,
        {
          q: 'search-term',
          limit: 10,
          offset: 5,
        }
      );
    });

    it('APIエラーを伝播する', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Internal API error: 500 - Server error'));

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { limit: 50, offset: 0 };

      await expect(searchProjectTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 500 - Server error'
      );
    });

    it('複数のプロジェクトを返す', async () => {
      const projects = [
        createMockProject({ id: 'proj-1', name: 'Project 1' }),
        createMockProject({ id: 'proj-2', name: 'Project 2' }),
        createMockProject({ id: 'proj-3', name: 'Project 3' }),
      ];
      const mockResponse = createMockResponse(projects);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { limit: 50, offset: 0 };

      const result = (await searchProjectTool.handler(input, context)) as SearchProjectResponse;

      expect(result.projects).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
    });

    it('組織に属するプロジェクトを返す', async () => {
      const projectWithOrg = createMockProject({
        organizationId: 'org-1',
        organization: {
          id: 'org-1',
          name: 'Test Organization',
        },
      });
      const mockResponse = createMockResponse([projectWithOrg]);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { limit: 50, offset: 0 };

      const result = (await searchProjectTool.handler(input, context)) as SearchProjectResponse;

      expect(result.projects[0].organization).toEqual({
        id: 'org-1',
        name: 'Test Organization',
      });
    });
  });
});
