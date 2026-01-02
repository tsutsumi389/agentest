# 作成系MCPツール（3個）実装計画

## 対象ツール

| ツール名 | 説明 |
|----------|------|
| `create_test_suite` | テストスイート作成 |
| `create_test_case` | テストケース作成 |
| `create_execution` | テスト実行開始（スナップショット＋全Result行を自動作成） |

---

## 実装方針

既存パターンに従い、以下の2層で実装：
1. **内部API（POSTエンドポイント）** - 認可チェック＋サービス層呼び出し
2. **MCPツール** - 入力バリデーション＋APIクライアント呼び出し

---

## Phase 1: 内部API追加

### 1.1 `POST /internal/api/test-suites`

**ファイル**: `apps/api/src/routes/internal.ts`

```typescript
// リクエストボディスキーマ
const createTestSuiteBodySchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
});

// エンドポイント実装
router.post('/test-suites', async (req, res, next) => {
  // 1. userIdクエリ検証
  // 2. ボディ検証
  // 3. プロジェクトへのアクセス権チェック（authService.canAccessProject）
  // 4. 書き込み権限チェック（authService.canWriteToProject を新規追加）
  // 5. testSuiteService.create() 呼び出し
  // 6. 201レスポンス
});
```

### 1.2 `POST /internal/api/test-cases`

```typescript
// リクエストボディスキーマ
const createTestCaseBodySchema = z.object({
  testSuiteId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
});

// エンドポイント実装
router.post('/test-cases', async (req, res, next) => {
  // 1. userIdクエリ検証
  // 2. ボディ検証
  // 3. テストスイートへのアクセス権チェック
  // 4. 書き込み権限チェック
  // 5. testCaseService.create() 呼び出し
  // 6. 201レスポンス
});
```

### 1.3 `POST /internal/api/test-suites/:testSuiteId/executions`

```typescript
// リクエストボディスキーマ
const startExecutionBodySchema = z.object({
  environmentId: z.string().uuid().optional(),
});

// エンドポイント実装
router.post('/test-suites/:testSuiteId/executions', async (req, res, next) => {
  // 1. userIdクエリ検証
  // 2. ボディ検証
  // 3. テストスイートへのアクセス権チェック
  // 4. 書き込み権限チェック
  // 5. testSuiteService.startExecution() 呼び出し
  // 6. 201レスポンス
});
```

---

## Phase 2: 認可サービス拡張

### 2.1 `InternalAuthorizationService` に書き込み権限チェック追加

**ファイル**: `apps/api/src/services/internal-authorization.service.ts`

```typescript
// 新規メソッド追加
async canWriteToProject(userId: string, projectId: string): Promise<boolean>
async canWriteToTestSuite(userId: string, testSuiteId: string): Promise<boolean>
```

**判定ロジック**:
- プロジェクトメンバーのロールが `OWNER`, `ADMIN`, `WRITE` のいずれか
- または組織メンバーのロールが `OWNER`, `ADMIN` のいずれか

---

## Phase 3: MCPツール実装

### 3.1 `create_test_suite` ツール

**ファイル**: `apps/mcp-server/src/tools/create-test-suite.ts`

```typescript
// 入力スキーマ
export const createTestSuiteInputSchema = z.object({
  projectId: z.string().uuid().describe('作成先プロジェクトID'),
  name: z.string().min(1).max(200).describe('テストスイート名'),
  description: z.string().max(2000).optional().describe('説明'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT').describe('ステータス'),
});

// ハンドラー
// POST /internal/api/test-suites を呼び出し
```

### 3.2 `create_test_case` ツール

**ファイル**: `apps/mcp-server/src/tools/create-test-case.ts`

```typescript
// 入力スキーマ
export const createTestCaseInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('作成先テストスイートID'),
  title: z.string().min(1).max(200).describe('テストケースタイトル'),
  description: z.string().max(2000).optional().describe('説明'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM').describe('優先度'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT').describe('ステータス'),
});
```

### 3.3 `create_execution` ツール

**ファイル**: `apps/mcp-server/src/tools/create-execution.ts`

```typescript
// 入力スキーマ
export const createExecutionInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('実行対象のテストスイートID'),
  environmentId: z.string().uuid().optional().describe('実行環境ID（オプション）'),
});
```

### 3.4 ツール登録

**ファイル**: `apps/mcp-server/src/tools/index.ts`

```typescript
// 新規ツールをインポート・登録
import { createTestSuiteTool } from './create-test-suite.js';
import { createTestCaseTool } from './create-test-case.js';
import { createExecutionTool } from './create-execution.js';

// registerTools() 内で登録
toolRegistry.register(createTestSuiteTool);
toolRegistry.register(createTestCaseTool);
toolRegistry.register(createExecutionTool);
```

---

## Phase 4: APIクライアント拡張

**ファイル**: `apps/mcp-server/src/lib/api-client.ts`

```typescript
// POSTメソッド追加（既存のgetメソッドを参考に）
async post<T>(path: string, body: Record<string, unknown>): Promise<T>
```

---

## Phase 5: テスト作成

### 5.1 内部API統合テスト

**ファイル**: `apps/api/src/__tests__/integration/internal-api-create.integration.test.ts`

- `POST /internal/api/test-suites` の正常系・異常系
- `POST /internal/api/test-cases` の正常系・異常系
- `POST /internal/api/test-suites/:testSuiteId/executions` の正常系・異常系

### 5.2 MCPツールユニットテスト

**ファイル**: `apps/mcp-server/src/__tests__/unit/tools/create-*.test.ts`

- 入力バリデーション
- APIクライアント呼び出し確認
- エラーハンドリング

---

## 修正ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `apps/api/src/routes/internal.ts` | POSTエンドポイント3個追加 |
| `apps/api/src/services/internal-authorization.service.ts` | 書き込み権限チェックメソッド追加 |
| `apps/mcp-server/src/tools/create-test-suite.ts` | 新規作成 |
| `apps/mcp-server/src/tools/create-test-case.ts` | 新規作成 |
| `apps/mcp-server/src/tools/create-execution.ts` | 新規作成 |
| `apps/mcp-server/src/tools/index.ts` | ツール登録追加 |
| `apps/mcp-server/src/lib/api-client.ts` | POSTメソッド追加 |
| `apps/api/src/__tests__/integration/internal-api-create.integration.test.ts` | 新規作成 |
| `apps/mcp-server/src/__tests__/unit/tools/create-*.test.ts` | 新規作成 |

---

## 実装順序

1. APIクライアントにPOSTメソッド追加
2. 認可サービスに書き込み権限チェック追加
3. 内部APIエンドポイント追加（3個）
4. MCPツール実装（3個）
5. ツール登録
6. テスト作成・実行

---

## レスポンス形式

### create_test_suite

```json
{
  "testSuite": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "テストスイート名",
    "description": "説明",
    "status": "DRAFT",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### create_test_case

```json
{
  "testCase": {
    "id": "uuid",
    "testSuiteId": "uuid",
    "title": "テストケースタイトル",
    "description": "説明",
    "priority": "MEDIUM",
    "status": "DRAFT",
    "orderKey": "00001",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### create_execution

```json
{
  "execution": {
    "id": "uuid",
    "testSuiteId": "uuid",
    "environmentId": "uuid or null",
    "status": "IN_PROGRESS",
    "startedAt": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```
