import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
import type { AgentSession } from '@agentest/db';
import { requestContext } from '../transport/streamable-http.js';
import { searchProjectTool } from './search-project.js';
import { searchTestSuiteTool } from './search-test-suite.js';
import { searchTestCaseTool } from './search-test-case.js';
import { searchExecutionTool } from './search-execution.js';

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
  // ツールを登録
  toolRegistry.register(searchProjectTool);
  toolRegistry.register(searchTestSuiteTool);
  toolRegistry.register(searchTestCaseTool);
  toolRegistry.register(searchExecutionTool);

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
 * ZodスキーマをJSON Schemaに変換（簡易版）
 * 本格的な実装では zod-to-json-schema パッケージを使用推奨
 */
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // 簡易的な変換。実際の実装では zod-to-json-schema を使用
  const def = schema._def as Record<string, unknown>;

  if (!def) {
    return { type: 'object' };
  }

  const typeName = def.typeName as string | undefined;

  // ZodObjectの場合
  if ('shape' in def && typeof def.shape === 'function') {
    const shape = (def.shape as () => Record<string, z.ZodType>)();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      // isOptionalかどうかをチェック
      if (!value.isOptional()) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  // ZodStringの場合
  if (typeName === 'ZodString') {
    return { type: 'string' };
  }

  // ZodNumberの場合
  if (typeName === 'ZodNumber') {
    return { type: 'number' };
  }

  // ZodBooleanの場合
  if (typeName === 'ZodBoolean') {
    return { type: 'boolean' };
  }

  // ZodArrayの場合
  if (typeName === 'ZodArray' && 'type' in def) {
    return {
      type: 'array',
      items: zodToJsonSchema(def.type as z.ZodType),
    };
  }

  // ZodEnumの場合
  if (typeName === 'ZodEnum' && 'values' in def) {
    return {
      type: 'string',
      enum: def.values as string[],
    };
  }

  // ZodOptionalの場合
  if (typeName === 'ZodOptional' && 'innerType' in def) {
    return zodToJsonSchema(def.innerType as z.ZodType);
  }

  // ZodNullableの場合
  if (typeName === 'ZodNullable' && 'innerType' in def) {
    const innerSchema = zodToJsonSchema(def.innerType as z.ZodType);
    return {
      ...innerSchema,
      nullable: true,
    };
  }

  // ZodDefaultの場合
  if (typeName === 'ZodDefault' && 'innerType' in def) {
    const innerSchema = zodToJsonSchema(def.innerType as z.ZodType);
    const defaultValue =
      typeof def.defaultValue === 'function'
        ? (def.defaultValue as () => unknown)()
        : def.defaultValue;
    return {
      ...innerSchema,
      default: defaultValue,
    };
  }

  // デフォルト
  return { type: 'object' };
}
