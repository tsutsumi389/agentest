# テスト実行画面のノートをMarkdown対応にする

## 概要
テスト実行（Execution）画面で、前提条件・手順・期待結果に付随する「ノート」フィールドをMarkdown形式に対応させる。

## 現状
- ノートは `InlineNoteEditor` コンポーネントで編集・表示
- 編集: プレーンな `<textarea>`
- 表示: `{value}` をそのまま表示（`whitespace-pre-wrap`）

## 実装計画

### 変更対象ファイル
`apps/web/src/components/execution/InlineNoteEditor.tsx`

### Step 1: インポート追加
```tsx
import { MarkdownToolbar, MarkdownPreview } from '../common/markdown';
```

### Step 2: handleInsert関数を追加
`MarkdownEditor.tsx` の実装を参考に、テキストエリアに書式を挿入する関数を追加。

### Step 3: 編集モードにツールバー追加
textareaの上に `MarkdownToolbar` を配置。

### Step 4: 表示モードにMarkdownPreview適用
`{value}` を `<MarkdownPreview content={value} />` に置き換え。
`whitespace-pre-wrap` クラスは削除。

### Step 5: キーボードショートカット追加
- `Ctrl/Cmd+B`: 太字
- `Ctrl/Cmd+I`: 斜体
- `Ctrl/Cmd+K`: リンク

## 影響範囲
以下のコンポーネントは `InlineNoteEditor` を使用しているが、propsインターフェースは変わらないため変更不要:
- `ExecutionResultItem.tsx`
- `PipExecutionPanel.tsx`

## 検証方法
1. Docker環境を起動: `cd docker && docker compose up`
2. テスト実行画面を開く
3. 以下を確認:
   - ノート編集時にツールバーが表示される
   - 太字・リスト等のMarkdown記法が入力できる
   - 保存後、Markdownがレンダリングされて表示される
   - PiP画面でも同様に動作する
   - キーボードショートカット（Ctrl+B等）が動作する
