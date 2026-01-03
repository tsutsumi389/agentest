import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 子エンティティ作成用スキーマ
 */
const childEntitySchema = z.object({
  content: z.string().min(1).max(10000).describe('テキスト内容（1-10000文字）'),
});

/**
 * 入力スキーマ
 */
export const createTestCaseInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('テストケースを作成するテストスイートのID。search_test_suiteで取得したIDを指定'),
  title: z.string().min(1).max(200).describe('テストケースのタイトル（1-200文字）'),
  description: z.string().max(2000).optional().describe('テストケースの説明（最大2000文字）。省略可'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM').describe('優先度: LOW, MEDIUM（デフォルト）, HIGH, CRITICAL'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT').describe('初期ステータス: DRAFT（下書き、デフォルト）, ACTIVE（有効）, ARCHIVED（アーカイブ済み）'),
  preconditions: z.array(childEntitySchema).optional().describe('前提条件の配列。各要素は{content: "条件内容"}形式。テスト実行前に満たすべき条件を記述'),
  steps: z.array(childEntitySchema).optional().describe('テスト手順の配列。各要素は{content: "手順内容"}形式。実行すべき操作を順番に記述'),
  expectedResults: z.array(childEntitySchema).optional().describe('期待結果の配列。各要素は{content: "期待結果内容"}形式。各手順後に確認すべき結果を記述'),
});

type CreateTestCaseInput = z.infer<typeof createTestCaseInputSchema>;

/**
 * 子エンティティ型
 */
interface ChildEntity {
  id: string;
  content: string;
  orderKey: string;
}

/**
 * レスポンス型
 */
interface CreateTestCaseResponse {
  testCase: {
    id: string;
    testSuiteId: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    orderKey: string;
    createdAt: string;
    updatedAt: string;
    preconditions?: ChildEntity[];
    steps?: ChildEntity[];
    expectedResults?: ChildEntity[];
  };
}

/**
 * ハンドラー
 */
const createTestCaseHandler: ToolHandler<CreateTestCaseInput, CreateTestCaseResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し（子エンティティ含む）
  const response = await apiClient.post<CreateTestCaseResponse>(
    '/internal/api/test-cases',
    {
      testSuiteId: input.testSuiteId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: input.status,
      preconditions: input.preconditions,
      steps: input.steps,
      expectedResults: input.expectedResults,
    },
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const createTestCaseTool: ToolDefinition<CreateTestCaseInput> = {
  name: 'create_test_case',
  description: `テストスイート内に新しいテストケースを作成します。

必須: testSuiteId, title
オプション: description, priority, status, preconditions, steps, expectedResults

返却情報: 作成されたテストケースID、登録された前提条件・ステップ・期待結果一覧（各要素のID含む）。

使用場面: 新しいテストケースを追加する際に使用します。前提条件・手順・期待結果は作成時に一括登録するか、後からupdate_test_caseで追加できます。
注意: testSuiteIdはsearch_test_suiteで事前に取得してください。`,
  inputSchema: createTestCaseInputSchema,
  handler: createTestCaseHandler,
};
