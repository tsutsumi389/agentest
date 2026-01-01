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

### API側（新規作成）

```
apps/api/src/
├── routes/
│   └── internal.ts                # 内部APIルート（新規）
└── middleware/
    └── internal-only.middleware.ts  # 内部ネットワーク限定（新規）
```

### MCP側（新規作成）

```
apps/mcp-server/src/
├── clients/
│   └── api-client.ts              # 内部APIクライアント
└── tools/project/
    ├── index.ts                   # ツール登録
    ├── schemas.ts                 # Zodスキーマ
    └── handlers/
        └── search-project.handler.ts  # ハンドラー
```

---

## Step 1: 内部APIエンドポイント作成

### 1.1 内部ネットワーク限定ミドルウェア

**ファイル**: `apps/api/src/middleware/internal-only.middleware.ts`

```typescript
export function internalOnly() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Docker内部ネットワークからのリクエストのみ許可
    const host = req.hostname;
    if (host === 'api' || host === 'localhost' || host === '127.0.0.1') {
      next();
    } else {
      res.status(403).json({ error: 'Internal API only' });
    }
  };
}
```

### 1.2 内部APIルート

**ファイル**: `apps/api/src/routes/internal.ts`

```typescript
// GET /internal/api/users/:userId/projects
router.get('/users/:userId/projects', internalOnly(), async (req, res) => {
  const { userId } = req.params;
  const query = getUserProjectsQuerySchema.parse(req.query);

  const [projects, total] = await Promise.all([
    userService.getProjects(userId, { ...query }),
    userService.countProjects(userId, query),
  ]);

  res.json({ projects, pagination: { total, limit, offset, hasMore } });
});
```

### 1.3 ルート登録

**ファイル**: `apps/api/src/routes/index.ts`

```typescript
import internalRoutes from './internal.js';
router.use('/internal/api', internalRoutes);
```

---

## Step 2: APIクライアント作成

**ファイル**: `apps/mcp-server/src/clients/api-client.ts`

```typescript
export class InternalApiClient {
  private baseUrl: string;

  constructor() {
    // Docker内部ネットワーク経由
    this.baseUrl = process.env.API_INTERNAL_URL || 'http://api:3000';
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) url.searchParams.set(k, v);
      });
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }
}

export const apiClient = new InternalApiClient();
```

---

## Step 3: スキーマ定義

**ファイル**: `apps/mcp-server/src/tools/project/schemas.ts`

```typescript
export const searchProjectInputSchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});
```

---

## Step 4: ハンドラー実装

**ファイル**: `apps/mcp-server/src/tools/project/handlers/search-project.handler.ts`

```typescript
export const searchProjectHandler: ToolHandler<SearchProjectInput, SearchProjectResponse> = async (
  input,
  context
) => {
  const { userId } = context;

  // 内部APIを呼び出し（認証不要）
  const response = await apiClient.get<SearchProjectResponse>(
    `/internal/api/users/${userId}/projects`,
    { q: input.q, limit: String(input.limit), offset: String(input.offset) }
  );

  return response;
};
```

---

## Step 5: ツール登録

**ファイル**: `apps/mcp-server/src/tools/project/index.ts`

```typescript
export function registerProjectTools(): void {
  toolRegistry.register({
    name: 'search_project',
    description: 'プロジェクト一覧を検索します。',
    inputSchema: searchProjectInputSchema,
    handler: searchProjectHandler,
  });
}
```

**ファイル**: `apps/mcp-server/src/tools/index.ts`

```typescript
import { registerProjectTools } from './project/index.js';

export function registerTools(server: McpServer): void {
  registerProjectTools();  // 追加
  // ... 既存コード
}
```

---

## Step 6: ToolContextへのuserIdの伝達

**現状の課題**: `apps/mcp-server/src/tools/index.ts:101-102`で`userId: ''`がTODOになっている

### 6.1 セッションにユーザー情報を紐付け

**ファイル**: `apps/mcp-server/src/transport/streamable-http.ts`

```typescript
// セッション作成時にユーザー情報を保存
const sessionData = new Map<string, { userId: string }>();

// handlePost内で
sessionData.set(newSessionId, { userId: req.user.id });
```

### 6.2 registerTools関数の修正

**ファイル**: `apps/mcp-server/src/tools/index.ts`

```typescript
// セッションデータを参照してcontextを構築
const context: ToolContext = {
  userId: sessionData.get(sessionId)?.userId || '',
};
```

---

## 重要ファイル

| ファイル | 役割 |
|---------|------|
| `apps/api/src/routes/internal.ts` | 内部APIルート（新規） |
| `apps/api/src/middleware/internal-only.middleware.ts` | 内部ネットワーク限定（新規） |
| `apps/mcp-server/src/clients/api-client.ts` | 内部APIクライアント（新規） |
| `apps/mcp-server/src/tools/project/` | MCPツール実装（新規） |
| `apps/mcp-server/src/tools/index.ts` | ツール登録・Context修正 |
| `apps/mcp-server/src/transport/streamable-http.ts` | セッション管理修正 |
| `apps/api/src/services/user.service.ts:83-151` | 既存プロジェクト検索ロジック（再利用） |

---

## 実装順序

1. **API側**: 内部APIミドルウェアとルート作成
2. **MCP側**: APIクライアント作成
3. **MCP側**: ツールスキーマ・ハンドラー実装
4. **MCP側**: ツール登録とContext伝達修正
5. **テスト**: 結合テスト

---

## テスト方針

1. **内部APIテスト**: 内部ネットワーク制限の検証
2. **単体テスト**: APIクライアントのモック、ハンドラーのテスト
3. **結合テスト**: MCPツール → 内部API → DB のE2E検証
