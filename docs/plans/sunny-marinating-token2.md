# 未解決コメントのインライン表示

## 概要
未解決コメントを概要タブ上部の一覧ではなく、コメント対象の項目の下にインライン表示する。

## 現状の問題
- `UnresolvedCommentList`が概要タブ上部に全ての未解決コメントを一覧表示している
- ユーザーはコメントがついた項目（説明、前提条件1、前提条件2など）の下に表示したい
- **重要**: 現在の`CommentableField`は`isReviewing=true`の場合のみコメントを表示する

## 変更内容

### 1. UnresolvedCommentList の削除
**ファイル**:
- `/apps/web/src/pages/TestSuiteCases.tsx`
- `/apps/web/src/components/test-case/TestCaseDetailPanel.tsx`

### 2. CommentableField を修正して常に未解決コメントを表示
**ファイル**: `/apps/web/src/components/review/CommentableField.tsx`

現状（行90-92）:
```typescript
if (!isReviewing) {
  return <>{children}</>;
}
```

修正後:
- レビュー中でなくても、未解決コメントがあれば表示する
- APIから未解決コメントを取得してフィルタリング

### 3. CommentableItem も同様に修正
**ファイル**: `/apps/web/src/components/review/CommentableItem.tsx`

### 4. 未解決コメント取得用のカスタムフックを作成
**新規ファイル**: `/apps/web/src/hooks/useUnresolvedComments.ts`

各CommentableField/CommentableItemで使用する未解決コメント取得フック

## 実装順序
1. `CommentableField` を修正
   - レビュー中でない場合でも、未解決コメントがあれば表示する
   - APIから未解決コメント取得（useQuery + getTestSuiteComments/getTestCaseComments）
   - 表示には既存の`ReviewCommentItem`を使用

2. `CommentableItem` を同様に修正
   - itemId でフィルタリングして該当アイテムの未解決コメントのみ表示

3. `UnresolvedCommentList` の使用箇所を削除
   - `/apps/web/src/pages/TestSuiteCases.tsx`
   - `/apps/web/src/components/test-case/TestCaseDetailPanel.tsx`

4. `UnresolvedCommentList.tsx` ファイルを削除

## 実装詳細

### CommentableField/CommentableItem の修正ロジック
```typescript
// レビュー中: 現在のセッションのコメントを表示（編集可能）
// レビュー中でない: APIから未解決コメントを取得して表示（ReviewCommentItemで）

// 変更前
if (!isReviewing) {
  return <>{children}</>;
}

// 変更後
// 1. APIから未解決コメントを取得
const { data } = useQuery({
  queryKey: ['unresolved-comments', targetType, targetId],
  queryFn: () => getComments(targetId, { status: 'OPEN' }),
  enabled: !isReviewing, // レビュー中でない時のみ取得
});

// 2. フィルタリング（targetField, targetItemId）
const unresolvedComments = filterByTarget(data?.comments, targetField, itemId);

// 3. レビュー中でない場合も、未解決コメントがあれば表示
```

## 検証方法
1. テストスイート詳細画面の概要タブを開く（レビュー中でない状態）
   - 説明にコメントがある場合: 説明セクションの下に表示
   - 前提条件1にコメントがある場合: 前提条件1の下に表示
2. テストケース詳細パネルも同様に確認
3. コメントのステータス変更（解決済みにする）が正常に動作する
4. レビュー開始後も引き続きコメントが表示される
