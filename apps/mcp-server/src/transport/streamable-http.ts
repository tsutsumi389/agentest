import type { Request, Response, RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '../server.js';
import type { RequestContext } from '../types/context.js';
import { logger as baseLogger } from '../utils/logger.js';
import { getMachineId, isInstanceAlive } from '../lib/server-instance.js';
import {
  saveSession as saveSessionToStore,
  getSession,
  deleteSession as deleteSessionFromStore,
  refreshSessionTtl,
} from '../lib/session-store.js';

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
// StreamableHTTPServerTransportはシリアライズ不可のためインメモリ管理が必須
// セッションメタデータ（ルーティング情報）はRedisのsession-storeに別途保存
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

    // RedisセッションTTLを延長（ベストエフォート、レスポンスをブロックしない）
    void refreshSessionTtl(sessionId);

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

    // 再初期化（前回セッションIDヘッダー付き）の場合はログ記録
    logReinitialize(sessionId, newSessionId);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
    });

    // トランスポートを登録
    transports.set(newSessionId, transport);

    // セッションデータを保存（ユーザー情報を保持）
    const userId = req.user?.id || '';
    sessionData.set(newSessionId, {
      userId,
      agentSession: req.agentSession,
    });

    // Redisにセッションメタデータを保存
    await saveSessionToStore(newSessionId, { userId });

    // セッション終了時にクリーンアップ
    transport.onclose = () => {
      transports.delete(newSessionId);
      sessionData.delete(newSessionId);
      // Redisからも削除（ベストエフォート、エラーは内部でハンドル）
      void deleteSessionFromStore(newSessionId);
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

  // セッションIDがない、または無効な場合 → 原因を判定して詳細なエラーを返す
  await resolveSessionError(sessionId, body, res);
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
 * 再初期化時のログを記録
 * initializeリクエストで前回セッションIDが付いている場合に呼び出す
 */
export function logReinitialize(
  oldSessionId: string | undefined,
  newSessionId: string,
): void {
  if (oldSessionId) {
    logger.info(
      { oldSessionId, newSessionId },
      'クライアントが再初期化しました（前回セッションから復帰）',
    );
  }
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
 * セッション不在時のエラー原因を判定して適切なレスポンスを返す
 */
export async function resolveSessionError(
  sessionId: string | undefined,
  body: JsonRpcRequest | null,
  res: Response,
): Promise<void> {
  let reason = 'session_not_found';
  let message = 'セッションが見つかりません。initializeリクエストから開始してください。';

  if (sessionId) {
    const stored = await getSession(sessionId);
    if (stored) {
      if (stored.machineId === getMachineId()) {
        // 同じマシンだがインメモリにない → プロセス再起動（開発環境のhot reload等）
        reason = 'server_restarted';
        message = 'セッションが無効です。サーバーが再起動されたため、再初期化してください。';
      } else if (await isInstanceAlive(stored.instanceId)) {
        // 別マシンのインスタンスが生きている → ルーティングミス
        reason = 'wrong_instance';
        message = 'セッションは別のインスタンスに存在します。再初期化してください。';
      } else {
        // 別マシンのインスタンスが死んでいる → スケールイン
        reason = 'instance_terminated';
        message = 'セッションを保持していたインスタンスが停止しました。再初期化してください。';
      }
      // 使えないセッションをRedisから削除
      await deleteSessionFromStore(sessionId);
    }
  }

  res.status(400).json({
    jsonrpc: '2.0',
    error: {
      code: -32600,
      message,
      data: { reason, reinitialize: true },
    },
    id: body?.id ?? null,
  });
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
  // Redisからも削除（ベストエフォート）
  void deleteSessionFromStore(sessionId);
}

/**
 * すべてのセッションをクリーンアップ
 * シャットダウン時はRedis削除を待つ
 */
export async function cleanupAllSessions(): Promise<void> {
  const deletePromises: Promise<void>[] = [];
  for (const [sessionId, transport] of transports) {
    try {
      transport.close();
    } catch (error) {
      logger.error({ err: error, sessionId }, 'セッションのクリーンアップエラー');
    }
    deletePromises.push(deleteSessionFromStore(sessionId));
  }
  await Promise.allSettled(deletePromises);
  transports.clear();
  sessionData.clear();
}
