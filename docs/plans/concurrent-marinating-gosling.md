# テストスイート新規作成フォームのルーティング変更

> **ステータス: 実装済み**

## 概要

テストスイート新規作成フォームを `/projects/:projectId?tab=suites&mode=create`（プロジェクト詳細ページ内の条件付きレンダリング）から、独立ページ `/test-suites/new?projectId=xxx` へ分離する。

## 変更ファイル一覧

| ファイル | 変更種別 |
|---------|---------|
| `apps/web/src/pages/TestSuiteNew.tsx` | **新規作成** |
| `apps/web/src/App.tsx` | 変更（ルート追加 + import） |
| `apps/web/src/pages/ProjectDetail.tsx` | 変更（作成モード関連コード削除、ボタンをLink化） |

## Step 1: `TestSuiteNew.tsx` 新規作成ページ

新規ファイル `apps/web/src/pages/TestSuiteNew.tsx` を作成:

- `useSearchParams` から `projectId` を取得
- `projectId` 未指定時・プロジェクト未発見時のエラー表示
- `useQuery` でプロジェクト情報を取得（パンくずリスト表示用、キャッシュ済みなら即表示）
- 既存の `TestSuiteForm` (mode="create") をそのまま再利用
- `onSave`: 作成成功時 → `/test-suites/:createdId` へ遷移
- `onCancel`: キャンセル時 → `/projects/:projectId?tab=suites` へ戻る

## Step 2: `App.tsx` ルート追加

- `TestSuiteNewPage` をインポート
- `test-suites/new` ルートを `test-suites/:testSuiteId` の**前**に追加（`:testSuiteId` にマッチしないように）

```diff
+ <Route path="test-suites/new" element={<TestSuiteNewPage />} />
  <Route path="test-suites/:testSuiteId" element={<TestSuiteCasesPage />} />
```

## Step 3: `ProjectDetail.tsx` 作成モード関連コード除去

### 削除するもの
- `TestSuiteForm` のインポート（行18）
- `isCreateMode` 変数（行49）
- `handleStartCreateMode` 関数（行70-75）
- `handleExitCreateMode` 関数（行78-88）
- `handleTabChange` 内の `mode` 削除処理（行55）
- `isCreateMode` 時の `TestSuiteForm` レンダリングブロック（行266-274）

### 変更するもの
- ヘッダーの作成ボタン: `<button onClick={handleStartCreateMode}>` → `<Link to={/test-suites/new?projectId=${projectId}}>`
- テストスイートタブコンテンツ: 三項演算子の条件分岐を除去し、常に `TestSuiteListContent` を表示
- `TestSuiteListContent` の `onCreateClick` prop → `projectId` prop に変更
- 空状態の作成ボタンも `<Link>` に変更

## 検証方法

1. プロジェクト詳細の「テストスイート」ボタン → `/test-suites/new?projectId=xxx` へ遷移
2. 空状態の「テストスイートを作成」ボタン → 同上
3. `/test-suites/new?projectId=xxx` でフォーム表示
4. 作成成功 → `/test-suites/:id` へ遷移
5. キャンセル → `/projects/:projectId?tab=suites` へ戻る
6. `/test-suites/new`（projectId なし）→ エラー表示
7. 既存の `/test-suites/:testSuiteId` が正常動作
