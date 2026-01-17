# KPIサマリーカード詳細実装計画

## 概要
プロジェクト概要タブ（ProjectOverviewTab）に表示するKPIサマリーカードの詳細仕様。
親プラン: [breezy-wondering-pudding.md](./breezy-wondering-pudding.md)

---

## 1. KPIカード仕様

### 1.1 テストケース総数
| 項目 | 値 |
|------|-----|
| アイコン | `FileText` (lucide-react) |
| 色 | `accent` |
| 値 | `summary.totalTestCases` |
| ラベル | "テストケース" |
| 備考 | プロジェクト内のテストケース総数 |

### 1.2 最終実行日時
| 項目 | 値 |
|------|-----|
| アイコン | `Clock` (lucide-react) |
| 色 | `muted` |
| 値 | 相対時間表示（例: "2時間前"） |
| ラベル | "最終実行" |
| 備考 | `summary.lastExecutionAt` がnullの場合は "--" を表示 |

**相対時間表示ロジック:**
```typescript
function formatRelativeTime(date: Date | null): string {
  if (!date) return '--';
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'たった今';
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 30) return `${diffDays}日前`;
  return new Date(date).toLocaleDateString('ja-JP');
}
```

### 1.3 成功率
| 項目 | 値 |
|------|-----|
| アイコン | `TrendingUp` (lucide-react) |
| 色 | 動的（後述） |
| 値 | `summary.overallPassRate` + "%" |
| ラベル | "成功率" |
| 備考 | パーセンテージ表示（小数点以下切り捨て） |

**動的色分けロジック:**
| 成功率 | 色 | 意味 |
|--------|-----|------|
| 80%以上 | `success` (緑) | 良好 |
| 50-79% | `warning` (黄) | 注意 |
| 50%未満 | `danger` (赤) | 要対応 |

```typescript
function getPassRateColor(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 80) return 'success';
  if (rate >= 50) return 'warning';
  return 'danger';
}
```

### 1.4 実行中テスト
| 項目 | 値 |
|------|-----|
| アイコン | `Play` (lucide-react) |
| 色 | 動的（後述） |
| 値 | `summary.inProgressExecutions` |
| ラベル | "実行中" |
| 備考 | 現在実行中のテスト数 |

**動的色分けロジック:**
| 実行中数 | 色 | 意味 |
|----------|-----|------|
| 1件以上 | `running` (青/アニメーション) | 実行中あり |
| 0件 | `muted` | 実行中なし |

```typescript
function getRunningColor(count: number): 'running' | 'muted' {
  return count > 0 ? 'running' : 'muted';
}
```

---

## 2. コンポーネント実装

### 2.1 ディレクトリ構成
```
apps/web/src/components/project/dashboard/
├── index.ts                    # エクスポート
└── KpiSummaryCards.tsx         # KPIカードコンポーネント
```

### 2.2 KpiCard（内部コンポーネント）

既存の`SummaryCard`パターン（ExecutionOverviewPanel.tsx:78-110）を拡張し、以下を追加:
- 文字列値のサポート（数値以外も表示可能）
- `running`色のサポート（アニメーション付き）

```typescript
/**
 * KPIカード（内部コンポーネント）
 * SummaryCardパターンを拡張
 */
function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: 'success' | 'danger' | 'warning' | 'muted' | 'accent' | 'running';
}) {
  const colorClasses = {
    success: 'bg-success-subtle text-success',
    danger: 'bg-danger-subtle text-danger',
    warning: 'bg-warning-subtle text-warning',
    muted: 'bg-background-tertiary text-foreground-muted',
    accent: 'bg-accent-subtle text-accent',
    running: 'bg-info-subtle text-info',
  };

  const isRunning = color === 'running';

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className={`w-5 h-5 ${isRunning ? 'animate-pulse' : ''}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-foreground-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
```

### 2.3 KpiSummaryCards（公開コンポーネント）

```typescript
import { FileText, Clock, TrendingUp, Play } from 'lucide-react';
import type { ProjectDashboardStats } from '@agentest/shared';

