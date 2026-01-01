import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const searchProjectInputSchema = z.object({
  q: z.string().max(100).optional().describe('プロジェクト名で検索'),
  limit: z.number().int().min(1).max(50).default(50).describe('取得件数'),
  offset: z.number().int().min(0).default(0).describe('オフセット'),
});

type SearchProjectInput = z.infer<typeof searchProjectInputSchema>;

/**
 * レスポンス型
 */
interface SearchProjectResponse {
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    organizationId: string | null;
    role: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * ハンドラー
 */
const searchProjectHandler: ToolHandler<SearchProjectInput, SearchProjectResponse> = async (
  input,
  context
) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.get<SearchProjectResponse>(
    `/internal/api/users/${userId}/projects`,
    {
      q: input.q,
      limit: input.limit,
      offset: input.offset,
    }
  );

  return response;
};

/**
 * ツール定義
 */
export const searchProjectTool: ToolDefinition<SearchProjectInput> = {
  name: 'search_project',
  description: 'アクセス可能なプロジェクト一覧を検索します。',
  // ZodDefaultを使用しているため、出力型でキャストが必要
  inputSchema: searchProjectInputSchema as unknown as z.ZodType<SearchProjectInput>,
  handler: searchProjectHandler,
};
