# M-4: リクエストトレーシングの拡充

## Context

現状、`apps/api/src/middleware/request-logger.ts` で `X-Request-ID` を生成しているが、サービス層やRedisイベント、ログ出力にはrequestIdが伝搬されていない。
AsyncLocalStorage を使ってリクエストコンテキストを非同期処理全体に自動伝搬し、ログやイベントに requestId を自動付与する。

## 実装方針

requestId の自動注入を **最下層（`publishEvent`）で一括処理** し、個別のイベント生成コードを変更しない設計にする。

---

## Step 1: リクエストコンテキストモジュール作成

**新規ファイル**: `apps/api/src/lib/request-context.ts`

- `AsyncLocalStorage<RequestContextData>` インスタンスを作成
- `RequestContextData` 型: `{ requestId: string }`
- `getRequestId()` ヘルパー関数をエクスポート

```typescript
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextData>();

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
```

---

## Step 2: ミドルウェアにコンテキスト開始処理を追加

**変更ファイル**: `apps/api/src/middleware/request-logger.ts`

- `requestContext.run()` でリクエスト処理全体をラップする新ミドルウェア `runWithRequestContext` を追加
- `attachRequestId` の後、`req.requestId` を使ってコンテキストを開始

```typescript
import { requestContext } from '../lib/request-context.js';

export function runWithRequestContext(req: Request, _res: Response, next: NextFunction): void {
  const requestId = req.requestId ?? crypto.randomUUID();
  requestContext.run({ requestId }, () => next());
}
```

**変更ファイル**: `apps/api/src/app.ts`

- ミドルウェアチェーンに `runWithRequestContext` を追加（`attachRequestId` の直後）

```typescript
app.use(httpLogger);
app.use(attachRequestId);
app.use(runWithRequestContext);  // 追加
```

---

## Step 3: ロガーにrequestId自動付与

**変更ファイル**: `packages/shared/src/logger/index.ts`

- `CreateLoggerOptions` に `mixin?: () => object` オプションを追加
- Pinoの `mixin` 機能で、ログ出力時にAsyncLocalStorageからrequestIdを自動注入

```typescript
export interface CreateLoggerOptions {
  service: string;
  level?: LogLevel;
  mixin?: () => object;  // 追加
}
```

`loggerOptions` 構築時に `mixin` があれば設定:

```typescript
if (options.mixin) {
  loggerOptions.mixin = options.mixin;
}
```

**変更ファイル**: `apps/api/src/utils/logger.ts`

- `getRequestId` を import して mixin に設定

```typescript
import { createLogger, type Logger } from '@agentest/shared/logger';
import { getRequestId } from '../lib/request-context.js';

export const logger: Logger = createLogger({
  service: 'api',
  mixin: () => {
    const requestId = getRequestId();
    return requestId ? { requestId } : {};
  },
});
```

これにより、API内の全ログ出力に自動的に `requestId` が含まれる（`logger.child()` で作成した子ロガーも含む）。

---

## Step 4: Redisイベントに requestId を自動注入

**変更ファイル**: `apps/api/src/lib/redis-publisher.ts`

- `publishEvent` 内で `getRequestId()` を呼び、イベントオブジェクトに `requestId` を自動注入
- 最下層で注入するため、`events.ts` や各サービスのイベント生成コードを変更不要

```typescript
import { getRequestId } from './request-context.js';

export async function publishEvent(channel: string, event: object): Promise<void> {
  const redis = getPublisher();
  if (!redis) return;

  try {
    const requestId = getRequestId();
    const enrichedEvent = requestId ? { ...event, requestId } : event;
    await redis.publish(channel, JSON.stringify(enrichedEvent));
  } catch (error) {
    logger.error({ err: error }, 'Redis publish エラー');
  }
}
```

---

## Step 5: WebSocketイベント型にrequestIdフィールドを追加

**変更ファイル**: `packages/ws-types/src/events.ts`

- `BaseEvent` に `requestId` をオプショナルフィールドとして追加
- 後方互換性を維持（既存のフロントエンドコードに影響なし）

```typescript
export interface BaseEvent extends BaseMessage {
  eventId: string;
  requestId?: string;  // リクエストトレーシング用
}
```

---

## Step 6: テスト

### 新規テスト: `apps/api/src/__tests__/unit/request-context.test.ts`
- `getRequestId()` がコンテキスト外で `undefined` を返す
- `requestContext.run()` 内で `getRequestId()` が正しいIDを返す
- ネストした非同期処理でコンテキストが伝搬される

### 更新テスト: `apps/api/src/__tests__/unit/redis-publisher.test.ts`
- `request-context` モジュールをモック
- コンテキスト内でpublishするとイベントに `requestId` が含まれることを検証
- コンテキスト外でpublishすると `requestId` が含まれないことを検証

### 更新テスト: `packages/shared/src/logger/logger.test.ts`
- `mixin` オプション付きでロガーを作成し、出力にmixinの値が含まれることを検証

### 既存テストへの影響
- `events.test.ts`: 変更なし（events.ts自体は変更しないため）
- `notification.service.test.ts`: `publishEvent` のモックが既にあるため影響なし

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
|---------|------|------|
| `apps/api/src/lib/request-context.ts` | 新規 | AsyncLocalStorage リクエストコンテキスト |
| `apps/api/src/middleware/request-logger.ts` | 変更 | `runWithRequestContext` ミドルウェア追加 |
| `apps/api/src/app.ts` | 変更 | ミドルウェアチェーンに追加 |
| `packages/shared/src/logger/index.ts` | 変更 | `mixin` オプション対応 |
| `apps/api/src/utils/logger.ts` | 変更 | mixin で requestId 自動付与 |
| `apps/api/src/lib/redis-publisher.ts` | 変更 | publishEvent で requestId 自動注入 |
| `packages/ws-types/src/events.ts` | 変更 | BaseEvent に `requestId?` 追加 |
| `apps/api/src/__tests__/unit/request-context.test.ts` | 新規 | コンテキスト伝搬テスト |
| `apps/api/src/__tests__/unit/redis-publisher.test.ts` | 更新 | requestId 注入テスト追加 |
| `packages/shared/src/logger/logger.test.ts` | 更新 | mixin テスト追加 |

---

## 検証方法

1. `docker compose exec dev pnpm build` でビルド成功を確認
2. `docker compose exec dev pnpm test` で全テスト通過を確認
3. ログ出力に `requestId` が含まれることを確認（開発サーバーでAPIリクエスト送信）
4. WebSocketイベントに `requestId` が含まれることを確認（Redis pub/sub経由）
