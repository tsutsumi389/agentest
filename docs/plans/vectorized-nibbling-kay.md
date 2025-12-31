# MCP サーバー基盤 実装計画

## 概要

Agentest の MCPサーバー基盤を実装し、Coding Agent（Claude Code等）からテスト管理ツールを利用可能にする。

**注意**: 本計画ではMCPサーバーの基盤部分のみを実装する。MCPツールは別タスクで作成する。

## 技術仕様

| 項目 | 仕様 |
|------|------|
| トランスポート | Streamable HTTP + SSE |
| エンドポイント | `POST /mcp` |
| 認証 | OAuth認証共有（HttpOnly Cookie） |
| 認可 | プロジェクト権限を継承 |
| SDK | `@modelcontextprotocol/sdk` |

## ディレクトリ構造

```
apps/mcp-server/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                      # エントリーポイント
│   ├── app.ts                        # Express アプリ設定
│   ├── server.ts                     # MCP サーバー定義
│   ├── config/
│   │   └── env.ts                    # 環境変数設定
│   ├── transport/
│   │   └── streamable-http.ts        # Streamable HTTP トランスポート
│   ├── middleware/
│   │   ├── mcp-auth.middleware.ts    # MCP 用認証
│   │   ├── agent-session.middleware.ts # Agent セッション管理
│   │   └── error-handler.ts          # エラーハンドリング
│   ├── tools/                        # MCP ツール定義（別タスクで実装）
│   │   └── index.ts                  # ツール登録基盤のみ
│   ├── services/
│   │   ├── agent-session.service.ts
│   │   └── heartbeat.service.ts
│   ├── repositories/
│   │   └── agent-session.repository.ts
│   ├── types/
│   │   └── mcp.d.ts
│   └── __tests__/
│       ├── unit/
│       └── integration/
```

---

## 実装フェーズ

### Phase 1: 基盤構築

**目標**: MCP サーバーの基本構造を作成し、POST /mcp でリクエストを受け付けられる状態にする

| # | タスク | ファイル |
|---|--------|----------|
| 1.1 | package.json 作成 | `apps/mcp-server/package.json` |
| 1.2 | tsconfig.json 作成 | `apps/mcp-server/tsconfig.json` |
| 1.3 | 環境変数設定 | `src/config/env.ts` |
| 1.4 | Express アプリ設定 | `src/app.ts` |
| 1.5 | MCP サーバー初期化 | `src/server.ts` |
| 1.6 | Streamable HTTP トランスポート | `src/transport/streamable-http.ts` |
| 1.7 | エントリーポイント | `src/index.ts` |

**依存パッケージ**:
```json
{
  "dependencies": {
    "@agentest/auth": "workspace:*",
    "@agentest/db": "workspace:*",
    "@agentest/shared": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.10.0",
    "cookie-parser": "catalog:",
    "cors": "catalog:",
    "express": "catalog:",
    "helmet": "catalog:",
    "zod": "catalog:"
  }
}
```

### Phase 2: 認証・セッション管理

**目標**: Cookie ベースの認証と AgentSession によるセッション管理を実装

| # | タスク | ファイル |
|---|--------|----------|
| 2.1 | MCP 認証ミドルウェア | `src/middleware/mcp-auth.middleware.ts` |
| 2.2 | Agent セッションミドルウェア | `src/middleware/agent-session.middleware.ts` |
| 2.3 | AgentSession リポジトリ | `src/repositories/agent-session.repository.ts` |
| 2.4 | AgentSession サービス | `src/services/agent-session.service.ts` |
| 2.5 | ハートビートサービス | `src/services/heartbeat.service.ts` |
| 2.6 | エラーハンドラー | `src/middleware/error-handler.ts` |

**認証フロー**:
1. Cookie から access_token を抽出
2. `@agentest/auth` の `verifyAccessToken` で JWT 検証
3. X-MCP-Client-Id ヘッダーから Agent 識別情報取得
4. AgentSession 作成/更新
5. req.agentSession にセッション情報を設定

**セッション管理**:
- ハートビート間隔: 30秒
- セッションタイムアウト: 無操作30分
- ハートビートタイムアウト: 途絶60秒後に TIMEOUT

### Phase 3: テスト・統合

**目標**: ユニットテストと結合テストを作成し、Docker 設定を更新

| # | タスク | ファイル |
|---|--------|----------|
| 3.1 | vitest 設定 | `vitest.config.ts` |
| 3.2 | ミドルウェアユニットテスト | `src/__tests__/unit/middleware/` |
| 3.3 | サービスユニットテスト | `src/__tests__/unit/services/` |
| 3.4 | 結合テスト（認証・セッション） | `src/__tests__/integration/` |
| 3.5 | Docker Compose 更新 | `docker/docker-compose.yml` |
| 3.6 | ツール登録基盤 | `src/tools/index.ts` |

---

## 重要な実装ポイント

### 認証ミドルウェア（参照: `packages/auth/src/middleware.ts`）

```typescript
// MCP 用に拡張
export function mcpAuthenticate() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Cookie から access_token 抽出
    const token = req.cookies?.access_token;

    // 2. JWT 検証（既存の verifyAccessToken を使用）
    const payload = verifyAccessToken(token, config);

    // 3. Agent 識別ヘッダー取得
    const clientId = req.headers['x-mcp-client-id'];
    const sessionId = req.headers['x-mcp-session-id'];

    // 4. AgentSession 処理
    // ...
  };
}
```

### Express アプリ設定（参照: `apps/api/src/app.ts`）

```typescript
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(cookieParser());

  // MCP エンドポイント
  app.post('/mcp', mcpAuthenticate(), mcpHandler);

  app.use(errorHandler);
  return app;
}
```

### AgentSession モデル（参照: `packages/db/prisma/schema.prisma:752-780`）

```prisma
model AgentSession {
  id            String             @id @default(uuid())
  projectId     String             @map("project_id")
  clientId      String             @map("client_id")
  clientName    String?            @map("client_name")
  status        AgentSessionStatus @default(ACTIVE)
  startedAt     DateTime           @default(now())
  lastHeartbeat DateTime           @default(now())
  endedAt       DateTime?
  // ... リレーション
}
```

---

## クリティカルファイル

| ファイル | 参照目的 |
|----------|----------|
| `packages/auth/src/middleware.ts` | 認証ミドルウェアパターン |
| `apps/api/src/app.ts` | Express アプリ設定パターン |
| `apps/api/src/services/test-suite.service.ts` | サービス層パターン |
| `packages/db/prisma/schema.prisma` | AgentSession モデル定義 |
| `packages/shared/src/errors/index.ts` | エラークラス |

---

## Docker 設定

```yaml
# docker/docker-compose.yml に追加
mcp-server:
  build:
    context: ..
    dockerfile: docker/Dockerfile.dev
  command: pnpm --filter @agentest/mcp-server dev
  ports:
    - "3002:3002"
  environment:
    - DATABASE_URL=postgresql://postgres:postgres@db:5432/agentest
    - JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
    - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    - CORS_ORIGIN=http://localhost:5173
  depends_on:
    - db
```
