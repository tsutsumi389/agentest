# Accessibility

## Core Principles

WCAG 2.1 Level AA準拠。コントラスト比4.5:1以上、キーボード操作可能、スクリーンリーダー対応。

## Color & Contrast

| Element | Requirement | Status |
|---------|-------------|--------|
| Body text | 4.5:1 | ✓ 12.4:1 |
| Primary text | 4.5:1 | ✓ 15.1:1 |
| UI components | 3:1 | ✓ Pass |

**重要**: 色のみで情報を伝えない。アイコン・テキストを併用する。

## Keyboard Navigation

### 必須要件

- 全ての対話要素にフォーカス可能
- フォーカスインジケーター常時表示
- 論理的なタブ順序
- Escでモーダル/オーバーレイを閉じる

### Skip Link

```html
<a href="#main" class="skip-link">Skip to content</a>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  z-index: 100;
}
.skip-link:focus { top: 0; }
```

## Screen Readers

### Semantic HTML

```html
<nav aria-label="Main">...</nav>
<main id="main">...</main>
<section aria-labelledby="title"><h2 id="title">...</h2></section>
```

### ARIA Labels

```tsx
// Icon-only button
<button aria-label="Close"><XIcon /></button>

// Status indicator
<span role="status" aria-label="Test passed" />

// Loading state
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading ? 'Loading...' : content}
</div>
```

### Live Regions

```tsx
// Toast notifications
<div role="alert" aria-live="assertive">{error}</div>

// Status updates
<div aria-live="polite">{status}</div>
```

## Focus Management

### Focus Ring

```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--info);
}

:focus:not(:focus-visible) {
  outline: none;
}
```

### Modal Focus Trap

```tsx
// モーダル表示時
1. 最初のフォーカス可能要素にフォーカス
2. Tab/Shift+Tabをモーダル内に制限
3. 閉じた後、トリガー要素にフォーカスを戻す
```

## Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Checklist

- [ ] コントラスト比テスト済み
- [ ] キーボードのみで全操作可能
- [ ] スクリーンリーダーテスト済み
- [ ] フォーカスインジケーター表示
- [ ] 色以外で情報を伝達
- [ ] 適切なARIA属性
- [ ] reduced-motion対応
- [ ] Skip link設置
