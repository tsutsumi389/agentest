import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { mcpAuthenticate } from './middleware/mcp-auth.middleware.js';
import { mcpHybridAuthenticate } from './middleware/oauth-auth.middleware.js';
import { agentSession, recordHeartbeat } from './middleware/agent-session.middleware.js';
import { createMcpHandler } from './transport/streamable-http.js';
import { createMcpServer } from './server.js';
import oauthMetadataRoutes from './routes/oauth-metadata.js';

/**
 * Expressアプリケーションを作成・設定
 */
export function createApp(): Express {
  const app = express();

  // セキュリティミドルウェア
  app.use(helmet({
    contentSecurityPolicy: false, // MCP通信では不要
  }));

  // CORS設定（MCP Inspectorなどのクライアントからのアクセスを許可）
  app.use(cors({
    origin: env.CORS_ORIGIN.split(',').filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    // MCP Inspectorは多くのカスタムヘッダーを使用するため、リクエストのヘッダーを反映
    allowedHeaders: '*',
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

  // OAuth 2.1 Protected Resource Metadata (RFC 9728)
  app.use(oauthMetadataRoutes);

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

  // ハイブリッド認証ミドルウェア（OAuth Bearer Token優先、Cookie認証フォールバック）
  const hybridAuthMiddleware = mcpHybridAuthenticate(mcpAuthenticate());

  // MCPエンドポイント（認証 → セッション管理 → ハートビート → ハンドラー）
  // POST /mcp: メインのMCPリクエスト
  app.post('/mcp', hybridAuthMiddleware, agentSessionMiddleware, recordHeartbeat(), mcpHandler);

  // GET /mcp: MCPセッション用SSEエンドポイント
  app.get('/mcp', hybridAuthMiddleware, agentSessionMiddleware, recordHeartbeat(), mcpHandler);

  // DELETE /mcp: MCPセッション終了
  app.delete('/mcp', hybridAuthMiddleware, agentSessionMiddleware, mcpHandler);

  // エラーハンドリング
  app.use(errorHandler);

  return app;
}
