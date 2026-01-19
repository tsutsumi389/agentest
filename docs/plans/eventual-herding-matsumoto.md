# スキップ色の統一

## 概要

スキップ（SKIPPED）の色をテストスイートのドーナッツチャートで使用されているオレンジ（`#d29922` / `warning`）に統一する。

## 現状

| コンポーネント | 現在の色 | 統一後 |
|--------------|---------|--------|
| ドーナッツチャート | `#d29922` (オレンジ) | そのまま |
| execution-status.ts | `text-warning` (オレンジ) | そのまま |
| SummaryCard | `warning` (オレンジ) | そのまま |
| **ProgressBar** | `bg-foreground-subtle` (グレー) | `bg-warning` (オレンジ) |
| **StatusBadge** | `bg-background-tertiary text-foreground-subtle` (グレー) | `bg-warning-subtle text-warning` (オレンジ) |
| **デザインガイドライン** | `#6e7681` (グレー) | `#d29922` (オレンジ) |

## 変更対象ファイル

### 1. ProgressBar コンポーネント
`apps/web/src/components/ui/ProgressBar.tsx`

```diff
- className="bg-foreground-subtle transition-all duration-300 ease-out"
+ className="bg-warning transition-all duration-300 ease-out"
```

ラベル部分も：
```diff
- <span className="w-2 h-2 rounded-full bg-foreground-subtle" />
+ <span className="w-2 h-2 rounded-full bg-warning" />
```

### 2. StatusBadge コンポーネント
`apps/web/src/components/ui/StatusBadge.tsx`

```diff
skipped: {
  icon: SkipForward,
- className: 'bg-background-tertiary text-foreground-subtle',
+ className: 'bg-warning-subtle text-warning',
  label: 'スキップ',
},
```

### 3. デザインガイドライン SKILL.md
`.claude/skills/design-guidelines/SKILL.md`

テスト状態の色を修正：
```diff
- ⏭️ Skipped → `--text-muted`（グレー）
+ ⏭️ Skipped → `--warning-*`（オレンジ）
```

### 4. デザインガイドライン colors.md
`.claude/skills/design-guidelines/references/colors.md`

ステータスカラーマッピングを修正：
```diff
- | **Skipped** | `#6e7681` | `#21262d` | ⊘ Skip |
+ | **Skipped** | `#d29922` | `#2e2111` | ⊘ Skip |
```

CSS実装例も修正：
```diff
skipped: {
- color: 'var(--text-muted)',
- bg: 'var(--bg-tertiary)',
+ color: 'var(--warning)',
+ bg: 'var(--warning-subtle)',
  icon: SkipForward,
},
```

## 検証方法

1. ビルドが成功することを確認
2. 実行履歴画面でProgressBarのスキップ色がオレンジになっていることを確認
3. StatusBadgeを使用している箇所でスキップ色がオレンジになっていることを確認
