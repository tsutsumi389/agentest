# 結合テスト改善計画

## 現状サマリー

| アプリ/パッケージ | 結合テスト数 | 状態 |
|-----------------|-----------|------|
| apps/api | 48ファイル | ✅ 成熟（一部ギャップあり） |
| apps/jobs | 5ファイル | ✅ 十分 |
| apps/mcp-server | 1ファイル | ⚠️ 認証のみ、ツール未カバー |
| apps/ws | 0ファイル | ❌ 未構築 |

### 対応済み作業（参照）
- `docs/plans/tdd-migration-plan.md` — 各パッケージのユニットテスト環境構築（全フェーズ完了）
- `docs/plans/concurrent-noodling-cray.md` — apps/api ユニットテスト改善計画（フェーズ1〜6）

---

## フェーズ1: apps/api 基本CRUDの結合テスト補完（優先度: HIGH）

既存の結合テストは特定機能（search, copy, events, history/restore, authorization）をカバーしているが、基本的なCRUD操作のエンドポイントテストが不足。

### 1.1 プロジェクト基本CRUD

- **作成ファイル**: `apps/api/src/__tests__/integration/project-crud.integration.test.ts`
- **テスト数**: ~25
- **対象エンドポイント**:
  - `POST /api/projects` — プロジェクト作成
  - `GET /api/projects` — 一覧取得（ページネーション、フィルタ）
  - `GET /api/projects/:projectId` — 詳細取得
  - `PATCH /api/projects/:projectId` — 更新
  - `DELETE /api/projects/:projectId` — 論理削除
- **テスト内容**:
  - 正常系CRUD一連の操作
  - 組織関連プロジェクトの作成と権限
  - 未認証（401）、権限不足（403）、存在しない（404）
  - バリデーションエラー（400）: 名前なし、長すぎる名前
  - 削除済みプロジェクトの表示制御
  - メンバー追加・ロール変更
- **参考パターン**: `organization-operations.integration.test.ts`
- **既存ヘルパー**: `createTestUser`, `createTestProject`, `createTestProjectMember`, `cleanupTestData`

### 1.2 テストスイート基本CRUD

- **作成ファイル**: `apps/api/src/__tests__/integration/test-suite-crud.integration.test.ts`
- **テスト数**: ~28
- **対象エンドポイント**:
  - `POST /api/test-suites` — テストスイート作成
  - `GET /api/test-suites` — 一覧取得
  - `GET /api/test-suites/:suiteId` — 詳細取得（preconditions, testCases含む）
  - `PATCH /api/test-suites/:suiteId` — 更新
  - `DELETE /api/test-suites/:suiteId` — 論理削除
  - `POST /api/test-suites/:suiteId/restore` — 復元
- **テスト内容**:
  - 正常系CRUD + ステータス遷移（DRAFT→ACTIVE→ARCHIVED）
  - プロジェクトメンバーのロール別アクセス（OWNER/ADMIN/WRITE/READ）
  - WRITEロール以上のみ作成・更新可能
  - READロールは閲覧のみ
  - 関連テストケース・前提条件の取得
  - 存在しないプロジェクトへの作成エラー
  - 削除後のアクセス制御
- **参考パターン**: `test-case-copy.integration.test.ts`（ロール別テスト）
- **既存ヘルパー**: `createTestSuite`, `createTestCase`, `createTestSuitePrecondition`

### 1.3 テストケース基本CRUD

- **作成ファイル**: `apps/api/src/__tests__/integration/test-case-crud.integration.test.ts`
- **テスト数**: ~35
- **対象エンドポイント**:
  - `POST /api/test-cases` — テストケース作成
  - `GET /api/test-cases/:caseId` — 詳細取得（steps, preconditions, expectedResults含む）
  - `PATCH /api/test-cases/:caseId` — 更新
  - `DELETE /api/test-cases/:caseId` — 論理削除
  - `POST /api/test-cases/:caseId/restore` — 復元
  - `POST /api/test-cases/:caseId/steps` — ステップ追加
  - `POST /api/test-cases/:caseId/preconditions` — 前提条件追加
  - `POST /api/test-cases/:caseId/expected-results` — 期待結果追加
- **テスト内容**:
  - テストケースCRUD（title, description, priority, status）
  - 子エンティティ（steps, preconditions, expectedResults）の作成・取得
  - orderKey自動計算の検証
  - ロール別アクセス（WRITE以上で作成・更新、READで閲覧）
  - 履歴レコード自動作成の確認
  - バリデーション（空タイトル、無効なpriority）
- **参考パターン**: `test-case-authorization.integration.test.ts`
- **既存ヘルパー**: `createTestCase`, `createTestCaseStep`, `createTestCaseExpectedResult`, `createTestCasePrecondition`

### 1.4 編集ロック結合テスト

