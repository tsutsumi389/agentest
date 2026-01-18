# プロジェクト概要タブ仕様変更

## 変更概要

| 項目 | 変更内容 |
|------|----------|
| フィルター | 環境・ラベルでフィルター機能を追加 |
| KPIカード | テストスイート数、テストケース数、期待結果数を表示（3枚に変更） |
| KPIカード削除 | 最終実行日、成功率、実行中 |
| レイアウト | 実行結果の分布と最近の活動を横並び（高さを揃える） |
| 削除 | テストスイート別カバレッジ |

---

## 実装手順

### 1. 型定義の変更
**ファイル**: `packages/shared/src/types/project-dashboard.ts`

```typescript
// ProjectDashboardSummary の変更
export interface ProjectDashboardSummary {
  totalTestSuites: number;       // 追加
  totalTestCases: number;        // 既存
  totalExpectedResults: number;  // 追加
  // 削除: lastExecutionAt, overallPassRate, inProgressExecutions
}

// フィルターパラメータ追加
export interface DashboardFilterParams {
  environmentId?: string;
  labelIds?: string[];
}

// ProjectDashboardStats から suiteCoverage を削除
// SuiteCoverageItem インターフェースを削除
```

### 2. バックエンドAPI変更
**ファイル**: `apps/api/src/services/project-dashboard.service.ts`

- `getDashboard()`: フィルターパラメータ（environmentId, labelIds）を追加
- `getSummary()`:
  - 追加: `totalTestSuites`（TestSuite.count）
  - 追加: `totalExpectedResults`（TestCaseExpectedResult.count）
  - 削除: lastExecutionAt, overallPassRate, inProgressExecutions の取得処理
- `getSuiteCoverage()`: メソッド削除
- フィルター適用:
  - ラベル: TestSuiteLabelを通じてテストスイートをフィルター
  - 環境: ExecutionのenvironmentIdでフィルター

**ファイル**: `apps/api/src/controllers/project.controller.ts`
- クエリパラメータ追加: `environmentId`, `labelIds`（カンマ区切り）

### 3. フロントエンドAPI変更
**ファイル**: `apps/web/src/lib/api.ts`

```typescript
getDashboard: (projectId: string, params?: {
  environmentId?: string;
  labelIds?: string[]
}) => ...
```

### 4. フィルターコンポーネント作成
**新規**: `apps/web/src/components/project/dashboard/DashboardFilters.tsx`

- 環境セレクト（単一選択）
- ラベルセレクト（複数選択、既存LabelSelectorを参考）

### 5. KPIカード変更
**ファイル**: `apps/web/src/components/project/dashboard/KpiSummaryCards.tsx`

変更前（4枚）:
- テストケース数、最終実行、成功率、実行中

変更後（3枚）:
- テストスイート数（FolderKanban アイコン）
- テストケース数（FileText アイコン）
- 期待結果数（CheckSquare アイコン）

グリッド: `grid-cols-1 md:grid-cols-3`

### 6. メインコンポーネント変更
**ファイル**: `apps/web/src/components/project/ProjectOverviewTab.tsx`

```tsx
<div className="space-y-6">
  {/* フィルター */}
  <DashboardFilters ... />

  {/* KPIカード（3枚） */}
  <KpiSummaryCards stats={stats} />

  {/* 実行結果の分布 + 最近の活動（横並び・高さ揃え） */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <ResultDistributionChart stats={stats} />
    <RecentActivityTimeline stats={stats} className="h-full" />
  </div>

  {/* 要注意テスト */}
  <AttentionRequiredTable stats={stats} />
</div>
```

### 7. 最近の活動の高さ調整
**ファイル**: `apps/web/src/components/project/dashboard/RecentActivityTimeline.tsx`

- `className` プロパティを追加
- 高さ固定、内部スクロール対応

### 8. 削除対象

| ファイル/コード | 操作 |
|----------------|------|
| `SuiteCoverageList.tsx` | ファイル削除 |
| `dashboard/index.ts` | SuiteCoverageList エクスポート削除 |
| `project-dashboard.ts` | SuiteCoverageItem 型削除 |
| `project-dashboard.service.ts` | getSuiteCoverage メソッド削除 |

---

## 影響ファイル一覧

| ファイル | 変更 |
|---------|------|
| `packages/shared/src/types/project-dashboard.ts` | 型変更 |
| `apps/api/src/services/project-dashboard.service.ts` | サービス変更 |
| `apps/api/src/controllers/project.controller.ts` | パラメータ追加 |
| `apps/web/src/lib/api.ts` | API関数変更 |
| `apps/web/src/components/project/ProjectOverviewTab.tsx` | レイアウト変更 |
| `apps/web/src/components/project/dashboard/KpiSummaryCards.tsx` | カード変更 |
| `apps/web/src/components/project/dashboard/RecentActivityTimeline.tsx` | 高さ対応 |
| `apps/web/src/components/project/dashboard/DashboardFilters.tsx` | **新規作成** |
| `apps/web/src/components/project/dashboard/index.ts` | エクスポート変更 |
| `apps/web/src/components/project/dashboard/SuiteCoverageList.tsx` | **削除** |

---

## 検証方法

1. Docker環境起動: `cd docker && docker compose up`
2. ブラウザでプロジェクト概要タブを開く
3. 確認項目:
   - フィルターで環境・ラベルを選択し、表示内容が絞り込まれること
   - KPIカードが3枚（テストスイート数、テストケース数、期待結果数）表示されること
   - 実行結果の分布と最近の活動が横並びで同じ高さで表示されること
   - テストスイート別カバレッジが表示されないこと
4. テスト実行: `docker compose exec dev pnpm test`
5. ビルド確認: `docker compose exec dev pnpm build`
