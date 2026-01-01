# search_project MCPツール 実装計画

## 概要
MCPツール「search_project」を実装し、AIエージェントがアクセス可能なプロジェクト一覧を検索できるようにする。

**設計方針**: MCPサーバーはAPI側への橋渡しのみ。ビジネスロジックはAPI側に持たせる。

---

## アーキテクチャ

```
[MCPクライアント] → [MCPサーバー] → [APIサーバー(内部API)] → [DB]
                       ↑                    ↑
                  橋渡しのみ          認証不要（Docker内部）
```

**方式**: 内部API呼び出し（`/internal/api/...`）

---

## 実装ファイル

### API側

```
apps/api/src/
├── config/
│   └── env.ts                       # 環境変数追加（修正）
├── routes/
│   ├── index.ts                     # ルート登録（修正）
│   └── internal.ts                  # 内部APIルート（新規）
└── middleware/
    └── internal-api.middleware.ts   # 内部API認証（新規）
```

### MCP側

```
apps/mcp-server/src/
├── config/
│   └── env.ts                       # 環境変数追加（修正）
├── clients/
│   └── api-client.ts                # 内部APIクライアント（新規）
├── types/
│   └── context.ts                   # リクエストコンテキスト型定義（新規）
├── transport/
│   └── streamable-http.ts           # AsyncLocalStorage追加（修正）
└── tools/
    ├── index.ts                     # ツール登録修正（修正）
    └── search-project.ts            # MCPツール（新規・単一ファイル）
```

### インフラ

```
docker/
└── docker-compose.yml               # INTERNAL_API_SECRET追加（修正）
```

---

## Step 1: 内部APIエンドポイント作成

### 1.1 内部API認証ミドルウェア（共有シークレット方式）

**ファイル**: `apps/api/src/middleware/internal-api.middleware.ts`

```typescript
import { env } from '../config/env.js';

/**
 * 内部API認証ミドルウェア
 * 共有シークレットトークンで認証を行う
 */
export function requireInternalApiAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['x-internal-api-key'];

    if (!authHeader || authHeader !== env.INTERNAL_API_SECRET) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or missing internal API key',
      });
      return;
    }

    next();
  };
}
```

**環境変数の追加**:

```bash
# .env.example, docker-compose.yml
# シークレットの生成: openssl rand -hex 32
INTERNAL_API_SECRET=<ランダムな32文字以上の文字列>
```

**設定ファイル修正**: `apps/api/src/config/env.ts`

```typescript
// 環境変数にINTERNAL_API_SECRETを追加
INTERNAL_API_SECRET: z.string().min(32),
```

### 1.2 内部APIルート（単一ファイル）

**ファイル**: `apps/api/src/routes/internal.ts`

```typescript
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireInternalApiAuth } from '../middleware/internal-api.middleware.js';
import { userService } from '../services/user.service.js';

const router = Router();

// 全エンドポイントに内部API認証を適用
router.use(requireInternalApiAuth());

/**
 * クエリパラメータのスキーマ
 */
const getUserProjectsQuerySchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /internal/api/users/:userId/projects
 * ユーザーがアクセス可能なプロジェクト一覧を取得
 */
router.get('/users/:userId/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const parseResult = getUserProjectsQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const query = parseResult.data;
    const projects = await userService.getProjects(userId, query);
    const total = await userService.countProjects(userId, query);

    res.json({
      projects,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + projects.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
```

### 1.3 ルート登録

**ファイル**: `apps/api/src/routes/index.ts`

```typescript
import internalRoutes from './internal.js';

// 内部API（MCPサーバーからの呼び出し用）
router.use('/internal/api', internalRoutes);
```

---

## Step 2: APIクライアント作成

**ファイル**: `apps/mcp-server/src/clients/api-client.ts`

```typescript
import { env } from '../config/env.js';

/**
 * 内部APIクライアント
 * 共有シークレットを使用してAPIサーバーと通信
 */
export class InternalApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    // Docker内部ネットワーク経由（デフォルト値はZodスキーマで設定）
    this.baseUrl = env.API_INTERNAL_URL;
    this.apiKey = env.INTERNAL_API_SECRET;
  }

  /**
   * GETリクエストを送信
   */
  async get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) url.searchParams.set(k, v);
      });
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Internal-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(`Internal API error: ${res.status} - ${error.message || 'Unknown error'}`);
    }

    return res.json();
  }
}

export const apiClient = new InternalApiClient();
```

