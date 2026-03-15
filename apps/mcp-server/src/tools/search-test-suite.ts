import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const searchTestSuiteInputSchema = z.object({
  projectId: z
    .string()
    .uuid()
    .optional()
    .describe(
      '特定プロジェクト内のテストスイートに絞り込む場合に指定。search_projectで取得したIDを使用'
    ),
  q: z
    .string()
    .max(100)
    .optional()
    .describe('テストスイート名で部分一致検索。省略時は全テストスイートを取得'),
  status: z
    .enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])
    .optional()
    .describe('ステータスで絞り込み: DRAFT（下書き）, ACTIVE（有効）, ARCHIVED（アーカイブ済み）'),
  limit: z.number().int().min(1).max(50).default(20).describe('取得件数（1-50、デフォルト: 20）'),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('ページネーション用オフセット（デフォルト: 0）'),
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
  description: `ユーザーがアクセス可能なテストスイート一覧を検索します。

返却情報: テストスイートID・名前・説明・ステータス、所属プロジェクト、作成者、テストケース数・前提条件数。

使用場面: テストケースの作成・検索や、テスト実行を開始する前に、対象テストスイートのIDを取得するために使用します。
関連ツール: get_test_suiteで詳細情報（前提条件リスト等）を取得可能。`,
  inputSchema: searchTestSuiteInputSchema,
  handler: searchTestSuiteHandler,
};
