# テストスイートページ統合計画

## 概要
テストスイート詳細ページを1ページに統合。サイドバー（テストケース一覧）は常に表示し、メインエリアでタブとテストケース詳細を切り替える。

## 変更前後の比較

### 変更前
- `/test-suites/:id` → テストケースページ（サイドバーあり、タブなし）
- `/test-suites/:id/info` → 詳細情報ページ（サイドバーなし、タブあり）
- ヘッダーに「テストケース」「詳細情報」のナビゲーションタブ

### 変更後
- `/test-suites/:id` のみ
- 常にサイドバー（テストケース一覧）を表示
- メインエリア:
  - テストケース未選択時 → タブ（概要/実行履歴/レビュー/変更履歴/設定）
  - テストケース選択時 → TestCaseDetailPanel
  - 作成モード時 → TestCaseForm

## 新しいヘッダーデザイン

```
[プロジェクト名] / [テストスイート名]
─────────────────────────────────────────────
[概要] [実行履歴] [レビュー] [変更履歴] [設定]    [編集] [+テストケース] [実行開始]
```
※テストケース選択時はタブがハイライト解除される

## 実装手順

### Step 1: TestSuiteHeader 修正
**ファイル**: `apps/web/src/components/test-suite/TestSuiteHeader.tsx`

- 「テストケース」「詳細情報」のナビゲーションタブを削除
- 代わりに「概要」「実行履歴」「レビュー」「変更履歴」「設定」のタブを追加
- タブ選択状態を親から受け取るpropsに変更
- テストケース選択時はタブのハイライトを解除

### Step 2: TestSuiteCasesPage に InfoPage の機能を統合
**ファイル**: `apps/web/src/pages/TestSuiteCases.tsx`

- TestSuiteInfoPage のタブコンテンツ（概要/実行履歴/レビュー等）を統合
- URLパラメータ `?tab=overview` でタブ状態を管理
- テストケース選択時（`?testCase=xxx`）はタブコンテンツではなく詳細パネルを表示
- 作成モード時（`?mode=create`）は作成フォームを表示

### Step 3: TestSuiteInfoPage 削除
**ファイル**: `apps/web/src/pages/TestSuiteInfo.tsx`

- 不要になるため削除

### Step 4: ルーティング更新
**ファイル**: `apps/web/src/App.tsx`

- `/test-suites/:testSuiteId/info` ルートを削除
- TestSuiteInfoPage のインポートを削除

## 変更ファイル一覧

| ファイル | 操作 |
|----------|------|
| `apps/web/src/components/test-suite/TestSuiteHeader.tsx` | 修正（タブをサブタブに変更） |
| `apps/web/src/pages/TestSuiteCases.tsx` | 修正（InfoPageの機能を統合） |
| `apps/web/src/pages/TestSuiteInfo.tsx` | 削除 |
| `apps/web/src/App.tsx` | 修正（infoルート削除） |

## URL設計

| URL | 表示内容 |
|-----|----------|
| `/test-suites/:id` | 概要タブ（デフォルト） |
| `/test-suites/:id?tab=overview` | 概要タブ |
| `/test-suites/:id?tab=executions` | 実行履歴タブ |
| `/test-suites/:id?tab=review` | レビュータブ |
| `/test-suites/:id?tab=history` | 変更履歴タブ |
| `/test-suites/:id?tab=settings` | 設定タブ |
| `/test-suites/:id?testCase=xxx` | テストケース詳細 |
| `/test-suites/:id?mode=create` | テストケース作成フォーム |