- **作成ファイル**: `apps/api/src/__tests__/integration/edit-locks.integration.test.ts`
- **テスト数**: ~22
- **対象エンドポイント**:
  - `POST /api/locks` — ロック取得
  - `GET /api/locks` — ロック状態確認
  - `PATCH /api/locks/:lockId/heartbeat` — ハートビート更新
  - `DELETE /api/locks/:lockId` — ロック解放
  - `DELETE /api/locks/:lockId/force` — 強制解放（管理者）
- **テスト内容**:
  - ロック取得→ハートビート→解放の正常フロー
  - 同一ユーザーの再取得（ロック更新）
  - 他ユーザーによるロック競合（409 Conflict）
  - ロック期限切れ（90秒経過後の自動解放）
  - ハートビートの認可チェック（ロック所有者のみ）
  - 強制解放の権限チェック（OWNER/ADMINのみ）
  - ロック対象の種類（SUITE, CASE）
  - 存在しないロックのハートビート/解放（404）
  - 未認証でのアクセス（401）
- **モック**: `vi.useFakeTimers()` でロック期限切れをテスト
- **参考パターン**: `notifications.integration.test.ts`（シンプルなCRUDパターン）
- **ソース参考**: `apps/api/src/services/edit-lock.service.ts`（LOCK_DURATION_SECONDS=90, HEARTBEAT_INTERVAL_SECONDS=30）

---

## フェーズ2: apps/mcp-server ツール結合テスト（優先度: CRITICAL）

MCPサーバーはAIエージェントとの主要インターフェース。20ツールすべてにユニットテストはあるが、結合テストは認証セッションの1ファイルのみ。

### アーキテクチャ

```
HTTP POST /mcp
  → mcpHybridAuthenticate（認証）
  → agentSession（セッション管理）
  → recordHeartbeat（ハートビート）
  → mcpHandler（MCP Protocol処理）
    → AsyncLocalStorage.run(context)
      → tool.handler(input, context)
        → apiClient.post/get（Internal API呼び出し）
```

### テスト方針

MCPツールはInternal API（apps/api）へのリクエストを行うため、結合テストでは **apiClientをモック**し、MCPプロトコル層のフローを検証する。

- **認証**: モックJWT + モックユーザー
- **セッション管理**: 実DB（AgentSession作成/取得）
- **ツール実行**: apiClientモック（レスポンスを定義）
- **MCP Protocol**: `@modelcontextprotocol/sdk/client` でMCPクライアントとして接続

### 2.1 テスト基盤構築

- **作成ファイル**: `apps/mcp-server/src/__tests__/integration/mcp-tools-helpers.ts`
- **内容**:
  - MCPクライアント接続ヘルパー（`createMcpClient`）
  - apiClientモックファクトリ
  - 共通テストデータセットアップ
- **既存ヘルパー**: `apps/mcp-server/src/__tests__/integration/test-helpers.ts`（`createTestUser`, `createTestProject`, `createTestAgentSession`, `cleanupTestData`）

### 2.2 検索ツール結合テスト

- **作成ファイル**: `apps/mcp-server/src/__tests__/integration/mcp-search-tools.integration.test.ts`
- **テスト数**: ~20
- **対象ツール**:
  - `search_project` — プロジェクト検索
  - `search_test_suite` — テストスイート検索
  - `search_test_case` — テストケース検索
  - `search_execution` — 実行結果検索
- **テスト内容**:
  - 認証済みMCPセッションからツール呼び出し
  - 検索パラメータ（keyword, filter, pagination）の正しい伝達
  - 未認証でのツール呼び出しエラー
  - APIエラー時のMCPエラーレスポンス形式

### 2.3 CRUDツール結合テスト

- **作成ファイル**: `apps/mcp-server/src/__tests__/integration/mcp-crud-tools.integration.test.ts`
- **テスト数**: ~30
- **対象ツール**:
  - `create_test_suite` / `update_test_suite` / `delete_test_suite`
  - `create_test_case` / `update_test_case` / `delete_test_case`
  - `get_project` / `get_test_suite` / `get_test_case` / `get_execution`
- **テスト内容**:
  - CRUD操作の正常系（作成→取得→更新→削除）
  - Zodバリデーションエラー（無効なUUID、必須パラメータ不足）
  - API 403/404エラーのMCPエラー変換
  - レスポンスJSON構造の検証

### 2.4 実行・エビデンスツール結合テスト

- **作成ファイル**: `apps/mcp-server/src/__tests__/integration/mcp-execution-tools.integration.test.ts`
- **テスト数**: ~18
- **対象ツール**:
  - `create_execution`
  - `update_execution_precondition_result`
  - `update_execution_step_result`
  - `update_execution_expected_result`
  - `upload_execution_evidence`
- **テスト内容**:
  - 実行作成→結果更新の連続操作
  - 各結果タイプ（PASS/FAIL/SKIP/PENDING）の更新
  - エビデンスアップロードのリクエスト形式
  - 存在しないエンティティへの操作エラー

### 2.5 MCPワークフロー結合テスト

