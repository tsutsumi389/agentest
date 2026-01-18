# 判定結果の表示統一とNOT_EXECUTABLE削除

## 概要
期待結果の判定ステータスの文言・色を全画面で統一し、NOT_EXECUTABLEを削除する。

### 文言の変更
| ステータス | 現在のラベル | 変更後のラベル |
|----------|------------|--------------|
| PENDING | 未判定 | 未判定（変更なし） |
| PASS | PASS | **成功** |
| FAIL | FAIL | **失敗** |
| SKIPPED | スキップ | スキップ（変更なし） |
| NOT_EXECUTABLE | 実行不可 | **削除** |

### 色の統一（全画面で以下を使用）
| ステータス | テキスト色 | 背景色 |
|----------|----------|-------|
| PENDING（未判定） | text-foreground-muted | bg-background-tertiary |
| PASS（成功） | text-success | bg-success-subtle |
| FAIL（失敗） | text-danger | bg-danger-subtle |
| SKIPPED（スキップ） | text-warning | bg-warning-subtle |

**方針**: 各コンポーネントで直接色をハードコードしている箇所を`execution-status.ts`の設定を参照するように統一する。

## 修正対象ファイル

### 1. 型定義・スキーマ（5ファイル）
- `packages/db/prisma/schema.prisma` - JudgmentStatus enumからNOT_EXECUTABLE削除
- `packages/shared/src/types/enums.ts` - JudgmentStatus定数からNOT_EXECUTABLE削除
- `packages/shared/src/validators/schemas.ts` - バリデーションスキーマ更新
- `apps/web/src/lib/api.ts` - ExpectedResultStatus型更新
- `apps/web/src/lib/execution-status.ts` - **ラベル変更 + NOT_EXECUTABLE設定削除**

### 2. バックエンド（5ファイル）
- `apps/api/src/controllers/project.controller.ts`
- `apps/api/src/controllers/execution.controller.ts`
- `apps/api/src/repositories/test-suite.repository.ts`
- `apps/api/src/services/project-dashboard.service.ts`
- `apps/api/src/routes/internal.ts`

### 3. MCP サーバー（1ファイル）
- `apps/mcp-server/src/tools/update-execution-expected-result.ts` - スキーマとドキュメント更新

### 4. WebSocket（1ファイル）
- `apps/ws/src/handlers/execution.ts`

### 5. フロントエンド（5ファイル）
- `apps/web/src/pages/ProjectDetail.tsx`
- `apps/web/src/components/execution/ExecutionOverviewPanel.tsx`
- `apps/web/src/components/execution/ExecutionTestCaseDetailPanel.tsx`
- `apps/web/src/components/execution/ExecutionTestCaseItem.tsx`
- `apps/web/src/components/execution/ExecutionSidebar.tsx`

### 6. テスト（5ファイル）
- `apps/api/src/__tests__/unit/project-dashboard.service.test.ts`
- `apps/api/src/__tests__/integration/test-helpers.ts`
- `apps/api/src/__tests__/integration/execution-operations.integration.test.ts`
- `apps/api/src/__tests__/integration/internal-api-update.integration.test.ts`
- `apps/mcp-server/src/__tests__/unit/tools/update-execution-expected-result.test.ts`

### 7. ドキュメント（6ファイル）
- `docs/architecture/features/test-suite-management.md`
- `docs/architecture/features/test-execution.md`
- `docs/architecture/features/mcp-integration.md`
- `docs/architecture/database/index.md`
- `docs/architecture/database/execution.md`
- `docs/architecture/database/agent-session.md`

## 実装手順

### Phase 1: データベースマイグレーション準備
1. 既存のNOT_EXECUTABLEデータをSKIPPEDに変換するマイグレーションを作成
   - `UPDATE execution_expected_results SET status = 'SKIPPED' WHERE status = 'NOT_EXECUTABLE'`
2. JudgmentStatus enumからNOT_EXECUTABLEを削除するマイグレーションを作成

### Phase 2: 共有型定義の更新
1. `packages/shared/src/types/enums.ts` - NOT_EXECUTABLE削除
2. `packages/shared/src/validators/schemas.ts` - バリデーション更新

### Phase 3: バックエンド更新
1. API・サービス層のNOT_EXECUTABLE参照を削除
2. ダッシュボード統計からnotExecutableカウントを削除

### Phase 4: フロントエンド更新
1. `apps/web/src/lib/execution-status.ts` - ラベル変更とNOT_EXECUTABLE削除
2. `apps/web/src/lib/api.ts` - 型定義更新
3. 各コンポーネントからnotExecutable参照を削除

### Phase 5: MCP/WebSocket更新
1. MCPツールのスキーマとドキュメント更新
2. WebSocketハンドラー更新

### Phase 6: テスト・ドキュメント更新
1. テストコードの修正
2. ドキュメントの更新

## 検証方法
1. `docker compose exec dev pnpm build` - ビルドが通ることを確認
2. `docker compose exec dev pnpm test` - 全テストがパスすることを確認
3. マイグレーション実行後、既存データの整合性確認
4. 画面上で判定結果の表示が統一されていることを目視確認