**環境変数の追加**: `apps/mcp-server/src/config/env.ts`

```typescript
// 既存の環境変数に追加
API_INTERNAL_URL: z.string().url().default('http://api:3000'),
INTERNAL_API_SECRET: z.string().min(32),
```

---

## Step 3-5: MCPツール実装（単一ファイル）

**ファイル**: `apps/mcp-server/src/tools/search-project.ts`

```typescript
import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const searchProjectInputSchema = z.object({
  q: z.string().max(100).optional().describe('プロジェクト名で検索'),
  limit: z.number().int().min(1).max(50).default(50).describe('取得件数'),
  offset: z.number().int().min(0).default(0).describe('オフセット'),
});

type SearchProjectInput = z.infer<typeof searchProjectInputSchema>;

/**
 * レスポンス型
 */
interface SearchProjectResponse {
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    organizationId: string | null;
    role: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * ハンドラー
 */
const searchProjectHandler: ToolHandler<SearchProjectInput, SearchProjectResponse> = async (
  input,
  context
) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.get<SearchProjectResponse>(
    `/internal/api/users/${userId}/projects`,
    {
      q: input.q,
      limit: String(input.limit),
      offset: String(input.offset),
    }
  );

  return response;
};

/**
 * ツール定義
 */
export const searchProjectTool: ToolDefinition<SearchProjectInput> = {
  name: 'search_project',
  description: 'アクセス可能なプロジェクト一覧を検索します。',
  inputSchema: searchProjectInputSchema,
  handler: searchProjectHandler,
};
```

**ファイル**: `apps/mcp-server/src/tools/index.ts` （修正）

```typescript
import { searchProjectTool } from './search-project.js';

// registerTools関数内でツールを登録
export function registerTools(server: McpServer): void {
  // search_projectツールを登録
  toolRegistry.register(searchProjectTool);

  // 以下、既存のツール登録処理...
}
```

---

## Step 6: ToolContextへのuserIdの伝達

### 現状の調査結果

1. **認証ミドルウェア** (`mcp-auth.middleware.ts`): `req.user` を設定している ✅
2. **セッション管理** (`streamable-http.ts`): `transports` Map に `transport` のみ保存
3. **問題点**: `registerTools` 内の `server.tool()` コールバックから `req.user` にアクセスできない

### 6.1 セッションデータの拡張

**ファイル**: `apps/mcp-server/src/transport/streamable-http.ts`

```typescript
import type { AgentSession } from '@agentest/db';

/**
 * セッションデータの型定義
 */
interface McpSessionData {
  transport: StreamableHTTPServerTransport;
  userId: string;
  agentSession?: AgentSession;
}

// セッションIDをキーとしたセッションデータの管理
const sessions = new Map<string, McpSessionData>();

// handlePost内（initializeリクエスト時）
if (body?.method === 'initialize') {
  const newSessionId = randomUUID();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => newSessionId,
  });

  // ユーザー情報も含めてセッションデータを保存
  sessions.set(newSessionId, {
    transport,
    userId: req.user?.id || '',
    agentSession: req.agentSession,
  });

  // ... 既存のコード
}

/**
 * セッションデータを取得（ツールレジストリから参照用）
 */
export function getSessionData(sessionId: string): McpSessionData | undefined {
  return sessions.get(sessionId);
}

/**
 * セッションを削除（クリーンアップ用）
 */
export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

// transportのcloseイベントでセッションを削除
transport.on('close', () => {
  deleteSession(sessionId);
});
```

### 6.2 ツールハンドラーへのコンテキスト伝達

**課題**: MCP SDKの `server.tool()` は `sessionId` を直接提供しない

**解決策A**: MCP SDKの拡張（推奨）
```typescript
// server.tool()の第4引数でextra contextを受け取れるか確認
// @modelcontextprotocol/sdk のソースを調査する必要あり
```

