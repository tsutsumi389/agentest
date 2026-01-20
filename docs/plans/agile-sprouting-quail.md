# プロジェクトダッシュボード WebSocket リアルタイム更新 - ドキュメント更新プラン

## 概要

vast-sauteeing-tide.md の実装完了に伴い、関連ドキュメントを更新する。

## 実装完了内容の確認

以下の実装が完了済み：

| ファイル | 内容 |
|----------|------|
| `packages/ws-types/src/events.ts` | `DashboardUpdatedEvent` 型追加 |
| `apps/api/src/lib/redis-publisher.ts` | Redis Publisher 新規作成 |
| `apps/api/src/services/test-suite.service.ts` | イベント発行追加 |
| `apps/api/src/services/execution.service.ts` | イベント発行追加 |
| `apps/api/src/services/test-case.service.ts` | イベント発行追加 |
| `apps/web/src/hooks/useProjectDashboard.ts` | カスタムフック新規作成 |
| `apps/web/src/components/project/ProjectOverviewTab.tsx` | フック使用に変更 |

## 更新対象ドキュメント

### 1. docs/architecture/features/project-dashboard.md（高優先度）

**現状**: 手動取得（useState + useEffect）のみ記載。WebSocket リアルタイム更新の記載なし。

**更新内容**:

1. 機能一覧に「PDB-006 リアルタイム更新」を追加
2. 「リアルタイム更新」セクションを新規追加:
   - WebSocket による自動更新の仕組み
   - トリガー種別（execution, test_suite, test_case, review）
   - デバウンス処理（500ms）
3. フロントエンドコンポーネント表に `useProjectDashboard.ts` を追加
4. データ取得フローにリアルタイム更新フローを追加

### 2. docs/architecture/overview.md（中優先度）

**現状**: リアルタイム更新フローの一般的な説明のみ。

**更新内容**:

1. packages/ws-types の説明に `DashboardEvent` を追記
2. リアルタイム更新フローの説明を補足（必要に応じて）

### 3. docs/architecture/diagrams/system-overview.md（低優先度）

**現状**: test-case:updated の例があるが、汎用的なフローとして問題なし。

**更新内容**:

- 現状維持（既存のシーケンス図は汎用的で dashboard:updated にも適用可能）

## 具体的な編集内容

### project-dashboard.md への追加

```markdown
## 機能一覧

| ID | 機能名 | 説明 | 状態 |
|----|--------|------|------|
| ... | ... | ... | ... |
| PDB-006 | リアルタイム更新 | WebSocketによるダッシュボードの自動更新 | 実装済 |

## リアルタイム更新

### 概要

プロジェクトダッシュボードは WebSocket を通じてリアルタイムに更新される。テスト実行結果の変更、テストスイート・テストケースの追加・更新時に自動で画面が更新される。

### WebSocket イベント

| イベント | 説明 |
|----------|------|
| `dashboard:updated` | ダッシュボードデータの更新通知 |

### トリガー種別

| trigger | 発火タイミング |
|---------|----------------|
| `execution` | テスト実行開始、結果更新時 |
| `test_suite` | テストスイート作成・更新・削除・復元時 |
| `test_case` | テストケース作成・更新・削除・復元時 |
| `review` | レビュー関連操作時 |

### 更新フロー

1. バックエンドでテストスイート/ケース/実行の操作が発生
2. Redis Pub/Sub 経由で `dashboard:updated` イベントを発行
3. WebSocket サーバーがプロジェクトチャンネルに配信
4. フロントエンドの `useProjectDashboard` フックがイベントを受信
5. 500ms のデバウンス後、ダッシュボード API をリフェッチ
6. UI が自動更新

### フロントエンドコンポーネント

| ファイル | 説明 |
|----------|------|
| `apps/web/src/hooks/useProjectDashboard.ts` | ダッシュボードデータ取得・WebSocket購読フック |
```

### overview.md への追加

packages/ws-types の説明を補足:

```markdown
| `packages/ws-types` | WebSocket イベント型 (`apps/ws` と連携) - ExecutionEvent, LockEvent, DashboardEvent 等 |
```

## 検証方法

1. 各ドキュメントファイルが正しく更新されていることを確認
2. マークダウンの構文エラーがないことを確認
3. 内部リンクが正しく機能することを確認
