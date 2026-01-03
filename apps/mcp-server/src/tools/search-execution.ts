import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const searchExecutionInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('実行履歴を検索するテストスイートID。search_test_suiteで取得したIDを指定'),
  status: z.array(z.enum(['IN_PROGRESS', 'COMPLETED', 'ABORTED'])).optional().describe('ステータスで絞り込み（複数選択可）: IN_PROGRESS（実行中）, COMPLETED（完了）, ABORTED（中断）'),
  from: z.string().datetime().optional().describe('この日時以降の実行を検索（ISO 8601形式、例: 2024-01-01T00:00:00.000Z）'),
  to: z.string().datetime().optional().describe('この日時以前の実行を検索（ISO 8601形式、例: 2024-01-31T23:59:59.999Z）'),
  limit: z.number().int().min(1).max(50).default(20).describe('取得件数（1-50、デフォルト: 20）'),
  offset: z.number().int().min(0).default(0).describe('ページネーション用オフセット（デフォルト: 0）'),
  sortBy: z.enum(['startedAt', 'completedAt', 'status']).default('startedAt').describe('ソート項目（デフォルト: startedAt=開始日時）'),
  sortOrder: z.enum(['asc', 'desc']).default('desc').describe('ソート順: asc（昇順）, desc（降順）。デフォルト: desc（新しい順）'),
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
  description: `指定したテストスイートのテスト実行履歴を検索します。

返却情報: 実行ID・ステータス・開始/完了日時、実行者、実行環境。

使用場面: 過去のテスト実行結果を確認したり、進行中の実行を探す際に使用します。
関連ツール: get_executionで詳細情報（テストケースごとの結果・エビデンス）を取得可能。`,
  inputSchema: searchExecutionInputSchema,
  handler: searchExecutionHandler,
};
