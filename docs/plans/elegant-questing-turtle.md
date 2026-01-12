# レビューコメント機能拡張計画

## 概要
レビュー機能を拡張し、以下を実現する：
1. 前提条件が0件でもコメント登録可能にする
2. 説明フィールドにもコメント追加可能にする
3. 追加したコメントをインライン表示（GitHub PR風）

## 現状分析

### APIの状態
- `apps/api/src/services/review.service.ts`の`validateTargetItem`メソッド（55-103行目）
- **APIは既に`targetItemId`なしでの`PRECONDITION`/`DESCRIPTION`フィールドへのコメントを許可している**
- API変更は不要

### フロントエンドの問題点
| コンポーネント | 問題 |
|--------------|------|
| `TestCasePreconditionList.tsx` | 前提条件0件の場合、CommentableItemがない |
| `TestCaseDetailPanel.tsx` | 説明はMarkdownPreviewで直接表示、CommentableItemなし |
| `PreconditionList.tsx` | CommentableItemを全く使用していない |
| `CommentableItem.tsx` | インラインコメント表示機能がない |

---

## 実装計画

### Phase 1: 新規コンポーネント作成

#### 1.1 CommentableField.tsx（新規）
フィールド全体（前提条件セクション/説明セクション）へのコメント機能

**ファイル:** `apps/web/src/components/review/CommentableField.tsx`

```typescript
interface CommentableFieldProps {
  children: ReactNode;
  targetType: ReviewTargetType;  // SUITE or CASE
  targetId: string;
  targetField: ReviewTargetField;  // PRECONDITION or DESCRIPTION
  fieldContent?: string;  // スナップショット用
  comments?: ReviewCommentWithReplies[];
  onCommentAdded?: () => void;
}
```

機能：
- フィールド全体にコメント追加ボタンを表示（ヘッダー横）
- `targetItemId`なしでコメントを追加
- フィールドに紐づくコメントを直下にインライン表示

#### 1.2 InlineCommentThread.tsx（新規）
コメントをインライン表示するコンポーネント

**ファイル:** `apps/web/src/components/review/InlineCommentThread.tsx`

機能：
- コメントをコンパクトに表示（GitHub PR風）
- 返信の表示/追加
- ステータス変更（OPEN/RESOLVED）
- 編集/削除

---

### Phase 2: 既存コンポーネントの修正

#### 2.1 TestCasePreconditionList.tsx
**ファイル:** `apps/web/src/components/test-case/TestCasePreconditionList.tsx`

修正内容：
- セクション全体を`CommentableField`でラップ
- 前提条件0件でもコメント追加可能
- フィールドレベルコメントをインライン表示

#### 2.2 TestCaseDetailPanel.tsx（OverviewTab）
**ファイル:** `apps/web/src/components/test-case/TestCaseDetailPanel.tsx`

修正内容：
- 説明セクションを`CommentableField`でラップ
- コメント一覧を取得してOverviewTabに渡す

#### 2.3 PreconditionList.tsx（テストスイート用）
**ファイル:** `apps/web/src/components/test-suite/PreconditionList.tsx`

修正内容：
- `CommentableField`でセクション全体をラップ
- 各前提条件を`CommentableItem`でラップ
- `comments`と`onCommentAdded`のpropsを追加

#### 2.4 CommentableItem.tsx
**ファイル:** `apps/web/src/components/review/CommentableItem.tsx`

修正内容：
- 該当アイテムのコメントをインライン表示する機能を追加

---

## 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `apps/web/src/components/review/CommentableField.tsx` | 新規 | フィールド全体へのコメント機能 |
| `apps/web/src/components/review/InlineCommentThread.tsx` | 新規 | インラインコメント表示 |
| `apps/web/src/components/review/CommentableItem.tsx` | 修正 | インライン表示機能追加 |
| `apps/web/src/components/review/index.ts` | 修正 | エクスポート追加 |
| `apps/web/src/components/test-case/TestCasePreconditionList.tsx` | 修正 | CommentableField追加 |
| `apps/web/src/components/test-case/TestCaseDetailPanel.tsx` | 修正 | 説明にCommentableField追加 |
| `apps/web/src/components/test-suite/PreconditionList.tsx` | 修正 | CommentableField/Item追加 |

---

## 検証方法

1. **前提条件0件のテストケースでコメント追加**
   - テストケース詳細を開く
   - レビューモードで前提条件セクションにコメントを追加
   - コメントがインライン表示されることを確認

2. **説明へのコメント追加**
   - テストケース詳細を開く
   - レビューモードで説明セクションにコメントを追加
   - コメントがインライン表示されることを確認

3. **テストスイートでの動作確認**
   - テストスイート詳細を開く
   - レビューモードで前提条件/説明にコメントを追加
   - コメントがインライン表示されることを確認

4. **既存機能への影響確認**
   - 個別の前提条件/ステップへのコメントが引き続き動作
   - レビュータブでのコメント一覧表示が正常動作
