import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const searchTestCaseInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('検索対象のテストスイートID。search_test_suiteで取得したIDを指定'),
  q: z.string().max(100).optional().describe('タイトル・手順・期待結果に対するキーワード部分一致検索'),
  status: z.array(z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])).optional().describe('ステータスで絞り込み（複数選択可）: DRAFT（下書き）, ACTIVE（有効）, ARCHIVED（アーカイブ済み）'),
  priority: z.array(z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])).optional().describe('優先度で絞り込み（複数選択可）: LOW, MEDIUM, HIGH, CRITICAL'),
  limit: z.number().int().min(1).max(50).default(20).describe('取得件数（1-50、デフォルト: 20）'),
  offset: z.number().int().min(0).default(0).describe('ページネーション用オフセット（デフォルト: 0）'),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt', 'priority', 'orderKey']).default('orderKey').describe('ソート項目（デフォルト: orderKey=表示順序）'),
  sortOrder: z.enum(['asc', 'desc']).default('asc').describe('ソート順: asc（昇順）, desc（降順）。デフォルト: asc'),
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
  description: `指定したテストスイート内のテストケース一覧を検索します。

返却情報: テストケースID・タイトル・説明・ステータス・優先度、作成者、前提条件数・ステップ数・期待結果数。

使用場面: テスト実行前に対象テストケースを確認したり、特定条件のテストケースを探す際に使用します。
関連ツール: get_test_caseで詳細情報（前提条件・ステップ・期待結果の内容）を取得可能。`,
  inputSchema: searchTestCaseInputSchema,
  handler: searchTestCaseHandler,
};
