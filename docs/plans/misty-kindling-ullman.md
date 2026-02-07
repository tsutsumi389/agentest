# C-3: 構造化ログ基盤の導入 (Pino)

## Context

現在、バックエンド全体(API/WS/Jobs/MCP)で `console.*` を直接使用しており(約340箇所)、本番運用に必要な構造化ログ・ログレベル制御・リクエストトレースが不十分。`apps/api/src/utils/logger.ts` は console.* のラッパーに過ぎず、コード内コメントにも「将来的にPino等に置き換え可能」と記載されている。本タスクでは Pino を導入し、全バックエンドアプリのログを構造化JSON出力に統一する。

## 方針

- **ロガーの配置**: `packages/shared/src/logger/` にサブパスエクスポート `@agentest/shared/logger` として追加（既存の `/process`, `/errors` 等と同パターン）
- **ライブラリ**: Pino（高性能JSON構造化ログ）+ pino-http（APIリクエストログ）
- **Morgan廃止**: pino-http で代替
- **AsyncLocalStorage**: C-3のスコープ外（M-4で対応）。リクエストIDは `req.requestId` 経由で手動付与
- **ログ出力**: stdout（Cloud Run親和性）、JSON形式

---

## Phase 1: 共有ロガーパッケージの作成

### 1-1. 依存関係の追加

**`pnpm-workspace.yaml`** — catalog に追加:
```yaml
pino: "^9.7.0"
pino-http: "^10.3.0"
pino-pretty: "^13.0.0"
```

**`packages/shared/package.json`** — dependencies に `pino` を追加

### 1-2. ロガーモジュールの作成

**新規: `packages/shared/src/logger/index.ts`**

- `createLogger(options: { service: string; level?: LogLevel })` — サービス別ロガー生成
- デフォルトログレベル: `LOG_LEVEL` 環境変数 → `NODE_ENV` に基づく自動判定（production: `info`, development: `debug`, test: `silent`）
- `timestamp`: ISO 8601形式
- `base`: `{ service, env }` を自動付与
- `formatters.level`: `{ level: "info" }` 形式（数値ではなくラベル）
- `LOG_PRETTY=true` で pino-pretty による可読フォーマット（開発用）
- `Logger` 型のre-export

### 1-3. サブパスエクスポートの追加

**`packages/shared/package.json`** — exports に追加:
```json
"./logger": {
  "import": "./dist/logger/index.js",
  "types": "./dist/logger/index.d.ts"
}
```

### 1-4. ユニットテスト

**新規: `packages/shared/src/logger/__tests__/logger.test.ts`**
- createLogger のオプション検証
- 環境変数によるログレベル制御
- child logger のコンテキスト伝搬

---

## Phase 2: apps/api への統合

### 2-1. ロガーの置き換え

**`apps/api/src/utils/logger.ts`** — Pino ベースに書き換え:
```typescript
import { createLogger, type Logger } from '@agentest/shared/logger';
export const logger: Logger = createLogger({ service: 'api' });
```
既存の import パスを維持するため、利用側の変更を最小化。

### 2-2. リクエストロガーの置き換え

**`apps/api/src/middleware/request-logger.ts`** — pino-http ベースに書き換え:
- `pino-http` を使用（logger インスタンスを共有）
- `genReqId`: 既存の `X-Request-ID` ヘッダーがあればそれを使用、なければ `crypto.randomUUID()`
- `customLogLevel`: ステータスコードに応じたレベル（500+: error, 400+: warn, 200+: info）
- シリアライザ: Authorization, Cookie ヘッダーを `[REDACTED]` に
- `req.requestId` への後方互換コピー（`attachRequestId` ミドルウェア）
- テスト時は `autoLogging: false`

**`apps/api/package.json`** — `pino-http` を dependencies に追加

### 2-3. Morgan の削除

**`apps/api/src/app.ts`**:
- `morgan` の import と `app.use(morgan('combined'))` を削除
- `requestLogger` の import パスを更新（pino-http版）
- `attachRequestId` ミドルウェアを追加

**`apps/api/package.json`**: `morgan`, `@types/morgan` を削除

### 2-4. エラーハンドラの更新

**`apps/api/src/middleware/error-handler.ts`**:
- `console.error('予期しないエラー:', error)` → `logger.error({ err: error, requestId: req.requestId }, '予期しないエラー')`

### 2-5. エントリポイントの更新

**`apps/api/src/index.ts`**:
- 全ての `console.log/error` を `logger.info/error` に置き換え
- 絵文字をログメッセージから除去（構造化ログでは不要）
- シャットダウンログに signal, exitCode 等のコンテキストを付与

### 2-6. lib/ ファイルの更新

以下のファイルで `console.*` → child logger に置き換え:
- `apps/api/src/lib/events.ts`
- `apps/api/src/lib/redis-publisher.ts`
- `apps/api/src/lib/redis-store.ts`

パターン:
```typescript
import { logger as baseLogger } from '../utils/logger.js';
const logger = baseLogger.child({ module: 'events' });
```

### 2-7. サービス層の更新

既にロガーを使用している6ファイル（webhook, subscription, organization等）は API 互換のため変更最小。ただし Pino 推奨パターン `logger.info({ key: value }, 'message')` に統一。

