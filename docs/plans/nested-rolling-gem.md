# search_test_suite / search_test_case / search_execution 実装計画

## 概要

MCPサーバーに3つの検索ツールと対応する内部APIエンドポイントを実装する。

## アーキテクチャ

```
[MCP Client] → [MCP Server (ツール)] → [API Server (内部API)] → [Prisma/PostgreSQL]
```

---

## 1. search_test_suite

### MCPツール

**ファイル**: `apps/mcp-server/src/tools/search-test-suite.ts`

```typescript
// 入力スキーマ
{
  projectId?: uuid        // プロジェクトIDで絞り込み（省略時は全アクセス可能プロジェクト）
  q?: string (max:100)    // テストスイート名で検索
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  limit: number (1-50, default:20)
  offset: number (min:0, default:0)
}

// レスポンス
{
  testSuites: Array<{
    id, name, description, status, projectId,
    project: { id, name },
    createdByUser: { id, name, avatarUrl } | null,
    _count: { testCases, preconditions },
    createdAt, updatedAt
  }>,
  pagination: { total, limit, offset, hasMore }
}
```

### 内部API

**パス**: `GET /internal/api/users/:userId/test-suites`

**クエリ**: `projectId`, `q`, `status`, `limit`, `offset`

---

## 2. search_test_case

### MCPツール

**ファイル**: `apps/mcp-server/src/tools/search-test-case.ts`

```typescript
// 入力スキーマ
{
  testSuiteId: uuid       // 必須
  q?: string (max:100)    // タイトルで検索
  status?: ['DRAFT' | 'ACTIVE' | 'ARCHIVED']  // 複数指定可
  priority?: ['CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW']  // 複数指定可
  limit: number (1-50, default:20)
  offset: number (min:0, default:0)
}

// レスポンス
{
  testCases: Array<{
    id, title, description, priority, status, orderKey,
    createdByUser: { id, name, avatarUrl } | null,
    _count: { preconditions, steps, expectedResults },
    createdAt, updatedAt
  }>,
  pagination: { total, limit, offset, hasMore }
}
```

### 内部API

**パス**: `GET /internal/api/test-suites/:testSuiteId/test-cases`

**クエリ**: `userId`, `q`, `status`, `priority`, `limit`, `offset`

---

## 3. search_execution

### MCPツール

**ファイル**: `apps/mcp-server/src/tools/search-execution.ts`

```typescript
// 入力スキーマ
{
  testSuiteId: uuid       // 必須
  status?: ['IN_PROGRESS' | 'COMPLETED' | 'ABORTED']  // 複数指定可
  from?: datetime (ISO 8601)
  to?: datetime (ISO 8601)
  limit: number (1-50, default:20)
  offset: number (min:0, default:0)
}

// レスポンス
{
  executions: Array<{
    id, status, startedAt, completedAt,
    executedByUser: { id, name, avatarUrl } | null,
    environment: { id, name, slug } | null,
    createdAt, updatedAt
  }>,
  pagination: { total, limit, offset, hasMore }
}
```

### 内部API

**パス**: `GET /internal/api/test-suites/:testSuiteId/executions`

**クエリ**: `userId`, `status`, `from`, `to`, `limit`, `offset`

---

## 実装ファイル一覧

### 新規作成

| ファイル | 内容 |
|---------|------|
| `apps/mcp-server/src/tools/search-test-suite.ts` | MCPツール |
| `apps/mcp-server/src/tools/search-test-case.ts` | MCPツール |
| `apps/mcp-server/src/tools/search-execution.ts` | MCPツール |
| `apps/api/src/services/internal-authorization.service.ts` | 認可ヘルパー |
| `apps/mcp-server/src/__tests__/unit/tools/search-test-suite.test.ts` | ユニットテスト |
| `apps/mcp-server/src/__tests__/unit/tools/search-test-case.test.ts` | ユニットテスト |
| `apps/mcp-server/src/__tests__/unit/tools/search-execution.test.ts` | ユニットテスト |

### 修正

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/routes/internal.ts` | 3つの内部APIエンドポイント追加 |
| `apps/api/src/services/user.service.ts` | getTestSuites/countTestSuitesメソッド追加 |
| `apps/mcp-server/src/tools/index.ts` | 3つのツール登録 |
| `apps/api/src/__tests__/integration/internal-api.integration.test.ts` | 統合テスト追加 |

---

## 実装順序

### Phase 1: 内部API基盤
1. `internal-authorization.service.ts` 作成（認可ヘルパー）
2. `user.service.ts` に `getTestSuites` / `countTestSuites` メソッド追加

### Phase 2: search_test_suite
1. 内部API: `GET /internal/api/users/:userId/test-suites`
2. MCPツール: `search-test-suite.ts`
3. ユニットテスト
4. ツール登録

### Phase 3: search_test_case
1. 内部API: `GET /internal/api/test-suites/:testSuiteId/test-cases`
2. MCPツール: `search-test-case.ts`
3. ユニットテスト
4. ツール登録

### Phase 4: search_execution
1. 内部API: `GET /internal/api/test-suites/:testSuiteId/executions`
2. MCPツール: `search-execution.ts`
3. ユニットテスト
4. ツール登録

### Phase 5: 統合テスト
1. 3つの内部APIエンドポイントの統合テスト追加

---

## 認可チェック方式

内部APIでは `userId` をクエリパラメータで受け取り、以下のロジックで認可:

```typescript
// InternalAuthorizationService
async canAccessProject(userId, projectId): boolean {
  // 1. ProjectMember確認
  // 2. 組織経由のアクセス確認（OrganizationMember）
}

async canAccessTestSuite(userId, testSuiteId): boolean {
  // TestSuiteからprojectIdを取得し、canAccessProject呼び出し
}
```

---

## 参照ファイル

- `apps/mcp-server/src/tools/search-project.ts` - MCPツール実装パターン
- `apps/api/src/routes/internal.ts` - 内部APIエンドポイント追加先
- `apps/api/src/services/test-suite.service.ts` - 既存のTestCase/Execution検索ロジック
- `packages/shared/src/validators/schemas.ts` - 検索スキーマ定義
