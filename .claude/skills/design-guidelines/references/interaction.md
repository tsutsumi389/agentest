# Interaction

## Table of Contents

1. [Animation Principles](#animation-principles)
2. [Transitions](#transitions)
3. [Micro-interactions](#micro-interactions)
4. [Keyboard Navigation](#keyboard-navigation)
5. [Drag and Drop](#drag-and-drop)
6. [Loading States](#loading-states)
7. [Error States](#error-states)

---

## Animation Principles

### Core Philosophy

1. **機能的** - アニメーションは情報を伝える手段
2. **高速** - ユーザーを待たせない
3. **控えめ** - 注意を奪わない
4. **一貫性** - 同じアクションには同じアニメーション

### Timing

```css
--duration-instant: 0ms;       /* 即座に変化 */
--duration-fast: 100ms;        /* ホバー、フォーカス */
--duration-normal: 150ms;      /* 標準トランジション */
--duration-moderate: 200ms;    /* パネル展開 */
--duration-slow: 300ms;        /* モーダル表示 */
--duration-slower: 400ms;      /* ページ遷移 */
```

### Easing

```css
/* Standard - ほとんどのUI遷移 */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);

/* Entrance - 要素の出現 */
--ease-out: cubic-bezier(0, 0, 0.2, 1);

/* Exit - 要素の消失 */
--ease-in: cubic-bezier(0.4, 0, 1, 1);

/* Emphasis - バウンス効果 */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Linear - プログレスバー */
--ease-linear: linear;
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Transitions

### Hover States

```css
/* Button */
.btn {
  transition: 
    background-color var(--duration-fast) var(--ease-default),
    border-color var(--duration-fast) var(--ease-default),
    box-shadow var(--duration-fast) var(--ease-default);
}

/* Link */
.link {
  transition: color var(--duration-fast) var(--ease-default);
}

/* Card */
.card {
  transition: 
    background-color var(--duration-normal) var(--ease-default),
    border-color var(--duration-normal) var(--ease-default),
    transform var(--duration-normal) var(--ease-default);
}

.card:hover {
  transform: translateY(-2px);
}
```

### Focus States

```css
/* Focus Ring */
.focusable:focus-visible {
  outline: none;
  box-shadow: 
    0 0 0 2px var(--bg-primary),
    0 0 0 4px var(--info);
  transition: box-shadow var(--duration-fast) var(--ease-default);
}
```

### Expand/Collapse

```css
.collapsible-content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-moderate) var(--ease-default);
}

.collapsible-content[data-open="true"] {
  grid-template-rows: 1fr;
}

.collapsible-inner {
  overflow: hidden;
}
```

### Modal / Overlay

```css
/* Overlay fade */
.modal-overlay {
  opacity: 0;
  transition: opacity var(--duration-slow) var(--ease-default);
}

.modal-overlay[data-open="true"] {
  opacity: 1;
}

/* Modal scale */
.modal {
  opacity: 0;
  transform: scale(0.95);
  transition: 
    opacity var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-out);
}

.modal[data-open="true"] {
  opacity: 1;
  transform: scale(1);
}
```

---

## Micro-interactions

### Button Click

```css
.btn:active {
  transform: scale(0.98);
}
```

### Checkbox Toggle

```css
.checkbox-indicator {
  transform: scale(0);
  transition: transform var(--duration-fast) var(--ease-bounce);
}

.checkbox:checked .checkbox-indicator {
  transform: scale(1);
}
```

### Switch Toggle

```css
.switch-thumb {
  transform: translateX(0);
  transition: transform var(--duration-normal) var(--ease-default);
}

.switch[data-checked="true"] .switch-thumb {
  transform: translateX(20px);
}
```

### Status Dot Pulse

```css
@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

.status-running {
  animation: pulse 1.5s var(--ease-default) infinite;
}
```

### Success Checkmark

```css
@keyframes checkmark-draw {
  0% {
    stroke-dashoffset: 24;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

.checkmark-path {
  stroke-dasharray: 24;
  stroke-dashoffset: 24;
  animation: checkmark-draw var(--duration-slow) var(--ease-out) forwards;
}
```

### Toast Entrance

```css
@keyframes toast-enter {
  0% {
    opacity: 0;
    transform: translateY(16px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.toast {
  animation: toast-enter var(--duration-slow) var(--ease-out);
}
```

---

## Keyboard Navigation

### Global Shortcuts

| Shortcut | Action | Scope |
|----------|--------|-------|
| `⌘ + K` | コマンドパレット | Global |
| `⌘ + /` | ショートカット一覧 | Global |
| `⌘ + B` | サイドバートグル | Global |
| `⌘ + Enter` | テスト実行 | Test page |
| `⌘ + S` | 保存 | Edit mode |
| `Esc` | 閉じる/キャンセル | Modal, Panel |

### List Navigation

| Shortcut | Action |
|----------|--------|
| `J` / `↓` | 次のアイテム |
| `K` / `↑` | 前のアイテム |
| `Enter` / `O` | 選択/開く |
| `X` | 選択トグル |
| `⌘ + A` | 全選択 |
| `Esc` | 選択解除 |

### Implementation

```tsx
// useKeyboardNavigation hook
const useKeyboardNavigation = (items: Item[], onSelect: (item: Item) => void) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(i => Math.min(i + 1, items.length - 1));
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          onSelect(items[activeIndex]);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, activeIndex, onSelect]);

  return { activeIndex, setActiveIndex };
};
```

### Focus Management

```css
/* Focus visible only on keyboard navigation */
:focus:not(:focus-visible) {
  outline: none;
  box-shadow: none;
}

:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

---

## Drag and Drop

### Visual Feedback

```css
/* Dragging item */
.dragging {
  opacity: 0.8;
  transform: rotate(2deg);
  box-shadow: var(--shadow-lg);
  cursor: grabbing;
}

/* Drop target */
.drop-target {
  border: 2px dashed var(--info);
  background: rgba(88, 166, 255, 0.05);
}

/* Drop indicator line */
.drop-indicator {
  height: 2px;
  background: var(--info);
  border-radius: 1px;
}
```

### Reorder Animation

```css
.sortable-item {
  transition: transform var(--duration-normal) var(--ease-default);
}

.sortable-item[data-moving] {
  transition: none;
}
```

---

## Loading States

### Skeleton

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-secondary) 25%,
    var(--bg-tertiary) 50%,
    var(--bg-secondary) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s var(--ease-linear) infinite;
  border-radius: var(--radius-md);
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Skeleton variants */
.skeleton-text {
  height: 14px;
  width: 80%;
}

.skeleton-title {
  height: 20px;
  width: 60%;
}

.skeleton-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.skeleton-button {
  width: 80px;
  height: 32px;
}
```

### Spinner

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-default);
  border-top-color: var(--info);
  border-radius: 50%;
  animation: spin 0.8s var(--ease-linear) infinite;
}

.spinner-sm { width: 12px; height: 12px; }
.spinner-lg { width: 24px; height: 24px; }
```

### Progress

```css
.progress-bar {
  transition: width var(--duration-moderate) var(--ease-default);
}

/* Indeterminate */
@keyframes progress-indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

.progress-indeterminate .progress-bar {
  width: 25%;
  animation: progress-indeterminate 1.5s var(--ease-default) infinite;
}
```

### Button Loading

```tsx
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Spinner className="mr-2" />
      Running...
    </>
  ) : (
    'Run Tests'
  )}
</Button>
```

---

## Error States

### Form Validation

```css
.input-error {
  border-color: var(--error-emphasis);
}

.input-error:focus {
  box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.15);
}

.error-message {
  color: var(--error-emphasis);
  font-size: var(--text-xs);
  margin-top: var(--space-1);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* Shake animation on error */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.input-error-shake {
  animation: shake 0.3s var(--ease-default);
}
```

### Empty State

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  text-align: center;
}
```

### Error Banner

```css
.error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--error-subtle);
  border: 1px solid var(--error-default);
  border-radius: var(--radius-lg);
  color: var(--error-emphasis);
}
```

### Retry Action

```tsx
<ErrorState
  title="Failed to load tests"
  description="Something went wrong while fetching your tests."
  action={
    <Button onClick={retry}>
      <RefreshIcon className="mr-2" />
      Try Again
    </Button>
  }
/>
```
