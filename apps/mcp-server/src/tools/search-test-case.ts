import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const searchTestCaseInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('テストスイートID（必須）'),
  q: z.string().max(100).optional().describe('キーワード検索（タイトル、手順、期待結果）'),
  status: z.array(z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])).optional().describe('ステータスで絞り込み（複数選択可）'),
  priority: z.array(z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])).optional().describe('優先度で絞り込み（複数選択可）'),
  limit: z.number().int().min(1).max(50).default(20).describe('取得件数'),
  offset: z.number().int().min(0).default(0).describe('オフセット'),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt', 'priority', 'orderKey']).default('orderKey').describe('ソート項目'),
  sortOrder: z.enum(['asc', 'desc']).default('asc').describe('ソート順'),
});

type SearchTestCaseInput = z.infer<typeof searchTestCaseInputSchema>;

/**
 * レスポンス型
 */
interface SearchTestCaseResponse {
  testCases: Array<{
    id: string;
    testSuiteId: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    orderKey: string;
    createdByUser: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
    _count: {
      preconditions: number;
      steps: number;
      expectedResults: number;
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
const searchTestCaseHandler: ToolHandler<SearchTestCaseInput, SearchTestCaseResponse> = async (
  input,
  context
) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.get<SearchTestCaseResponse>(
    `/internal/api/test-suites/${input.testSuiteId}/test-cases`,
    {
      userId,
      q: input.q,
      status: input.status,
      priority: input.priority,
      limit: input.limit,
      offset: input.offset,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    }
  );

  return response;
};

/**
 * ツール定義
 */
export const searchTestCaseTool: ToolDefinition<SearchTestCaseInput> = {
  name: 'search_test_case',
  description: 'テストスイート内のテストケース一覧を検索します。キーワード、ステータス、優先度で絞り込み可能です。',
  inputSchema: searchTestCaseInputSchema as unknown as z.ZodType<SearchTestCaseInput>,
  handler: searchTestCaseHandler,
};
