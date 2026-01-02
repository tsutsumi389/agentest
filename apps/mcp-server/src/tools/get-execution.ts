import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const getExecutionInputSchema = z.object({
  executionId: z.string().uuid().describe('実行ID（必須）'),
});

type GetExecutionInput = z.infer<typeof getExecutionInputSchema>;

/**
 * エビデンス型
 */
interface ExecutionEvidence {
  id: string;
  expectedResultId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  description: string | null;
  uploadedByUserId: string;
  createdAt: string;
}

/**
 * 前提条件スナップショット型（スイート/ケース共通）
 */
interface ExecutionPreconditionSnapshot {
  id: string;
  content: string;
  orderKey: string;
  originalPreconditionId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * ステップスナップショット型
 */
interface ExecutionStepSnapshot {
  id: string;
  executionTestCaseId: string;
  originalStepId: string;
  content: string;
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 期待結果スナップショット型
 */
interface ExecutionExpectedResultSnapshot {
  id: string;
  executionTestCaseId: string;
  originalExpectedResultId: string;
  content: string;
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * テストケーススナップショット型
 */
interface ExecutionTestCaseSnapshot {
  id: string;
  executionTestSuiteId: string;
  originalTestCaseId: string;
  title: string;
  description: string | null;
  priority: string;
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 前提条件結果型
 */
interface ExecutionPreconditionResult {
  id: string;
  executionId: string;
  executionTestCaseId: string | null;
  executionSuitePreconditionId: string | null;
  executionCasePreconditionId: string | null;
  status: string;
  note: string | null;
  checkedAt: string | null;
  suitePrecondition: ExecutionPreconditionSnapshot | null;
  casePrecondition: ExecutionPreconditionSnapshot | null;
  executionTestCase: ExecutionTestCaseSnapshot | null;
}

/**
 * ステップ結果型
 */
interface ExecutionStepResult {
  id: string;
  executionId: string;
  executionTestCaseId: string;
  executionStepId: string;
  status: string;
  note: string | null;
  executedAt: string | null;
  executionStep: ExecutionStepSnapshot;
  executionTestCase: ExecutionTestCaseSnapshot;
}

/**
 * 期待結果型
 */
interface ExecutionExpectedResultData {
  id: string;
  executionId: string;
  executionTestCaseId: string;
  executionExpectedResultId: string;
  status: string;
  note: string | null;
  judgedAt: string | null;
  executionExpectedResult: ExecutionExpectedResultSnapshot;
  executionTestCase: ExecutionTestCaseSnapshot;
  evidences: ExecutionEvidence[];
}

/**
 * テストスイートスナップショット型
 */
interface ExecutionTestSuiteSnapshot {
  id: string;
  executionId: string;
  originalTestSuiteId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  preconditions: ExecutionPreconditionSnapshot[];
  testCases: Array<
    ExecutionTestCaseSnapshot & {
      preconditions: ExecutionPreconditionSnapshot[];
      steps: ExecutionStepSnapshot[];
      expectedResults: ExecutionExpectedResultSnapshot[];
    }
  >;
}

/**
 * レスポンス型
 */
interface GetExecutionResponse {
  execution: {
    id: string;
    testSuiteId: string;
    testSuite: {
      id: string;
      name: string;
      projectId: string;
    };
    status: string;
    startedAt: string;
    completedAt: string | null;
    executedByUser: {
      id: string;
      name: string | null;
      avatarUrl: string | null;
    } | null;
    environment: {
      id: string;
      name: string;
      slug: string;
    } | null;
    executionTestSuite: ExecutionTestSuiteSnapshot | null;
    preconditionResults: ExecutionPreconditionResult[];
    stepResults: ExecutionStepResult[];
    expectedResults: ExecutionExpectedResultData[];
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * ハンドラー
 */
const getExecutionHandler: ToolHandler<GetExecutionInput, GetExecutionResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.get<GetExecutionResponse>(`/internal/api/executions/${input.executionId}`, {
    userId,
  });

  return response;
};

/**
 * ツール定義
 */
export const getExecutionTool: ToolDefinition<GetExecutionInput> = {
  name: 'get_execution',
  description: 'テスト実行の詳細情報を取得します。スナップショット、各結果データ、エビデンスも含まれます。',
  inputSchema: getExecutionInputSchema,
  handler: getExecutionHandler,
};
