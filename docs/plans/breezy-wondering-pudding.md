# プロジェクト概要タブ ダッシュボード機能実装計画

## 概要
プロジェクトの概要タブにテスト状況・分析結果を表示するダッシュボード機能を実装する。

## 実装する機能
1. **テスト実行サマリー（KPIカード）** - テストケース総数、最終実行日時、成功率、実行中テスト
2. **実行結果の分布（ドーナツチャート）** - PASS/FAIL/SKIPPED/NOT_EXECUTABLE/PENDINGの割合
3. **要注意テスト一覧** - 失敗中、長期未実行、不安定なテスト
4. **最近の活動（タイムライン）** - 実行、テストケース更新、レビュー
5. **テストスイート別カバレッジ** - スイートごとの成功率・実行状況

---

## Phase 1: バックエンド実装

### 1.1 型定義追加
**ファイル**: `packages/shared/src/types/project-dashboard.ts`（新規）

```typescript
export interface ProjectDashboardStats {
  summary: {
    totalTestCases: number;
    lastExecutionAt: Date | null;
    overallPassRate: number;
    inProgressExecutions: number;
  };
  resultDistribution: {
    pass: number;
    fail: number;
    skipped: number;
    notExecutable: number;
    pending: number;
  };
  attentionRequired: {
    failingTests: FailingTestItem[];
    longNotExecuted: LongNotExecutedItem[];
    flakyTests: FlakyTestItem[];
  };
  recentActivities: RecentActivityItem[];
  suiteCoverage: SuiteCoverageItem[];
}
```

### 1.2 サービス作成
**ファイル**: `apps/api/src/services/project-dashboard.service.ts`（新規）

- `getProjectDashboard(projectId: string, userId: string)` メソッド
- 統計クエリは過去30日間を対象
- 要注意テストの定義:
  - 失敗中: 最新の実行でFAIL
  - 長期未実行: 30日以上未実行
  - 不安定: 過去10回の成功率50-90%

### 1.3 APIエンドポイント追加
**ファイル**: `apps/api/src/routes/projects.ts`

```
GET /api/projects/:projectId/dashboard
```
- `requireProjectRole('READ')` ミドルウェア使用

---

## Phase 2: フロントエンド実装

### 2.1 APIクライアント更新
**ファイル**: `apps/web/src/lib/api.ts`

```typescript
projectsApi.getDashboard(projectId: string)
```

### 2.2 コンポーネント構成
```
apps/web/src/components/project/
├── ProjectOverviewTab.tsx          # 親コンポーネント（リファクタ）
└── dashboard/
    ├── index.ts                    # エクスポート
    ├── KpiSummaryCards.tsx         # KPIカード
    ├── ResultDistributionChart.tsx # ドーナツチャート（CSS-only）
    ├── AttentionRequiredTable.tsx  # 要注意テスト一覧
    ├── RecentActivityTimeline.tsx  # 最近の活動
    └── SuiteCoverageList.tsx       # スイート別カバレッジ
```

### 2.3 実装詳細

#### KpiSummaryCards.tsx
- 既存の `SummaryCard` パターンを参照（ExecutionOverviewPanel.tsx:78-110）
- 4列グリッド: テストケース数、最終実行、成功率、実行中

#### ResultDistributionChart.tsx
- CSS-onlyドーナツチャート（ライブラリ不要）
- `ProgressBar` と同じカラースキーム使用

#### AttentionRequiredTable.tsx
- タブ切り替え: 失敗中 | 長期未実行 | 不安定
- テストケースへのリンク付き

#### RecentActivityTimeline.tsx
- アイコン + 日時 + 内容 + アクター
- 最大10件表示

#### SuiteCoverageList.tsx
- 既存の `ProgressBar` コンポーネント再利用
- スイート名、テスト数、実行数、成功率

---

## 実装順序

1. `packages/shared` に型定義追加
2. `apps/api` にサービス・エンドポイント追加
3. `apps/web/src/lib/api.ts` にAPIクライアント追加
4. `dashboard/` 配下にコンポーネント作成
5. `ProjectOverviewTab.tsx` をリファクタして統合

---

## 変更対象ファイル

### 新規作成
- `packages/shared/src/types/project-dashboard.ts`
- `apps/api/src/services/project-dashboard.service.ts`
- `apps/web/src/components/project/dashboard/index.ts`
- `apps/web/src/components/project/dashboard/KpiSummaryCards.tsx`
- `apps/web/src/components/project/dashboard/ResultDistributionChart.tsx`
- `apps/web/src/components/project/dashboard/AttentionRequiredTable.tsx`
- `apps/web/src/components/project/dashboard/RecentActivityTimeline.tsx`
- `apps/web/src/components/project/dashboard/SuiteCoverageList.tsx`

### 変更
- `packages/shared/src/types/index.ts` - エクスポート追加
- `apps/api/src/routes/projects.ts` - エンドポイント追加
- `apps/web/src/lib/api.ts` - 型定義とAPIクライアント追加
- `apps/web/src/components/project/ProjectOverviewTab.tsx` - 全面リファクタ

---

## 検証方法

1. **APIテスト**: `docker compose exec dev pnpm test` でユニットテスト実行
2. **手動テスト**:
   - プロジェクト詳細画面の概要タブを開く
   - 各セクションのデータが正しく表示されることを確認
   - テスト実行後にデータが更新されることを確認
3. **空データ確認**: テストがないプロジェクトでも適切な空状態が表示される
