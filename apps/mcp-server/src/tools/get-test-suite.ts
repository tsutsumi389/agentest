import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const getTestSuiteInputSchema = z.object({
  testSuiteId: z
    .string()
    .uuid()
    .describe('取得するテストスイートのID。search_test_suiteで取得したIDを指定'),
});

type GetTestSuiteInput = z.infer<typeof getTestSuiteInputSchema>;

/**
 * 前提条件型
 */
interface TestSuitePrecondition {
  id: string;
  testSuiteId: string;
  content: string;
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * テストケースサマリー型
 */
interface TestCaseSummary {
  id: string;
  testSuiteId: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  orderKey: string;
  _count: {
    preconditions: number;
    steps: number;
    expectedResults: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * レスポンス型
 */
interface GetTestSuiteResponse {
  testSuite: {
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
      name: string | null;
      avatarUrl: string | null;
    } | null;
    preconditions: TestSuitePrecondition[];
    testCases: TestCaseSummary[];
    _count: {
      testCases: number;
      preconditions: number;
    };
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * ハンドラー
 */
const getTestSuiteHandler: ToolHandler<GetTestSuiteInput, GetTestSuiteResponse> = async (
  input,
  context
) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.get<GetTestSuiteResponse>(
    `/internal/api/test-suites/${input.testSuiteId}`,
    {
      userId,
    }
  );

  return response;
};

/**
 * ツール定義
 */
export const getTestSuiteTool: ToolDefinition<GetTestSuiteInput> = {
  name: 'get_test_suite',
  description: `テストスイートの詳細情報を取得します。

返却情報: テストスイートID・名前・説明・ステータス、所属プロジェクト、作成者、スイートレベルの前提条件一覧、テストケース一覧（ID・タイトル・優先度・各要素数）。

使用場面: テストスイートの内容を確認したり、テスト実行前に前提条件を確認する際に使用します。
関連ツール: search_test_caseでテストケースを検索、get_test_caseで個別テストケースの詳細を取得。`,
  inputSchema: getTestSuiteInputSchema,
  handler: getTestSuiteHandler,
};
