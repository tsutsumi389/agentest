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

ダークモードファースト。ターミナルの美学を継承。

| 種別 | 用途 | 詳細 |
|-----|------|------|
| Background | 背景色（Primary/Secondary/Tertiary） | [colors.md](references/colors.md) |
| Text | テキスト色（Primary/Secondary/Muted） | [colors.md](references/colors.md) |
| Semantic | テスト状態（Pass/Fail/Running等） | [colors.md](references/colors.md) |

**テスト状態の色**:
- ✅ Passed → `--success-*`（緑）
- ❌ Failed → `--error-*`（赤）
- 🔄 Running → `#a371f7`（紫）
- ⏳ Pending → `--warning-*`（黄）
- ⏭️ Skipped → `--text-muted`（グレー）

### Typography Philosophy

モノスペースをアクセントに使用。可読性とコード感のバランス。詳細は [typography.md](references/typography.md) を参照。

| フォント | 用途 |
|---------|------|
| `--font-sans` (Inter) | UI全般 |
| `--font-mono` (JetBrains Mono) | コード、テスト名、パス |

| サイズ | 用途 |
|--------|------|
| `--text-xs` (12px) | ラベル、バッジ |
| `--text-sm` (14px) | 本文、テーブル |
| `--text-base` (16px) | 見出し |
| `--text-lg/xl` (20-24px) | ページ/セクションタイトル |

### Spacing System

8pxベースのグリッドシステム。詳細は [layout.md](references/layout.md) を参照。

| 変数 | 値 | 用途 |
|------|-----|------|
| `--space-2` | 8px | 要素間の最小間隔 |
| `--space-4` | 16px | 標準パディング |
| `--space-6` | 24px | セクション間隔 |
| `--space-8` | 32px | 大きなセクション間隔 |

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

## Design Workflows

### 新規コンポーネント作成

チェックリストをコピーして進行状況を追跡：

```
コンポーネント作成：
- [ ] 1. 既存コンポーネントの確認
- [ ] 2. デザイントークンの選定
- [ ] 3. 基本構造の実装
- [ ] 4. インタラクション状態の実装
- [ ] 5. アクセシビリティ検証
- [ ] 6. レスポンシブ対応確認
```

**Step 1: 既存コンポーネントの確認**
- [components.md](references/components.md) で類似コンポーネントを確認
- 存在する場合は拡張を検討

**Step 2: デザイントークンの選定**
- [colors.md](references/colors.md) から色を選択
- [typography.md](references/typography.md) からフォントサイズを選択
- カスタム値は使用しない

**Step 3: 基本構造の実装**
- CSS変数を使用（`--radius-md`, `--space-*` 等）
- Tailwind ユーティリティクラスを活用

**Step 4: インタラクション状態**
- [interaction.md](references/interaction.md) を参照
- Hover / Focus / Active / Disabled を実装

**Step 5: アクセシビリティ検証**
- [accessibility.md](references/accessibility.md) を参照
- キーボード操作、aria属性、コントラスト比を確認

**Step 6: レスポンシブ対応**
- [layout.md](references/layout.md) のブレークポイントを参照
- モバイル → デスクトップの順で確認

### UI修正ワークフロー

1. **現状確認** → 該当コンポーネントのコードを確認
2. **ガイドライン照合** → 関連する参照ファイルを確認
3. **修正実施** → デザイントークンを使用して修正
4. **検証** → ホバー、フォーカス、レスポンシブを確認

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
