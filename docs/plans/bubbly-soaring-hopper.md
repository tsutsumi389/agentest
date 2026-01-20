# WebSocketリアルタイム更新ドキュメント更新計画

## 概要

`docs/plans/partitioned-plotting-mist.md` の実装が完了したため、関連するドキュメントを更新する。

## 実装確認結果

全ての実装が完了していることを確認:

### バックエンド
- `apps/api/src/lib/events.ts` - イベント発行ヘルパー関数
- `apps/api/src/services/test-suite.service.ts` - 5メソッドにイベント発行追加
- `apps/api/src/services/test-case.service.ts` - 14メソッドにイベント発行追加

### フロントエンド
- `apps/web/src/hooks/useTestSuiteRealtime.ts` - テストスイートリアルタイム更新フック
- `apps/web/src/hooks/useTestCaseRealtime.ts` - テストケースリアルタイム更新フック
- `apps/web/src/pages/TestSuiteCases.tsx` - フック統合
- `apps/web/src/components/test-suite/PreconditionList.tsx` - React Query移行
- `apps/web/src/components/test-suite/TestSuiteHistoryList.tsx` - React Query移行
- `apps/web/src/components/test-case/TestCaseHistoryList.tsx` - React Query移行

## 更新対象ドキュメント

### 1. `docs/architecture/features/test-suite-management.md`

**追加セクション**: リアルタイム更新

- WebSocketイベント（`test_suite:updated`, `test_case:updated`, `execution:started`）
- 更新トリガー（前提条件操作、テストケース並び替え等）
- 更新の仕組み（Redis Pub/Sub → WebSocket → React Query invalidation）
- フロントエンド実装ファイル（`useTestSuiteRealtime.ts`）
- バックエンド実装ファイル（`events.ts`, `test-suite.service.ts`）

**追加箇所**: 業務フロー の後、データモデル の前

### 2. `docs/architecture/features/test-case-management.md`

**追加セクション**: リアルタイム更新

- WebSocketイベント（`test_case:updated`）
- 更新トリガー（前提条件・手順・期待結果の操作、コピー等）
- 更新の仕組み
- フロントエンド実装ファイル（`useTestCaseRealtime.ts`）
- バックエンド実装ファイル（`events.ts`, `test-case.service.ts`）

**追加箇所**: 業務フロー の後、データモデル の前

### 3. `docs/architecture/overview.md`

**更新内容**: ws-typesパッケージの説明を更新

```
現在: ExecutionEvent, LockEvent, DashboardEvent 等
更新後: ExecutionEvent, LockEvent, DashboardEvent, TestSuiteUpdatedEvent, TestCaseUpdatedEvent 等
```

## 更新内容詳細

### test-suite-management.md に追加するセクション

```markdown
## リアルタイム更新

### 概要

テストスイート詳細画面は WebSocket を通じてリアルタイムに更新される。前提条件の操作、テストケースの並び替え時に自動で画面が更新される。

### WebSocket イベント

| イベント | 説明 |
|----------|------|
| `test_suite:updated` | テストスイートデータの更新通知 |
| `test_case:updated` | テストケースデータの更新通知（テストスイートチャンネル経由） |
| `execution:started` | テスト実行開始通知 |

### 更新トリガー

| 操作 | 発火イベント | 無効化されるクエリキー |
|------|-------------|---------------------|
| 前提条件追加 | `test_suite:updated` | `test-suite`, `test-suite-preconditions`, `test-suite-histories` |
| 前提条件更新 | `test_suite:updated` | `test-suite`, `test-suite-preconditions`, `test-suite-histories` |
| 前提条件削除 | `test_suite:updated` | `test-suite`, `test-suite-preconditions`, `test-suite-histories` |
| 前提条件並び替え | `test_suite:updated` | `test-suite`, `test-suite-preconditions`, `test-suite-histories` |
| テストケース並び替え | `test_suite:updated` | `test-suite`, `test-suite-cases`, `test-suite-histories` |
| テストケース更新 | `test_case:updated` | `test-case-details`, `test-suite-cases`, `test-suite-histories`, `test-case-histories` |
| 実行開始 | `execution:started` | `test-suite-executions` |

### 更新の仕組み

1. バックエンドで前提条件/テストケースの操作が発生
2. Redis Pub/Sub 経由でイベントを発行（プロジェクト・テストスイートチャンネル）
3. WebSocket サーバーが購読者に配信
4. フロントエンドの `useTestSuiteRealtime` フックがイベントを受信
5. React Query のキャッシュを無効化
6. UI が自動更新

### フロントエンド実装

| ファイル | 説明 |
|----------|------|
| `apps/web/src/hooks/useTestSuiteRealtime.ts` | テストスイートリアルタイム更新フック |
| `apps/web/src/pages/TestSuiteCases.tsx` | フック統合 |

### バックエンド実装

| ファイル | 説明 |
|----------|------|
| `apps/api/src/lib/events.ts` | イベント発行ヘルパー関数 |
| `apps/api/src/services/test-suite.service.ts` | イベント発行を含むサービス |
| `packages/ws-types/src/events.ts` | TestSuiteUpdatedEvent 型定義 |
```

### test-case-management.md に追加するセクション

```markdown
## リアルタイム更新

### 概要

テストケース詳細パネルは WebSocket を通じてリアルタイムに更新される。前提条件・手順・期待結果の操作時に自動で画面が更新される。

### WebSocket イベント

| イベント | 説明 |
|----------|------|
| `test_case:updated` | テストケースデータの更新通知 |

### 更新トリガー

| 操作 | 発火イベント | 無効化されるクエリキー |
|------|-------------|---------------------|
| 前提条件追加/更新/削除/並び替え | `test_case:updated` | `test-case-details`, `test-case-histories` |
| 手順追加/更新/削除/並び替え | `test_case:updated` | `test-case-details`, `test-case-histories` |
| 期待結果追加/更新/削除/並び替え | `test_case:updated` | `test-case-details`, `test-case-histories` |
| テストケースコピー | `test_case:updated` | `test-case-details`, `test-case-histories` |
| 一括更新 | `test_case:updated` | `test-case-details`, `test-case-histories` |

### 更新の仕組み

1. バックエンドで前提条件/手順/期待結果の操作が発生
2. Redis Pub/Sub 経由でイベントを発行（プロジェクト・テストスイート・テストケースチャンネル）
3. WebSocket サーバーが購読者に配信
4. フロントエンドの `useTestCaseRealtime` フックがイベントを受信
5. React Query のキャッシュを無効化
6. UI が自動更新

### フロントエンド実装

| ファイル | 説明 |
|----------|------|
| `apps/web/src/hooks/useTestCaseRealtime.ts` | テストケースリアルタイム更新フック |
| `apps/web/src/pages/TestSuiteCases.tsx` | フック統合 |

### バックエンド実装

| ファイル | 説明 |
|----------|------|
| `apps/api/src/lib/events.ts` | イベント発行ヘルパー関数 |
| `apps/api/src/services/test-case.service.ts` | イベント発行を含むサービス |
| `packages/ws-types/src/events.ts` | TestCaseUpdatedEvent 型定義 |
```

## 検証方法

1. 各ドキュメントを更新後、マークダウンの構文エラーがないことを確認
2. 内部リンクが正しく機能することを確認
3. 記載内容が実装と一致していることを確認
