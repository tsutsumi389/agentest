import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { mcpAuthenticate } from './middleware/mcp-auth.middleware.js';
import { agentSession, recordHeartbeat } from './middleware/agent-session.middleware.js';
import { createMcpHandler } from './transport/streamable-http.js';
import { createMcpServer } from './server.js';

/**
 * Expressアプリケーションを作成・設定
 */
export function createApp(): Express {
  const app = express();

  // セキュリティミドルウェア
  app.use(helmet({
    contentSecurityPolicy: false, // MCP通信では不要
  }));

  // CORS設定
  app.use(cors({
    origin: env.CORS_ORIGIN.split(',').filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-MCP-Client-Id',
      'X-MCP-Client-Name',
      'X-MCP-Project-Id',
      'X-MCP-Session-Id',
      'Mcp-Session-Id',
    ],
    exposedHeaders: ['Mcp-Session-Id'],
  }));

  // ボディパーサー（MCP用途では1MBで十分）
  app.use(express.json({ limit: '1mb' }));

  // クッキーパーサー
  app.use(cookieParser());

  // ヘルスチェック
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'mcp-server' });
  });

  // MCPサーバーインスタンスを作成
  const mcpServer = createMcpServer();

  // MCPハンドラーを作成
  const mcpHandler = createMcpHandler(mcpServer);

  // Agentセッションミドルウェア
  // プロジェクトIDはヘッダーから取得（initializeリクエストでは不要なためrequired: false）
  const agentSessionMiddleware = agentSession({
    getProjectId: (req) => req.headers['x-mcp-project-id'] as string | null,
    required: false,
  });

  // MCPエンドポイント（認証 → セッション管理 → ハートビート → ハンドラー）
  // POST /mcp: メインのMCPリクエスト
  app.post('/mcp', mcpAuthenticate(), agentSessionMiddleware, recordHeartbeat(), mcpHandler);

  // GET /mcp: MCPセッション用SSEエンドポイント
  app.get('/mcp', mcpAuthenticate(), agentSessionMiddleware, recordHeartbeat(), mcpHandler);

  // DELETE /mcp: MCPセッション終了
  app.delete('/mcp', mcpAuthenticate(), agentSessionMiddleware, mcpHandler);

  // エラーハンドリング
  app.use(errorHandler);

  return app;
}
