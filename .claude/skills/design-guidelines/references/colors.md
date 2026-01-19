# Color System

## Table of Contents

1. [Dark Theme (Default)](#dark-theme-default)
2. [Light Theme](#light-theme)
3. [Semantic Colors](#semantic-colors)
4. [Test Status Colors](#test-status-colors)
5. [Usage Guidelines](#usage-guidelines)

---

## Dark Theme (Default)

### Background Scale

```css
--bg-canvas: #010409;       /* 最背面 - ページ全体 */
--bg-primary: #0d1117;      /* メイン背景 */
--bg-secondary: #161b22;    /* カード、パネル、サイドバー */
--bg-tertiary: #21262d;     /* ホバー、選択状態 */
--bg-overlay: #30363db3;    /* オーバーレイ（70%透過） */
```

### Border Scale

```css
--border-default: #30363d;  /* 標準ボーダー */
--border-muted: #21262d;    /* 控えめボーダー */
--border-emphasis: #8b949e; /* 強調ボーダー */
```

### Text Scale

```css
--text-primary: #e6edf3;    /* 見出し、重要テキスト */
--text-secondary: #8b949e;  /* 本文、説明文 */
--text-muted: #6e7681;      /* 補助テキスト、プレースホルダー */
--text-disabled: #484f58;   /* 無効状態 */
--text-link: #58a6ff;       /* リンク */
--text-link-hover: #79c0ff; /* リンクホバー */
```

---

## Light Theme

### Background Scale

```css
--bg-canvas: #ffffff;
--bg-primary: #f6f8fa;
--bg-secondary: #ffffff;
--bg-tertiary: #f3f4f6;
--bg-overlay: #1f2328b3;
```

### Border Scale

```css
--border-default: #d0d7de;
--border-muted: #d8dee4;
--border-emphasis: #57606a;
```

### Text Scale

```css
--text-primary: #1f2328;
--text-secondary: #57606a;
--text-muted: #6e7781;
--text-disabled: #8c959f;
--text-link: #0969da;
--text-link-hover: #0550ae;
```

---

## Semantic Colors

### Success

```css
--success-subtle: #12261e;     /* 背景（ダーク） */
--success-default: #238636;    /* ボーダー、アイコン */
--success-emphasis: #3fb950;   /* テキスト、強調 */
```

### Error / Danger

```css
--error-subtle: #2d1619;
--error-default: #da3633;
--error-emphasis: #f85149;
```

### Warning

```css
--warning-subtle: #2e2111;
--warning-default: #9e6a03;
--warning-emphasis: #d29922;
```

### Info

```css
--info-subtle: #121d2f;
--info-default: #1f6feb;
--info-emphasis: #58a6ff;
```

---

## Test Status Colors

テスト管理ツール固有のステータス表現。

### Status Mapping

| Status | Color | Background | Icon |
|--------|-------|------------|------|
| Passed | `#3fb950` | `#12261e` | ✓ CheckCircle |
| Failed | `#f85149` | `#2d1619` | ✗ XCircle |
| Running | `#a371f7` | `#271d3d` | ◐ Spinner |
| Pending | `#d29922` | `#2e2111` | ◷ Clock |
| Skipped | `#d29922` | `#2e2111` | ⊘ Skip |
| Flaky | `#db6d28` | `#2c1d11` | ⚡ Zap |

### Implementation Example

```tsx
const statusConfig = {
  passed: {
    color: 'var(--success-emphasis)',
    bg: 'var(--success-subtle)',
    icon: CheckCircle,
  },
  failed: {
    color: 'var(--error-emphasis)',
    bg: 'var(--error-subtle)',
    icon: XCircle,
  },
  running: {
    color: '#a371f7',
    bg: '#271d3d',
    icon: Loader,
  },
  pending: {
    color: 'var(--warning-emphasis)',
    bg: 'var(--warning-subtle)',
    icon: Clock,
  },
  skipped: {
    color: 'var(--warning-emphasis)',
    bg: 'var(--warning-subtle)',
    icon: SkipForward,
  },
};
```

---

## Usage Guidelines

### Contrast Requirements

- テキスト/背景のコントラスト比: 最低 4.5:1（WCAG AA）
- 大きなテキスト: 最低 3:1
- UI要素: 最低 3:1

### Do's

- ステータスには必ず専用のセマンティックカラーを使用
- 重要度に応じてテキストカラーを使い分け
- ダークモードをデフォルトとし、ライトモードはオプション

### Don'ts

- 色だけで情報を伝えない（アイコン・テキストを併用）
- カスタムカラーを追加しない（パレットを守る）
- 透過度を多用しない（背景との組み合わせで問題が起きる）

### CSS Variables Template

```css
:root {
  color-scheme: dark;
  
  /* Backgrounds */
  --bg-canvas: #010409;
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  
  /* Borders */
  --border-default: #30363d;
  --border-muted: #21262d;
  
  /* Text */
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #6e7681;
  
  /* Semantic */
  --success: #3fb950;
  --error: #f85149;
  --warning: #d29922;
  --info: #58a6ff;
}

[data-theme="light"] {
  color-scheme: light;
  
  --bg-canvas: #ffffff;
  --bg-primary: #f6f8fa;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f3f4f6;
  
  --border-default: #d0d7de;
  --border-muted: #d8dee4;
  
  --text-primary: #1f2328;
  --text-secondary: #57606a;
  --text-muted: #6e7781;
}
```
