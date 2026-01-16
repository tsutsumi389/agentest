# レビューコメント表示の修正計画

## 問題
レビューコメント送信後、テストスイート/テストケース詳細画面に戻ってもコメントが表示されない。リロードすると表示される。

## 原因
React Queryのキャッシュ無効化漏れ。

### 詳細
1. `ReviewSessionContext.addComment()` でコメント追加後、`reviewsApi.getById()` でレビュー詳細を再取得して `currentReview` を更新
2. しかし、`CommentableField` の `useQuery(['unresolved-comments', targetType, targetId])` キャッシュは無効化されていない
3. テストスイート/ケース詳細画面で古いキャッシュが表示される

## 修正対象ファイル
- `apps/web/src/contexts/ReviewSessionContext.tsx`

## 修正内容

### 1. `useQueryClient` をインポート（L1付近）
```typescript
import { useQueryClient } from '@tanstack/react-query';
```

### 2. コンポーネント内で `queryClient` を取得（L72付近）
```typescript
export function ReviewSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();  // 追加
  const [currentReview, setCurrentReview] = useState<ReviewWithDetails | null>(null);
  // ...
```

### 3. `addComment` 関数でキャッシュを無効化（L168-172付近）
```typescript
const response = await reviewsApi.addComment(currentReview.id, data);
const refreshed = await reviewsApi.getById(currentReview.id);
setCurrentReview(refreshed.review);

// 追加: コメント対象のキャッシュを無効化
queryClient.invalidateQueries({
  queryKey: ['unresolved-comments', data.targetType, data.targetId]
});
```

### 4. `submitReview` 関数で全コメントのキャッシュを無効化（L125-128付近）
```typescript
await reviewsApi.submit(currentReview.id, { verdict, summary });

// 追加: レビューに含まれる全コメントのキャッシュを無効化
const uniqueTargets = new Set(
  currentReview.comments.map(c => `${c.targetType}:${c.targetId}`)
);
uniqueTargets.forEach(key => {
  const [targetType, targetId] = key.split(':');
  queryClient.invalidateQueries({
    queryKey: ['unresolved-comments', targetType, targetId]
  });
});

// 提出後はセッションをクリア
setCurrentReview(null);
setTestSuiteId(null);
```

## 検証方法
1. テストスイート詳細画面を開く
2. レビューを開始し、フィールドにコメントを追加
3. 別のテストスイート/ケースに移動
4. 元のテストスイート詳細に戻る
5. コメントが表示されることを確認（リロードせずに）
6. レビューを提出後も同様に確認
