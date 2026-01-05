# テストケース選択時のヘッダー変更計画

## 要件
- テストスイート表示時: 現状のまま
- テストケース選択時:
  - パンくず: プロジェクト名 > テストスイート名 > テストケース名
  - タブ: テストケース用（概要/レビュー/履歴/設定）

## 現状の構造
- **TestSuiteHeader**: パンくず（2階層）+ テストスイート用タブ + アクションボタン
- **TestCaseDetailPanel**: 独自のヘッダー（タイトル、優先度バッジ、編集/コピー/閉じるボタン）+ タブ + タブコンテンツ

## 実装方針

### 1. TestSuiteHeader.tsx の拡張

テストケース選択時の表示モードを追加。

**追加props**:
```typescript
// テストケース選択時の情報
selectedTestCase?: {
  id: string;
  title: string;
  priority: string;
  status: string;
  deletedAt?: string | null;
};
testCaseTab?: 'overview' | 'review' | 'history' | 'settings';
onTestCaseTabChange?: (tab: TestCaseTabType) => void;
onEditTestCase?: () => void;
onCopyTestCase?: () => void;
onCloseTestCase?: () => void;
```

**表示切り替え**:
| 状態 | パンくず | タブ | アクションボタン |
|------|---------|------|-----------------|
| テストスイート | プロジェクト > テストスイート | 概要/実行履歴/レビュー/変更履歴/設定 | 編集/+テストケース/実行開始 |
| テストケース | プロジェクト > テストスイート > テストケース名 [優先度][ステータス] | 概要/レビュー/履歴/設定 | 編集/コピー/閉じる |

※テストケース選択時はパンくず行にテストケース名と優先度・ステータスバッジを表示

### 2. TestCaseDetailPanel.tsx の修正

- ヘッダー部分（タイトル、バッジ、ボタン）を削除
- タブナビゲーションを削除
- タブコンテンツ表示部分のみ残す
- `currentTab` を親から受け取るpropsに変更

### 3. TestSuiteCases.tsx の修正

- テストケースタブの状態管理（`testCaseTab` URLパラメータ）
- 選択中のテストケース情報をTestSuiteHeaderに渡す
- TestCaseDetailPanelにタブ状態を渡す

## 変更ファイル一覧

| ファイル | 操作 |
|----------|------|
| `apps/web/src/components/test-suite/TestSuiteHeader.tsx` | 修正 |
| `apps/web/src/components/test-case/TestCaseDetailPanel.tsx` | 修正 |
| `apps/web/src/pages/TestSuiteCases.tsx` | 修正 |

## URL設計

| URL | 表示内容 |
|-----|----------|
| `/test-suites/:id` | テストスイート概要 |
| `/test-suites/:id?tab=executions` | テストスイート実行履歴 |
| `/test-suites/:id?testCase=xxx` | テストケース概要（デフォルト） |
| `/test-suites/:id?testCase=xxx&testCaseTab=review` | テストケースレビュー |
| `/test-suites/:id?testCase=xxx&testCaseTab=history` | テストケース履歴 |
| `/test-suites/:id?testCase=xxx&testCaseTab=settings` | テストケース設定 |
