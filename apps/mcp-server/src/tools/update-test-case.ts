import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 子エンティティ更新用スキーマ（idあり→更新、idなし→新規作成）
 */
const childEntityUpdateSchema = z.object({
  id: z.string().uuid().optional().describe('既存エンティティのID（省略時は新規作成）'),
  content: z.string().min(1).max(10000).describe('テキスト内容'),
});

/**
 * 入力スキーマ
 */
export const updateTestCaseInputSchema = z.object({
  testCaseId: z.string().uuid().describe('更新対象のテストケースID'),
  title: z.string().min(1).max(200).optional().describe('テストケースタイトル'),
  description: z.string().max(2000).nullable().optional().describe('説明（nullで削除）'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().describe('優先度'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional().describe('ステータス'),
  preconditions: z.array(childEntityUpdateSchema).optional().describe('前提条件の配列（差分更新: idあり→更新、idなし→追加、リクエストにないid→削除）'),
  steps: z.array(childEntityUpdateSchema).optional().describe('テスト手順の配列（差分更新: idあり→更新、idなし→追加、リクエストにないid→削除）'),
  expectedResults: z.array(childEntityUpdateSchema).optional().describe('期待結果の配列（差分更新: idあり→更新、idなし→追加、リクエストにないid→削除）'),
});

type UpdateTestCaseInput = z.infer<typeof updateTestCaseInputSchema>;

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
interface UpdateTestCaseResponse {
  testCase: {
    id: string;
    testSuiteId: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
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
const updateTestCaseHandler: ToolHandler<UpdateTestCaseInput, UpdateTestCaseResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { testCaseId, ...updateData } = input;

  // 更新フィールドが1つ以上あるか確認
  if (Object.keys(updateData).length === 0) {
    throw new Error('少なくとも1つの更新フィールドを指定してください');
  }

  // 内部APIを呼び出し（子エンティティの差分更新含む）
  const response = await apiClient.patch<UpdateTestCaseResponse>(
    `/internal/api/test-cases/${testCaseId}`,
    updateData,
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const updateTestCaseTool: ToolDefinition<UpdateTestCaseInput> = {
  name: 'update_test_case',
  description: 'テストケースを更新します。テストケースIDと更新するフィールド（title, description, priority, status, preconditions, steps, expectedResults）を指定してください。子エンティティは差分更新: idあり→更新、idなし→追加、リクエストにないid→削除されます。',
  inputSchema: updateTestCaseInputSchema,
  handler: updateTestCaseHandler,
};
