# テスト実施の実施者・実施日時記録機能

## 概要
テスト実行結果（前提条件、手順、期待結果）の各項目に「実施者」と「実施日時」を記録・表示する機能を実装する。MCPツール経由での実施時はエージェント名（例：Claude Code Opus4.5）を記録できるようにする。

## 変更ファイル一覧

### 1. Prismaスキーマ
- `packages/db/prisma/schema.prisma`

### 2. バックエンド（API）
- `apps/api/src/services/execution.service.ts`
- `apps/api/src/routes/internal.ts`
- `apps/api/src/routes/executions.ts`（公開API側も対応）

### 3. MCPサーバー
- `apps/mcp-server/src/tools/update-execution-precondition-result.ts`
- `apps/mcp-server/src/tools/update-execution-step-result.ts`
- `apps/mcp-server/src/tools/update-execution-expected-result.ts`

### 4. 共有型定義
- `packages/shared/src/types/execution.ts`

### 5. フロントエンド
- `apps/web/src/lib/api.ts`
- `apps/web/src/components/execution/ExecutionResultItem.tsx`
- `apps/web/src/components/execution/ExecutionPreconditionList.tsx`
- `apps/web/src/components/execution/ExecutionStepList.tsx`
- `apps/web/src/components/execution/ExecutionExpectedResultList.tsx`

---

## 実装詳細

### Step 1: Prismaスキーマ変更

各結果モデルに実施者フィールドを追加：

```prisma
// ExecutionPreconditionResult に追加
checkedByUserId     String?  @map("checked_by_user_id")
checkedByAgentName  String?  @map("checked_by_agent_name") @db.VarChar(100)
checkedByUser       User?    @relation("PreconditionResultChecker", fields: [checkedByUserId], references: [id])

// ExecutionStepResult に追加
executedByUserId    String?  @map("executed_by_user_id")
executedByAgentName String?  @map("executed_by_agent_name") @db.VarChar(100)
executedByUser      User?    @relation("StepResultExecutor", fields: [executedByUserId], references: [id])

// ExecutionExpectedResult に追加
judgedByUserId      String?  @map("judged_by_user_id")
judgedByAgentName   String?  @map("judged_by_agent_name") @db.VarChar(100)
judgedByUser        User?    @relation("ExpectedResultJudger", fields: [judgedByUserId], references: [id])
```

Userモデルに逆リレーションを追加。

### Step 2: マイグレーション実行
```bash
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name add_executor_info_to_execution_results
```

### Step 3: 共有型定義の更新
`packages/shared/src/types/execution.ts` の各インターフェースに実施者フィールドを追加。

### Step 4: ExecutionService更新
`apps/api/src/services/execution.service.ts`

各updateメソッドに実施者情報を記録する処理を追加：
- `updatePreconditionResult()` → `checkedByUserId`, `checkedByAgentName`
- `updateStepResult()` → `executedByUserId`, `executedByAgentName`
- `updateExpectedResult()` → `judgedByUserId`, `judgedByAgentName`

`findByIdWithDetails()` で実施者情報をincludeに追加。

### Step 5: 内部API更新
`apps/api/src/routes/internal.ts`

各結果更新スキーマに `agentName` パラメーターを追加し、サービス呼び出し時に実施者情報を渡す。

### Step 6: 公開API更新
`apps/api/src/routes/executions.ts`

同様に実施者情報（userId）を記録するよう更新。

### Step 7: MCPツール更新

3つの結果更新ツールに `agentName` パラメーターを追加：

```typescript
agentName: z.string().max(100).optional().describe(
  '実施したAIエージェントの名前（例：Claude Code Opus4.5）'
)
```

### Step 8: フロントエンド型定義更新
`apps/web/src/lib/api.ts` の各結果インターフェースに実施者情報を追加。

### Step 9: ExecutionResultItem更新
`apps/web/src/components/execution/ExecutionResultItem.tsx`

`executor` propを追加し、簡易表示形式で実施者情報を表示：
```
田中太郎 / 2025-01-15 10:30
または
Claude Code Opus4.5 / 2025-01-15 10:30
```

### Step 10: 各リストコンポーネント更新
ExecutionPreconditionList, ExecutionStepList, ExecutionExpectedResultList で `executor` propを渡す。

---

## 検証方法

1. **マイグレーション確認**
   - DBテーブルに新カラムが追加されていることを確認

2. **API動作確認**
   - 内部API経由で結果更新時、実施者情報が記録されることを確認
   - `GET /executions/:id/details` で実施者情報が返却されることを確認

3. **MCPツール動作確認**
   - `update_execution_step_result` 等で `agentName` パラメーターを指定
   - 記録された情報がAPIレスポンスに含まれることを確認

4. **フロントエンド表示確認**
   - テスト実行画面で各結果項目に実施者情報が表示されることを確認
   - 表示形式：「名前 / 日時」

5. **ビルド・テスト**
   ```bash
   docker compose exec dev pnpm build
   docker compose exec dev pnpm test
   docker compose exec dev pnpm lint
   ```
