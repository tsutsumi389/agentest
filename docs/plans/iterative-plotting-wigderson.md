# レビューコメントのMarkdownレンダリング対応

## 概要
テストスイートのレビュータブで、レビューコメントやサマリーがMarkdownレンダリングされていない問題を修正する。

## 問題箇所
以下のファイルでプレーンテキスト表示されている箇所を特定:

### 1. `ReviewDetailContent.tsx`
- **93-94行目**: `review.summary` - レビューサマリー
- **181-183行目**: `comment.content` - コメント本文
- **221-223行目**: `reply.content` - 返信本文

### 2. `ReviewItem.tsx`
- **66-69行目**: `review.summary` - レビューサマリー（一覧表示）

## 対比: 正しく実装されているファイル
- `ReviewCommentItem.tsx`: 274, 288, 421行目で `MarkdownPreview` 使用
- `InlineCommentThread.tsx`: 278, 402行目で `MarkdownPreview` 使用

## 修正方法

### ファイル1: `apps/web/src/components/review/ReviewDetailContent.tsx`

1. `MarkdownPreview` のインポートを追加:
   ```tsx
   import { MarkdownPreview } from '../common/markdown';
   ```

2. サマリー表示（93-95行目）を修正:
   ```tsx
   // 変更前
   <p className="text-sm text-foreground whitespace-pre-wrap">
     {review.summary}
   </p>

   // 変更後
   <div className="text-sm">
     <MarkdownPreview content={review.summary} />
   </div>
   ```

3. コメント内容（181-183行目）を修正:
   ```tsx
   // 変更前
   <p className="text-sm text-foreground whitespace-pre-wrap break-words">
     {comment.content}
   </p>

   // 変更後
   <div className="text-sm">
     <MarkdownPreview content={comment.content} />
   </div>
   ```

4. 返信内容（221-223行目）を修正:
   ```tsx
   // 変更前
   <p className="text-sm text-foreground whitespace-pre-wrap break-words pl-7">
     {reply.content}
   </p>

   // 変更後
   <div className="text-sm pl-7">
     <MarkdownPreview content={reply.content} />
   </div>
   ```

### ファイル2: `apps/web/src/components/review/ReviewItem.tsx`

1. `MarkdownPreview` のインポートを追加:
   ```tsx
   import { MarkdownPreview } from '../common/markdown';
   ```

2. サマリー表示（66-69行目）を修正:
   ```tsx
   // 変更前
   <p className="text-sm text-foreground-muted line-clamp-2 mb-2">
     {review.summary}
   </p>

   // 変更後
   <div className="text-sm text-foreground-muted line-clamp-2 mb-2">
     <MarkdownPreview content={review.summary} />
   </div>
   ```

## 検証方法
1. Dockerコンテナで開発サーバーを起動
2. テストスイート詳細画面のレビュータブを開く
3. Markdown記法を含むコメント（例: `**太字**`, `- リスト`, `` `コード` ``）が正しくレンダリングされることを確認
4. レビュー一覧・詳細表示の両方でMarkdownが適用されていることを確認
