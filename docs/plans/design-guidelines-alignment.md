## 実装計画: デザインガイドライン適合性改善

### 概要

`.claude/skills/design-guidelines/` に定義されたデザインガイドラインと現在のフロントエンド実装の差分を解消する。Terminal/CLI風のミニマルで機能的なUIを実現し、アクセシビリティ要件を満たす。

---

### フェーズ概要

| フェーズ | 内容 | 優先度 |
|----------|------|--------|
| **Phase 1** | カラーシステム修正 | 高 |
| **Phase 2** | レイアウトサイズ調整 | 中 |
| **Phase 3** | アクセシビリティ対応 | 高 |
| **Phase 4** | コンポーネント拡張 | 中 |
| **Phase 5** | インタラクション強化 | 低 |

---

## Phase 1: カラーシステム修正

### 1.1 Tailwind設定の修正

**対象ファイル:** `apps/web/tailwind.config.ts`

| 変数 | 現状 | ガイドライン | 対応 |
|------|------|-------------|------|
| `foreground.DEFAULT` | `#c9d1d9` | `#e6edf3` | 変更 |
| `accent-muted` | `#388bfd` | `#121d2f` (subtle bg) | 役割を分離 |
| `running` | 未定義 | `#a371f7` | 追加 |

**変更内容:**

```typescript
// apps/web/tailwind.config.ts
colors: {
  background: {
    DEFAULT: '#0d1117',
    secondary: '#161b22',
    tertiary: '#21262d',
    canvas: '#010409',        // 追加: 最背面用
  },
  foreground: {
    DEFAULT: '#e6edf3',       // 変更: コントラスト向上
    muted: '#8b949e',
    subtle: '#6e7681',
    disabled: '#484f58',      // 追加: 無効状態
  },
  border: {
    DEFAULT: '#30363d',
    muted: '#21262d',
    emphasis: '#8b949e',      // 追加: 強調ボーダー
  },
  accent: {
    DEFAULT: '#58a6ff',
    hover: '#79c0ff',
    subtle: '#121d2f',        // 追加: 背景用
  },
  success: {
    DEFAULT: '#3fb950',
    muted: '#238636',
    subtle: '#12261e',        // 追加: 背景用
  },
  warning: {
    DEFAULT: '#d29922',
    muted: '#9e6a03',
    subtle: '#2e2111',        // 追加: 背景用
  },
  danger: {
    DEFAULT: '#f85149',
    muted: '#da3633',
    subtle: '#2d1619',        // 追加: 背景用
  },
  running: {                  // 追加: テスト実行中状態
    DEFAULT: '#a371f7',
    subtle: '#271d3d',
  },
}
```

### 1.2 CSS変数の追加

**対象ファイル:** `apps/web/src/styles/globals.css`

ガイドラインで推奨されているCSS変数を追加し、将来のテーマ切替に対応。

```css
@layer base {
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
    --border-emphasis: #8b949e;

    /* Text */
    --text-primary: #e6edf3;
    --text-secondary: #8b949e;
    --text-muted: #6e7681;
    --text-disabled: #484f58;

    /* Semantic */
    --success: #3fb950;
    --error: #f85149;
    --warning: #d29922;
    --info: #58a6ff;
    --running: #a371f7;

    /* Spacing */
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-6: 24px;
    --space-8: 32px;

    /* Border Radius */
    --radius-sm: 4px;
    --radius-md: 6px;
    --radius-lg: 8px;
    --radius-full: 9999px;
  }

  [data-theme="light"] {
    color-scheme: light;
    --bg-canvas: #ffffff;
    --bg-primary: #f6f8fa;
    --bg-secondary: #ffffff;
    --bg-tertiary: #f3f4f6;
    --border-default: #d0d7de;
    --text-primary: #1f2328;
    --text-secondary: #57606a;
  }
}
```

---

## Phase 2: レイアウトサイズ調整

### 2.1 ヘッダー高さ修正

**対象ファイル:** `apps/web/src/components/Layout.tsx`

| 要素 | 現状 | ガイドライン |
|------|------|-------------|
| ヘッダー高さ | `h-16` (64px) | 56px |
| サイドバー幅 | `w-64` (256px) | 240px |

**変更内容:**

```tsx
// Layout.tsx:57 ヘッダー高さ
- <div className="flex items-center justify-between h-16 px-4 border-b border-border">
+ <div className="flex items-center justify-between h-14 px-4 border-b border-border">

// Layout.tsx:49 サイドバー幅
- <aside className="fixed top-0 left-0 z-50 h-full w-64 bg-background-secondary ...">
+ <aside className="fixed top-0 left-0 z-50 h-full w-60 bg-background-secondary ...">

// Layout.tsx:142 モバイルヘッダー
- <header className="sticky top-0 z-30 flex items-center h-16 px-4 ...">
+ <header className="sticky top-0 z-30 flex items-center h-14 px-4 ...">
```

