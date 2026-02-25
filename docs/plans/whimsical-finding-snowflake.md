# 実行結果のWebSocketリアルタイム更新

## Context

実行ページ（`/executions/:executionId`）では、MCPツールや他ユーザーが前提条件・ステップ・期待結果を更新しても、手動リロードしない限り反映されない。WebSocketインフラ（Redis pub/sub → WSサーバー → クライアント）は既に稼働しており、実行イベント型も`ws-types`に定義済みだが、**APIが粒度の細かいイベントを発行していない**ことが唯一のギャップ。

## 変更概要

| # | ファイル | 変更内容 |
|---|---------|---------|
| 1 | `apps/api/src/lib/execution-events.ts` | **新規** - 実行イベント発行ヘルパー |
| 2 | `apps/api/src/services/execution.service.ts` | **修正** - 各更新メソッドにイベント発行追加 |
| 3 | `apps/web/src/hooks/useExecutionRealtime.ts` | **新規** - 実行チャンネル購読フック |
| 4 | `apps/web/src/pages/Execution.tsx` | **修正** - フック呼び出し追加（1行） |

変更不要:
- `packages/ws-types/src/events.ts` - イベント型は定義済み
- `apps/ws/src/server.ts` - Redis→WebSocket転送は汎用的に動作済み

## Step 1: APIイベント発行ヘルパー作成

**ファイル**: `apps/api/src/lib/execution-events.ts`（新規）

`events.ts`の`publishTestSuiteUpdated`/`publishTestCaseUpdated`と同じパターンで、4つの関数を作成:

```typescript
import { Channels } from '@agentest/ws-types';
import type { ExecutionPreconditionUpdatedEvent, ExecutionStepUpdatedEvent, ExecutionExpectedResultUpdatedEvent, ExecutionEvidenceAddedEvent } from '@agentest/ws-types';
import { randomUUID } from 'node:crypto';
import { publishEvent } from './redis-publisher.js';

export async function publishExecutionPreconditionUpdated(params: {
  executionId: string; resultId: string; snapshotPreconditionId: string;
  status: string; note: string | null;
}): Promise<void> {
  const event: ExecutionPreconditionUpdatedEvent = {
    type: 'execution:precondition_updated',
    eventId: randomUUID(), timestamp: Date.now(),
    ...params,
  };
  await publishEvent(Channels.execution(params.executionId), event);
}

// publishExecutionStepUpdated, publishExecutionExpectedResultUpdated, publishExecutionEvidenceAdded も同様
```

チャンネルは `execution:{executionId}` のみ（実行詳細ページの購読先）。

## Step 2: ExecutionServiceにイベント発行追加

**ファイル**: `apps/api/src/services/execution.service.ts`

3つの更新メソッド + エビデンス確認完了の計4箇所に追加。`result`（findFirstの結果）からスナップショットIDを取得:

### updatePreconditionResult（139行目付近、publishDashboardUpdatedの後）
```typescript
await publishExecutionPreconditionUpdated({
  executionId,
  resultId: preconditionResultId,
  snapshotPreconditionId: result.executionSuitePreconditionId ?? result.executionCasePreconditionId ?? '',
  status: data.status,
  note: data.note ?? null,
});
```

### updateStepResult（184行目付近）
```typescript
await publishExecutionStepUpdated({
  executionId,
  resultId: stepResultId,
  snapshotTestCaseId: result.executionTestCaseId ?? '',
  snapshotStepId: result.executionStepId,
  status: data.status,
  note: data.note ?? null,
});
```

### updateExpectedResult（229行目付近）
```typescript
await publishExecutionExpectedResultUpdated({
  executionId,
  resultId: expectedResultId,
  snapshotTestCaseId: result.executionTestCaseId ?? '',
  snapshotExpectedResultId: result.executionExpectedResultId,
  status: data.status,
  note: data.note ?? null,
});
```

