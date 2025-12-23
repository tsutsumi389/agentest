# Layout

## Table of Contents

1. [Grid System](#grid-system)
2. [Page Templates](#page-templates)
3. [Header](#header)
4. [Sidebar](#sidebar)
5. [Content Area](#content-area)
6. [Responsive Design](#responsive-design)

---

## Grid System

8pxベースのスペーシングシステム。

### Spacing Scale

```css
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
```

### Container Widths

```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1536px;
```

---

## Page Templates

### Standard Layout (Sidebar + Content)

```
┌──────────────────────────────────────────────────────────────┐
│ Header (56px, fixed)                                         │
├────────────────┬─────────────────────────────────────────────┤
│                │                                             │
│   Sidebar      │   Content Area                              │
│   (240px)      │   (flex: 1)                                 │
│   fixed        │   scrollable                                │
│                │                                             │
│                │                                             │
└────────────────┴─────────────────────────────────────────────┘
```

```css
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.layout-header {
  height: 56px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.layout-body {
  display: flex;
  flex: 1;
  margin-top: 56px;
}

.layout-sidebar {
  width: 240px;
  position: fixed;
  top: 56px;
  bottom: 0;
  left: 0;
  overflow-y: auto;
}

.layout-content {
  flex: 1;
  margin-left: 240px;
  padding: var(--space-6);
  overflow-y: auto;
}
```

### Full Width Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Header (56px)                                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                     Content Area                             │
│                     (max-width: 1280px, centered)            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Split View Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Header (56px)                                                │
├────────────────┬─────────────────────────────────────────────┤
│                │                                             │
│   List Panel   │   Detail Panel                              │
│   (360px)      │   (flex: 1)                                 │
│   resizable    │                                             │
│                │                                             │
└────────────────┴─────────────────────────────────────────────┘
```

---

## Header

### Structure

```
┌──────────────────────────────────────────────────────────────┐
│ [Logo]  [Nav Items]     [Search ⌘K]     [?] [🔔] [Avatar ▼] │
└──────────────────────────────────────────────────────────────┘
```

### Specifications

| Element | Width | Height |
|---------|-------|--------|
| Header | 100% | 56px |
| Logo | auto | 24px |
| Search | 400px max | 36px |
| Avatar | 28px | 28px |

### CSS

```css
.header {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-default);
}

.header-logo {
  height: 24px;
  margin-right: var(--space-6);
}

.header-nav {
  display: flex;
  gap: var(--space-1);
}

.header-search {
  flex: 1;
  max-width: 400px;
  margin: 0 var(--space-4);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}
```

---

## Sidebar

### Structure

```
┌────────────────┐
│ Project Select │
├────────────────┤
│ 📊 Dashboard   │
│ 🧪 Tests       │
│ 📁 Test Suites │
│ 🏃 Runs        │
│ ⚙️ Settings    │
├────────────────┤
│ Test Tree      │
│ ├─ auth/       │
│ │  ├─ login    │
│ │  └─ logout   │
│ └─ api/        │
├────────────────┤
│ [Collapse ◀]   │
└────────────────┘
```

### Specifications

| State | Width |
|-------|-------|
| Expanded | 240px |
| Collapsed | 56px (icons only) |

### CSS

```css
.sidebar {
  width: 240px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  transition: width 200ms ease;
}

.sidebar-collapsed {
  width: 56px;
}

.sidebar-section {
  padding: var(--space-3);
}

.sidebar-section-title {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--space-2) var(--space-3);
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 32px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
}

.sidebar-nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.sidebar-nav-item-active {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

### Tree View

```css
.tree-item {
  display: flex;
  align-items: center;
  height: 28px;
  padding-left: calc(var(--depth) * 12px + 8px);
  cursor: pointer;
}

.tree-item:hover {
  background: var(--bg-tertiary);
}

.tree-item-icon {
  width: 16px;
  height: 16px;
  margin-right: var(--space-2);
  color: var(--text-muted);
}

.tree-item-expand {
  width: 16px;
  height: 16px;
  margin-right: var(--space-1);
}
```

---

## Content Area

### Page Header

```
┌──────────────────────────────────────────────────────────────┐
│ Breadcrumb: Tests > auth > login.spec.ts                     │
│                                                              │
│ Page Title                                    [Action Button]│
│ Description or metadata                                      │
├──────────────────────────────────────────────────────────────┤
│ [Tab 1] [Tab 2] [Tab 3]                                      │
└──────────────────────────────────────────────────────────────┘
```

```css
.page-header {
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-default);
}

.page-breadcrumb {
  margin-bottom: var(--space-4);
}

.page-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.page-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.page-tabs {
  display: flex;
  gap: var(--space-1);
  margin-top: var(--space-4);
  border-bottom: 1px solid var(--border-default);
}
```

### Content Body

```css
.content-body {
  padding: var(--space-6);
}

.content-section {
  margin-bottom: var(--space-8);
}

.content-section-title {
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}
```

### Grid Layouts

```css
/* 2カラム */
.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

/* 3カラム */
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile First */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

### Responsive Sidebar

```css
/* Mobile: Hidden, show as overlay */
@media (max-width: 1023px) {
  .sidebar {
    position: fixed;
    z-index: 50;
    transform: translateX(-100%);
  }
  
  .sidebar-open {
    transform: translateX(0);
  }
  
  .layout-content {
    margin-left: 0;
  }
}

/* Desktop: Always visible */
@media (min-width: 1024px) {
  .sidebar {
    position: fixed;
    transform: none;
  }
}
```

### Responsive Table

```css
/* Mobile: Card view */
@media (max-width: 767px) {
  .table-responsive thead {
    display: none;
  }
  
  .table-responsive tr {
    display: block;
    padding: var(--space-3);
    border-bottom: 1px solid var(--border-default);
  }
  
  .table-responsive td {
    display: flex;
    justify-content: space-between;
    padding: var(--space-1) 0;
  }
  
  .table-responsive td::before {
    content: attr(data-label);
    font-weight: var(--font-medium);
    color: var(--text-muted);
  }
}
```

### Z-Index Scale

```css
--z-base: 0;
--z-dropdown: 10;
--z-sticky: 20;
--z-sidebar: 30;
--z-header: 40;
--z-overlay: 50;
--z-modal: 60;
--z-toast: 70;
--z-tooltip: 80;
```
