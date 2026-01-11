# テストケース履歴グループ展開時のカテゴリ別セクション表示

## 概要

履歴APIのレスポンスで、グループ内の変更を4つのカテゴリ別にまとめて返す機能を実装します。

## 対象ファイル

### バックエンド（API側）
- `/packages/shared/src/types/test-case.ts` - 型定義の更新
- `/apps/api/src/repositories/test-case.repository.ts` - カテゴリ別グループ化ロジック

### フロントエンド
- `/apps/web/src/lib/api.ts` - 型定義の更新
- `/apps/web/src/components/test-case/TestCaseHistoryList.tsx` - 表示対応

## 実装内容

### 1. 型定義の更新（@agentest/shared）

```typescript
// カテゴリ別履歴
export interface CategorizedHistories {
  basicInfo: TestCaseHistory[];
  preconditions: TestCaseHistory[];
  steps: TestCaseHistory[];
  expectedResults: TestCaseHistory[];
}

// グループ化された履歴アイテム（更新）
export interface TestCaseHistoryGroupedItem {
  groupId: string | null;
  categorizedHistories: CategorizedHistories;
  createdAt: Date;
}
```

### 2. カテゴリ判定ロジック（Repository）

`changeDetail.type` からカテゴリを判定：

| カテゴリ | 対応する changeDetail.type |
|---------|---------------------------|
| basicInfo | BASIC_INFO_UPDATE, COPY, CREATE, DELETE, RESTORE, なし |
| preconditions | PRECONDITION_ADD, PRECONDITION_UPDATE, PRECONDITION_DELETE, PRECONDITION_REORDER |
| steps | STEP_ADD, STEP_UPDATE, STEP_DELETE, STEP_REORDER |
| expectedResults | EXPECTED_RESULT_ADD, EXPECTED_RESULT_UPDATE, EXPECTED_RESULT_DELETE, EXPECTED_RESULT_REORDER |

### 3. Repository更新（getHistoriesGrouped）

`test-case.repository.ts` の362-396行目付近を更新：
- グループ化時にカテゴリ別に振り分け
- `CategorizedHistories` 形式で返却

### 4. フロントエンド更新

- `api.ts` の型定義を更新
- `TestCaseHistoryList.tsx` でカテゴリ別表示に対応
  - 空カテゴリは非表示
  - カテゴリごとにセクションヘッダー（アイコン + ラベル）

## 表示イメージ

```
│ 📄 基本情報 (1件)
│    タイトルを変更
│    旧: ログインテスト → 新: ログイン認証テスト
│
│ 📋 前提条件 (1件)
│    前提条件を追加
│    追加: ユーザーがログアウト状態であること
│
│ 📝 手順 (1件)
│    手順を更新
│    旧: メールを入力 → 新: メールアドレスを入力
│
│ 🎯 期待結果 (1件)
│    期待結果を追加
│    追加: ログイン成功メッセージが表示される
```

## 検証方法

1. 開発サーバーを起動（`docker compose up`）
2. テストケース詳細画面で変更履歴を表示
3. 複数変更を含むグループを展開
4. カテゴリ別にセクション分けされていることを確認
5. 変更がないカテゴリは非表示であることを確認
