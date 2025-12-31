import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
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
    origin: env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-MCP-Client-Id',
      'X-MCP-Session-Id',
      'Mcp-Session-Id',
    ],
    exposedHeaders: ['Mcp-Session-Id'],
  }));

  // ボディパーサー（MCP用にJSONを許可）
  app.use(express.json({ limit: '10mb' }));

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

  // MCPエンドポイント（POST /mcp）
  app.post('/mcp', mcpHandler);

  // MCPセッション用GETエンドポイント（SSE用）
  app.get('/mcp', mcpHandler);

  // MCPセッション終了用DELETEエンドポイント
  app.delete('/mcp', mcpHandler);

  // エラーハンドリング
  app.use(errorHandler);

  return app;
}
