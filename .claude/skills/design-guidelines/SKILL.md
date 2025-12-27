---
name: design-guidelines
description: テスト管理ツールSaaSのUI/UXデザインガイドライン。Terminal/CLI風のミニマルなデザインシステムを提供する。UIコンポーネント、画面レイアウト、スタイリング、フロントエンド実装について言及している場合、または「デザイン」「UI」「スタイル」「コンポーネント」に関する質問がある場合に使用する。
---

# Design Guidelines - テスト管理ツール

Terminal/CLI風のミニマルで機能的なデザインシステム。GitHub/Linearの美学を継承し、エンジニアが直感的に操作できるUIを実現する。

## Design Principles

1. **Function Over Form** - 装飾より機能。全ての要素に意味がある
2. **Information Density** - 適切な情報密度。スクロールを最小化
3. **Keyboard First** - キーボード操作を前提とした設計
4. **Instant Feedback** - 操作結果を即座に視覚化
5. **Consistent Patterns** - 一度学べばどこでも使える

## Quick Reference

| カテゴリ | 詳細 |
|---------|------|
| カラーシステム | [references/colors.md](references/colors.md) |
| タイポグラフィ | [references/typography.md](references/typography.md) |
| コンポーネント | [references/components.md](references/components.md) |
| レイアウト | [references/layout.md](references/layout.md) |
| インタラクション | [references/interaction.md](references/interaction.md) |
| アクセシビリティ | [references/accessibility.md](references/accessibility.md) |

## Core Visual Identity

### Color Philosophy

ダークモードファースト。ターミナルの美学を継承しつつ、モダンな洗練さを加える。

```css
/* Primary Palette */
--bg-primary: #0d1117;      /* GitHub Dark背景 */
--bg-secondary: #161b22;    /* カード/パネル */
--bg-tertiary: #21262d;     /* ホバー/選択 */
--border: #30363d;          /* ボーダー */
--text-primary: #e6edf3;    /* メインテキスト */
--text-secondary: #8b949e;  /* サブテキスト */
--text-muted: #6e7681;      /* 補助テキスト */

/* Accent Colors - テスト状態を表現 */
--accent-green: #3fb950;    /* Passed/Success */
--accent-red: #f85149;      /* Failed/Error */
--accent-yellow: #d29922;   /* Warning/Pending */
--accent-blue: #58a6ff;     /* Info/Link */
--accent-purple: #a371f7;   /* Running/Progress */
```

### Typography Philosophy

モノスペースをアクセントに使用。可読性とコード感のバランス。

```css
/* Font Stack */
--font-sans: 'Inter', -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Scale */
--text-xs: 0.75rem;    /* 12px - ラベル、バッジ */
--text-sm: 0.875rem;   /* 14px - 本文、テーブル */
--text-base: 1rem;     /* 16px - 見出し */
--text-lg: 1.25rem;    /* 20px - ページタイトル */
--text-xl: 1.5rem;     /* 24px - セクションタイトル */
```

### Spacing System

