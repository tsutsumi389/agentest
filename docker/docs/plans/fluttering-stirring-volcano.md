# MEDIUM指摘対応: テストヘルパー重複コード統合

## 対応方針

| # | 指摘 | 対応 |
|---|------|------|
| M-1 | MCP SSE/JSON-RPCヘルパー4重複 | `mcp-tools-helpers.ts` に統合 |
| M-2 | API認証モック4重複 | **対応見送り** (`vi.mock`ホイスティング制約で統合困難) |
| M-3 | テストファイル800行超 | M-1対応で各ファイル約90-120行削減 |
| M-4 | `parseToolResult`返却型不一致 | 2バリアント(`Json`/`Raw`)を共有ヘルパーに定義 |
| M-5 | `hasAnyError`と`isToolError`冗長 | `hasAnyError`を削除、`isToolError`に統一 |
| M-6 | WS JWT秘密鍵2箇所ハードコード | `test-helpers.ts`に定数化、`vi.mock`のasync factoryで参照 |

## Phase 1: `mcp-tools-helpers.ts` に共有関数を追加

**ファイル**: `apps/mcp-server/src/__tests__/integration/mcp-tools-helpers.ts`

追加する関数 (~150行追加):

```
import request from 'supertest';
import type { Express } from 'express';
```

| 関数 | 説明 |
|------|------|
| `extractJsonRpcFromSse(response)` | SSEからJSON-RPCメッセージ抽出 (4ファイル同一) |
| `parseToolResultJson(response): unknown` | contentテキストをJSON.parseして返す (crud-tools, search-tools向け) |
| `parseToolResultRaw(response): {content, isError}` | resultオブジェクトをそのまま返す (execution-tools, workflow向け) |
| `isToolError(response): boolean` | JSON-RPC/ツールレベルのエラー判定 |
| `getToolContentText(response): string` | contentテキスト直接取得 |
| `getToolErrorMessage(response): string` | エラーメッセージ取得 |
| `initializeMcpSession(app, options?): Promise<string>` | セッション初期化 (options: projectId, clientId, clientName) |
| `callMcpTool(app, sessionId, toolName, args?, requestId?): Promise<Response>` | ツール呼び出し |

`initializeMcpSession`のoptionsインタフェース:
```typescript
interface InitializeSessionOptions {
  projectId?: string;
  clientId?: string;
  clientName?: string;
}
```

**注意**: 元のsearch-tools/crud-toolsの`initializeMcpSession`内にある`expect`アサーションは共有ヘルパーには含めない。テスト側で必要なら個別にアサートする。

## Phase 2: MCPテストファイル4件を更新

### 2-1: `mcp-crud-tools.integration.test.ts` (~124行削減)

- **インポート追加**: `parseToolResultJson as parseToolResult`, `isToolError`, `getToolContentText`, `initializeMcpSession`, `callMcpTool` (from `./mcp-tools-helpers.js`)
- **ローカル関数削除** (lines 109-240): `initializeSession`, `callTool`, `extractJsonRpcFromSse`, `parseToolResult`, `isToolError`, `getToolContentText`, `hasAnyError`
- **リネーム**: `initializeSession(app)` -> `initializeMcpSession(app)`, `callTool(...)` -> `callMcpTool(...)`, `hasAnyError(...)` -> `isToolError(...)`

### 2-2: `mcp-execution-tools.integration.test.ts` (~91行削減)

- **インポート追加**: `parseToolResultRaw as parseToolResult`, `initializeMcpSession`, `callMcpTool`
- **ローカル関数削除** (lines 105-202): `initializeMcpSession`, `callMcpTool`, `extractJsonRpcFromSse`, `parseToolResult`
- **呼び出し変更**: `initializeMcpSession(app, testProject.id)` -> `initializeMcpSession(app, { projectId: testProject.id })`

### 2-3: `mcp-search-tools.integration.test.ts` (~108行削減)

- **インポート更新**: 既存のmcp-tools-helpersインポートに `parseToolResultJson as parseToolResult`, `isToolError`, `getToolErrorMessage`, `initializeMcpSession`, `callMcpTool` を追加
- **ローカル関数削除** (lines 155-266): `initializeMcpSession`, `callMcpTool`, `extractJsonRpcFromSse`, `parseToolResult`, `isToolError`, `getToolErrorMessage`
- **呼び出し変更なし** (既に `initializeMcpSession(app)`, `callMcpTool(...)` の形式)

### 2-4: `mcp-workflow.integration.test.ts` (~103行削減)

- **インポート追加**: `parseToolResultRaw as parseToolResult`, `initializeMcpSession`, `callMcpTool`
- **ローカル関数削除** (lines 110-219): `initializeMcpSession`, `callMcpTool`, `extractJsonRpcFromSse`, `parseToolResult`
- **呼び出し変更**: `initializeMcpSession(app, projectId)` -> `initializeMcpSession(app, { projectId })`, `initializeMcpSession(app, projectId, { clientId, clientName })` -> `initializeMcpSession(app, { projectId, clientId, clientName })`

## Phase 3: WS テスト設定定数の統合

### 3-1: `apps/ws/src/__tests__/integration/test-helpers.ts` に定数追加

```typescript
export const TEST_ENV_CONFIG = {
  NODE_ENV: 'test',
  PORT: 0,
  HOST: '127.0.0.1',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-secret-key-for-jwt-testing-32ch',
} as const;
```

### 3-2: `ws-connection.integration.test.ts` の config mock を共有定数参照に変更

```typescript
vi.mock('../../config.js', async () => {
  const { TEST_ENV_CONFIG } = await import('./test-helpers.js');
  return { env: TEST_ENV_CONFIG };
});
```

### 3-3: `ws-broadcast.integration.test.ts` も同様に変更

## 検証

各Phase完了後:
```bash
# MCP テスト
docker compose exec dev pnpm --filter @agentest/mcp-server test
# WS テスト
docker compose exec dev pnpm --filter @agentest/ws test
# 全体テスト
docker compose exec dev pnpm test
```

テスト数が変更前後で同一であることを確認する。
