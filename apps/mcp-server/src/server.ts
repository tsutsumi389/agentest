import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools/index.js';
import { registerApps } from './apps/index.js';

/**
 * MCPサーバーインスタンスを作成
 *
 * ツールの登録はtoolRegistryに登録されたツールを自動的に登録
 * MCP Appsも登録
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'agentest-mcp-server',
    version: '0.0.1',
  });

  // 登録されたツールをMCPサーバーに追加
  registerTools(server);

  // MCP Appsを登録
  registerApps(server);

  return server;
}

export type { McpServer };
