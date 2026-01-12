# 概要タブに未解決レビューコメント一覧表示

## 概要
テストスイート/テストケースの概要タブに未解決のレビューコメントを常時表示し、レビュー選択ドロップダウンを削除する。

## 変更内容

### 1. 新規コンポーネント作成
**ファイル**: `/apps/web/src/components/review/UnresolvedCommentList.tsx`

- 概要タブ用の未解決コメント一覧
- `status='OPEN'` でフィルタしたコメントを表示
- 既存の `ReviewCommentItem` を再利用
- コメントがない場合はセクション非表示

```typescript
interface UnresolvedCommentListProps {
  targetType: 'SUITE' | 'CASE';
  targetId: string;
  currentUserId: string;
  canEdit: boolean;
}
```

### 2. テストスイート概要タブ修正
**ファイル**: `/apps/web/src/pages/TestSuiteCases.tsx`

- `OverviewReviewSelector` を削除
- `UnresolvedCommentList` を説明セクションの前に追加
- `selectedReviewId` state と `selectedReviewData` query を削除

### 3. テストケース概要タブ修正
**ファイル**: `/apps/web/src/components/test-case/TestCaseDetailPanel.tsx`

- `UnresolvedCommentList` を説明セクションの前に追加

### 4. 不要コンポーネント削除
**ファイル**: `/apps/web/src/components/test-suite/OverviewReviewSelector.tsx`

- ファイル削除

## 実装順序
1. `UnresolvedCommentList` コンポーネント作成
2. テストスイート概要タブ修正（OverviewReviewSelector削除含む）
3. テストケース概要タブ修正
4. `OverviewReviewSelector.tsx` ファイル削除

## 検証方法
1. テストスイート詳細画面の概要タブを開く
   - 未解決コメントがある場合: 一覧が表示される
   - 未解決コメントがない場合: セクションが非表示
   - レビュー選択ドロップダウンが削除されている
2. テストケース詳細パネルの概要タブを開く
   - 未解決コメントがある場合: 一覧が表示される
   - 未解決コメントがない場合: セクションが非表示
3. 未解決コメントのステータスを「解決済み」に変更できる
4. インラインコメント機能が維持されている