8pxベースのグリッドシステム。

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
--space-16: 64px;
```

## Layout Structure

### Page Anatomy

```
┌─────────────────────────────────────────────────────────┐
│ Header (56px) - ロゴ / 検索 / ユーザー                    │
├────────────┬────────────────────────────────────────────┤
│            │ Page Header                                │
│  Sidebar   │ ─────────────────────────────────────────  │
│  (240px)   │ Content Area                              │
│            │                                            │
│  - Nav     │  ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  - Tree    │  │  Card   │ │  Card   │ │  Card   │     │
│            │  └─────────┘ └─────────┘ └─────────┘     │
│            │                                            │
└────────────┴────────────────────────────────────────────┘
```

### Responsive Breakpoints

```css
--breakpoint-sm: 640px;   /* モバイル */
--breakpoint-md: 768px;   /* タブレット */
--breakpoint-lg: 1024px;  /* デスクトップ */
--breakpoint-xl: 1280px;  /* ワイドスクリーン */
```

## Component Patterns

### Test Status Badge

テスト結果を一目で識別できるバッジ。

```jsx
// ステータスに応じた色とアイコン
<Badge status="passed">  // 緑 + チェックアイコン
<Badge status="failed">  // 赤 + ×アイコン
<Badge status="running"> // 紫 + スピナー
<Badge status="pending"> // 黄 + 時計アイコン
<Badge status="skipped"> // グレー + スキップアイコン
```

### Data Table

情報密度の高いテーブル。Linear風のミニマルデザイン。

```
┌──────────────────────────────────────────────────────────┐
│ ☐ Test Name              Status   Duration   Updated    │
├──────────────────────────────────────────────────────────┤
│ ☐ auth/login.spec.ts     ● Pass   1.2s       2m ago     │
│ ☐ auth/logout.spec.ts    ● Pass   0.8s       2m ago     │
│ ☑ api/users.spec.ts      ● Fail   3.4s       5m ago     │
└──────────────────────────────────────────────────────────┘
```

### Command Palette (⌘K)

キーボードファーストの検索/コマンド実行。

```
┌─────────────────────────────────────────┐
│ 🔍 Search tests, commands...            │
├─────────────────────────────────────────┤
│ Recent                                  │
│   ↩ auth/login.spec.ts                 │
│   ↩ api/users.spec.ts                  │
├─────────────────────────────────────────┤
│ Commands                                │
│   ▶ Run All Tests                      │
│   ⟳ Retry Failed                       │
│   ⚙ Settings                           │
└─────────────────────────────────────────┘
```

## Interaction Guidelines

### Hover States

```css
/* カード/行のホバー */
background: var(--bg-tertiary);
transition: background 150ms ease;

/* リンク/ボタンのホバー */
opacity: 0.8;
transition: opacity 150ms ease;
```

### Loading States

```css
/* スケルトンローディング */
background: linear-gradient(
  90deg,
  var(--bg-secondary) 25%,
  var(--bg-tertiary) 50%,
  var(--bg-secondary) 75%
);
animation: shimmer 1.5s infinite;
```

### Keyboard Shortcuts

| ショートカット | アクション |
|--------------|-----------|
| `⌘ + K` | コマンドパレット |
| `⌘ + /` | キーボードショートカット一覧 |
| `⌘ + Enter` | テスト実行 |
| `J` / `K` | 上下移動 |
| `X` | 選択トグル |
| `Esc` | キャンセル/閉じる |

## Animation Principles

### Timing

```css
--duration-fast: 150ms;    /* ホバー、フォーカス */
--duration-normal: 200ms;  /* トランジション */
--duration-slow: 300ms;    /* モーダル、展開 */

--easing-default: cubic-bezier(0.4, 0, 0.2, 1);
--easing-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Motion Rules

1. **意味のあるアニメーションのみ** - 純粋な装飾は避ける
2. **控えめに** - 派手なアニメーションは疲労を招く
3. **高速で** - 200ms以下を基本とする
4. **prefers-reduced-motion対応** - アクセシビリティ考慮

## Implementation Notes

### CSS Variables Setup

```css
:root {
  color-scheme: dark;
  /* 全変数をここで定義 */
}

[data-theme="light"] {
  /* ライトモード用オーバーライド */
}
```

### Component Library Priority

1. **Radix UI** - アクセシブルなプリミティブ
2. **Tailwind CSS** - ユーティリティファースト
3. **Framer Motion** - アニメーション（必要時のみ）

### File Structure

```
src/
├── styles/
│   ├── globals.css      # CSS変数、リセット
│   └── tokens.ts        # デザイントークン
├── components/
│   ├── ui/              # 汎用コンポーネント
│   └── features/        # 機能固有コンポーネント
└── lib/
    └── utils.ts         # cn(), clsx等
```
