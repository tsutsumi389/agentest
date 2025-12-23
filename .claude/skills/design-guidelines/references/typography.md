# Typography

## Table of Contents

1. [Font Families](#font-families)
2. [Type Scale](#type-scale)
3. [Font Weights](#font-weights)
4. [Line Heights](#line-heights)
5. [Usage Patterns](#usage-patterns)

---

## Font Families

### Primary: Inter

UI全般に使用。可読性が高く、数字の視認性も優秀。

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
```

### Monospace: JetBrains Mono

コード、ファイルパス、技術的な情報に使用。リガチャ対応。

```css
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, Consolas, monospace;
```

### Font Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## Type Scale

8pxベースのモジュラースケール。

| Name | Size | Rem | Use Case |
|------|------|-----|----------|
| `text-xs` | 11px | 0.6875rem | バッジ、キャプション |
| `text-sm` | 13px | 0.8125rem | テーブル、補助テキスト |
| `text-base` | 14px | 0.875rem | 本文（デフォルト） |
| `text-md` | 16px | 1rem | 小見出し |
| `text-lg` | 18px | 1.125rem | セクションタイトル |
| `text-xl` | 20px | 1.25rem | ページタイトル |
| `text-2xl` | 24px | 1.5rem | ダッシュボード数値 |
| `text-3xl` | 32px | 2rem | ヒーロー、特大数値 |

### CSS Variables

```css
--text-xs: 0.6875rem;
--text-sm: 0.8125rem;
--text-base: 0.875rem;
--text-md: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 2rem;
```

---

## Font Weights

| Weight | Value | Use Case |
|--------|-------|----------|
| Regular | 400 | 本文、説明文 |
| Medium | 500 | ラベル、ナビゲーション |
| Semibold | 600 | 見出し、強調 |

### CSS Variables

```css
--font-regular: 400;
--font-medium: 500;
--font-semibold: 600;
```

---

## Line Heights

| Name | Value | Use Case |
|------|-------|----------|
| `leading-none` | 1 | バッジ、アイコンラベル |
| `leading-tight` | 1.25 | 見出し |
| `leading-snug` | 1.375 | 短い本文 |
| `leading-normal` | 1.5 | 本文（デフォルト） |
| `leading-relaxed` | 1.625 | 長文 |

### CSS Variables

```css
--leading-none: 1;
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
```

---

## Usage Patterns

### Page Title

```css
.page-title {
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-tight);
  color: var(--text-primary);
  letter-spacing: -0.02em;
}
```

### Section Header

```css
.section-header {
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  line-height: var(--leading-tight);
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

### Body Text

```css
.body-text {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--font-regular);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}
```

### Code / File Path

```css
.code-text {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--font-regular);
  line-height: var(--leading-normal);
  color: var(--text-primary);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
}
```

### Test File Name

```css
.test-filename {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.test-filename .directory {
  color: var(--text-muted);
}
```

Example: `auth/`**`login.spec.ts`**

### Metric / Number

```css
.metric-value {
  font-family: var(--font-mono);
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-none);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
```

### Table Cell

```css
.table-cell {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-regular);
  line-height: var(--leading-snug);
  color: var(--text-secondary);
}

.table-cell-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

### Badge / Label

```css
.badge {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: var(--leading-none);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

---

## Typography Do's and Don'ts

### Do's

- 見出しには `-0.02em` のレターースペーシングで引き締める
- 数値には `font-variant-numeric: tabular-nums` で等幅表示
- ファイルパス、コードには必ずモノスペースフォント
- 階層に応じてテキストカラーを使い分け

### Don'ts

- Bold (700) は使用しない（Semibold 600 まで）
- 本文に `text-xs` は使用しない（視認性低下）
- ALL CAPS は見出し・バッジのみ（本文では使用禁止）
- イタリックは原則使用しない

---

## Tailwind Config

```js
// tailwind.config.js
module.exports = {
  theme: {
    fontFamily: {
      sans: ['Inter', '-apple-system', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
    fontSize: {
      xs: ['0.6875rem', { lineHeight: '1' }],
      sm: ['0.8125rem', { lineHeight: '1.375' }],
      base: ['0.875rem', { lineHeight: '1.5' }],
      md: ['1rem', { lineHeight: '1.5' }],
      lg: ['1.125rem', { lineHeight: '1.25' }],
      xl: ['1.25rem', { lineHeight: '1.25' }],
      '2xl': ['1.5rem', { lineHeight: '1' }],
      '3xl': ['2rem', { lineHeight: '1' }],
    },
    fontWeight: {
      regular: '400',
      medium: '500',
      semibold: '600',
    },
  },
};
```
