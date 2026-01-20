# テストスイート・テストケース全タブ WebSocketリアルタイム更新

## 概要

テストスイートとテストケースの**全てのタブ**をWebSocketでリアルタイム更新に対応させる。

## 対象タブとデータ

### テストスイート詳細ページ（5タブ）

| タブ | 表示データ | 更新イベント | React Queryキー |
|-----|-----------|-------------|----------------|
| **概要** | 説明、前提条件、実行履歴 | `test_suite:updated`, `execution:started` | `test-suite`, `test-suite-preconditions`, `test-suite-executions` |
| **実行履歴** | 実行一覧 | `execution:started`, `execution:*_updated` | `test-suite-executions` |
| **レビュー** | レビュー一覧 | `review:*` | `test-suite-reviews`, `review-detail` |
| **変更履歴** | 履歴一覧 | `test_suite:updated`, `test_case:updated` | `test-suite-histories` |
| **設定** | ラベル | `test_suite:updated` | `test-suite-labels` |

### テストケース詳細パネル（3タブ）

| タブ | 表示データ | 更新イベント | React Queryキー |
|-----|-----------|-------------|----------------|
| **概要** | 説明、前提条件、手順、期待結果 | `test_case:updated` | `test-case-details` |
| **履歴** | 変更履歴 | `test_case:updated` | `test-case-histories` |
| **設定** | 削除 | - | - |

## 実装方針

1. **既存イベント型を活用**: `test_suite:updated`, `test_case:updated`, `execution:*`, `review:*`
2. **バックエンド**: 未実装の19メソッドにイベント発行を追加
3. **フロントエンド**: 統一されたリアルタイム更新フックを作成

## 変更ファイル

### バックエンド

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/lib/events.ts` | **新規** - イベント発行ヘルパー関数 |
| `apps/api/src/services/test-suite.service.ts` | 前提条件・並び替えにイベント発行追加（5メソッド） |
| `apps/api/src/services/test-case.service.ts` | 子エンティティ操作にイベント発行追加（14メソッド） |

### フロントエンド

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/hooks/useTestSuiteRealtime.ts` | **新規** - テストスイートリアルタイム更新フック |
| `apps/web/src/hooks/useTestCaseRealtime.ts` | **新規** - テストケースリアルタイム更新フック |
| `apps/web/src/pages/TestSuiteCases.tsx` | フック統合 |
| `apps/web/src/components/test-suite/PreconditionList.tsx` | React Query移行 |
| `apps/web/src/components/test-suite/TestSuiteHistoryList.tsx` | React Query移行 |
| `apps/web/src/components/test-case/TestCaseHistoryList.tsx` | React Query移行 |

## 実装手順

### Step 1: バックエンド - イベント発行ヘルパー作成

`apps/api/src/lib/events.ts`:

```typescript
import { Channels, type TestSuiteUpdatedEvent, type TestCaseUpdatedEvent } from '@agentest/ws-types';
import { publishEvent } from './redis-publisher.js';
import { randomUUID } from 'node:crypto';

type UpdatedBy = { type: 'user' | 'agent'; id: string; name: string };
type Change = { field: string; oldValue: unknown; newValue: unknown };

export async function publishTestSuiteUpdated(
  testSuiteId: string,
  projectId: string,
  changes: Change[],
  updatedBy: UpdatedBy
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

export async function publishTestCaseUpdated(
  testCaseId: string,
  testSuiteId: string,
  projectId: string,
  changes: Change[],
  updatedBy: UpdatedBy
): Promise<void> {
  const event: TestCaseUpdatedEvent = {
    type: 'test_case:updated',
    eventId: randomUUID(),
    timestamp: Date.now(),
    testCaseId,
    testSuiteId,
    projectId,
    changes,
    updatedBy,
  };
  await Promise.all([
    publishEvent(Channels.project(projectId), event),
    publishEvent(Channels.testSuite(testSuiteId), event),
    publishEvent(Channels.testCase(testCaseId), event),
  ]);
}
```

### Step 2: バックエンド - TestSuiteServiceにイベント発行追加

対象メソッド:
- `addPrecondition()` - 前提条件追加
- `updatePrecondition()` - 前提条件更新
- `deletePrecondition()` - 前提条件削除
- `reorderPreconditions()` - 前提条件並び替え
- `reorderTestCases()` - テストケース並び替え

各メソッドの最後に追加:
```typescript
await publishTestSuiteUpdated(testSuiteId, projectId, [
  { field: 'precondition:add', oldValue: null, newValue: preconditionId }
], { type: 'user', id: userId, name: userName });
```

### Step 3: バックエンド - TestCaseServiceにイベント発行追加

対象メソッド（14個）:
- 前提条件: add, update, delete, reorder
- 手順: add, update, delete, reorder
- 期待結果: add, update, delete, reorder
- 複合操作: copy, updateWithChildren

### Step 4: フロントエンド - useTestSuiteRealtime.ts作成

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsClient } from '../lib/ws';
import { Channels } from '@agentest/ws-types';
import type { TestSuiteUpdatedEvent, TestCaseUpdatedEvent, ExecutionStartedEvent } from '@agentest/ws-types';

