# テストスイート概要タブ WebSocketリアルタイム更新

## 概要

テストスイートの概要タブ（OverviewTab）をWebSocketでリアルタイム更新に対応させる。

## 対象データ

概要タブで表示している3つのデータをリアルタイム更新する：
1. **テストスイート説明** - `test_suite:updated` イベントで更新
2. **前提条件一覧** - `test_suite:updated` イベントで更新
3. **最近の実行履歴** - `execution:started` イベントで更新

## 実装方針

- 既存のWebSocket基盤（apps/ws）を活用
- 既存のイベント型（`test_suite:updated`, `execution:started`）を使用
- `useEditLock.ts` のパターンに従った一貫性のある実装

## 変更ファイル

### 新規作成

| ファイル | 説明 |
|---------|------|
| `apps/api/src/lib/redis.ts` | Redis Pub/Subクライアント |
| `apps/api/src/lib/events.ts` | イベント発行ヘルパー関数 |
| `apps/web/src/hooks/useTestSuiteRealtime.ts` | リアルタイム更新フック |

### 修正

| ファイル | 説明 |
|---------|------|
| `apps/api/src/services/test-suite.service.ts` | イベント発行を追加 |
| `apps/web/src/pages/TestSuiteCases.tsx` | フック統合 |
| `apps/web/src/components/test-suite/PreconditionList.tsx` | React Query移行 |

## 実装手順

### Step 1: バックエンド - Redis Pub/Subクライアント

`apps/api/src/lib/redis.ts` を作成：

```typescript
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const publisher = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;

export async function publishEvent(channel: string, event: object): Promise<void> {
  if (publisher) {
    await publisher.publish(channel, JSON.stringify(event));
  }
}
```

### Step 2: バックエンド - イベント発行ヘルパー

`apps/api/src/lib/events.ts` を作成：

```typescript
import { Channels, type TestSuiteUpdatedEvent, type ExecutionStartedEvent } from '@agentest/ws-types';
import { publishEvent } from './redis.js';
import { randomUUID } from 'node:crypto';

export async function publishTestSuiteUpdatedEvent(
  testSuiteId: string,
  projectId: string,
  changes: { field: string; oldValue: unknown; newValue: unknown }[],
  updatedBy: { type: 'user' | 'agent'; id: string; name: string }
): Promise<void> {
  const event: TestSuiteUpdatedEvent = {
    type: 'test_suite:updated',
    eventId: randomUUID(),
    timestamp: Date.now(),
    testSuiteId,
    projectId,
    changes,
    updatedBy,
  };
  await Promise.all([
    publishEvent(Channels.project(projectId), event),
    publishEvent(Channels.testSuite(testSuiteId), event),
  ]);
}
```

### Step 3: バックエンド - テストスイートサービスにイベント発行追加

`apps/api/src/services/test-suite.service.ts` の以下メソッドにイベント発行を追加：

- `update()` - 基本情報更新時
- `addPrecondition()` - 前提条件追加時
- `updatePrecondition()` - 前提条件更新時
- `deletePrecondition()` - 前提条件削除時
- `reorderPreconditions()` - 前提条件並び替え時

### Step 4: フロントエンド - リアルタイム更新フック

`apps/web/src/hooks/useTestSuiteRealtime.ts` を作成：

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsClient } from '../lib/ws';
import { Channels, type TestSuiteUpdatedEvent, type ExecutionStartedEvent } from '@agentest/ws-types';

export function useTestSuiteRealtime(testSuiteId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!testSuiteId) return;

    const channel = Channels.testSuite(testSuiteId);
    wsClient.subscribe([channel]);

    // テストスイート更新イベント
    const unsubscribeSuiteUpdated = wsClient.on<TestSuiteUpdatedEvent>(
      'test_suite:updated',
      (event) => {
        if (event.testSuiteId !== testSuiteId) return;

        const hasBasicInfoChange = event.changes.some(
          (c) => ['name', 'description', 'status'].includes(c.field)
        );
        const hasPreconditionChange = event.changes.some(
          (c) => c.field.startsWith('precondition')
        );

        if (hasBasicInfoChange) {
          queryClient.invalidateQueries({ queryKey: ['test-suite', testSuiteId] });
        }
        if (hasPreconditionChange) {
          queryClient.invalidateQueries({ queryKey: ['test-suite-preconditions', testSuiteId] });
        }
      }
    );

    // 実行開始イベント
    const unsubscribeExecutionStarted = wsClient.on<ExecutionStartedEvent>(
      'execution:started',
      (event) => {
        if (event.testSuiteId !== testSuiteId) return;
        queryClient.invalidateQueries({ queryKey: ['test-suite-executions', testSuiteId] });
      }
    );

    return () => {
      unsubscribeSuiteUpdated();
      unsubscribeExecutionStarted();
      wsClient.unsubscribe([channel]);
    };
  }, [testSuiteId, queryClient]);
}
```

### Step 5: フロントエンド - PreconditionListをReact Queryに移行

`apps/web/src/components/test-suite/PreconditionList.tsx` を修正：

```typescript
// Before: useState + fetch
const [preconditions, setPreconditions] = useState<Precondition[]>([]);
const fetchPreconditions = useCallback(async () => { ... }, [testSuiteId]);

// After: React Query
const { data: preconditionsData, isLoading, error } = useQuery({
  queryKey: ['test-suite-preconditions', testSuiteId],
  queryFn: () => testSuitesApi.getPreconditions(testSuiteId),
});
const preconditions = useMemo(() => {
  return preconditionsData?.preconditions
    .slice()
    .sort((a, b) => a.orderKey.localeCompare(b.orderKey)) ?? [];
}, [preconditionsData]);
```

### Step 6: フロントエンド - ページにフック統合

`apps/web/src/pages/TestSuiteCases.tsx` に追加：

```typescript
import { useTestSuiteRealtime } from '../hooks/useTestSuiteRealtime';

export function TestSuiteCasesPage() {
  const { testSuiteId } = useParams<{ testSuiteId: string }>();

  // リアルタイム更新を有効化
  useTestSuiteRealtime(testSuiteId);

  // ... 既存コード ...
}
```

## 検証方法

1. Docker環境を起動: `cd docker && docker compose up`
2. 2つのブラウザタブで同じテストスイートの概要タブを開く
3. 片方でテストスイートの説明を編集 → もう片方で即座に反映されることを確認
4. 片方で前提条件を追加/編集/削除 → もう片方で即座に反映されることを確認
5. テスト実行を開始 → 概要タブの実行履歴が即座に更新されることを確認

## 注意事項

- Redis接続がない場合はイベント発行をスキップ（ローカル開発でRedisなしでも動作）
- WebSocket切断時は既存のwsClient実装で自動再接続・チャンネル再購読される
