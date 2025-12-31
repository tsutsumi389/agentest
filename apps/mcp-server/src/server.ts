import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * MCPサーバーインスタンスを作成
 *
 * ツールの登録は別タスク（Phase 2以降）で実装
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'agentest-mcp-server',
    version: '0.0.1',
  });

  // ツール登録は src/tools/index.ts で別途実装予定
  // registerTools(server);

  return server;
}

export type { McpServer };
