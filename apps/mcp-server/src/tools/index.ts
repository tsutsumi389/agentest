import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
import { zodToJsonSchema as zodToJsonSchemaLib } from 'zod-to-json-schema';
import type { AgentSession } from '@agentest/db';
import { requestContext } from '../transport/streamable-http.js';
import { searchProjectTool } from './search-project.js';
import { searchTestSuiteTool } from './search-test-suite.js';
import { searchTestCaseTool } from './search-test-case.js';
import { searchExecutionTool } from './search-execution.js';
import { getProjectTool } from './get-project.js';
import { getTestSuiteTool } from './get-test-suite.js';
import { getTestCaseTool } from './get-test-case.js';
import { getExecutionTool } from './get-execution.js';
import { createTestSuiteTool } from './create-test-suite.js';
import { createTestCaseTool } from './create-test-case.js';
import { createExecutionTool } from './create-execution.js';
import { updateTestSuiteTool } from './update-test-suite.js';
import { updateTestCaseTool } from './update-test-case.js';
import { updateExecutionPreconditionResultTool } from './update-execution-precondition-result.js';
import { updateExecutionStepResultTool } from './update-execution-step-result.js';
import { updateExecutionExpectedResultTool } from './update-execution-expected-result.js';
import { deleteTestSuiteTool } from './delete-test-suite.js';
import { deleteTestCaseTool } from './delete-test-case.js';
import { uploadExecutionEvidenceTool } from './upload-execution-evidence.js';

/**
 * ツール実行コンテキスト
 * ツール実行時に利用可能な情報
 */
export interface ToolContext {
  // 認証済みユーザー情報
  userId: string;
  // AgentSession情報（存在する場合）
  agentSession?: AgentSession;
  // プロジェクトID（ヘッダーから取得）
  projectId?: string;
}

/**
 * ツールハンドラーの型定義
 */
export type ToolHandler<TInput extends Record<string, unknown>, TOutput> = (
  input: TInput,
  context: ToolContext
) => Promise<TOutput>;

/**
 * ツール定義
 */
export interface ToolDefinition<TInput extends Record<string, unknown> = Record<string, unknown>> {
  // ツール名
  name: string;
  // ツールの説明
  description: string;
  // 入力スキーマ（Zodスキーマ）
  inputSchema: z.ZodType<TInput>;
  // ハンドラー
  handler: ToolHandler<TInput, unknown>;
}

/**
 * ツールレジストリ
 * 登録されたツールを管理する
 */
class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /**
   * ツールを登録
   */
  register<TInput extends Record<string, unknown>>(
    definition: ToolDefinition<TInput>
  ): void {
    if (this.tools.has(definition.name)) {
      console.warn(`ツール "${definition.name}" は既に登録されています。上書きします。`);
    }
    this.tools.set(definition.name, definition as ToolDefinition);
  }

  /**
   * 登録されたツールを取得
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * すべてのツールを取得
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * ツール数を取得
   */
  get size(): number {
    return this.tools.size;
  }
}

// シングルトンインスタンス
export const toolRegistry = new ToolRegistry();

/**
 * MCPサーバーにツールを登録
 * すべての登録済みツールをMCPサーバーに追加する
 */
export function registerTools(server: McpServer): void {
  // 検索ツールを登録
  toolRegistry.register(searchProjectTool);
  toolRegistry.register(searchTestSuiteTool);
  toolRegistry.register(searchTestCaseTool);
  toolRegistry.register(searchExecutionTool);

  // 単一取得ツールを登録
  toolRegistry.register(getProjectTool);
  toolRegistry.register(getTestSuiteTool);
  toolRegistry.register(getTestCaseTool);
  toolRegistry.register(getExecutionTool);

  // 作成ツールを登録
  toolRegistry.register(createTestSuiteTool);
  toolRegistry.register(createTestCaseTool);
  toolRegistry.register(createExecutionTool);

  // 更新ツールを登録
  toolRegistry.register(updateTestSuiteTool);
  toolRegistry.register(updateTestCaseTool);
  toolRegistry.register(updateExecutionPreconditionResultTool);
  toolRegistry.register(updateExecutionStepResultTool);
  toolRegistry.register(updateExecutionExpectedResultTool);

  // 削除ツールを登録
  toolRegistry.register(deleteTestSuiteTool);
  toolRegistry.register(deleteTestCaseTool);

  // エビデンスアップロードツールを登録
  toolRegistry.register(uploadExecutionEvidenceTool);

  const tools = toolRegistry.getAll();

  for (const tool of tools) {
    // MCPサーバーにツールを登録
    // 注: zodSchemaからJSON Schemaへの変換が必要
    server.tool(
      tool.name,
      tool.description,
      zodToJsonSchema(tool.inputSchema),
      async (args) => {
        // AsyncLocalStorageからコンテキストを取得
        const ctx = requestContext.getStore();
        const context: ToolContext = {
          userId: ctx?.userId || '',
          agentSession: ctx?.agentSession,
        };

        try {
          const result = await tool.handler(args as Record<string, unknown>, context);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          return {
            content: [
              {
                type: 'text' as const,
                text: `エラー: ${message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  console.log(`${tools.length}個のツールをMCPサーバーに登録しました`);
}

/**
 * ZodスキーマをJSON Schemaに変換
 * zod-to-json-schemaパッケージを使用して正確な変換を行う
 */
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = zodToJsonSchemaLib(schema, {
    // MCPが期待する形式に合わせる
    $refStrategy: 'none',
    // descriptionを含める
    markdownDescription: false,
  });

  // $schemaプロパティを削除（MCPが期待しない）
  const { $schema: _$schema, ...schemaWithoutMeta } = jsonSchema as Record<string, unknown>;

  return schemaWithoutMeta;
}
