# Executionからstatus/startedAt/completedAtフィールドを削除

## 概要
executionsテーブルから以下のフィールドを削除し、実行の状態管理機能を完全廃止する:
- `status` (ExecutionStatus enum含む)
- `startedAt`
- `completedAt`

abort/complete機能も削除し、実行は「作成のみ」できる形にシンプル化。ソートはcreatedAtベースに変更。

---

## 変更ファイル一覧

### 1. データベース層
| ファイル | 変更内容 |
|---------|---------|
| `packages/db/prisma/schema.prisma` | ExecutionStatus enum削除、Executionモデルから3フィールド削除、インデックス変更 |

### 2. 共有型定義
| ファイル | 変更内容 |
|---------|---------|
| `packages/shared/src/types/enums.ts` | ExecutionStatus定数・型削除 |
| `packages/shared/src/types/execution.ts` | Execution, ExecutionPublic等から3フィールド削除 |

### 3. API層
| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/repositories/execution.repository.ts` | orderByをcreatedAtに変更 |
| `apps/api/src/services/execution.service.ts` | abort/complete削除、状態チェック削除 |
| `apps/api/src/controllers/execution.controller.ts` | abort/completeメソッド削除 |
| `apps/api/src/routes/executions.ts` | abort/completeルート削除 |
| `apps/api/src/middleware/require-execution-role.ts` | allowCompletedExecution削除 |
| `apps/api/src/services/internal-authorization.service.ts` | IN_PROGRESSチェック削除 |
| `apps/api/src/services/test-suite.service.ts` | statusフィルタ削除、日時フィルタをcreatedAtに変更 |
| `apps/api/src/routes/internal.ts` | getExecutionsQuerySchemaのstatusフィルタ・sortBy変更 |

### 4. MCPサーバー
| ファイル | 変更内容 |
|---------|---------|
| `apps/mcp-server/src/tools/create-execution.ts` | レスポンスからstatus/startedAt削除 |
| `apps/mcp-server/src/tools/get-execution.ts` | レスポンスからstatus/startedAt/completedAt削除 |
| `apps/mcp-server/src/tools/search-execution.ts` | statusフィルタ削除、sortByをcreatedAtのみに変更 |

### 5. WebSocket
| ファイル | 変更内容 |
|---------|---------|
| `apps/ws/src/handlers/execution.ts` | publishExecutionStatusChanged削除 |
| `packages/ws-types/src/events.ts` | ExecutionStatusChangedEvent削除 |

### 6. フロントエンド
| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/lib/api.ts` | ExecutionSearchParams, Execution型更新 |
| `apps/web/src/components/execution/ExecutionHistoryList.tsx` | ステータスフィルタUI削除、sortBy変更 |
| `apps/web/src/pages/Dashboard.tsx` | mapExecutionStatus更新 |
| `apps/web/src/components/execution/ExecutionOverviewPanel.tsx` | status表示削除 |
| `apps/web/src/pages/Execution.tsx` | status表示・abort/completeボタン削除 |
| `apps/web/src/pages/TestSuiteCases.tsx` | startedAt→createdAt変更 |

### 7. テストファイル
- `apps/api/src/__tests__/unit/execution.service.test.ts`
- `apps/api/src/__tests__/unit/execution.controller.test.ts`
- `apps/api/src/__tests__/unit/execution.repository.test.ts`
- `apps/api/src/__tests__/unit/require-execution-role.middleware.test.ts`
- `apps/api/src/__tests__/unit/execution.service.evidence.test.ts`
- `apps/api/src/__tests__/integration/execution-operations.integration.test.ts`
- `apps/api/src/__tests__/integration/execution-evidence.integration.test.ts`
- `apps/mcp-server/src/__tests__/unit/tools/create-execution.test.ts`
- `apps/mcp-server/src/__tests__/unit/tools/get-execution.test.ts`
- `apps/mcp-server/src/__tests__/unit/tools/search-execution.test.ts`

---

## 実装順序

1. **Prismaスキーマ更新** - schema.prisma変更
2. **マイグレーション実行** - `docker compose exec dev pnpm db:migrate:dev --name remove_execution_status_fields`
3. **共有型定義更新** - packages/shared
4. **API層更新** - Repository → Service → Controller → Routes → Middleware
5. **MCPサーバー更新** - ツール定義
6. **WebSocket更新** - イベント定義
7. **フロントエンド更新** - 型定義 → コンポーネント
8. **テスト更新・実行**

---

## 検証方法

1. **ビルド確認**: `docker compose exec dev pnpm build`
2. **lint確認**: `docker compose exec dev pnpm lint`
3. **テスト実行**: `docker compose exec dev pnpm test`
4. **動作確認**:
   - 実行作成が正常に動作すること
   - 実行一覧がcreatedAtでソートされること
   - 実行詳細が表示されること
