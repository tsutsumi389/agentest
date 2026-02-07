import type { Request, Response, NextFunction } from 'express';
import type { AgentSession } from '@agentest/db';
import { BadRequestError, AuthorizationError } from '@agentest/shared';
import { agentSessionService } from '../services/agent-session.service.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'agent-session' });

/**
 * MCPクライアント情報
 */
export interface McpClientInfo {
  clientId: string;
  clientName?: string;
}

/**
 * Agentセッションミドルウェアのオプション
 */
export interface AgentSessionOptions {
  // プロジェクトIDの取得方法
  getProjectId: (req: Request) => string | null;
  // セッション作成が必須かどうか
  required?: boolean;
}

/**
 * MCPヘッダーからクライアント情報を抽出
 */
function extractClientInfo(req: Request): McpClientInfo | null {
  const clientId = req.headers['x-mcp-client-id'] as string | undefined;

  if (!clientId) {
    return null;
  }

  const clientName = req.headers['x-mcp-client-name'] as string | undefined;

  return {
    clientId,
    clientName,
  };
}

/**
 * Agentセッションミドルウェア
 *
 * MCPクライアントからのリクエストに対してAgentSessionを管理
 * - X-MCP-Client-Id: クライアント識別子（必須）
 * - X-MCP-Client-Name: クライアント名（オプション）
 *
 * @param options ミドルウェアオプション
 */
export function agentSession(options: AgentSessionOptions) {
  const { getProjectId, required = true } = options;

  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // クライアント情報を抽出
      const clientInfo = extractClientInfo(req);

      if (!clientInfo) {
        if (required) {
          throw new BadRequestError('X-MCP-Client-Id ヘッダーが必要です');
        }
        return next();
      }

      // ユーザー認証済みか確認
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      // プロジェクトIDを取得
      const projectId = getProjectId(req);
      if (!projectId) {
        if (required) {
          throw new BadRequestError('プロジェクトIDが必要です');
        }
        return next();
      }

      // セッションを取得または作成
      const { session, isNew } = await agentSessionService.getOrCreateSession({
        projectId,
        clientId: clientInfo.clientId,
        clientName: clientInfo.clientName,
      });

      if (isNew) {
        logger.info(
          { sessionId: session.id, clientId: clientInfo.clientId },
          '新しいAgentセッションを作成'
        );
      }

      // リクエストにセッションを設定
      req.agentSession = session;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * セッションのハートビートを記録するミドルウェア
 * リクエストごとにハートビートを更新
 */
export function recordHeartbeat() {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (req.agentSession) {
        await agentSessionService.recordHeartbeat(req.agentSession.id);
      }
      next();
    } catch (error) {
      // ハートビート更新失敗は致命的ではないのでログのみ
      logger.error({ err: error }, 'ハートビート更新エラー');
      next();
    }
  };
}

// Express Requestの拡張
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      agentSession?: AgentSession;
    }
  }
}
