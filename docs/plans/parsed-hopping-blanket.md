# 削除系MCPツール実装計画

## 概要

`delete_test_suite` と `delete_test_case` の2つのMCPツールを実装する。

## 実装タスク

### 1. APIクライアントにdeleteメソッド追加
**ファイル**: `apps/mcp-server/src/clients/api-client.ts`

`InternalApiClient` クラスに `delete()` メソッドを追加:
```typescript
async delete<T>(path: string, params?: Record<string, string>): Promise<T>
```

### 2. 内部API削除エンドポイント追加
**ファイル**: `apps/api/src/routes/internal.ts`

2つの削除エンドポイントを追加:
- `DELETE /internal/api/test-suites/:testSuiteId` - テストスイート削除
- `DELETE /internal/api/test-cases/:testCaseId` - テストケース削除

処理内容:
- userIdクエリパラメータで認証
- 書き込み権限チェック（`canWriteToTestSuite`）
- 既存の `softDelete` サービスメソッドを呼び出し
- レスポンス: `{ success: true, deletedId: "..." }`

### 3. MCPツール実装

#### 3-1. delete_test_suite
**新規ファイル**: `apps/mcp-server/src/tools/delete-test-suite.ts`

```typescript
// 入力スキーマ
export const deleteTestSuiteInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('削除対象のテストスイートID'),
});

// ハンドラー: 認証チェック → apiClient.delete() 呼び出し
```

#### 3-2. delete_test_case
**新規ファイル**: `apps/mcp-server/src/tools/delete-test-case.ts`

```typescript
// 入力スキーマ
export const deleteTestCaseInputSchema = z.object({
  testCaseId: z.string().uuid().describe('削除対象のテストケースID'),
});

// ハンドラー: 認証チェック → apiClient.delete() 呼び出し
```

### 4. ツール登録
**ファイル**: `apps/mcp-server/src/tools/index.ts`

- `deleteTestSuiteTool` と `deleteTestCaseTool` をimport
- `toolRegistry.register()` で登録

### 5. テスト作成

#### 5-1. MCPツールユニットテスト
**新規ファイル**:
- `apps/mcp-server/src/__tests__/unit/tools/delete-test-suite.test.ts`
- `apps/mcp-server/src/__tests__/unit/tools/delete-test-case.test.ts`

テスト内容:
- ツール定義（名前・説明）
- 入力スキーマバリデーション
- ハンドラー認証チェック
- API呼び出しモック

#### 5-2. 内部API結合テスト
**新規ファイル**: `apps/api/src/__tests__/integration/internal-api-delete.integration.test.ts`

テスト内容:
- 正常削除（204 or 200）
- 権限エラー（403）
- 存在しないID（404）

## ファイル一覧

| 種別 | ファイルパス |
|------|-------------|
| 修正 | `apps/mcp-server/src/clients/api-client.ts` |
| 修正 | `apps/api/src/routes/internal.ts` |
| 新規 | `apps/mcp-server/src/tools/delete-test-suite.ts` |
| 新規 | `apps/mcp-server/src/tools/delete-test-case.ts` |
| 修正 | `apps/mcp-server/src/tools/index.ts` |
| 新規 | `apps/mcp-server/src/__tests__/unit/tools/delete-test-suite.test.ts` |
| 新規 | `apps/mcp-server/src/__tests__/unit/tools/delete-test-case.test.ts` |
| 新規 | `apps/api/src/__tests__/integration/internal-api-delete.integration.test.ts` |

## 実装順序

1. APIクライアント `delete()` メソッド追加
2. 内部API削除エンドポイント追加
3. MCPツール実装（delete_test_suite, delete_test_case）
4. ツール登録
5. ユニットテスト作成
6. 結合テスト作成
7. 動作確認