export function useTestSuiteRealtime(testSuiteId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!testSuiteId) return;

    const channel = Channels.testSuite(testSuiteId);
    wsClient.subscribe([channel]);

    // テストスイート更新
    const unsubSuiteUpdated = wsClient.on<TestSuiteUpdatedEvent>('test_suite:updated', (event) => {
      if (event.testSuiteId !== testSuiteId) return;

      queryClient.invalidateQueries({ queryKey: ['test-suite', testSuiteId] });

      if (event.changes.some(c => c.field.startsWith('precondition'))) {
        queryClient.invalidateQueries({ queryKey: ['test-suite-preconditions', testSuiteId] });
      }
      // 変更履歴も更新
      queryClient.invalidateQueries({ queryKey: ['test-suite-histories', testSuiteId] });
    });

    // テストケース更新（テストスイートチャンネル経由）
    const unsubCaseUpdated = wsClient.on<TestCaseUpdatedEvent>('test_case:updated', (event) => {
      if (event.testSuiteId !== testSuiteId) return;

      queryClient.invalidateQueries({ queryKey: ['test-case-details', event.testCaseId] });
      queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
      queryClient.invalidateQueries({ queryKey: ['test-suite-histories', testSuiteId] });
      queryClient.invalidateQueries({ queryKey: ['test-case-histories', event.testCaseId] });
    });

    // 実行開始
    const unsubExecStarted = wsClient.on<ExecutionStartedEvent>('execution:started', (event) => {
      if (event.testSuiteId !== testSuiteId) return;
      queryClient.invalidateQueries({ queryKey: ['test-suite-executions', testSuiteId] });
    });

    return () => {
      unsubSuiteUpdated();
      unsubCaseUpdated();
      unsubExecStarted();
      wsClient.unsubscribe([channel]);
    };
  }, [testSuiteId, queryClient]);
}
```

### Step 5: フロントエンド - useTestCaseRealtime.ts作成

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsClient } from '../lib/ws';
import { Channels } from '@agentest/ws-types';
import type { TestCaseUpdatedEvent } from '@agentest/ws-types';

export function useTestCaseRealtime(testCaseId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!testCaseId) return;

    const channel = Channels.testCase(testCaseId);
    wsClient.subscribe([channel]);

    const unsubCaseUpdated = wsClient.on<TestCaseUpdatedEvent>('test_case:updated', (event) => {
      if (event.testCaseId !== testCaseId) return;

      queryClient.invalidateQueries({ queryKey: ['test-case-details', testCaseId] });
      queryClient.invalidateQueries({ queryKey: ['test-case-histories', testCaseId] });
    });

    return () => {
      unsubCaseUpdated();
      wsClient.unsubscribe([channel]);
    };
  }, [testCaseId, queryClient]);
}
```

### Step 6: フロントエンド - useState+fetchをReact Queryに移行

#### PreconditionList.tsx
```typescript
// Before
const [preconditions, setPreconditions] = useState<Precondition[]>([]);
const fetchPreconditions = useCallback(async () => { ... }, [testSuiteId]);

// After
const { data } = useQuery({
  queryKey: ['test-suite-preconditions', testSuiteId],
  queryFn: () => testSuitesApi.getPreconditions(testSuiteId),
});
```

#### TestSuiteHistoryList.tsx
```typescript
// After
const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['test-suite-histories', testSuiteId],
  queryFn: ({ pageParam }) => testSuitesApi.getHistories(testSuiteId, { cursor: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

#### TestCaseHistoryList.tsx
```typescript
// After
const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['test-case-histories', testCaseId],
  queryFn: ({ pageParam }) => testCasesApi.getHistories(testCaseId, { cursor: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

### Step 7: フロントエンド - ページにフック統合

`apps/web/src/pages/TestSuiteCases.tsx`:
```typescript
import { useTestSuiteRealtime } from '../hooks/useTestSuiteRealtime';
import { useTestCaseRealtime } from '../hooks/useTestCaseRealtime';

export function TestSuiteCasesPage() {
  const { testSuiteId } = useParams();
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string>();

  // リアルタイム更新を有効化
  useTestSuiteRealtime(testSuiteId);
  useTestCaseRealtime(selectedTestCaseId);

  // ...
}
```

## 検証方法

1. Docker環境を起動: `cd docker && docker compose up`
2. 2つのブラウザタブで同じテストスイートを開く
3. 以下を確認:
   - **概要タブ**: 説明・前提条件編集が即座に反映
   - **実行履歴タブ**: 実行開始が即座に反映
   - **レビュータブ**: コメント追加が即座に反映（既存実装）
   - **変更履歴タブ**: 履歴が即座に更新
   - **テストケース概要**: 手順・期待結果編集が即座に反映
   - **テストケース履歴**: 履歴が即座に更新

## 注意事項

- Redis接続がない場合はイベント発行をスキップ（ローカル開発対応）
- WebSocket切断時は既存実装で自動再接続・再購読
- デバウンスは不要（React Queryのstale設定で制御）