残りの `console.*` を使用しているサービスファイル全てを `logger` に置き換え。各サービスで child logger を使用:
```typescript
const logger = baseLogger.child({ module: 'test-suite' });
```

---

## Phase 3: 他バックエンドアプリへの展開

### 3-1. apps/ws

**新規: `apps/ws/src/utils/logger.ts`** — `createLogger({ service: 'ws' })`

更新対象:
- `apps/ws/src/index.ts` — startup/shutdown ログ
- `apps/ws/src/server.ts` — WebSocket接続ログ
- `apps/ws/src/redis.ts` — Redis接続ログ
- `apps/ws/src/auth.ts` — 認証ログ

約20箇所の `console.*` を置き換え。

### 3-2. apps/jobs

**新規: `apps/jobs/src/utils/logger.ts`** — `createLogger({ service: 'jobs' })`

更新対象:
- `apps/jobs/src/index.ts` — ジョブオーケストレーションログ
- `apps/jobs/src/jobs/*.ts` — 各ジョブファイル（8ファイル）で child logger 使用

約75箇所の `console.*` を置き換え。

### 3-3. apps/mcp-server

**新規: `apps/mcp-server/src/utils/logger.ts`** — `createLogger({ service: 'mcp' })`

更新対象:
- `apps/mcp-server/src/index.ts` — startup/shutdown ログ
- `apps/mcp-server/src/services/*.ts` — 各サービス
- `apps/mcp-server/src/middleware/*.ts` — 認証ミドルウェア

約30箇所の `console.*` を置き換え。

---

## Phase 4: プロセスハンドラの更新

**`packages/shared/src/process/index.ts`**:
- `ProcessHandlersOptions` に `logger?: Logger` オプションを追加
- logger が渡された場合: `logger.fatal({ err }, 'キャッチされない例外が発生しました')` を使用
- logger が渡されない場合: 既存の `console.error(JSON.stringify(...))` を維持（後方互換）
- `logUncaughtException`, `logUnhandledRejection` に logger パラメータを追加

各アプリのエントリポイントで logger を渡すように更新:
```typescript
registerProcessHandlers({ getShutdownFn: () => shutdownFn, logger });
```

---

## Phase 5: クリーンアップ

- `pnpm-workspace.yaml` の catalog から `morgan`, `@types/morgan` を削除（他に使用箇所がなければ）
- `pnpm install` で lockfile を更新
- 全アプリで `console.(log|error|warn|info|debug)` が残っていないことを grep で確認（テストファイルは除外）

---

## 主要ファイル一覧

| ファイル | 変更種別 |
|---------|---------|
| `pnpm-workspace.yaml` | 編集（catalog追加/削除）|
| `packages/shared/package.json` | 編集（pino追加, exports追加）|
| `packages/shared/src/logger/index.ts` | **新規** |
| `packages/shared/src/logger/__tests__/logger.test.ts` | **新規** |
| `packages/shared/src/process/index.ts` | 編集 |
| `apps/api/package.json` | 編集（pino-http追加, morgan削除）|
| `apps/api/src/utils/logger.ts` | 書き換え |
| `apps/api/src/middleware/request-logger.ts` | 書き換え |
| `apps/api/src/middleware/error-handler.ts` | 編集 |
| `apps/api/src/app.ts` | 編集（morgan削除, pino-http統合）|
| `apps/api/src/index.ts` | 編集 |
| `apps/api/src/lib/events.ts` | 編集 |
| `apps/api/src/lib/redis-publisher.ts` | 編集 |
| `apps/api/src/lib/redis-store.ts` | 編集 |
| `apps/api/src/services/*.ts` | 編集（約15ファイル）|
| `apps/ws/src/utils/logger.ts` | **新規** |
| `apps/ws/src/**/*.ts` | 編集（約5ファイル）|
| `apps/jobs/src/utils/logger.ts` | **新規** |
| `apps/jobs/src/**/*.ts` | 編集（約9ファイル）|
| `apps/mcp-server/src/utils/logger.ts` | **新規** |
| `apps/mcp-server/src/**/*.ts` | 編集（約8ファイル）|

---

## 検証方法

1. **ユニットテスト**: `docker compose exec dev pnpm test` — 全テストが通ること
2. **ビルド確認**: `docker compose exec dev pnpm build` — TypeScript コンパイルが通ること
3. **ログ出力確認**: APIサーバーを起動し、リクエストを送信して構造化JSONログが出力されることを確認
   ```bash
   curl http://localhost:3000/api/health
   # 期待出力: {"level":"info","time":"...","service":"api","req":{...},"res":{...},"msg":"GET /api/health 200"}
   ```
4. **ログレベル確認**: `LOG_LEVEL=warn` で起動し、info ログが抑制されることを確認
5. **console.* 残存チェック**: `grep -r "console\.\(log\|error\|warn\|info\)" apps/ packages/ --include="*.ts" --exclude-dir="__tests__" --exclude-dir="node_modules"` で残りがないことを確認
6. **Pretty Print確認**: `LOG_PRETTY=true` で開発サーバーを起動し、可読フォーマットを確認