- **作成ファイル**: `apps/mcp-server/src/__tests__/integration/mcp-workflow.integration.test.ts`
- **テスト数**: ~12
- **テスト内容**:
  - **E2Eシナリオ**: 検索→テストスイート作成→テストケース作成→実行作成→結果入力
  - セッション管理: セッション作成→ハートビート→終了
  - 複数ツールの連続呼び出し時のコンテキスト保持
  - エラーリカバリ: ツール失敗後の再試行

---

## フェーズ3: apps/ws WebSocket結合テスト（優先度: MEDIUM）

リアルタイム通知はUXに直結。ユニットテストは4ファイルで完了済みだが、結合テストが未構築。

### 3.1 テスト基盤構築

- **作成/更新ファイル**: `apps/ws/vitest.config.ts`（結合テスト対応設定追加）
- **作成ファイル**: `apps/ws/src/__tests__/integration/test-helpers.ts`
- **内容**:
  - WebSocketクライアント接続ヘルパー
  - Redisサブスクリプションモック/実接続
  - テストデータセットアップ

### 3.2 WebSocket接続結合テスト

- **作成ファイル**: `apps/ws/src/__tests__/integration/ws-connection.integration.test.ts`
- **テスト数**: ~15
- **テスト内容**:
  - 認証済みWebSocket接続の確立
  - 未認証接続の拒否
  - 無効なトークンでの接続拒否
  - 接続切断時のクリーンアップ
  - 再接続処理
  - 複数クライアント同時接続

### 3.3 イベントブロードキャスト結合テスト

- **作成ファイル**: `apps/ws/src/__tests__/integration/ws-broadcast.integration.test.ts`
- **テスト数**: ~18
- **テスト内容**:
  - Redisイベント受信→WebSocket配信
  - プロジェクト別のイベントフィルタリング
  - 編集ロックイベント（ロック取得/解放通知）
  - テスト実行状態変更通知
  - ダッシュボード更新通知
  - イベントの型安全性（ws-types準拠）

---

## 全体サマリー

| フェーズ | タスク数 | 新規テスト数 | 新規ファイル数 | 優先度 |
|---------|---------|------------|-------------|--------|
| 1. API CRUD補完 | 4 | ~110 | 4 | HIGH |
| 2. MCPツール結合 | 5 | ~80 | 5 | CRITICAL |
| 3. WebSocket結合 | 3 | ~33 | 3 | MEDIUM |
| **合計** | **12** | **~223** | **12** | |

---

## 依存関係

```
フェーズ1（すべて独立・並列可能）
  1.1, 1.2, 1.3, 1.4 → 依存なし

フェーズ2（基盤→個別テスト）
  2.1 (基盤) → 2.2, 2.3, 2.4 → 2.5 (ワークフロー)

フェーズ3（基盤→テスト）
  3.1 (基盤) → 3.2, 3.3
```

---

## テスト規約（既存パターン準拠）

- **ファイル配置**: `src/__tests__/integration/`
- **命名**: `<feature>.integration.test.ts`
- **認証モック**: `vi.mock('@agentest/auth')` + `mockAuthUser` グローバル変数
- **ロール管理**: `mockProjectRole`, `mockOrgRole` 等のグローバル変数
- **テストデータ**: `test-helpers.ts` のファクトリ関数を使用
- **クリーンアップ**: `cleanupTestData()` を `afterAll` と必要に応じて `beforeEach` で呼び出し
- **コメント**: describe/it文字列は日本語
- **ライフサイクル**: `beforeAll` でapp作成、`beforeEach` でデータリセット
- **アサーション**: ステータスコード + レスポンスボディ構造 + DB状態確認

## 参考ファイル

- `apps/api/src/__tests__/integration/organization-operations.integration.test.ts` — CRUD結合テストの模範
- `apps/api/src/__tests__/integration/notifications.integration.test.ts` — シンプルなCRUDパターン
- `apps/api/src/__tests__/integration/test-case-copy.integration.test.ts` — ロール別テストの模範
- `apps/api/src/__tests__/integration/reviews.integration.test.ts` — 高度な認証モック（vi.hoisted）
- `apps/api/src/__tests__/integration/test-helpers.ts` — ファクトリ関数一覧（1400行+）
- `apps/mcp-server/src/__tests__/integration/mcp-auth-session.integration.test.ts` — MCP結合テストの模範
- `apps/mcp-server/src/__tests__/integration/test-helpers.ts` — MCPヘルパー関数

## 検証方法

各フェーズ完了時に以下を実行:
```bash
# apps/api
docker compose exec dev pnpm --filter api test
docker compose exec dev pnpm --filter api test:coverage

# apps/mcp-server
docker compose exec dev pnpm --filter mcp-server test
docker compose exec dev pnpm --filter mcp-server test:coverage

# apps/ws
docker compose exec dev pnpm --filter ws test
docker compose exec dev pnpm --filter ws test:coverage
```

---

*作成日: 2026-02-04*
