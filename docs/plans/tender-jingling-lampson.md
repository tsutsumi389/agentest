# テストスイートページ分離実装計画

## 概要
テストスイート詳細ページを分離し、テストケース表示領域を最大化する。
GitHub codeページ風のパンくずリストナビゲーションを導入。

## 新しいURL構造

| URL | ページ | 用途 |
|-----|--------|------|
| `/test-suites/:id` | TestSuiteCasesPage | テストケース一覧・詳細（サイドバー維持） |
| `/test-suites/:id/info` | TestSuiteInfoPage | テストスイート情報（タブ: 概要/実行/レビュー/履歴/設定） |

## ヘッダーデザイン（GitHub風）

```
[プロジェクト名] / [テストスイート名]
─────────────────────────────────────────────
[テストケース] (12)  | [詳細情報]          [実行開始]
```

## 実装手順

### Step 1: TestSuiteHeader コンポーネント作成
**新規作成**: `apps/web/src/components/test-suite/TestSuiteHeader.tsx`

- パンくずリスト: プロジェクト名 → テストスイート名（info）へのリンク
- ナビゲーションタブ: 「テストケース」「詳細情報」
- アクションボタン: 編集、テストケース追加、実行開始

### Step 2: TestSuiteCasesPage 作成
**新規作成**: `apps/web/src/pages/TestSuiteCases.tsx`

現在の TestSuiteDetail.tsx から以下を移行:
- サイドバー設定ロジック（TestCaseSidebar）
- TestCaseDetailPanel / TestCaseForm の表示
- **タブを削除** → 表示領域最大化

### Step 3: TestSuiteInfoPage 作成
**新規作成**: `apps/web/src/pages/TestSuiteInfo.tsx`

現在の TestSuiteDetail.tsx から以下を移行:
- タブナビゲーション（概要/実行履歴/レビュー/変更履歴/設定）
- OverviewTab, SettingsTab
- TestSuiteForm（編集モード）
- サイドバーなし

### Step 4: ルーティング更新
**変更**: `apps/web/src/App.tsx`

```tsx
// 変更前
<Route path="test-suites/:testSuiteId" element={<TestSuiteDetailPage />} />

// 変更後
<Route path="test-suites/:testSuiteId" element={<TestSuiteCasesPage />} />
<Route path="test-suites/:testSuiteId/info" element={<TestSuiteInfoPage />} />
```

### Step 5: クリーンアップ
**削除**: `apps/web/src/pages/TestSuiteDetail.tsx`

## 変更ファイル一覧

| ファイル | 操作 |
|----------|------|
| `apps/web/src/components/test-suite/TestSuiteHeader.tsx` | 新規作成 |
| `apps/web/src/pages/TestSuiteCases.tsx` | 新規作成 |
| `apps/web/src/pages/TestSuiteInfo.tsx` | 新規作成 |
| `apps/web/src/App.tsx` | 変更（ルート追加） |
| `apps/web/src/pages/TestSuiteDetail.tsx` | 削除 |

## 補足: プロジェクト名の取得

テストスイートAPIのレスポンスにプロジェクト情報が含まれていない場合:
```tsx
const { data: projectData } = useQuery({
  queryKey: ['project', suite?.projectId],
  queryFn: () => projectsApi.getById(suite!.projectId),
  enabled: !!suite?.projectId,
});
```