interface KpiSummaryCardsProps {
  /** ダッシュボード統計データ */
  stats: ProjectDashboardStats;
}

/**
 * KPIサマリーカード
 * プロジェクトのテスト状況を4つのカードで表示
 */
export function KpiSummaryCards({ stats }: KpiSummaryCardsProps) {
  const { summary } = stats;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* テストケース総数 */}
      <KpiCard
        icon={FileText}
        label="テストケース"
        value={summary.totalTestCases}
        color="accent"
      />

      {/* 最終実行日時 */}
      <KpiCard
        icon={Clock}
        label="最終実行"
        value={formatRelativeTime(summary.lastExecutionAt)}
        color="muted"
      />

      {/* 成功率 */}
      <KpiCard
        icon={TrendingUp}
        label="成功率"
        value={`${Math.floor(summary.overallPassRate)}%`}
        color={getPassRateColor(summary.overallPassRate)}
      />

      {/* 実行中テスト */}
      <KpiCard
        icon={Play}
        label="実行中"
        value={summary.inProgressExecutions}
        color={getRunningColor(summary.inProgressExecutions)}
      />
    </div>
  );
}
```

---

## 3. レイアウト

### 3.1 グリッドレイアウト
```
grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4
```

| ブレークポイント | 列数 | 用途 |
|------------------|------|------|
| デフォルト（モバイル） | 1列 | スマートフォン |
| md (768px以上) | 2列 | タブレット |
| xl (1280px以上) | 4列 | デスクトップ |

### 3.2 カード内レイアウト
```
card p-4
├── flex items-center gap-3
│   ├── アイコンボックス (w-10 h-10 rounded-lg)
│   └── テキストエリア
│       ├── 値 (text-2xl font-bold)
│       └── ラベル (text-sm text-foreground-muted)
```

---

## 4. 完全なコード例

### 4.1 KpiSummaryCards.tsx

```typescript
import { FileText, Clock, TrendingUp, Play } from 'lucide-react';
import type { ProjectDashboardStats } from '@agentest/shared';

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * 相対時間をフォーマット
 */
function formatRelativeTime(date: Date | null): string {
  if (!date) return '--';
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'たった今';
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 30) return `${diffDays}日前`;
  return new Date(date).toLocaleDateString('ja-JP');
}

/**
 * 成功率に基づく色を取得
 */
function getPassRateColor(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 80) return 'success';
  if (rate >= 50) return 'warning';
  return 'danger';
}

/**
 * 実行中テスト数に基づく色を取得
 */
function getRunningColor(count: number): 'running' | 'muted' {
  return count > 0 ? 'running' : 'muted';
}

// ============================================================================
// 内部コンポーネント
// ============================================================================

/**
 * KPIカード（内部コンポーネント）
 * SummaryCardパターンを拡張し、文字列値とrunning色をサポート
 */
