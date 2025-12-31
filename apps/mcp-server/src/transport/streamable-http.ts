import type { Request, Response, RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '../server.js';

// セッションIDをキーとしたトランスポートの管理
const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * MCPリクエストを処理するExpressハンドラーを作成
 *
 * @param mcpServer - MCPサーバーインスタンス
 * @returns Expressリクエストハンドラー
 */
export function createMcpHandler(mcpServer: McpServer): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // セッションIDの取得（mcp-session-id ヘッダーから）
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (req.method === 'POST') {
        await handlePost(req, res, mcpServer, sessionId);
      } else if (req.method === 'GET') {
        await handleGet(req, res, sessionId);
      } else if (req.method === 'DELETE') {
        await handleDelete(req, res, sessionId);
      } else {
        res.status(405).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Method not allowed' },
          id: null,
        });
      }
    } catch (error) {
      console.error('MCPハンドラーエラー:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  };
}

/**
 * POSTリクエストを処理（メインのMCPリクエスト）
 */
async function handlePost(
  req: Request,
  res: Response,
  mcpServer: McpServer,
  sessionId: string | undefined
): Promise<void> {
  // 既存セッションがある場合は再利用
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // 新しいセッションを作成（初期化リクエストの場合）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = req.body as any;
  if (body?.method === 'initialize') {
    const newSessionId = randomUUID();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
    });

    // トランスポートを登録
    transports.set(newSessionId, transport);

    // セッション終了時にクリーンアップ
    transport.onclose = () => {
      transports.delete(newSessionId);
      console.log(`MCPセッション終了: ${newSessionId}`);
    };

    // MCPサーバーに接続
    await mcpServer.connect(transport);

    // リクエストを処理
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // セッションIDがない、または無効な場合
  res.status(400).json({
    jsonrpc: '2.0',
    error: {
      code: -32600,
      message: 'セッションが見つかりません。initializeリクエストから開始してください。',
    },
    id: body?.id ?? null,
  });
}

/**
 * GETリクエストを処理（SSEストリーム用）
 */
async function handleGet(
  req: Request,
  res: Response,
  sessionId: string | undefined
): Promise<void> {
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'セッションが見つかりません' },
      id: null,
    });
    return;
  }

  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
}

/**
 * DELETEリクエストを処理（セッション終了用）
 */
async function handleDelete(
  req: Request,
  res: Response,
  sessionId: string | undefined
): Promise<void> {
  if (!sessionId || !transports.has(sessionId)) {
    res.status(404).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'セッションが見つかりません' },
      id: null,
    });
    return;
  }

  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
}

/**
 * アクティブなセッション数を取得
 */
export function getActiveSessionCount(): number {
  return transports.size;
}

/**
 * すべてのセッションをクリーンアップ
 */
export function cleanupAllSessions(): void {
  for (const [sessionId, transport] of transports) {
    try {
      transport.close();
    } catch (error) {
      console.error(`セッション ${sessionId} のクリーンアップエラー:`, error);
    }
  }
  transports.clear();
}
