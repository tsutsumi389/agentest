# テストケース履歴グループ展開時のカテゴリ別セクション表示

## 概要

`TestCaseHistoryList.tsx` のグループ展開時に、変更を4つのカテゴリ別にセクション分けして表示する機能を実装します。

## 対象ファイル

- `/apps/web/src/components/test-case/TestCaseHistoryList.tsx`（メイン変更対象）

## 実装内容

### 1. カテゴリ定義の追加

```tsx
type HistoryCategory = 'BASIC_INFO' | 'PRECONDITION' | 'STEP' | 'EXPECTED_RESULT';

const HISTORY_CATEGORIES: Record<HistoryCategory, { label: string; icon: typeof FileText }> = {
  BASIC_INFO: { label: '基本情報', icon: FileText },
  PRECONDITION: { label: '前提条件', icon: ClipboardList },
  STEP: { label: 'ステップ', icon: ListOrdered },
  EXPECTED_RESULT: { label: '期待結果', icon: Target },
};
```

アイコン（`FileText`, `ClipboardList`, `ListOrdered`, `Target`）を追加importします。

### 2. カテゴリ判定関数の追加

`getCategoryFromChangeDetail(snapshot, changeType)` 関数を追加し、`changeDetail.type` からカテゴリを判定します：

| カテゴリ | 対応する changeDetail.type |
|---------|---------------------------|
| BASIC_INFO | BASIC_INFO_UPDATE, COPY, CREATE, DELETE, RESTORE |
| PRECONDITION | PRECONDITION_ADD, PRECONDITION_UPDATE, PRECONDITION_DELETE, PRECONDITION_REORDER |
| STEP | STEP_ADD, STEP_UPDATE, STEP_DELETE, STEP_REORDER |
| EXPECTED_RESULT | EXPECTED_RESULT_ADD, EXPECTED_RESULT_UPDATE, EXPECTED_RESULT_DELETE, EXPECTED_RESULT_REORDER |

### 3. グループ化関数の追加

`groupHistoriesByCategory(histories)` 関数で履歴をカテゴリ別にグループ化。表示順序を保証し、空カテゴリは除外します。

### 4. CategorySectionコンポーネントの追加

各カテゴリのセクションを表示するコンポーネント：
- カテゴリヘッダー（アイコン + ラベル + 件数）
- 配下の履歴一覧（既存の `DiffView` を使用）

### 5. HistoryGroupItemコンポーネントの更新

展開部分（714-724行目）を更新し、`CategorySection` を使ったカテゴリ別表示に変更します。

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
│ 📝 ステップ (1件)
│    ステップを更新
│    旧: メールを入力 → 新: メールアドレスを入力
```

## 検証方法

1. 開発サーバーを起動（`docker compose up`）
2. テストケース詳細画面で変更履歴を表示
3. 複数変更を含むグループを展開
4. カテゴリ別にセクション分けされていることを確認
5. 変更がないカテゴリは非表示であることを確認
