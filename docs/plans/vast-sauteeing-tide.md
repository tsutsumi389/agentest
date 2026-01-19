# プロジェクト概要タブ WebSocketリアルタイム更新

## 概要
プロジェクト概要タブ（Dashboard）をWebSocketでリアルタイム更新に対応させる。
テスト実行結果の変更、テストケースの追加・更新時に自動で画面が更新される。

## 現状
- **WebSocket**: `apps/ws/` に実装済み、Redis Pub/Sub連携済み
- **Redis**: docker-compose.ymlに定義済み、起動中
- **概要タブ**: useState + useEffectで手動取得のみ（リアルタイム更新なし）

## 実装内容

### 1. WebSocketイベント型の追加
**ファイル**: `packages/ws-types/src/events.ts`

```typescript
// DashboardUpdatedEvent を追加
export interface DashboardUpdatedEvent extends BaseEvent {
  type: 'dashboard:updated';
  projectId: string;
  trigger: 'execution' | 'test_suite' | 'test_case' | 'review';
  resourceId?: string;
}

export type DashboardEvent = DashboardUpdatedEvent;

// ServerEvent に DashboardEvent を追加
export type ServerEvent =
  | ExecutionEvent
  | LockEvent
  | PresenceEvent
  | ReviewEvent
  | TestUpdateEvent
  | AgentEvent
  | DashboardEvent;  // 追加
```

### 2. API Redis Publisher作成
**新規ファイル**: `apps/api/src/lib/redis-publisher.ts`

- Redis PublisherをAPIから使えるようにする
- `publishDashboardUpdated(projectId, trigger, resourceId?)` 関数を提供
- Redis未設定時はスキップ（APIの動作は継続）

### 3. 各サービスでイベント発行

| サービス | タイミング | trigger |
|---------|-----------|---------|
| `test-suite.service.ts` | startExecution | `execution` |
| `execution.service.ts` | updateExpectedResult/updateStepResult等 | `execution` |
| `test-suite.service.ts` | create/update/softDelete/restore | `test_suite` |
| `test-case.service.ts` | create/update/softDelete | `test_case` |

### 4. フロントエンドカスタムフック作成
**新規ファイル**: `apps/web/src/hooks/useProjectDashboard.ts`

- `Channels.project(projectId)` を購読
- `dashboard:updated` イベント受信時にデバウンス付きリフェッチ
- `useEditLock.ts` のパターンに準拠

### 5. ProjectOverviewTab更新
**ファイル**: `apps/web/src/components/project/ProjectOverviewTab.tsx`

- `useProjectDashboard` フックを使用するように変更
- useState/useEffectでの手動取得を削除

## 修正ファイル一覧

| ファイル | 操作 |
|---------|------|
| `packages/ws-types/src/events.ts` | 編集 |
| `apps/api/src/lib/redis-publisher.ts` | 新規 |
| `apps/api/src/services/test-suite.service.ts` | 編集 |
| `apps/api/src/services/execution.service.ts` | 編集 |
| `apps/api/src/services/test-case.service.ts` | 編集 |
| `apps/web/src/hooks/useProjectDashboard.ts` | 新規 |
| `apps/web/src/components/project/ProjectOverviewTab.tsx` | 編集 |

## 検証方法

1. `docker compose up` で開発サーバー起動
2. ブラウザでプロジェクト概要タブを開く
3. 別タブ/別ブラウザで同じプロジェクトのテスト実行を開始
4. 概要タブがリロードなしで自動更新されることを確認
5. テストケース追加時も同様に確認
