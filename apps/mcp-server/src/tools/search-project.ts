import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const searchProjectInputSchema = z.object({
  q: z
    .string()
    .max(100)
    .optional()
    .describe('プロジェクト名で部分一致検索。省略時は全プロジェクトを取得'),
  limit: z.number().int().min(1).max(50).default(50).describe('取得件数（1-50、デフォルト: 50）'),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('ページネーション用オフセット（デフォルト: 0）'),
});

type SearchProjectInput = z.infer<typeof searchProjectInputSchema>;

/**
 * レスポンス型
 * API側（user.service.ts:129-151）のレスポンスと整合
 */
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
  description: `ユーザーがアクセス可能なプロジェクト一覧を検索します。

返却情報: プロジェクトID・名前・説明、所属組織、ユーザー権限(OWNER/ADMIN/MEMBER/VIEWER)、テストスイート数。

使用場面: テストスイートやテストケースを操作する前に、対象プロジェクトのIDを取得する最初のステップとして使用します。`,
  inputSchema: searchProjectInputSchema,
  handler: searchProjectHandler,
};
