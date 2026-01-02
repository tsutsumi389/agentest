import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const searchExecutionInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('テストスイートID（必須）'),
  status: z.array(z.enum(['IN_PROGRESS', 'COMPLETED', 'ABORTED'])).optional().describe('ステータスで絞り込み（複数選択可）'),
  from: z.string().datetime().optional().describe('開始日時（ISO 8601形式、例: 2024-01-01T00:00:00.000Z）'),
  to: z.string().datetime().optional().describe('終了日時（ISO 8601形式、例: 2024-01-31T23:59:59.999Z）'),
  limit: z.number().int().min(1).max(50).default(20).describe('取得件数'),
  offset: z.number().int().min(0).default(0).describe('オフセット'),
  sortBy: z.enum(['startedAt', 'completedAt', 'status']).default('startedAt').describe('ソート項目'),
  sortOrder: z.enum(['asc', 'desc']).default('desc').describe('ソート順'),
});

type SearchExecutionInput = z.infer<typeof searchExecutionInputSchema>;

/**
 * レスポンス型
 */
interface SearchExecutionResponse {
  executions: Array<{
    id: string;
    testSuiteId: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    executedByUser: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
    environment: {
      id: string;
      name: string;
      slug: string;
    } | null;
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
const searchExecutionHandler: ToolHandler<SearchExecutionInput, SearchExecutionResponse> = async (
  input,
  context
) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.get<SearchExecutionResponse>(
    `/internal/api/test-suites/${input.testSuiteId}/executions`,
    {
      userId,
      status: input.status,
      from: input.from,
      to: input.to,
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
export const searchExecutionTool: ToolDefinition<SearchExecutionInput> = {
  name: 'search_execution',
  description: 'テストスイートの実行履歴を検索します。ステータス、期間で絞り込み可能です。',
  inputSchema: searchExecutionInputSchema as unknown as z.ZodType<SearchExecutionInput>,
  handler: searchExecutionHandler,
};
