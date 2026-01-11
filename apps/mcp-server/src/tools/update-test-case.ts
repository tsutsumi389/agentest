import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient, checkLockStatus } from '../clients/api-client.js';

/**
 * 子エンティティ更新用スキーマ（idあり→更新、idなし→新規作成）
 */
const childEntityUpdateSchema = z.object({
  id: z.string().uuid().optional().describe('既存要素のID。省略すると新規追加、指定すると内容を更新'),
  content: z.string().min(1).max(10000).describe('テキスト内容（1-10000文字）'),
});

/**
 * 入力スキーマ
 */
export const updateTestCaseInputSchema = z.object({
  testCaseId: z.string().uuid().describe('更新するテストケースのID。search_test_caseまたはget_test_suiteで取得したIDを指定'),
  title: z.string().min(1).max(200).optional().describe('新しいタイトル（1-200文字）'),
  description: z.string().max(2000).nullable().optional().describe('新しい説明（最大2000文字）。nullを指定すると説明を削除'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().describe('新しい優先度: LOW, MEDIUM, HIGH, CRITICAL'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional().describe('新しいステータス: DRAFT（下書き）, ACTIVE（有効）, ARCHIVED（アーカイブ済み）'),
  preconditions: z.array(childEntityUpdateSchema).optional().describe('前提条件の配列。差分更新: idあり→内容更新、idなし→新規追加、配列に含まれないid→削除。get_test_caseで現在のIDを確認可能'),
  steps: z.array(childEntityUpdateSchema).optional().describe('テスト手順の配列。差分更新: idあり→内容更新、idなし→新規追加、配列に含まれないid→削除。get_test_caseで現在のIDを確認可能'),
  expectedResults: z.array(childEntityUpdateSchema).optional().describe('期待結果の配列。差分更新: idあり→内容更新、idなし→新規追加、配列に含まれないid→削除。get_test_caseで現在のIDを確認可能'),
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

  // 楽観的ロック確認：人間がロック中なら更新拒否
  await checkLockStatus('CASE', testCaseId);

  // MCPツール内でgroupIdを自動生成し、全カテゴリの変更を同一グループとして扱う
  const groupId = crypto.randomUUID();

  // 内部APIを呼び出し（子エンティティの差分更新含む）
  const response = await apiClient.patch<UpdateTestCaseResponse>(
    `/internal/api/test-cases/${testCaseId}`,
    { ...updateData, groupId },
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const updateTestCaseTool: ToolDefinition<UpdateTestCaseInput> = {
  name: 'update_test_case',
  description: `テストケースの情報を更新します。

必須: testCaseId
更新可能: title, description, priority, status, preconditions, steps, expectedResults（少なくとも1つ指定）

差分更新の仕組み（preconditions/steps/expectedResults）:
- {content: "新内容"} → 新規追加
- {id: "既存ID", content: "変更後"} → 内容更新
- 配列に含めなかったID → 削除

返却情報: 更新後のテストケース情報（子要素含む）。

使用場面: テストケースの内容修正、前提条件・手順・期待結果の追加・編集・削除を行う際に使用します。
注意: 更新前にget_test_caseで現在の内容とIDを確認することを推奨します。`,
  inputSchema: updateTestCaseInputSchema,
  handler: updateTestCaseHandler,
};
