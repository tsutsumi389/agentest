# ステータス色の統一修正

## 問題

`execution-status.ts`で定義された色設定と、実際のコンポーネントで使用されている色が不一致。

### 期待される色設定（tailwind.config.ts + execution-status.ts）
| ステータス | テキスト色 | 16進数コード |
|----------|----------|------------|
| PENDING（未判定） | text-foreground-muted | #8b949e |
| PASS（成功） | text-success | #3fb950 |
| FAIL（失敗） | text-danger | #f85149 |
| SKIPPED（スキップ） | text-warning | #d29922 |

## 修正対象ファイル

### 1. ResultDistributionChart.tsx（主要問題）
**ファイル**: `apps/web/src/components/project/dashboard/ResultDistributionChart.tsx`

**現在の設定（間違い）**:
```typescript
const SEGMENT_CONFIG = {
  pass: { label: '成功', color: '#3fb950' },     // ✓ 正しい
  fail: { label: '失敗', color: '#f85149' },     // ✓ 正しい
  pending: { label: '未判定', color: '#d29922' }, // ❌ warningの色（SKIPPEDの色）
  skipped: { label: 'スキップ', color: '#6e7681' }, // ❌ foreground-subtleの色
}
```

**修正後**:
```typescript
const SEGMENT_CONFIG = {
  pass: { label: '成功', color: '#3fb950' },
  fail: { label: '失敗', color: '#f85149' },
  pending: { label: '未判定', color: '#8b949e' }, // foreground-muted
  skipped: { label: 'スキップ', color: '#d29922' }, // warning
}
```

### 2. ProjectDetail.tsx（ラベル修正）
**ファイル**: `apps/web/src/pages/ProjectDetail.tsx`（458-463行目）

**現在の設定**:
```typescript
const judgmentDisplayConfig = {
  PASS: { label: '成功', className: 'text-success' },
  FAIL: { label: '失敗', className: 'text-danger' },
  PENDING: { label: '未実施', className: 'text-foreground-muted' }, // ❌ ラベルが違う
  SKIPPED: { label: 'スキップ', className: 'text-warning' },
}
```

**修正後**:
```typescript
const judgmentDisplayConfig = {
  PASS: { label: '成功', className: 'text-success' },
  FAIL: { label: '失敗', className: 'text-danger' },
  PENDING: { label: '未判定', className: 'text-foreground-muted' }, // 「未実施」→「未判定」
  SKIPPED: { label: 'スキップ', className: 'text-warning' },
}
```

## 実装手順

1. `ResultDistributionChart.tsx`のpendingとskippedの色を修正
2. `ProjectDetail.tsx`のPENDINGラベルを「未判定」に変更

## 検証方法

1. `docker compose exec dev pnpm build` - ビルド確認
2. プロジェクト詳細画面で「実行結果の分布」ドーナツチャートの色を確認
   - 未判定: グレー(#8b949e)
   - スキップ: 黄色/オレンジ(#d29922)
