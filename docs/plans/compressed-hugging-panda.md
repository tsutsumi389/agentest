# テストスイート詳細画面のMarkdownレンダリング対応

## 概要
テストスイート詳細画面で「説明」と「前提条件」がMarkdown形式のまま表示されている問題を修正する。

## 修正対象ファイル

### 1. `apps/web/src/pages/TestSuiteCases.tsx`
- 347-349行目の description 表示部分
- `<p>` タグを `MarkdownPreview` コンポーネントに置き換え
- 説明がない場合は「説明なし」を表示（現状維持）

**Before:**
```tsx
<p className="text-foreground-muted">
  {suite.description || '説明なし'}
</p>
```

**After:**
```tsx
{suite.description ? (
  <MarkdownPreview content={suite.description} className="text-foreground-muted" />
) : (
  <p className="text-foreground-muted">説明なし</p>
)}
```

### 2. `apps/web/src/components/test-suite/PreconditionList.tsx`
- 96-98行目の precondition.content 表示部分
- `<p>` タグを `MarkdownPreview` コンポーネントに置き換え

**Before:**
```tsx
<p className="text-sm text-foreground">
  {precondition.content}
</p>
```

**After:**
```tsx
<MarkdownPreview content={precondition.content} className="text-sm" />
```

## 既存リソース
- `MarkdownPreview` コンポーネント: `apps/web/src/components/common/markdown/MarkdownPreview.tsx`
- スタイル: `apps/web/src/styles/globals.css` に `.markdown-preview` クラスが定義済み
