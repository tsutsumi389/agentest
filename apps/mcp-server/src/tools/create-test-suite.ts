import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const createTestSuiteInputSchema = z.object({
  projectId: z
    .string()
    .uuid()
    .describe('テストスイートを作成するプロジェクトのID。search_projectで取得したIDを指定'),
  name: z.string().min(1).max(200).describe('テストスイート名（1-200文字）'),
  description: z
    .string()
    .max(2000)
    .optional()
    .describe('テストスイートの説明（最大2000文字）。省略可。Markdown記法対応'),
  status: z
    .enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])
    .default('DRAFT')
    .describe(
      '初期ステータス: DRAFT（下書き、デフォルト）, ACTIVE（有効）, ARCHIVED（アーカイブ済み）'
    ),
});

type CreateTestSuiteInput = z.infer<typeof createTestSuiteInputSchema>;

/**
 * レスポンス型
 */
interface CreateTestSuiteResponse {
  testSuite: {
    id: string;
    projectId: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * ハンドラー
 */
const createTestSuiteHandler: ToolHandler<CreateTestSuiteInput, CreateTestSuiteResponse> = async (
  input,
  context
) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.post<CreateTestSuiteResponse>(
    '/internal/api/test-suites',
    {
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      status: input.status,
    },
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const createTestSuiteTool: ToolDefinition<CreateTestSuiteInput> = {
  name: 'create_test_suite',
  description: `プロジェクト内に新しいテストスイートを作成します。

必須: projectId, name
オプション: description, status

返却情報: 作成されたテストスイートID・名前・説明・ステータス。

使用場面: 新しいテスト群をまとめるスイートを作成する際に使用します。作成後、create_test_caseでテストケースを追加できます。
注意: projectIdはsearch_projectで事前に取得してください。`,
  inputSchema: createTestSuiteInputSchema,
  handler: createTestSuiteHandler,
};
