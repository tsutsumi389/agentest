# レビュー送信後にレビュータブの一覧が更新されない問題の修正

## 問題
レビュー送信後、レビュータブに追加したレビューが表示されない。リロードすると表示される。

## 原因
`ReviewSessionContext.tsx` の `submitReview` 関数で、レビュー一覧のキャッシュ `['test-suite-reviews', testSuiteId]` が無効化されていない。

### 現状のキャッシュ無効化
- `['unresolved-comments', targetType, targetId]` → 無効化されている ✓
- `['test-suite-reviews', testSuiteId]` → **無効化されていない** ✗

## 修正対象ファイル
- `apps/web/src/contexts/ReviewSessionContext.tsx`

## 修正内容

### `submitReview` 関数にレビュー一覧キャッシュの無効化を追加（L127-140付近）

```typescript
await reviewsApi.submit(currentReview.id, { verdict, summary });
// レビューに含まれる全コメントのキャッシュを無効化
const uniqueTargets = new Set(
  currentReview.comments.map((c) => `${c.targetType}:${c.targetId}`)
);
uniqueTargets.forEach((key) => {
  const [targetType, targetId] = key.split(':');
  queryClient.invalidateQueries({
    queryKey: ['unresolved-comments', targetType, targetId],
  });
});
// 追加: レビュー一覧のキャッシュを無効化
queryClient.invalidateQueries({
  queryKey: ['test-suite-reviews', testSuiteId],
});
// 提出後はセッションをクリア
setCurrentReview(null);
setTestSuiteId(null);
```

**注意**: `testSuiteId` は `setTestSuiteId(null)` の前に使用する必要がある。

## 検証方法
1. テストスイート詳細画面を開く
2. レビューを開始し、コメントを追加
3. レビューを提出
4. レビュータブに切り替える
5. 提出したレビューが一覧に表示されることを確認（リロードせずに）