### confirmEvidenceUpload（551行目付近、fileSize更新後）
```typescript
await publishExecutionEvidenceAdded({
  executionId,
  expectedResultId: evidence.expectedResultId,
  evidence: { id: evidence.id, fileName: evidence.fileName, fileUrl: evidence.fileUrl, fileType: evidence.fileType },
});
```

## Step 3: useExecutionRealtimeフック作成

**ファイル**: `apps/web/src/hooks/useExecutionRealtime.ts`（新規）

`useTestSuiteRealtime`と同じパターン。イベント受信時、`setQueryData`でキャッシュの該当結果だけをパッチ（ページ全体の再取得なし）:

```typescript
export function useExecutionRealtime(executionId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!executionId) return;
    const channel = Channels.execution(executionId);
    wsClient.subscribe([channel]);

    // 前提条件更新 → status/noteをパッチ + バックグラウンド再取得
    const unsubPrecondition = wsClient.on<ExecutionPreconditionUpdatedEvent>(
      'execution:precondition_updated', (event) => {
        if (event.executionId !== executionId) return;
        queryClient.setQueryData<{ execution: ExecutionWithDetails }>(
          queryKey, (old) => /* resultId一致するものだけstatus/noteを差し替え */
        );
        // 実施者情報など完全データ取得のため、バックグラウンドで再取得をマーク
        queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
      }
    );

    // ステップ更新、期待結果更新も同様のパターン

    // エビデンス追加 → downloadUrlが必要なため invalidateQueries（完全再取得）
    const unsubEvidence = wsClient.on<ExecutionEvidenceAddedEvent>(
      'execution:evidence_added', (event) => {
        if (event.executionId !== executionId) return;
        queryClient.invalidateQueries({ queryKey: ['execution', executionId, 'details'] });
      }
    );

    return () => { /* unsubscribe all + wsClient.unsubscribe */ };
  }, [executionId, queryClient]);
}
```

**自身の楽観的更新との重複について**: WS経由で自分の変更が返ってきても、同じstatus/noteが再セットされるだけなのでReactの差分検出でre-renderは発生しない。requestIdベースの重複排除は不要（問題が出た場合に後から追加可能）。

**`invalidateQueries({ refetchType: 'none' })`の意図**: キャッシュをstaleとマークするだけで即時refetchはしない。次にコンポーネントがre-mountされた時やウィンドウフォーカス時に完全データを取得する。これにより、実施者情報（checkedByUser等）も最終的に反映される。

## Step 4: Execution.tsxにフック追加

**ファイル**: `apps/web/src/pages/Execution.tsx`

```typescript
import { useExecutionRealtime } from '../hooks/useExecutionRealtime';

export function ExecutionPage() {
  const { executionId } = useParams<{ executionId: string }>();
  // ... 既存コード ...
  useExecutionRealtime(executionId);  // ← 追加（1行）
```

## データフロー

```
MCPツール / 他ユーザー → API → DB更新
                               ↓
                    publishEvent → Redis pub/sub
                               ↓
                    WSサーバー → WebSocket broadcast
                               ↓
                    useExecutionRealtime → setQueryData（キャッシュパッチ）
                               ↓
                    前提条件/ステップ/期待結果セクションのみ再描画
```

## 検証方法

1. `docker compose up` で開発サーバー起動
2. ブラウザで実行ページ（`/executions/:id`）を開く
3. **MCPツール経由のテスト**: 別ターミナルからMCPツール（`update-execution-precondition-result`等）を実行 → ブラウザがリロードなしで更新されることを確認
4. **他ユーザーのテスト**: 別ブラウザ/シークレットウィンドウで同じ実行ページを開き、片方で更新 → もう片方に反映されることを確認
5. **エビデンス追加**: MCPまたは別タブからエビデンスアップロード → リストに反映されることを確認
6. DevToolsのNetworkタブで、ステータス更新時にAPIリフェッチが発生していない（WS経由のキャッシュパッチのみ）ことを確認
