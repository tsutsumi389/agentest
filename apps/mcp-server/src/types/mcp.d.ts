/**
 * MCP関連の型定義
 */

/**
 * JSON-RPCリクエストの型定義
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id?: string | number | null;
}

/**
 * JSON-RPCレスポンスの型定義
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: JsonRpcError;
  id: string | number | null;
}

/**
 * JSON-RPCエラーの型定義
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP標準エラーコード
 */
export const McpErrorCodes = {
  // JSON-RPC標準エラー
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/**
 * MCPセッション情報
 */
export interface McpSession {
  sessionId: string;
  userId: string;
  projectId: string;
  clientId: string;
  clientName?: string;
  createdAt: Date;
  lastHeartbeat: Date;
}

/**
 * MCPリクエストのコンテキスト
 * Express の req オブジェクトに追加される情報
 */
export interface McpRequestContext {
  session?: McpSession;
}
