# テスト実施画面のMarkdownレンダリング対応

## 概要
テスト実施画面およびPiP機能で、テストスイート・テストケースの説明、前提条件、手順、期待結果がプレーンテキストで表示されている問題を修正する。テストスイート詳細・テストケース詳細画面と同様に`MarkdownPreview`コンポーネントを使用してレンダリングする。

## 修正対象ファイル

### 1. ExecutionOverviewPanel.tsx
**パス**: `apps/web/src/components/execution/ExecutionOverviewPanel.tsx`

**修正内容**:
1. `MarkdownPreview`をインポート追加
2. テストスイート説明を追加表示（Line 161付近、時刻表示の下に）
```tsx
{executionTestSuite?.description && (
  <MarkdownPreview content={executionTestSuite.description} className="text-foreground-muted text-sm mt-2" />
)}
```

### 2. ExecutionTestCaseDetailPanel.tsx
**パス**: `apps/web/src/components/execution/ExecutionTestCaseDetailPanel.tsx`

**修正内容**:
1. `MarkdownPreview`をインポート追加
2. Line 136-138を変更:
```tsx
// Before
{testCase.description && (
  <p className="text-sm text-foreground-muted">{testCase.description}</p>
)}

// After
{testCase.description && (
  <MarkdownPreview content={testCase.description} className="text-sm text-foreground-muted" />
)}
```

### 3. ExecutionResultItem.tsx
**パス**: `apps/web/src/components/execution/ExecutionResultItem.tsx`

**修正内容**:
1. `MarkdownPreview`をインポート追加
2. Line 58を変更:
```tsx
// Before
<p className="text-sm text-foreground flex-1">{content}</p>

// After
<div className="text-sm text-foreground flex-1">
  <MarkdownPreview content={content} />
</div>
```

### 4. PipExecutionPanel.tsx
**パス**: `apps/web/src/components/execution/PipExecutionPanel.tsx`

**修正内容**:
1. `MarkdownPreview`をインポート追加
2. Line 425-427を変更:
```tsx
// Before
<div className="text-sm text-foreground leading-relaxed">
  {currentItem.content}
</div>

// After
<div className="text-sm text-foreground leading-relaxed">
  <MarkdownPreview content={currentItem.content} />
</div>
```

## 検証方法
1. `docker compose exec dev pnpm build` でビルドエラーがないことを確認
2. テスト実施画面を開く
3. テストスイートの概要パネルで説明がMarkdownレンダリングされていることを確認
4. テストケースを選択し、説明がMarkdownレンダリングされていることを確認
5. 前提条件、ステップ、期待結果がMarkdownレンダリングされていることを確認
6. PiPボタンをクリックしてPiPウィンドウを開く
7. PiP内の前提条件、ステップ、期待結果がMarkdownレンダリングされていることを確認
