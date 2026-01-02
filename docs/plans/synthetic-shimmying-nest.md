# 単一取得系MCPツール（4個）実装計画

## 概要
以下の4つのget_*ツールを実装する：
- `get_project` - プロジェクト詳細取得
- `get_test_suite` - テストスイート詳細取得（テストケース含む）
- `get_test_case` - テストケース詳細取得（ステップ/期待結果含む）
- `get_execution` - テスト実行詳細取得（全Result含む）

---

## 実装ファイル

### 新規作成（4ファイル）
| ファイル | 説明 |
|---------|------|
| `apps/mcp-server/src/tools/get-project.ts` | get_projectツール |
| `apps/mcp-server/src/tools/get-test-suite.ts` | get_test_suiteツール |
| `apps/mcp-server/src/tools/get-test-case.ts` | get_test_caseツール |
| `apps/mcp-server/src/tools/get-execution.ts` | get_executionツール |

### 修正（2ファイル）
| ファイル | 修正内容 |
|---------|----------|
| `apps/mcp-server/src/tools/index.ts` | 4ツールをインポート＆登録 |
| `apps/api/src/routes/internal.ts` | 4つのGETエンドポイント追加 |

---

## 実装順序

### Step 1: 内部APIエンドポイント追加（apps/api/src/routes/internal.ts）

4つのGETエンドポイントを追加：

```typescript
// GET /internal/api/projects/:projectId?userId=xxx
// GET /internal/api/test-suites/:testSuiteId?userId=xxx
// GET /internal/api/test-cases/:testCaseId?userId=xxx
// GET /internal/api/executions/:executionId?userId=xxx
```

各エンドポイントで：
1. userIdクエリパラメータをバリデーション
2. 認可チェック（canAccessProject/canAccessTestSuite）
3. 既存サービスで詳細取得
4. レスポンス返却

### Step 2: get_project.ts 作成

```typescript
// 入力スキーマ
z.object({
  projectId: z.string().uuid().describe('プロジェクトID（必須）'),
})

// レスポンス
{
  project: {
    id, name, description, organizationId, organization,
    role, environments[], _count, createdAt, updatedAt
  }
}
```

### Step 3: get_test_suite.ts 作成

```typescript
// 入力スキーマ
z.object({
  testSuiteId: z.string().uuid().describe('テストスイートID（必須）'),
})

// レスポンス
{
  testSuite: {
    id, name, description, status, projectId, project,
    createdByUser, preconditions[], testCases[], _count, createdAt, updatedAt
  }
}
```

### Step 4: get_test_case.ts 作成

```typescript
// 入力スキーマ
z.object({
  testCaseId: z.string().uuid().describe('テストケースID（必須）'),
})

// レスポンス
{
  testCase: {
    id, testSuiteId, testSuite, title, description, priority, status, orderKey,
    createdByUser, preconditions[], steps[], expectedResults[], createdAt, updatedAt
  }
}
```

### Step 5: get_execution.ts 作成

```typescript
// 入力スキーマ
z.object({
  executionId: z.string().uuid().describe('実行ID（必須）'),
})

// レスポンス
{
  execution: {
    id, testSuiteId, testSuite, status, startedAt, completedAt,
    executedByUser, environment, executionTestSuite（スナップショット）,
    preconditionResults[], stepResults[], expectedResults[]（evidences含む）,
    createdAt, updatedAt
  }
}
```

### Step 6: tools/index.ts 修正

```typescript
// インポート追加
import { getProjectTool } from './get-project.js';
import { getTestSuiteTool } from './get-test-suite.js';
import { getTestCaseTool } from './get-test-case.js';
import { getExecutionTool } from './get-execution.js';

// registerTools()内に追加
toolRegistry.register(getProjectTool);
toolRegistry.register(getTestSuiteTool);
toolRegistry.register(getTestCaseTool);
toolRegistry.register(getExecutionTool);
```

---

## 認可パターン

| ツール | 認可メソッド |
|--------|-------------|
| get_project | `canAccessProject(userId, projectId)` |
| get_test_suite | `canAccessTestSuite(userId, testSuiteId)` |
| get_test_case | テストケース取得 → `canAccessTestSuite(userId, testCase.testSuiteId)` |
| get_execution | 実行取得 → `canAccessTestSuite(userId, execution.testSuiteId)` |

---

## 注意事項

- **BigInt変換**: `ExecutionEvidence.fileSize`はBigInt → numberに変換必須
- **orderKeyソート**: 子エンティティはorderKey昇順でソート
- **削除済み除外**: deletedAt != nullのエンティティは取得対象外
- **既存パターン踏襲**: `search-project.ts`の構造に従う

---

## 参考ファイル

- `apps/mcp-server/src/tools/search-project.ts` - ツール実装パターン
- `apps/api/src/routes/internal.ts` - 内部APIパターン
- `apps/api/src/services/internal-authorization.service.ts` - 認可サービス
- `apps/api/src/services/execution.service.ts` - findByIdWithDetails（BigInt変換例）
