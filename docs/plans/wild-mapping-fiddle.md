# E2Eテストシナリオ拡充計画（Phase 1）

## 概要

現在のE2Eテスト（15個）に44個のテストを追加し、ビジネスクリティカルな機能を網羅する。

## 現状

```
e2e/tests/web/
├── login.spec.ts       # 未認証テスト（3個）
├── dashboard.spec.ts   # ダッシュボード（4個）
├── projects.spec.ts    # プロジェクト（5個）
└── test-suites.spec.ts # テストスイート（4個）
```

## 追加するテストファイル

| ファイル | テスト数 | 内容 |
|---------|---------|------|
| `test-cases.spec.ts` | 12 | テストケースCRUD・検索・コピー・並び替え |
| `test-case-details.spec.ts` | 15 | 前提条件・ステップ・期待値のCRUD・並び替え |
| `executions.spec.ts` | 13 | 実行開始・実施記録・エビデンス管理 |
| `edit-locks.spec.ts` | 4 | 編集ロック取得・競合検出・解放 |

## 必要なヘルパー拡張

### TestApiClient拡張 (`e2e/helpers/api-client.ts`)

```typescript
// 追加メソッド
// 前提条件
addPrecondition(testCaseId, data)
deletePrecondition(testCaseId, preconditionId)

// ステップ
addStep(testCaseId, data)
deleteStep(testCaseId, stepId)

// 期待値
addExpectedResult(testCaseId, data)
deleteExpectedResult(testCaseId, expectedResultId)

// 実行
startExecution(testSuiteId, data)
getExecution(executionId)
updatePreconditionResult(executionId, resultId, data)
updateStepResult(executionId, resultId, data)
updateExpectedResultResult(executionId, resultId, data)

// ロック
acquireLock(data)
releaseLock(lockId)
```

## テストケース詳細

### 1. test-cases.spec.ts（12テスト）

```typescript
test.describe('テストケース一覧', () => {
  test('テストスイート内のテストケースが表示される');
  test('テストケースの検索ができる');
  test('優先度でフィルタできる');
});

test.describe('テストケースCRUD', () => {
  test('新規テストケースを作成できる');
  test('テストケースのタイトルを編集できる');
  test('テストケースの説明を編集できる');
  test('テストケースの優先度を変更できる');
  test('テストケースを削除できる');
  test('削除したテストケースを復元できる');
  test('テストケースをコピーできる');
});

test.describe('テストケース並び替え', () => {
  test('ドラッグ＆ドロップでテストケースを並び替えできる');
});
```

### 2. test-case-details.spec.ts（15テスト）

```typescript
test.describe('前提条件管理', () => {
  test('前提条件一覧が表示される');
  test('前提条件を追加できる');
  test('前提条件を編集できる');
  test('前提条件を削除できる');
  test('前提条件を並び替えできる');
});

test.describe('ステップ管理', () => {
  test('ステップ一覧が表示される');
  test('ステップを追加できる');
  test('ステップを編集できる');
  test('ステップを削除できる');
  test('ステップを並び替えできる');
});

test.describe('期待結果管理', () => {
  test('期待結果一覧が表示される');
  test('期待結果を追加できる');
  test('期待結果を編集できる');
  test('期待結果を削除できる');
  test('期待結果を並び替えできる');
});
```

### 3. executions.spec.ts（13テスト）

```typescript
test.describe('テスト実行開始', () => {
  test('テスト実行を開始できる');
  test('環境を選択して実行できる');
  test('実行中のステータスが表示される');
});

test.describe('テスト実施記録', () => {
  test('前提条件のステータスを更新できる');
  test('ステップのステータスを更新できる');
  test('期待結果の判定を記録できる');
  test('各項目にメモを追加できる');
});

test.describe('エビデンス管理', () => {
  test('エビデンスをアップロードできる');
  test('アップロードしたエビデンスが表示される');
  test('エビデンスをダウンロードできる');
  test('エビデンスを削除できる');
});

test.describe('実行履歴', () => {
  test('テストスイートの実行履歴が表示される');
  test('実行詳細を確認できる');
});
```

### 4. edit-locks.spec.ts（4テスト）

```typescript
test.describe('編集ロック', () => {
  test('テストスイートを開くとロックが取得される');
  test('ロック中のユーザー情報が表示される');
  test('ロック競合時に警告が表示される');
  test('ページを離れるとロックが解放される');
});
```

## 実装順序

```
1. api-client.ts 拡張（全テストの基盤）
   ↓
2. test-cases.spec.ts（テストケースCRUD）
   ↓
3. test-case-details.spec.ts（前提条件・ステップ・期待値）
   ↓
4. executions.spec.ts（実行フロー）
   ↓
5. edit-locks.spec.ts（編集ロック）
```

## 変更対象ファイル

### 新規作成
- `e2e/tests/web/test-cases.spec.ts`
- `e2e/tests/web/test-case-details.spec.ts`
- `e2e/tests/web/executions.spec.ts`
- `e2e/tests/web/edit-locks.spec.ts`

### 既存ファイル修正
- `e2e/helpers/api-client.ts` - メソッド追加

## 検証方法

```bash
# 全テスト実行
cd e2e && pnpm test

# 個別ファイル実行
pnpm test tests/web/test-cases.spec.ts
pnpm test tests/web/test-case-details.spec.ts
pnpm test tests/web/executions.spec.ts
pnpm test tests/web/edit-locks.spec.ts

# UIモードでデバッグ
pnpm test:ui
```

## テストデータの方針

- 各テストでユニークなデータを作成・削除（独立性確保）
- シードデータ（Demo Project等）は読み取り専用として使用
- タイムスタンプでデータ名を一意化（例: `Test Case ${Date.now()}`）
- `try-finally`パターンでクリーンアップを保証

```typescript
// 例: テストデータの独立性確保
test('テストケースを作成できる', async ({ page, apiClient }) => {
  const suite = await apiClient.createTestSuite({
    name: `Suite ${Date.now()}`,
    projectId: DEMO_PROJECT_ID,
  });

  try {
    // テスト実行
    await page.goto(`/test-suites/${suite.id}`);
    // ...
  } finally {
    await apiClient.deleteTestSuite(DEMO_PROJECT_ID, suite.id);
  }
});
```

## 期待される成果

| 指標 | 現状 | 目標 |
|------|------|------|
| テストファイル数 | 4 | 8 |
| テストケース数 | 15 | 59 |
| 機能カバレッジ | 基本CRUD | コア機能（テストケース管理・実行・ロック）|
