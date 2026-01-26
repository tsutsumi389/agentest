# テストスイート詳細画面のUI変更

## 概要
テストスイート詳細画面をテスト実行画面のようなUIに変更する。
- サイドバーのテストケース一覧上部に「概要」ボタンを追加
- ヘッダーの「閉じる」ボタンを削除

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/components/test-suite/TestCaseSidebar.tsx` | 概要ボタンの追加 |
| `apps/web/src/components/test-suite/TestSuiteHeader.tsx` | 閉じるボタンの削除 |
| `apps/web/src/pages/TestSuiteCases.tsx` | 概要表示ハンドラ追加、props連携 |

---

## 変更1: TestCaseSidebar.tsx

### 1.1 Propsインターフェースに追加 (29-40行目付近)
```typescript
interface TestCaseSidebarProps {
  // 既存...
  /** 概要表示中かどうか */
  isOverviewMode?: boolean;
  /** 概要ボタンクリック時のハンドラ */
  onOverviewClick?: () => void;
}
```

### 1.2 LayoutGridアイコンのインポート追加 (19-25行目)
```typescript
import {
  Loader2,
  Plus,
  GripVertical,
  Search,
  FileText,
  LayoutGrid,  // 追加
} from 'lucide-react';
```

### 1.3 コンポーネント引数に追加 (128-138行目)
```typescript
export function TestCaseSidebar({
  // 既存...
  isOverviewMode = false,
  onOverviewClick,
}: TestCaseSidebarProps) {
```

### 1.4 検索ボックス後に概要ボタンを追加 (267行目の `</div>` の後)

ExecutionSidebar の 209-238行目を参考に追加:

```tsx
{/* 概要ボタン */}
{onOverviewClick && (
  <div className="p-2 border-b border-border">
    <button
      type="button"
      onClick={onOverviewClick}
      aria-label="テストスイート概要を表示"
      className={`
        w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors
        ${isOverviewMode
          ? 'bg-accent-subtle text-accent'
          : 'hover:bg-background-tertiary text-foreground'
        }
      `}
    >
      <LayoutGrid className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-medium flex-1">概要</span>
    </button>
  </div>
)}
```

---

## 変更2: TestSuiteHeader.tsx

### 2.1 閉じるボタンのJSXを削除 (146-155行目)

以下のコードを削除:
```tsx
{onCloseTestCase && (
  <button
    onClick={onCloseTestCase}
    className="btn btn-secondary btn-sm"
    title="閉じる"
  >
    <X className="w-4 h-4" />
    閉じる
  </button>
)}
```

### 2.2 Xアイコンのインポートを削除 (1行目)

```typescript
// Before
import { Play, Pencil, FileText, History, MessageSquare, Settings, Copy, X } from 'lucide-react';

// After
import { Play, Pencil, FileText, History, MessageSquare, Settings, Copy } from 'lucide-react';
```

---

## 変更3: TestSuiteCases.tsx

### 3.1 概要表示ハンドラを追加

```typescript
// 概要表示ハンドラ（テストケース選択を解除して概要タブを表示）
const handleShowOverview = useCallback(() => {
  const newParams = new URLSearchParams(searchParams);
  newParams.delete('testCase');
  newParams.delete('testCaseTab');
  newParams.delete('mode');
  newParams.set('tab', 'overview');
  setSearchParams(newParams);
}, [searchParams, setSearchParams]);
```

### 3.2 TestCaseSidebarのpropsに追加 (useEffect内, 226-244行目付近)

```tsx
setSidebarContent(
  <TestCaseSidebar
    testSuiteId={testSuiteId}
    testCases={testCases}
    selectedTestCaseId={selectedTestCaseId}
    onSelect={handleSelectTestCase}
    onCreateClick={handleStartCreateMode}
    currentRole={currentRole}
    isLoading={isLoadingCases}
    onTestCasesReordered={handleTestCasesReordered}
    isCreateMode={isCreateMode}
    // 追加
    isOverviewMode={!selectedTestCaseId && !isCreateMode}
    onOverviewClick={handleShowOverview}
  />
);
```

### 3.3 useEffectの依存配列を更新

`handleShowOverview` を依存配列に追加。

---

## UI変更イメージ

**Before (現在のUI):**
```
+---------------------------+
| テストケース       [+]    |
+---------------------------+
| [検索ボックス]            |
+---------------------------+
| テストケース1             |
| テストケース2             |
+---------------------------+
| 3件                       |
+---------------------------+

ヘッダー: [編集] [コピー] [閉じる]
```

**After (変更後のUI):**
```
+---------------------------+
| テストケース       [+]    |
+---------------------------+
| [検索ボックス]            |
+---------------------------+
| [□] 概要                  |  ← 新規追加
+---------------------------+
| テストケース1             |
| テストケース2             |
+---------------------------+
| 3件                       |
+---------------------------+

ヘッダー: [編集] [コピー]  ← 閉じるボタン削除
```

---

## 状態遷移

| 操作 | selectedTestCaseId | isCreateMode | 表示内容 |
|-----|-------------------|--------------|---------|
| 概要ボタンクリック | null | false | テストスイート概要 |
| テストケース選択 | 選択したID | false | テストケース詳細 |
| 作成ボタンクリック | null | true | 作成フォーム |

---

## 検証方法

1. `docker compose up` でサーバー起動
2. テストスイート詳細画面（`/projects/:id/test-suites/:id`）を開く
3. 確認項目:
   - [ ] サイドバーの検索ボックスの下に「概要」ボタンが表示される
   - [ ] 概要ボタンをクリックするとテストスイートの概要タブが表示される
   - [ ] テストケースを選択すると、概要ボタンの選択状態が解除される
   - [ ] テストケース選択時、ヘッダーに「閉じる」ボタンが表示されない
   - [ ] 概要ボタンクリックでテストケースの選択状態が解除される
