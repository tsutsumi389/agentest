# 要注意テスト一覧（AttentionRequiredTable）実装計画

## 概要
プロジェクト概要タブに「要注意テスト一覧」セクションを追加する。
バックエンドは既に実装済み（`project-dashboard.service.ts`）のため、**フロントエンドコンポーネントの実装のみ**が必要。

## 機能要件
3種類の要注意テストをタブ切り替えで表示：

| タブ | 説明 | 表示データ |
|-----|------|-----------|
| 失敗中 | 最新実行でFAIL | テスト名、スイート名、最終実行日時、連続失敗回数 |
| 長期未実行 | 30日以上未実行 | テスト名、スイート名、最終実行日時、未実行日数 |
| 不安定 | 成功率50-90% | テスト名、スイート名、成功率、実行回数 |

## 変更ファイル

### 1. 新規作成: `apps/web/src/components/project/dashboard/AttentionRequiredTable.tsx`

```
AttentionRequiredTable
├── Props: stats (ProjectDashboardStats)
├── State: activeTab ('failing' | 'longNotExecuted' | 'flaky')
├── Components:
│   ├── TabButtons - タブ切り替えボタン（件数バッジ付き）
│   ├── FailingTestsList - 失敗中テスト一覧
│   ├── LongNotExecutedList - 長期未実行テスト一覧
│   └── FlakyTestsList - 不安定テスト一覧
└── EmptyState - 各タブのデータがない場合の表示
```

**実装ポイント**:
- 各リスト項目はテストケース詳細ページへのリンク
- リンク先: `/projects/${projectId}/test-suites/${testSuiteId}/test-cases/${testCaseId}`
- `AuditLogList.tsx`のカード・リストパターンを参照
- アイコン: `AlertTriangle`（失敗）、`Clock`（未実行）、`Activity`（不安定）

### 2. 変更: `apps/web/src/components/project/dashboard/index.ts`
```typescript
export { AttentionRequiredTable } from './AttentionRequiredTable';
```

### 3. 変更: `apps/web/src/components/project/ProjectOverviewTab.tsx`
```typescript
import { KpiSummaryCards, ResultDistributionChart, AttentionRequiredTable } from './dashboard';

// コメントアウトを解除
<AttentionRequiredTable stats={stats} />
```

## UI設計

### タブデザイン
```
[失敗中 (3)] [長期未実行 (5)] [不安定 (2)]
```
- アクティブタブ: `border-b-2 border-accent text-accent`
- 件数が0のタブも表示（非活性スタイル）

### リスト項目デザイン
```
┌─────────────────────────────────────────────────────┐
│ [アイコン] テストケース名                              │
│            スイート名: TestSuite A                   │
│            最終実行: 3日前 | 連続失敗: 5回           │
│                                              [→]   │
└─────────────────────────────────────────────────────┘
```

### 空状態
```
このカテゴリの要注意テストはありません
```

## 型定義（既存・参照のみ）

```typescript
// packages/shared/src/types/project-dashboard.ts - 変更不要
interface FailingTestItem {
  testCaseId: string;
  title: string;
  testSuiteId: string;
  testSuiteName: string;
  lastExecutedAt: Date | string;
  consecutiveFailures: number;
}

interface LongNotExecutedItem {
  testCaseId: string;
  title: string;
  testSuiteId: string;
  testSuiteName: string;
  lastExecutedAt: Date | string | null;
  daysSinceLastExecution: number | null;
}

interface FlakyTestItem {
  testCaseId: string;
  title: string;
  testSuiteId: string;
  testSuiteName: string;
  passRate: number;
  totalExecutions: number;
}
```

## 実装手順

1. `AttentionRequiredTable.tsx` を作成
   - タブ状態管理
   - 3種類のリストコンポーネント
   - 空状態の表示
2. `dashboard/index.ts` にエクスポート追加
3. `ProjectOverviewTab.tsx` でインポート・使用

## 検証方法

1. **開発サーバーで確認**
   ```bash
   cd docker && docker compose up
   ```
2. **手動テスト**
   - プロジェクト詳細画面 → 概要タブを開く
   - 各タブの切り替えが動作することを確認
   - テストケースへのリンクが正しく動作することを確認
   - データがない場合の空状態表示を確認
3. **レスポンシブ確認**
   - モバイル幅でのレイアウト崩れがないことを確認
