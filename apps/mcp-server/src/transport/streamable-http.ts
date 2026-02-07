import type { Request, Response, RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '../server.js';
import type { RequestContext } from '../types/context.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'streamable-http' });

/**
 * リクエストコンテキストを保持するAsyncLocalStorage
 * ツールハンドラーからユーザー情報等を取得するために使用
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * JSON-RPCリクエストの型定義
 */
interface JsonRpcRequest {
  jsonrpc?: string;
  method?: string;
  params?: unknown;
  id?: string | number | null;
}

// セッションIDをキーとしたトランスポートの管理
// TODO: Phase 2でハートビートベースのセッションタイムアウトを実装
// TODO: 複数インスタンス対応時はRedis/DBベースのセッションストアへ移行
const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * MCPセッションデータ
 * セッションIDに紐づくユーザー情報等を保持
 */
export interface McpSessionData {
  userId: string;
  agentSession?: RequestContext['agentSession'];
}

// セッションIDをキーとしたセッションデータの管理
const sessionData = new Map<string, McpSessionData>();

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
      logger.error({ err: error }, 'MCPハンドラーエラー');
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
    const data = sessionData.get(sessionId);

    // AsyncLocalStorageでコンテキストを設定してリクエストを処理
    const context: RequestContext = {
      sessionId,
      userId: data?.userId || req.user?.id || '',
      agentSession: data?.agentSession || req.agentSession,
    };

    await requestContext.run(context, async () => {
      await transport.handleRequest(req, res, req.body);
    });
    return;
  }

  // 新しいセッションを作成（初期化リクエストの場合）
  const body = req.body as JsonRpcRequest;
  if (body?.method === 'initialize') {
    const newSessionId = randomUUID();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
    });

    // トランスポートを登録
    transports.set(newSessionId, transport);

    // セッションデータを保存（ユーザー情報を保持）
    sessionData.set(newSessionId, {
      userId: req.user?.id || '',
      agentSession: req.agentSession,
    });

    // セッション終了時にクリーンアップ
    transport.onclose = () => {
      transports.delete(newSessionId);
      sessionData.delete(newSessionId);
      logger.info({ sessionId: newSessionId }, 'MCPセッション終了');
    };

    // MCPサーバーに接続
    await mcpServer.connect(transport);

    // AsyncLocalStorageでコンテキストを設定してリクエストを処理
    const context: RequestContext = {
      sessionId: newSessionId,
      userId: req.user?.id || '',
      agentSession: req.agentSession,
    };

    await requestContext.run(context, async () => {
      await transport.handleRequest(req, res, req.body);
    });
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
 * セッションデータを取得
 * @param sessionId セッションID
 * @returns セッションデータ（存在しない場合はundefined）
 */
export function getSessionData(sessionId: string): McpSessionData | undefined {
  return sessionData.get(sessionId);
}

/**
 * セッションを削除（クリーンアップ用）
 * @param sessionId 削除するセッションID
 */
export function deleteSession(sessionId: string): void {
  const transport = transports.get(sessionId);
  if (transport) {
    try {
      transport.close();
    } catch (error) {
      logger.error({ err: error, sessionId }, 'セッションのクローズエラー');
    }
  }
  transports.delete(sessionId);
  sessionData.delete(sessionId);
}

/**
 * すべてのセッションをクリーンアップ
 */
export function cleanupAllSessions(): void {
  for (const [sessionId, transport] of transports) {
    try {
      transport.close();
    } catch (error) {
      logger.error({ err: error, sessionId }, 'セッションのクリーンアップエラー');
    }
  }
  transports.clear();
  sessionData.clear();
}
