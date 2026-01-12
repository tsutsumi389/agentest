# GitHub PR風レビュー機能 実装計画

## 概要
現在の即座公開型レビューコメントを、GitHubのPRレビューのような「レビューセッション」ベースの機能に刷新する。

### 要件
1. **レビューセッション**: レビュー開始→コメント追加→submit の流れ（submitまで非公開）
2. **コメント対象**: 項目単位（TITLE, DESCRIPTION, PRECONDITION, STEP, EXPECTED_RESULT）
3. **レビュー評価**: 承認(APPROVED) / 要修正(CHANGES_REQUESTED) / コメントのみ
4. **レビュー一覧**: レビュアー名、日時、コメント数、評価ステータスを表示
5. **既存データ**: 削除OK

---

## 1. データベーススキーマ

### 新規Enum
```prisma
enum ReviewSessionStatus {
  DRAFT      // 下書き中
  SUBMITTED  // 提出済み
}

enum ReviewVerdict {
  APPROVED           // 承認
  CHANGES_REQUESTED  // 要修正
  COMMENT_ONLY       // コメントのみ
}
```

### 新規モデル: Review
```prisma
model Review {
  id                    String              @id @default(uuid())
  targetType            ReviewTargetType    @map("target_type")
  targetId              String              @map("target_id")
  authorUserId          String?             @map("author_user_id")
  authorAgentSessionId  String?             @map("author_agent_session_id")
  status                ReviewSessionStatus @default(DRAFT)
  verdict               ReviewVerdict?
  summary               String?             @db.Text
  submittedAt           DateTime?           @map("submitted_at")
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  author       User?          @relation("ReviewAuthor", ...)
  agentSession AgentSession?  @relation("ReviewAgentSession", ...)
  comments     ReviewComment[]

  @@index([targetType, targetId, status])
  @@map("reviews")
}
```

### ReviewComment変更
- `reviewId` 追加（Reviewへの外部キー）
- `targetType`, `targetId` は維持（テストスイート内のテストケースにもコメント可能なため）

---

## 2. API設計

### レビュー操作（テストスイート単位のみ）
| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | `/api/test-suites/:id/reviews` | レビュー開始（DRAFT作成） |
| GET | `/api/test-suites/:id/reviews` | レビュー一覧（SUBMITTEDのみ） |
| GET | `/api/reviews/:reviewId` | レビュー詳細 |
| POST | `/api/reviews/:reviewId/submit` | レビュー提出 |
| DELETE | `/api/reviews/:reviewId` | レビュー削除（DRAFTのみ） |
| GET | `/api/reviews/drafts` | 自分の下書き一覧 |

※ テストケース単位のレビューは対象外（テストスイート内のテストケースにコメントを付けることは可能）

### コメント操作
| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | `/api/reviews/:reviewId/comments` | コメント追加 |
| PATCH | `/api/reviews/:reviewId/comments/:id` | コメント編集 |
| DELETE | `/api/reviews/:reviewId/comments/:id` | コメント削除 |
| POST | `/api/reviews/:reviewId/comments/:id/replies` | 返信追加 |

---

## 3. フロントエンドUI

### レビュータブ構成
```
┌─────────────────────────────────────────┐
│ [レビューを開始]       自分の下書き: 1件 │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 田中太郎        2024/01/15 14:30   │ │
│ │ ✅ 承認                            │ │
│ │ サマリーテキスト...                │ │
│ │ 💬 3件のコメント         [詳細→]  │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### レビュー中バー（画面下部固定）
```
┌─────────────────────────────────────────────────┐
│ 📝 レビュー中 │ コメント: 3件 │ [提出] [キャンセル] │
└─────────────────────────────────────────────────┘
```

### 新規コンポーネント
- `ReviewPanel.tsx` - レビュータブのメイン
- `ReviewList.tsx` - 提出済みレビュー一覧
- `ReviewItem.tsx` - 個別レビュー表示
- `ReviewDetailModal.tsx` - レビュー詳細モーダル
- `ReviewSessionBar.tsx` - レビュー中バー
- `ReviewSubmitModal.tsx` - 提出確認モーダル
- `ReviewVerdictBadge.tsx` - 評価バッジ
- `ReviewSessionContext.tsx` - 状態管理Context

---

## 4. 実装ファイル

### バックエンド
| ファイル | 操作 |
|----------|------|
| `packages/db/prisma/schema.prisma` | 更新 |
| `packages/shared/src/validators/schemas.ts` | 更新 |
| `apps/api/src/routes/reviews.ts` | 新規 |
| `apps/api/src/controllers/review.controller.ts` | 新規 |
| `apps/api/src/services/review.service.ts` | 新規 |
| `apps/api/src/repositories/review.repository.ts` | 新規 |
| `apps/api/src/services/review-comment.service.ts` | 更新 |
| `apps/api/src/routes/review-comments.ts` | 削除 |

### フロントエンド
| ファイル | 操作 |
|----------|------|
| `apps/web/src/lib/api.ts` | 更新 |
| `apps/web/src/contexts/ReviewSessionContext.tsx` | 新規 |
| `apps/web/src/components/review/ReviewPanel.tsx` | 新規 |
| `apps/web/src/components/review/ReviewList.tsx` | 新規 |
| `apps/web/src/components/review/ReviewItem.tsx` | 新規 |
| `apps/web/src/components/review/ReviewDetailModal.tsx` | 新規 |
| `apps/web/src/components/review/ReviewSessionBar.tsx` | 新規 |
| `apps/web/src/components/review/ReviewSubmitModal.tsx` | 新規 |
| `apps/web/src/components/review/ReviewVerdictBadge.tsx` | 新規 |
| `apps/web/src/components/review/ReviewCommentList.tsx` | 更新 |
| `apps/web/src/components/review/ReviewCommentItem.tsx` | 更新 |
| `apps/web/src/pages/TestSuiteCases.tsx` | 更新 |

---

## 5. 実装順序

### Phase 1: バックエンド基盤
1. Prismaスキーマ更新
2. マイグレーション実行（既存データ削除含む）
3. Review Repository/Service/Controller実装
4. APIルート設定
5. バリデーションスキーマ追加

### Phase 2: フロントエンド基盤
1. 型定義更新（shared）
2. API Client追加（reviewsApi）
3. ReviewSessionContext実装

### Phase 3: レビュータブUI
1. ReviewPanel実装
2. ReviewList/ReviewItem実装
3. ReviewDetailModal実装
4. ReviewVerdictBadge実装

### Phase 4: レビューモードUI
1. ReviewSessionBar実装
2. ReviewSubmitModal実装
3. 既存コメントコンポーネント更新

### Phase 5: 統合・テスト
1. TestSuiteCases.tsxにReviewPanel統合
2. 動作確認・調整

---

## 6. 検証方法

1. **レビュー開始**: テストスイートのレビュータブで「レビューを開始」→下書き作成確認
2. **コメント追加**: レビュー中にコメント追加→下書きに紐付け確認
3. **非公開確認**: 他ユーザーでログイン→下書きが見えないこと確認
4. **レビュー提出**: 評価選択→submit→公開確認
5. **一覧表示**: 提出済みレビューが一覧に表示されること確認
6. **詳細表示**: レビュー詳細でコメント一覧がスレッド形式で表示されること確認

---

## 7. 注意事項

- DRAFTレビューは作成者本人のみ閲覧可能
- 同一ユーザーが同一対象に対して複数DRAFTを持つことは不可
- SUBMITTEDレビューのコメントには他ユーザーも返信可能
- レビュー一覧取得時はコメント数のみ取得（パフォーマンス考慮）
