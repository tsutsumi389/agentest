# インラインレビューコメント機能の実装計画

## 概要
GitHubのPRのように、テストケースの前提条件・ステップ・期待結果にホバーしたときにコメント追加ボタンを表示し、インラインでコメントを追加できる機能を実装する。

## 設計方針
- **対象アイテムの内容保存**: コメント追加時にアイテム内容のスナップショットをDBに保存
- **インラインフォーム**: アイテム下にフォームを展開

---

## 実装手順

### Phase 1: DBスキーマ変更

**ファイル**: `packages/db/prisma/schema.prisma`

`ReviewComment`モデルに`targetItemContent`フィールドを追加:
```prisma
model ReviewComment {
  // ... 既存フィールド
  targetItemContent     String?           @map("target_item_content") @db.Text
  // ...
}
```

マイグレーション実行:
```bash
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name add_target_item_content
```

### Phase 2: 共有型定義・バリデーションの更新

**ファイル**: `packages/shared/src/types/review.ts`
- `ReviewComment`型に`targetItemContent: string | null`を追加

**ファイル**: `packages/shared/src/validators/schemas.ts`
- `reviewCommentCreateSchema`に`targetItemContent: z.string().max(1000).optional()`を追加

### Phase 3: バックエンドの修正

**ファイル**: `apps/api/src/services/review.service.ts`
- `CreateCommentData`インターフェースに`targetItemContent?: string`を追加

**ファイル**: `apps/api/src/repositories/review.repository.ts`
- `addComment`メソッドのcreate/selectに`targetItemContent`を追加

### Phase 4: フロントエンドAPI型定義の更新

**ファイル**: `apps/web/src/lib/api.ts`
```typescript
export interface CreateReviewCommentRequest {
  targetType: ReviewTargetType;
  targetId: string;
  targetField: ReviewTargetField;
  targetItemId?: string;
  targetItemContent?: string;  // 追加
  content: string;
}
```

### Phase 5: CommentableItemラッパーコンポーネント作成

**新規ファイル**: `apps/web/src/components/review/CommentableItem.tsx`

機能:
- ホバー時にコメント追加ボタン（吹き出しアイコン）を右側に表示
- レビューモード中（`isReviewing`）のみ表示
- クリックでアイテム下にインラインフォームを展開
- このアイテムに紐づく既存コメント数をバッジ表示
- コメント追加時に`targetItemId`と`targetItemContent`を送信

### Phase 6: リストコンポーネントの修正

各コンポーネントの変更内容:

**ファイル**: `apps/web/src/components/test-case/TestCasePreconditionList.tsx`
- propsに`comments?: ReviewCommentWithReplies[]`と`onCommentAdded?: () => void`を追加
- 各アイテムを`CommentableItem`でラップ
- `targetField: "PRECONDITION"`、`itemId: precondition.id`を渡す

**ファイル**: `apps/web/src/components/test-case/TestCaseStepList.tsx`
- 同様に修正、`targetField: "STEP"`

**ファイル**: `apps/web/src/components/test-case/TestCaseExpectedResultList.tsx`
- 同様に修正、`targetField: "EXPECTED_RESULT"`

### Phase 7: ReviewCommentItemでのスナップショット表示

**ファイル**: `apps/web/src/components/review/ReviewCommentItem.tsx`

`targetItemContent`が存在する場合、引用形式で表示:
```tsx
{comment.targetItemContent && (
  <div className="mb-3 p-2 bg-background-tertiary rounded border-l-2 border-accent">
    <MarkdownPreview content={comment.targetItemContent} />
  </div>
)}
```

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `packages/db/prisma/schema.prisma` | `targetItemContent`フィールド追加 |
| `packages/shared/src/types/review.ts` | 型に`targetItemContent`追加 |
| `packages/shared/src/validators/schemas.ts` | バリデーションスキーマ更新 |
| `apps/api/src/services/review.service.ts` | CreateCommentDataに追加 |
| `apps/api/src/repositories/review.repository.ts` | DB操作にフィールド追加 |
| `apps/web/src/lib/api.ts` | CreateReviewCommentRequestに追加 |
| `apps/web/src/components/review/CommentableItem.tsx` | **新規作成** |
| `apps/web/src/components/test-case/TestCasePreconditionList.tsx` | CommentableItemでラップ |
| `apps/web/src/components/test-case/TestCaseStepList.tsx` | CommentableItemでラップ |
| `apps/web/src/components/test-case/TestCaseExpectedResultList.tsx` | CommentableItemでラップ |
| `apps/web/src/components/review/ReviewCommentItem.tsx` | スナップショット表示追加 |

---

## 注意点

1. **既存データ互換性**: `targetItemContent`はオプショナルなので、既存コメントに影響なし
2. **レビューモード依存**: ホバーボタンは`isReviewing === true`の場合のみ表示
3. **テストスイート対応**: 将来的にテストスイートの前提条件にも同様に対応可能

---

## 検証方法

1. Dockerで開発環境を起動
2. テストスイート詳細画面でレビューを開始
3. 前提条件/ステップ/期待結果にホバーしてコメントボタン表示を確認
4. コメントを追加し、アイテムIDが正しく紐づけられることを確認
5. レビュータブで、コメントに対象アイテムの内容（スナップショット）が表示されることを確認
6. レビューを提出し、レビュー詳細でも正しく表示されることを確認
