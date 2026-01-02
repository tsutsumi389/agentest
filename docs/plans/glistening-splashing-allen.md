# MCPツール更新系（5個）実装計画

## 対象ツール

| ツール名 | 説明 |
|----------|------|
| `update_test_suite` | テストスイート更新 |
| `update_test_case` | テストケース更新 |
| `update_execution_precondition_result` | 事前条件確認結果更新（UNCHECKED→MET/NOT_MET） |
| `update_execution_step_result` | ステップ実行結果更新（PENDING→DONE/SKIPPED） |
| `update_execution_expected_result` | 期待結果判定更新（PENDING→PASS/FAIL/SKIPPED/NOT_EXECUTABLE） |

---

## 実装順序

### Phase 1: 基盤準備

#### 1.1 APIクライアントにpatchメソッド追加
**ファイル**: `apps/mcp-server/src/clients/api-client.ts`

```typescript
async patch<T>(path: string, body: Record<string, unknown>, params?: Record<string, string>): Promise<T>
```
- POSTメソッドと同じパターンで、`method: 'PATCH'`に変更

#### 1.2 認可サービスにcanWriteToExecution追加
**ファイル**: `apps/api/src/services/internal-authorization.service.ts`

```typescript
async canWriteToExecution(userId: string, executionId: string): Promise<boolean>
```
- 実行の存在確認・IN_PROGRESSステータス確認
- テストスイートへの書き込み権限確認

---

### Phase 2: エンティティ更新ツール

#### 2.1 update_test_suite

**MCPツール**: `apps/mcp-server/src/tools/update-test-suite.ts`
```typescript
inputSchema: {
  testSuiteId: z.string().uuid()           // 必須
  name: z.string().min(1).max(200)         // optional
  description: z.string().max(2000)        // optional, nullable
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])  // optional
}
```

**内部API**: `PATCH /internal/api/test-suites/:testSuiteId`
- 認可: `canWriteToTestSuite(userId, testSuiteId)`
- サービス: `testSuiteService.update()` （既存）

#### 2.2 update_test_case

**MCPツール**: `apps/mcp-server/src/tools/update-test-case.ts`
```typescript
inputSchema: {
  testCaseId: z.string().uuid()            // 必須
  title: z.string().min(1).max(200)        // optional
  description: z.string().max(2000)        // optional, nullable
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])  // optional
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])  // optional
}
```

**内部API**: `PATCH /internal/api/test-cases/:testCaseId`
- 認可: テストケース→テストスイート→`canWriteToTestSuite()`
- サービス: `testCaseService.update()` （既存）

---

### Phase 3: 実行結果更新ツール

#### 3.1 update_execution_precondition_result

**MCPツール**: `apps/mcp-server/src/tools/update-execution-precondition-result.ts`
```typescript
inputSchema: {
  executionId: z.string().uuid()           // 必須
  preconditionResultId: z.string().uuid()  // 必須
  status: z.enum(['MET', 'NOT_MET'])       // 必須
  note: z.string().max(2000)               // optional
}
```

**内部API**: `PATCH /internal/api/executions/:executionId/precondition-results/:preconditionResultId`
- 認可: `canWriteToExecution(userId, executionId)`
- サービス: `executionService.updatePreconditionResult()` （既存）

#### 3.2 update_execution_step_result

**MCPツール**: `apps/mcp-server/src/tools/update-execution-step-result.ts`
```typescript
inputSchema: {
  executionId: z.string().uuid()           // 必須
  stepResultId: z.string().uuid()          // 必須
  status: z.enum(['DONE', 'SKIPPED'])      // 必須
  note: z.string().max(2000)               // optional
}
```

**内部API**: `PATCH /internal/api/executions/:executionId/step-results/:stepResultId`
- 認可: `canWriteToExecution(userId, executionId)`
- サービス: `executionService.updateStepResult()` （既存）

#### 3.3 update_execution_expected_result

**MCPツール**: `apps/mcp-server/src/tools/update-execution-expected-result.ts`
```typescript
inputSchema: {
  executionId: z.string().uuid()           // 必須
  expectedResultId: z.string().uuid()      // 必須
  status: z.enum(['PASS', 'FAIL', 'SKIPPED', 'NOT_EXECUTABLE'])  // 必須
  note: z.string().max(2000)               // optional
}
```

**内部API**: `PATCH /internal/api/executions/:executionId/expected-results/:expectedResultId`
- 認可: `canWriteToExecution(userId, executionId)`
- サービス: `executionService.updateExpectedResult()` （既存）

---

### Phase 4: 統合

#### 4.1 ツール登録
**ファイル**: `apps/mcp-server/src/tools/index.ts`

5つの新規ツールをインポート・登録

---

## 修正ファイル一覧

| ファイル | 変更内容 |
|----------|---------|
| `apps/mcp-server/src/clients/api-client.ts` | patchメソッド追加 |
| `apps/api/src/services/internal-authorization.service.ts` | canWriteToExecution追加 |
| `apps/api/src/routes/internal.ts` | 5つのPATCHエンドポイント追加 |
| `apps/mcp-server/src/tools/update-test-suite.ts` | 新規作成 |
| `apps/mcp-server/src/tools/update-test-case.ts` | 新規作成 |
| `apps/mcp-server/src/tools/update-execution-precondition-result.ts` | 新規作成 |
| `apps/mcp-server/src/tools/update-execution-step-result.ts` | 新規作成 |
| `apps/mcp-server/src/tools/update-execution-expected-result.ts` | 新規作成 |
| `apps/mcp-server/src/tools/index.ts` | 5つのツール登録追加 |

---

## エラーハンドリング

| エラー | HTTPステータス | メッセージ |
|--------|---------------|-----------|
| 認証なし | 401 | Unauthorized |
| 権限なし | 403 | Access denied |
| 実行がIN_PROGRESS以外 | 403 | Execution is not in progress |
| リソース未存在 | 404 | Not found |
| バリデーションエラー | 400 | Invalid request body |
| 更新フィールドなし | 400 | At least one field must be provided |

---

## 既存リソースの活用

以下のサービスメソッドは既に実装済み（再利用）：
- `TestSuiteService.update()`
- `TestCaseService.update()`
- `ExecutionService.updatePreconditionResult()`
- `ExecutionService.updateStepResult()`
- `ExecutionService.updateExpectedResult()`