function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: 'success' | 'danger' | 'warning' | 'muted' | 'accent' | 'running';
}) {
  const colorClasses = {
    success: 'bg-success-subtle text-success',
    danger: 'bg-danger-subtle text-danger',
    warning: 'bg-warning-subtle text-warning',
    muted: 'bg-background-tertiary text-foreground-muted',
    accent: 'bg-accent-subtle text-accent',
    running: 'bg-info-subtle text-info',
  };

  const isRunning = color === 'running';

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}
        >
          <Icon className={`w-5 h-5 ${isRunning ? 'animate-pulse' : ''}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-foreground-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 公開コンポーネント
// ============================================================================

interface KpiSummaryCardsProps {
  /** ダッシュボード統計データ */
  stats: ProjectDashboardStats;
}

/**
 * KPIサマリーカード
 * プロジェクトのテスト状況を4つのカードで表示
 */
export function KpiSummaryCards({ stats }: KpiSummaryCardsProps) {
  const { summary } = stats;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* テストケース総数 */}
      <KpiCard
        icon={FileText}
        label="テストケース"
        value={summary.totalTestCases}
        color="accent"
      />

      {/* 最終実行日時 */}
      <KpiCard
        icon={Clock}
        label="最終実行"
        value={formatRelativeTime(summary.lastExecutionAt)}
        color="muted"
      />

      {/* 成功率 */}
      <KpiCard
        icon={TrendingUp}
        label="成功率"
        value={`${Math.floor(summary.overallPassRate)}%`}
        color={getPassRateColor(summary.overallPassRate)}
      />

      {/* 実行中テスト */}
      <KpiCard
        icon={Play}
        label="実行中"
        value={summary.inProgressExecutions}
        color={getRunningColor(summary.inProgressExecutions)}
      />
    </div>
  );
}
```

### 4.2 index.ts（エクスポート設定）

```typescript
export { KpiSummaryCards } from './KpiSummaryCards';
```

### 4.3 ProjectOverviewTabでの使用例

```typescript
import { useEffect, useState } from 'react';
import { projectsApi, type ProjectDashboardStats } from '../../lib/api';
import { KpiSummaryCards } from './dashboard';

interface ProjectOverviewTabProps {
  projectId: string;
}

export function ProjectOverviewTab({ projectId }: ProjectOverviewTabProps) {
  const [stats, setStats] = useState<ProjectDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setIsLoading(true);
        const data = await projectsApi.getDashboard(projectId);
        setStats(data);
      } catch (err) {
        setError('ダッシュボードの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboard();
  }, [projectId]);

  if (isLoading) {
    return <div className="text-foreground-muted">読み込み中...</div>;
  }

  if (error || !stats) {
    return <div className="text-danger">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIサマリーカード */}
      <KpiSummaryCards stats={stats} />

      {/* 以下、他のダッシュボードコンポーネント */}
      {/* <ResultDistributionChart stats={stats} /> */}
      {/* <AttentionRequiredTable stats={stats} /> */}
      {/* <RecentActivityTimeline stats={stats} /> */}
      {/* <SuiteCoverageList stats={stats} /> */}
    </div>
  );
}
```

---

## 5. スタイル補足

### 5.1 Tailwind CSSクラス対応

既存のカラークラスは`tailwind.config.ts`で定義済み:
- `bg-success-subtle`, `text-success`
- `bg-danger-subtle`, `text-danger`
- `bg-warning-subtle`, `text-warning`
- `bg-accent-subtle`, `text-accent`
- `bg-background-tertiary`, `text-foreground-muted`

### 5.2 新規追加が必要なクラス

`running`色のサポートには以下のクラスが必要:
```css
/* tailwind.config.ts に追加 */
info: 'var(--color-info)',
'info-subtle': 'var(--color-info-subtle)',
```

または、既存の`accent`色を流用する選択肢もあり:
```typescript
running: 'bg-accent-subtle text-accent',
```

---

## 6. 親プランとの整合性

| 親プラン記載 | 本計画での対応 |
|--------------|----------------|
| 既存の `SummaryCard` パターンを参照 | ✅ ExecutionOverviewPanel.tsx:78-110を参照 |
| 4列グリッド | ✅ `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` |
| テストケース数、最終実行、成功率、実行中 | ✅ 4つのカードで実装 |
| `KpiSummaryCards.tsx` | ✅ ファイル名・コンポーネント名を踏襲 |
| `dashboard/index.ts` でエクスポート | ✅ エクスポート設定を記載 |

---

## 7. 検証チェックリスト

- [ ] `KpiCard`がSummaryCardパターンと同じ構造か
- [ ] 4つのカードが正しいアイコン・色を使用しているか
- [ ] 相対時間表示が正しく動作するか
- [ ] 成功率の動的色分けが仕様通りか
- [ ] 実行中テストのアニメーションが機能するか
- [ ] レスポンシブレイアウトが正しく動作するか
- [ ] 型定義（`ProjectDashboardStats`）と整合しているか