### 2.2 Tailwind カスタムサイズ追加

**対象ファイル:** `apps/web/tailwind.config.ts`

```typescript
theme: {
  extend: {
    spacing: {
      '14': '3.5rem',   // 56px (ヘッダー高さ)
      '60': '15rem',    // 240px (サイドバー幅)
    },
  },
}
```

### 2.3 Z-Index統一

**対象ファイル:** `apps/web/tailwind.config.ts`

```typescript
theme: {
  extend: {
    zIndex: {
      'dropdown': '10',
      'sticky': '20',
      'sidebar': '30',
      'header': '40',
      'overlay': '50',
      'modal': '60',
      'toast': '70',
      'tooltip': '80',
    },
  },
}
```

**対象ファイル更新:**

| ファイル | 変更内容 |
|---------|---------|
| `Layout.tsx` | `z-50` → `z-sidebar`, `z-30` → `z-header` |
| `Toast.tsx` | `z-50` → `z-toast` |
| `Projects.tsx` (モーダル) | `z-50` → `z-modal` |

---

## Phase 3: アクセシビリティ対応

### 3.1 Skip Link実装

**対象ファイル:** `apps/web/src/components/Layout.tsx`

```tsx
export function Layout() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-tooltip focus:px-4 focus:py-2 focus:bg-accent focus:text-background focus:rounded"
      >
        コンテンツにスキップ
      </a>

      <Sidebar ... />

      <main id="main-content" className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

### 3.2 トーストのaria-live対応

**対象ファイル:** `apps/web/src/components/Toast.tsx`

```tsx
export function ToastContainer() {
  const { toasts } = useToastStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-toast flex flex-col gap-2 max-w-sm"
      role="region"
      aria-label="通知"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
```

### 3.3 prefers-reduced-motion対応

**対象ファイル:** `apps/web/src/styles/globals.css`

```css
@layer base {
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

### 3.4 フォーカス管理の強化

**対象ファイル:** `apps/web/src/styles/globals.css`

```css
@layer base {
  /* フォーカスリングの改善 */
  *:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--info);
  }

  /* マウス操作時はフォーカスリング非表示 */
  *:focus:not(:focus-visible) {
    outline: none;
    box-shadow: none;
  }
}
```

---

## Phase 4: コンポーネント拡張

### 4.1 テスト状態バッジ

**新規ファイル:** `apps/web/src/components/ui/StatusBadge.tsx`

```tsx
import { CheckCircle, XCircle, Loader, Clock, SkipForward } from 'lucide-react';

type TestStatus = 'passed' | 'failed' | 'running' | 'pending' | 'skipped';

const statusConfig: Record<TestStatus, { icon: React.ElementType; className: string }> = {
  passed: {
    icon: CheckCircle,
    className: 'bg-success-subtle text-success',
  },
  failed: {
    icon: XCircle,
    className: 'bg-danger-subtle text-danger',
  },
  running: {
    icon: Loader,
    className: 'bg-running-subtle text-running animate-spin',
  },
  pending: {
    icon: Clock,
    className: 'bg-warning-subtle text-warning',
  },
  skipped: {
    icon: SkipForward,
    className: 'bg-background-tertiary text-foreground-subtle',
  },
};

export function StatusBadge({ status }: { status: TestStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={`badge ${config.className}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}
```

### 4.2 スケルトンローディング

**新規ファイル:** `apps/web/src/components/ui/Skeleton.tsx`

```tsx
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ className = '', variant = 'text' }: SkeletonProps) {
  const baseClass = 'animate-skeleton bg-gradient-to-r from-background-secondary via-background-tertiary to-background-secondary bg-[length:200%_100%]';

  const variantClass = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  return <div className={`${baseClass} ${variantClass[variant]} ${className}`} />;
}
```

**対象ファイル:** `apps/web/src/styles/globals.css`

```css
@layer utilities {
  @keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .animate-skeleton {
    animation: skeleton-shimmer 1.5s infinite;
  }
}
```

### 4.3 プログレスバー

**新規ファイル:** `apps/web/src/components/ui/ProgressBar.tsx`

```tsx
interface ProgressBarProps {
  passed: number;
  failed: number;
  skipped?: number;
  total: number;
}