**解決策B**: AsyncLocalStorageを使用

**型定義ファイル**: `apps/mcp-server/src/types/context.ts`（新規）
```typescript
import type { AgentSession } from '@agentest/db';

/**
 * リクエストコンテキストの型定義
 * AsyncLocalStorageとToolContextで共有
 */
export interface RequestContext {
  sessionId: string;
  userId: string;
  agentSession?: AgentSession;
}
```

**実装**: `apps/mcp-server/src/transport/streamable-http.ts`
```typescript
import { AsyncLocalStorage } from 'async_hooks';
import type { RequestContext } from '../types/context.js';

// リクエストコンテキストを保持
export const requestContext = new AsyncLocalStorage<RequestContext>();

// handlePost内でコンテキストを設定
await requestContext.run(
  { sessionId, userId: req.user?.id || '', agentSession: req.agentSession },
  async () => {
    await transport.handleRequest(req, res, req.body);
  }
);

// registerTools内でコンテキストを取得
server.tool(tool.name, tool.description, schema, async (args) => {
  const ctx = requestContext.getStore();
  const context: ToolContext = {
    userId: ctx?.userId || '',
    agentSession: ctx?.agentSession,
  };
  // ...
});
```

### 6.3 実装方針

1. まず **解決策B（AsyncLocalStorage）** で実装
2. MCP SDKの将来バージョンでコンテキスト伝達がサポートされれば移行

---

## 重要ファイル

| ファイル | 役割 | 種別 |
|---------|------|------|
| `apps/api/src/routes/internal.ts` | 内部APIルート | 新規 |
| `apps/api/src/middleware/internal-api.middleware.ts` | 内部API認証（共有シークレット） | 新規 |
| `apps/api/src/config/env.ts` | 環境変数に`INTERNAL_API_SECRET`追加 | 修正 |
| `apps/mcp-server/src/clients/api-client.ts` | 内部APIクライアント | 新規 |
| `apps/mcp-server/src/config/env.ts` | 環境変数追加 | 修正 |
| `apps/mcp-server/src/types/context.ts` | リクエストコンテキスト型定義 | 新規 |
| `apps/mcp-server/src/tools/search-project.ts` | MCPツール実装 | 新規 |
| `apps/mcp-server/src/tools/index.ts` | ツール登録・Context修正 | 修正 |
| `apps/mcp-server/src/transport/streamable-http.ts` | セッション管理・AsyncLocalStorage | 修正 |
| `apps/api/src/services/user.service.ts:83-151` | 既存プロジェクト検索ロジック | 再利用（※countProjectsの確認要） |
| `docker/docker-compose.yml` | 環境変数追加 | 修正 |

---

## 実装順序

0. **事前確認**: `userService.getProjects`と`countProjects`のインターフェース確認
   - `countProjects`メソッドが存在しない場合は新規実装が必要
1. **環境変数**: `INTERNAL_API_SECRET`をdocker-compose.ymlと各env.tsに追加
2. **API側**: 内部API認証ミドルウェアとルート作成
3. **MCP側**: APIクライアント作成
4. **MCP側**: AsyncLocalStorageによるContext伝達修正
5. **MCP側**: search_projectツール実装・登録
6. **MCP側**: セッションクリーンアップ処理の追加（メモリリーク防止）
7. **テスト**: 単体テスト・結合テスト

---

## テスト方針

### 単体テスト

1. **内部API認証ミドルウェア**: 正しいシークレット/不正なシークレット/未設定のケース
2. **APIクライアント**: モックを使用したリクエスト/エラーハンドリング
3. **search_projectハンドラー**: コンテキスト検証、APIクライアント呼び出し

### 結合テスト

1. **内部APIエンドポイント**: シークレット認証の検証
2. **MCPツール→内部API→DB**: E2E検証（Docker環境）

### テストファイル

```
apps/api/src/middleware/__tests__/internal-api.middleware.test.ts
apps/api/src/routes/__tests__/internal.test.ts
apps/mcp-server/src/clients/__tests__/api-client.test.ts
apps/mcp-server/src/tools/__tests__/search-project.test.ts
```
