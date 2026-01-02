import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const searchTestSuiteInputSchema = z.object({
  projectId: z.string().uuid().optional().describe('プロジェクトIDで絞り込み（省略時は全アクセス可能プロジェクト）'),
  q: z.string().max(100).optional().describe('テストスイート名で検索'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional().describe('ステータスで絞り込み'),
  limit: z.number().int().min(1).max(50).default(20).describe('取得件数'),
  offset: z.number().int().min(0).default(0).describe('オフセット'),
});

type SearchTestSuiteInput = z.infer<typeof searchTestSuiteInputSchema>;

/**
 * レスポンス型
 * API側（user.service.ts）のレスポンスと整合
 */
interface SearchTestSuiteResponse {
  testSuites: Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    projectId: string;
    project: {
      id: string;
      name: string;
    };
    createdByUser: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
    _count: {
      testCases: number;
      preconditions: number;
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
const searchTestSuiteHandler: ToolHandler<SearchTestSuiteInput, SearchTestSuiteResponse> = async (
  input,
  context
) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.get<SearchTestSuiteResponse>(
    `/internal/api/users/${userId}/test-suites`,
    {
      projectId: input.projectId,
      q: input.q,
      status: input.status,
      limit: input.limit,
      offset: input.offset,
    }
  );

  return response;
};

/**
 * ツール定義
 */
export const searchTestSuiteTool: ToolDefinition<SearchTestSuiteInput> = {
  name: 'search_test_suite',
  description: 'アクセス可能なテストスイート一覧を検索します。プロジェクト、名前、ステータスで絞り込み可能です。',
  // ZodDefaultを使用しているため、出力型でキャストが必要
  inputSchema: searchTestSuiteInputSchema as unknown as z.ZodType<SearchTestSuiteInput>,
  handler: searchTestSuiteHandler,
};