export function ProgressBar({ passed, failed, skipped = 0, total }: ProgressBarProps) {
  const passedPercent = (passed / total) * 100;
  const failedPercent = (failed / total) * 100;
  const skippedPercent = (skipped / total) * 100;

  return (
    <div className="h-2 bg-background-tertiary rounded-full overflow-hidden flex">
      <div
        className="bg-success transition-all duration-300"
        style={{ width: `${passedPercent}%` }}
        role="progressbar"
        aria-valuenow={passed}
        aria-valuemax={total}
        aria-label={`${passed} passed`}
      />
      <div
        className="bg-danger transition-all duration-300"
        style={{ width: `${failedPercent}%` }}
        aria-label={`${failed} failed`}
      />
      <div
        className="bg-foreground-subtle transition-all duration-300"
        style={{ width: `${skippedPercent}%` }}
        aria-label={`${skipped} skipped`}
      />
    </div>
  );
}
```

### 4.4 パンくずリスト

**新規ファイル:** `apps/web/src/components/ui/Breadcrumb.tsx`

```tsx
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="パンくずリスト" className="flex items-center gap-2 text-sm text-foreground-muted">
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="w-4 h-4 text-foreground-subtle" />}
          {item.href ? (
            <Link to={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

---

## Phase 5: インタラクション強化

### 5.1 コマンドパレット (⌘K)

**新規ファイル:** `apps/web/src/components/CommandPalette.tsx`

主要機能:
- `⌘ + K` で起動
- 最近のテスト/コマンド検索
- キーボードナビゲーション (J/K, Enter, Esc)

### 5.2 キーボードショートカット

**新規ファイル:** `apps/web/src/hooks/useKeyboardShortcuts.ts`

| ショートカット | アクション |
|--------------|-----------|
| `⌘ + K` | コマンドパレット |
| `⌘ + /` | ショートカット一覧 |
| `J` / `K` | リスト上下移動 |
| `X` | 選択トグル |
| `Esc` | 閉じる/キャンセル |

### 5.3 フォント読み込み

**対象ファイル:** `apps/web/index.html`

```html
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
```

---

## 実装チェックリスト

### Phase 1: カラーシステム
- [x] `tailwind.config.ts` カラー定義更新
- [x] `globals.css` CSS変数追加
- [x] 既存コンポーネントの色クラス確認

### Phase 2: レイアウト
- [x] ヘッダー高さ 64px → 56px
- [x] サイドバー幅 256px → 240px
- [x] Z-Index統一

### Phase 3: アクセシビリティ
- [x] Skip Link実装
- [x] トーストaria-live対応
- [x] prefers-reduced-motion対応
- [x] フォーカスリング改善

### Phase 4: コンポーネント
- [x] StatusBadge
- [x] Skeleton
- [x] ProgressBar
- [x] Breadcrumb

### Phase 5: インタラクション
- [x] フォント読み込み
- [x] コマンドパレット
- [x] キーボードショートカット

---

## Claude Code 実行手順

### Step 1: カラーシステム修正
```
apps/web/tailwind.config.ts のカラー定義を更新してください。
- foreground.DEFAULT を #e6edf3 に変更
- running カラーを追加 (#a371f7, #271d3d)
- subtle カラーを各セマンティックカラーに追加

同時に apps/web/src/styles/globals.css にCSS変数を追加してください。
```

### Step 2: レイアウト調整
```
apps/web/src/components/Layout.tsx を更新してください。
- ヘッダー高さを h-16 から h-14 に変更
- サイドバー幅を w-64 から w-60 に変更
- Skip Linkを追加

tailwind.config.ts にz-indexスケールを追加してください。
```

### Step 3: アクセシビリティ
```
以下のアクセシビリティ対応を実装してください。
- Toast.tsx に aria-live 属性追加
- globals.css に prefers-reduced-motion 対応追加
- フォーカスリングの改善
```

### Step 4: UIコンポーネント追加
```
apps/web/src/components/ui/ に以下を作成してください。
- StatusBadge.tsx (テスト状態表示)
- Skeleton.tsx (ローディング)
- ProgressBar.tsx (テスト進捗)
- Breadcrumb.tsx (パンくず)
```

### Step 5: フォント設定
```
apps/web/index.html に Google Fonts (Inter, JetBrains Mono) の読み込みを追加してください。
```

---

## 補足: 動作確認

各フェーズ完了後に以下を確認:

1. **カラー確認**
   - ダークモードでのコントラスト比
   - テスト状態バッジの視認性

2. **レイアウト確認**
   - ヘッダー/サイドバーのサイズ
   - モバイルレスポンシブ

3. **アクセシビリティ確認**
   - Tabキーでのナビゲーション
   - Skip Linkの動作
   - スクリーンリーダーでのトースト読み上げ

4. **ブラウザ対応**
   - Chrome, Firefox, Safari
   - prefers-reduced-motion有効時の動作
