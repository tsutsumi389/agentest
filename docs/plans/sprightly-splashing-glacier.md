# テスト実行状況セクションの変更計画

## 概要

テストスイート概要ページの「要注意テスト」セクションを「テスト実行状況」に名称変更し、テストケース単位からテストスイート単位に変更。タブ構成・表示内容を刷新する。

## 変更内容

### 現在 → 変更後

| 項目 | 現在 | 変更後 |
|------|------|--------|
| セクション名 | 要注意テスト | **テスト実行状況** |
| 表示単位 | テストケース | **テストスイート** |
| タブ構成 | 失敗中、長期未実行、不安定 | **失敗中、スキップ中、テスト未実施、テスト実行中** |
| 環境表示 | なし | **あり** |
| ページネーション | なし | **あり** |
| リンク先 | 存在しないパス | **正しいパス** |

### タブ定義

1. **失敗中**: 最終実行の期待結果にFAILを含むテストスイート
2. **スキップ中**: 最終実行の期待結果にSKIPPEDを含むテストスイート
3. **テスト未実施**: 一度も実行されていないテストスイート
4. **テスト実行中**: 最終実行の期待結果にPENDINGを含むテストスイート

## 実装手順

### Step 1: 型定義の追加 (`packages/shared/src/types/project-dashboard.ts`)

新しいインターフェースを追加:

```typescript
// テストスイート用の要注意項目
export interface FailingTestSuiteItem {
  testSuiteId: string;
  testSuiteName: string;
  lastExecutionId: string;
  lastExecutedAt: Date | string;
  environment: { id: string; name: string } | null;
  failCount: number;
  totalExpectedResults: number;
}

export interface SkippedTestSuiteItem {
  testSuiteId: string;
  testSuiteName: string;
  lastExecutionId: string;
  lastExecutedAt: Date | string;
  environment: { id: string; name: string } | null;
  skippedCount: number;
  totalExpectedResults: number;
}

export interface NeverExecutedTestSuiteItem {
  testSuiteId: string;
  testSuiteName: string;
  createdAt: Date | string;
  testCaseCount: number;
}

export interface InProgressTestSuiteItem {
  testSuiteId: string;
  testSuiteName: string;
  lastExecutionId: string;
  lastExecutedAt: Date | string;
  environment: { id: string; name: string } | null;
  pendingCount: number;
  totalExpectedResults: number;
}

// ページネーション対応
export interface ExecutionStatusSuites {
  failingSuites: { items: FailingTestSuiteItem[]; total: number };
  skippedSuites: { items: SkippedTestSuiteItem[]; total: number };
  neverExecutedSuites: { items: NeverExecutedTestSuiteItem[]; total: number };
  inProgressSuites: { items: InProgressTestSuiteItem[]; total: number };
}
```

### Step 2: バックエンドサービスの変更 (`apps/api/src/services/project-dashboard.service.ts`)

古いメソッドを削除し、新しいメソッドを追加:

- `getFailingSuites()` - FAILを含むテストスイートを取得
- `getSkippedSuites()` - SKIPPEDを含むテストスイートを取得
- `getNeverExecutedSuites()` - 実行0件のテストスイートを取得
- `getInProgressSuites()` - PENDINGを含むテストスイートを取得

クエリロジック（例: 失敗中）:
1. プロジェクト内の全テストスイートを取得
2. 各テストスイートの最新Executionを取得
3. ExecutionExpectedResultからFAIL件数をカウント
4. FAIL > 0のものをフィルタリング
5. ページネーション適用

### Step 3: フロントエンドの変更 (`apps/web/src/components/project/dashboard/ExecutionStatusTable.tsx`)

- ファイル名を `AttentionRequiredTable.tsx` → `ExecutionStatusTable.tsx` にリネーム
- セクションタイトルを「テスト実行状況」に変更
- タブ定義を4つに変更（失敗中、スキップ中、テスト未実施、テスト実行中）
- `TestSuiteListItem`コンポーネントを新規作成
- 環境名の表示を追加
- リンク先を修正:
  - 実行あり: `/executions/${lastExecutionId}`
  - 実行なし: `/test-suites/${testSuiteId}`
- ページネーションコンポーネントを追加

### Step 4: APIクライアントの更新 (`apps/web/src/lib/api.ts`)

ページネーションパラメータ対応を追加

### Step 5: テストの更新 (`apps/api/src/__tests__/unit/project-dashboard.service.test.ts`)

新しいメソッドのテストを追加

## 変更対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `packages/shared/src/types/project-dashboard.ts` | 新しい型定義を追加、古い型に@deprecated付与 |
| `apps/api/src/services/project-dashboard.service.ts` | 新しいメソッドを追加、古いメソッドを削除 |
| `apps/api/src/controllers/project.controller.ts` | ページネーションパラメータ対応 |
| `apps/web/src/components/project/dashboard/AttentionRequiredTable.tsx` | ファイル削除 |
| `apps/web/src/components/project/dashboard/ExecutionStatusTable.tsx` | 新規作成（リネーム＆全面書き換え） |
| `apps/web/src/components/project/ProjectOverviewTab.tsx` | インポート先を変更 |
| `apps/web/src/lib/api.ts` | APIクライアント更新 |
| `apps/api/src/__tests__/unit/project-dashboard.service.test.ts` | テスト更新 |

## 検証方法

1. **ユニットテスト**: `docker compose exec dev pnpm test` でテスト実行
2. **手動テスト**:
   - 各タブの表示を確認
   - ページネーションの動作確認
   - リンク先が正しく遷移することを確認
   - 環境名が表示されることを確認
3. **ビルド確認**: `docker compose exec dev pnpm build`
