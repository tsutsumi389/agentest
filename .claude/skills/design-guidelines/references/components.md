# Components

## Table of Contents

1. [Design Tokens](#design-tokens)
2. [Buttons](#buttons)
3. [Inputs](#inputs)
4. [Badges & Status](#badges--status)
5. [Cards](#cards)
6. [Tables](#tables)
7. [Navigation](#navigation)
8. [Modals & Overlays](#modals--overlays)
9. [Feedback](#feedback)

---

## Design Tokens

全コンポーネント共通の値。

```css
/* Border Radius */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;
--radius-full: 9999px;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.5);
--shadow-overlay: 0 16px 32px rgba(0, 0, 0, 0.6);

/* Focus Ring */
--focus-ring: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--info);
```

---

## Buttons

### Variants

| Variant | Use Case |
|---------|----------|
| Primary | 主要アクション（テスト実行など） |
| Secondary | 副次アクション |
| Ghost | テキストリンク風、ツールバー |
| Danger | 削除、破壊的操作 |

### Sizes

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| sm | 28px | 8px 12px | 13px |
| md | 32px | 8px 16px | 14px |
| lg | 40px | 12px 20px | 14px |

### Primary Button

```css
.btn-primary {
  height: 32px;
  padding: 0 16px;
  background: var(--success-default);
  color: #ffffff;
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 150ms ease;
}

.btn-primary:hover {
  background: var(--success-emphasis);
}

.btn-primary:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Secondary Button

```css
.btn-secondary {
  height: 32px;
  padding: 0 16px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}

.btn-secondary:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-emphasis);
}
```

### Ghost Button

```css
.btn-ghost {
  height: 32px;
  padding: 0 12px;
  background: transparent;
  color: var(--text-secondary);
  border: none;
}

.btn-ghost:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

### Icon Button

```css
.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-muted);
}

.btn-icon:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

---

## Inputs

### Text Input

```css
.input {
  height: 32px;
  padding: 0 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
}

.input:hover {
  border-color: var(--border-emphasis);
}

.input:focus {
  outline: none;
  border-color: var(--info);
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
}

.input::placeholder {
  color: var(--text-muted);
}
```

### Search Input

```css
.search-input {
  height: 36px;
  padding: 0 12px 0 36px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 400px;
}

.search-input-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
}
```

### Select

```css
.select {
  height: 32px;
  padding: 0 32px 0 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  appearance: none;
  cursor: pointer;
}
```

### Checkbox

```css
.checkbox {
  width: 16px;
  height: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  cursor: pointer;
}

.checkbox:checked {
  background: var(--info);
  border-color: var(--info);
}
```

---

## Badges & Status

### Status Badge

テスト結果表示用。

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 8px;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-full);
}

.badge-passed {
  background: var(--success-subtle);
  color: var(--success-emphasis);
}

.badge-failed {
  background: var(--error-subtle);
  color: var(--error-emphasis);
}

.badge-running {
  background: #271d3d;
  color: #a371f7;
}

.badge-pending {
  background: var(--warning-subtle);
  color: var(--warning-emphasis);
}

.badge-skipped {
  background: var(--bg-tertiary);
  color: var(--text-muted);
}
```

### Dot Indicator

テーブル内のインライン状態表示。

```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot-passed { background: var(--success-emphasis); }
.status-dot-failed { background: var(--error-emphasis); }
.status-dot-running { 
  background: #a371f7;
  animation: pulse 1.5s infinite;
}
```

### Count Badge

```css
.count-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-full);
  font-variant-numeric: tabular-nums;
}
```

---

## Cards

### Basic Card

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}
```

### Interactive Card

```css
.card-interactive {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  cursor: pointer;
  transition: all 150ms ease;
}

.card-interactive:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-emphasis);
}
```

### Test Run Card

```
┌─────────────────────────────────────────────────┐
│ Run #1234                           ● Passed    │
│ main branch • a1b2c3d               2 min ago   │
├─────────────────────────────────────────────────┤
│ ████████████████████░░░░░  85% (170/200)        │
│                                                 │
│ ✓ 170 passed  ✗ 20 failed  ○ 10 skipped        │
└─────────────────────────────────────────────────┘
```

---

## Tables

### Basic Table

```css
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.table th {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-secondary);
}

.table td {
  padding: var(--space-3) var(--space-4);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-muted);
}

.table tr:hover td {
  background: var(--bg-tertiary);
}
```

### Selectable Table Row

```css
.table-row-selectable {
  cursor: pointer;
}

.table-row-selected td {
  background: rgba(88, 166, 255, 0.1);
}
```

---

## Navigation

### Sidebar Item

```css
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 32px;
  padding: 0 var(--space-3);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-item-active {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

### Tab

```css
.tab {
  padding: var(--space-2) var(--space-4);
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.tab:hover {
  color: var(--text-primary);
}

.tab-active {
  color: var(--text-primary);
  border-bottom-color: var(--info);
}
```

### Breadcrumb

```css
.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.breadcrumb-link {
  color: var(--text-secondary);
}

.breadcrumb-link:hover {
  color: var(--text-primary);
}

.breadcrumb-separator {
  color: var(--text-muted);
}
```

---

## Modals & Overlays

### Modal

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(1, 4, 9, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  width: 100%;
  max-width: 500px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-overlay);
}

.modal-header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.modal-body {
  padding: var(--space-4);
}

.modal-footer {
  padding: var(--space-4);
  border-top: 1px solid var(--border-default);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
```

### Command Palette

```css
.command-palette {
  width: 100%;
  max-width: 600px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-overlay);
  overflow: hidden;
}

.command-input {
  width: 100%;
  height: 48px;
  padding: 0 var(--space-4);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border-default);
  font-size: var(--text-md);
}

.command-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
}

.command-item:hover,
.command-item-selected {
  background: var(--bg-tertiary);
}

.command-shortcut {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--bg-primary);
  padding: 2px 6px;
  border-radius: 4px;
}
```

### Dropdown Menu

```css
.dropdown {
  min-width: 160px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-1) 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  color: var(--text-secondary);
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.dropdown-separator {
  height: 1px;
  background: var(--border-default);
  margin: var(--space-1) 0;
}
```

---

## Feedback

### Toast / Notification

```css
.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.toast-success {
  border-left: 3px solid var(--success-emphasis);
}

.toast-error {
  border-left: 3px solid var(--error-emphasis);
}
```

### Progress Bar

```css
.progress {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--success-emphasis);
  transition: width 300ms ease;
}

/* 複数状態のプログレス */
.progress-bar-passed { background: var(--success-emphasis); }
.progress-bar-failed { background: var(--error-emphasis); }
.progress-bar-skipped { background: var(--text-muted); }
```

### Skeleton Loading

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-secondary) 25%,
    var(--bg-tertiary) 50%,
    var(--bg-secondary) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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

.empty-state-icon {
  color: var(--text-muted);
  margin-bottom: var(--space-4);
}

.empty-state-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.empty-state-description {
  color: var(--text-secondary);
  margin-bottom: var(--space-6);
}
```
