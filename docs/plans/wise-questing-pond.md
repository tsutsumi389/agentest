# 実行結果の分布（ドーナツチャート）実装計画

## 概要
プロジェクトダッシュボードに、テスト実行結果の分布を可視化するドーナツチャートを実装する。

## 現状
- **バックエンド**: 実装済み（`ProjectDashboardService.getResultDistribution()`）
- **API**: 実装済み（`GET /api/projects/:projectId/dashboard` → `resultDistribution`）
- **フロントエンド**: `ResultDistributionChart.tsx` が未実装

## 実装するコンポーネント

### 1. DonutChart（汎用UIコンポーネント）
**ファイル**: `apps/web/src/components/ui/DonutChart.tsx`

- CSS `conic-gradient` を使用したドーナツチャート
- ライブラリ不使用（軽量）
- 再利用可能な設計

```typescript
interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;  // HEXコード
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;              // デフォルト: 160px
  thickness?: number;         // デフォルト: 0.25
  centerContent?: React.ReactNode;
  emptyMessage?: string;
  ariaLabel?: string;
}
```

### 2. ResultDistributionChart（Feature コンポーネント）
**ファイル**: `apps/web/src/components/project/dashboard/ResultDistributionChart.tsx`

- `ProjectDashboardStats` を受け取り、分布データを表示
- ドーナツチャート + 凡例のレイアウト
- レスポンシブ対応（モバイル: 縦積み、デスクトップ: 横並び）

## カラースキーム
既存の `ProgressBar.tsx` に準拠:

| ステータス | Tailwindクラス | HEXコード |
|-----------|---------------|-----------|
| PASS（成功） | `bg-success` | `#3fb950` |
| FAIL（失敗） | `bg-danger` | `#f85149` |
| SKIPPED（スキップ） | `bg-foreground-subtle` | `#6e7681` |
| NOT_EXECUTABLE（実行不可） | `bg-accent` | `#58a6ff` |
| PENDING（未判定） | `bg-warning` | `#d29922` |

## 実装手順

### Step 1: DonutChart UIコンポーネント作成
1. `apps/web/src/components/ui/DonutChart.tsx` を新規作成
   - `buildConicGradient()` ヘルパー関数
   - 空状態の表示
   - アクセシビリティ対応（`role="img"`, `aria-label`）
2. `apps/web/src/components/ui/index.ts` にエクスポート追加

### Step 2: ResultDistributionChart 作成
1. `apps/web/src/components/project/dashboard/ResultDistributionChart.tsx` を新規作成
   - `SEGMENT_CONFIG` 定数（ステータス→色・ラベルのマッピング）
   - `LegendItem` サブコンポーネント（色ドット + ラベル + 件数 + %）
   - メインコンポーネント
2. `apps/web/src/components/project/dashboard/index.ts` にエクスポート追加

### Step 3: ProjectOverviewTab に統合
1. `apps/web/src/components/project/ProjectOverviewTab.tsx` を更新
   - `ResultDistributionChart` をインポート
   - コメントアウトを解除（52行目）

## 変更対象ファイル

### 新規作成
- `apps/web/src/components/ui/DonutChart.tsx`
- `apps/web/src/components/project/dashboard/ResultDistributionChart.tsx`

### 変更
- `apps/web/src/components/ui/index.ts` - エクスポート追加
- `apps/web/src/components/project/dashboard/index.ts` - エクスポート追加
- `apps/web/src/components/project/ProjectOverviewTab.tsx` - コンポーネント統合

## UI仕様

### レイアウト
```
┌─────────────────────────────────────────────────┐
│ 実行結果の分布                                    │
├─────────────────────────────────────────────────┤
│                                                 │
│   ┌────────────┐     ● 成功      80   (80.0%)  │
│   │            │     ● 失敗      10   (10.0%)  │
│   │   100件    │     ● 未判定     5    (5.0%)  │
│   │   総実行数  │     ● スキップ   3    (3.0%)  │
│   │            │     ● 実行不可   2    (2.0%)  │
│   └────────────┘                                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 空状態
- 全ての値が0の場合、グレーの円とメッセージを表示
- メッセージ: 「実行データがありません」

### レスポンシブ
- モバイル (<768px): チャート上、凡例下の縦積み
- タブレット以上 (>=768px): チャート左、凡例右の横並び

## 検証方法

1. **リント確認**
   ```bash
   docker compose exec dev pnpm lint
   ```

2. **手動確認**
   - プロジェクト詳細画面の概要タブを開く
   - ドーナツチャートが表示されることを確認
   - 各セグメントの色と凡例が正しいことを確認
   - 空のプロジェクトで空状態表示を確認
   - モバイル/デスクトップでレスポンシブ動作を確認
