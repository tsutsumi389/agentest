# テストケース作成画面の改善

## 概要

テストケース作成フォームの使いやすさを向上させるための変更。

## 変更内容

### 1. テストスート操作領域の非表示（作成モード時）

作成モード時にTestSuiteHeaderのタブとアクションボタンを非表示にする。

**変更ファイル:**
- `apps/web/src/components/test-suite/TestSuiteHeader.tsx`
  - 新しいprop `isCreateMode?: boolean` を追加
  - 作成モード時はタブ（概要、実行履歴、レビュー、変更履歴、設定）とアクションボタン（編集、テストケース、実行開始）を非表示
  - パンくずリストは残す（現在地のナビゲーションとして必要）

- `apps/web/src/pages/TestSuiteCases.tsx`
  - TestSuiteHeaderに `isCreateMode={isCreateMode}` を渡す

### 2. ステータスのデフォルトを「アクティブ」に変更

**変更ファイル:**
- `apps/web/src/components/test-case/TestCaseForm.tsx`
  - 74-76行目: 初期値を `'DRAFT'` → `'ACTIVE'` に変更

### 3. ステータスプルダウンの削除と下書きチェックボックスの追加

**変更ファイル:**
- `apps/web/src/components/test-case/TestCaseForm.tsx`
  - 575-592行目: ステータスのselectを削除
  - 代わりに「下書きとして保存」チェックボックスを追加
  - チェックON → DRAFT、チェックOFF → ACTIVE

### 4. 「ステップ」→「手順」への文言変更

**変更ファイル:**
- `apps/web/src/components/test-case/TestCaseForm.tsx`
  - 611行目: `title="ステップ"` → `title="手順"`
  - 620行目: `placeholder="ステップを入力..."` → `placeholder="手順を入力..."`

## 変更対象ファイル一覧

1. `apps/web/src/components/test-suite/TestSuiteHeader.tsx`
2. `apps/web/src/pages/TestSuiteCases.tsx`
3. `apps/web/src/components/test-case/TestCaseForm.tsx`

## 検証方法

1. テストスイートページで「+ テストケース」ボタンをクリック
2. 作成モードに入ったら、タブとアクションボタンが非表示になることを確認
3. ステータスのプルダウンがなく、代わりに「下書きとして保存」チェックボックスがあることを確認
4. チェックボックスをOFFにして保存 → ステータスが「アクティブ」で作成されることを確認
5. チェックボックスをONにして保存 → ステータスが「下書き」で作成されることを確認
6. 「ステップ」セクションが「手順」に変更されていることを確認
