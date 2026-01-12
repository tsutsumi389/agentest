# レビュー テーブル

## 概要

テストスイートに対する GitHub PR 風のレビュー機能を管理するテーブル群。レビューは「開始→コメント追加→提出」の流れで行い、提出するまでコメントは非公開となる。提出時に承認(APPROVED)/要修正(CHANGES_REQUESTED)/コメントのみ(COMMENT_ONLY)の評価を選択する。

---

## Review

レビューセッションを管理するテーブル。GitHub の PR Review に相当。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `testSuiteId` | UUID | NO | - | テストスイート ID（外部キー） |
| `authorUserId` | UUID | YES | NULL | 作成者ユーザー ID（外部キー）※1 |
| `authorAgentSessionId` | UUID | YES | NULL | 作成者 Agent セッション ID（外部キー）※1 |
| `status` | ENUM | NO | DRAFT | レビューセッションステータス |
| `verdict` | ENUM | YES | NULL | レビュー評価（提出時に設定） |
| `summary` | TEXT | YES | NULL | レビュー全体のサマリーコメント |
| `submittedAt` | TIMESTAMP | YES | NULL | 提出日時 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

※1: `authorUserId` と `authorAgentSessionId` はどちらか一方のみ設定（排他制約）

### レビューセッションステータス

| ステータス | 説明 |
|------------|------|
| `DRAFT` | 下書き中（submit するまで他のユーザーに見えない） |
| `SUBMITTED` | 提出済み（公開） |

### レビュー評価

| 評価 | 説明 |
|------|------|
| `APPROVED` | 承認 |
| `CHANGES_REQUESTED` | 要修正 |
| `COMMENT_ONLY` | コメントのみ（評価なし） |

### Prisma スキーマ

```prisma
enum ReviewSessionStatus {
  DRAFT
  SUBMITTED
}

enum ReviewVerdict {
  APPROVED
  CHANGES_REQUESTED
  COMMENT_ONLY
}

model Review {
  id                    String              @id @default(uuid()) @db.Uuid
  testSuiteId           String              @map("test_suite_id") @db.Uuid
  authorUserId          String?             @map("author_user_id") @db.Uuid
  authorAgentSessionId  String?             @map("author_agent_session_id") @db.Uuid
  status                ReviewSessionStatus @default(DRAFT)
  verdict               ReviewVerdict?
  summary               String?             @db.Text
  submittedAt           DateTime?           @map("submitted_at")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  testSuite    TestSuite      @relation(fields: [testSuiteId], references: [id], onDelete: Cascade)
  author       User?          @relation("ReviewAuthor", fields: [authorUserId], references: [id])
  agentSession AgentSession?  @relation("ReviewAgentSession", fields: [authorAgentSessionId], references: [id])
  comments     ReviewComment[]

  @@index([testSuiteId])
  @@index([testSuiteId, status])
  @@index([authorUserId])
  @@map("reviews")
}
```

### 排他制約（SQL）

```sql
-- authorUserId か authorAgentSessionId のどちらか一方のみ設定
ALTER TABLE "reviews" ADD CONSTRAINT "review_author_check"
  CHECK (
    (author_user_id IS NOT NULL AND author_agent_session_id IS NULL) OR
    (author_user_id IS NULL AND author_agent_session_id IS NOT NULL)
  );
```

---

## ReviewComment

レビューコメントを管理するテーブル。Review に紐付き、テストスイート/テストケースの特定のフィールドに対してコメント可能。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `reviewId` | UUID | NO | - | レビュー ID（外部キー） |
| `targetType` | ENUM | NO | - | 対象種別（SUITE, CASE） |
| `targetId` | UUID | NO | - | 対象 ID（テストスイート or テストケース） |
| `targetField` | ENUM | NO | - | 対象フィールド |
| `targetItemId` | UUID | YES | NULL | 対象アイテム ID（前提条件/手順/期待値の ID） |
| `authorUserId` | UUID | YES | NULL | 作成者ユーザー ID（外部キー）※1 |
| `authorAgentSessionId` | UUID | YES | NULL | 作成者 Agent セッション ID（外部キー）※1 |
| `content` | TEXT | NO | - | コメント内容 |
| `status` | ENUM | NO | OPEN | ステータス |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

※1: `authorUserId` と `authorAgentSessionId` はどちらか一方のみ設定（排他制約）

### 対象種別

| 種別 | 説明 |
|------|------|
| `SUITE` | テストスイート |
| `CASE` | テストケース |

### 対象フィールド

| フィールド | 説明 |
|------------|------|
| `TITLE` | タイトル |
| `DESCRIPTION` | 説明 |
| `PRECONDITION` | 前提条件 |
| `STEP` | 手順 |
| `EXPECTED_RESULT` | 期待値 |

### ステータス

| ステータス | 説明 |
|------------|------|
| `OPEN` | 未解決 |
| `RESOLVED` | 解決済み |

### Prisma スキーマ

```prisma
enum ReviewTargetType {
  SUITE
  CASE
}

enum ReviewTargetField {
  TITLE
  DESCRIPTION
  PRECONDITION
  STEP
  EXPECTED_RESULT
}

enum ReviewStatus {
  OPEN
  RESOLVED
}

model ReviewComment {
  id                   String             @id @default(uuid()) @db.Uuid
  reviewId             String             @map("review_id") @db.Uuid
  targetType           ReviewTargetType   @map("target_type")
  targetId             String             @map("target_id") @db.Uuid
  targetField          ReviewTargetField  @map("target_field")
  targetItemId         String?            @map("target_item_id") @db.Uuid
  authorUserId         String?            @map("author_user_id") @db.Uuid
  authorAgentSessionId String?            @map("author_agent_session_id") @db.Uuid
  content              String
  status               ReviewStatus       @default(OPEN)
  createdAt            DateTime           @default(now()) @map("created_at")
  updatedAt            DateTime           @updatedAt @map("updated_at")

  review             Review               @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  authorUser         User?                @relation(fields: [authorUserId], references: [id])
  authorAgentSession AgentSession?        @relation(fields: [authorAgentSessionId], references: [id])
  replies            ReviewCommentReply[]

  @@index([reviewId])
  @@index([targetType, targetId])
  @@index([targetType, targetId, targetField, targetItemId])
  @@map("review_comments")
}
```

### 排他制約（SQL）

```sql
-- authorUserId か authorAgentSessionId のどちらか一方のみ設定
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comment_author_check"
  CHECK (
    (author_user_id IS NOT NULL AND author_agent_session_id IS NULL) OR
    (author_user_id IS NULL AND author_agent_session_id IS NOT NULL)
  );
```

---

## ReviewCommentReply

レビューコメントへの返信を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `commentId` | UUID | NO | - | コメント ID（外部キー） |
| `authorUserId` | UUID | YES | NULL | 作成者ユーザー ID（外部キー）※1 |
| `authorAgentSessionId` | UUID | YES | NULL | 作成者 Agent セッション ID（外部キー）※1 |
| `content` | TEXT | NO | - | 返信内容 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

※1: `authorUserId` と `authorAgentSessionId` はどちらか一方のみ設定（排他制約）

### Prisma スキーマ

```prisma
model ReviewCommentReply {
  id                   String    @id @default(uuid()) @db.Uuid
  commentId            String    @map("comment_id") @db.Uuid
  authorUserId         String?   @map("author_user_id") @db.Uuid
  authorAgentSessionId String?   @map("author_agent_session_id") @db.Uuid
  content              String
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  comment            ReviewComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  authorUser         User?         @relation(fields: [authorUserId], references: [id])
  authorAgentSession AgentSession? @relation(fields: [authorAgentSessionId], references: [id])

  @@index([commentId])
  @@map("review_comment_replies")
}
```

### 排他制約（SQL）

```sql
-- authorUserId か authorAgentSessionId のどちらか一方のみ設定
ALTER TABLE "review_comment_replies" ADD CONSTRAINT "review_comment_reply_author_check"
  CHECK (
    (author_user_id IS NOT NULL AND author_agent_session_id IS NULL) OR
    (author_user_id IS NULL AND author_agent_session_id IS NOT NULL)
  );
```

---

## レビューワークフロー

```
1. ユーザーがレビューを開始
   └─▶ Review 作成（status: DRAFT）
   └─▶ 下書きは作成者本人のみ閲覧可能

2. ユーザーがコメントを追加（submit するまで非公開）
   └─▶ ReviewComment 作成（reviewId に紐付け）
   └─▶ 特定の項目（手順、期待値など）に対してコメント可能

3. ユーザーがレビューを提出
   └─▶ Review.status → SUBMITTED
   └─▶ Review.verdict 設定（APPROVED / CHANGES_REQUESTED / COMMENT_ONLY）
   └─▶ Review.submittedAt 設定
   └─▶ コメントが公開される

4. Agent がコメントを確認して修正

5. Agent がコメントに返信
   └─▶ ReviewCommentReply 作成

6. ユーザーが確認してコメントを解決済みにする
   └─▶ ReviewComment.status → RESOLVED
```

---

## コメント対象の例

### テストスイート全体へのコメント

```json
{
  "reviewId": "review-uuid-1",
  "targetType": "SUITE",
  "targetId": "suite-uuid-1",
  "targetField": "TITLE",
  "targetItemId": null,
  "content": "全体的にテストケースが不足しています"
}
```

### テストケース全体へのコメント

```json
{
  "reviewId": "review-uuid-1",
  "targetType": "CASE",
  "targetId": "case-uuid-1",
  "targetField": "TITLE",
  "targetItemId": null,
  "content": "このテストケースは境界値テストが必要です"
}
```

### テストケースの手順1へのコメント

```json
{
  "reviewId": "review-uuid-1",
  "targetType": "CASE",
  "targetId": "case-uuid-1",
  "targetField": "STEP",
  "targetItemId": "step-uuid-1",
  "content": "この手順は具体的な操作内容を記載してください"
}
```

### テストケースの期待値2へのコメント

```json
{
  "reviewId": "review-uuid-1",
  "targetType": "CASE",
  "targetId": "case-uuid-1",
  "targetField": "EXPECTED_RESULT",
  "targetItemId": "expected-uuid-2",
  "content": "期待値が曖昧です。具体的な値を記載してください"
}
```

---

## データ構造（階層表示）

```
Review
├── id
├── testSuiteId
├── authorUserId (ユーザーの場合)
├── authorAgentSessionId (Agent の場合)
├── status (DRAFT / SUBMITTED)
├── verdict (APPROVED / CHANGES_REQUESTED / COMMENT_ONLY)
├── summary
├── submittedAt
├── createdAt
└── comments[]
    └── ReviewComment
        ├── id
        ├── reviewId
        ├── targetType (SUITE / CASE)
        ├── targetId
        ├── targetField (TITLE / DESCRIPTION / PRECONDITION / STEP / EXPECTED_RESULT)
        ├── targetItemId (前提条件/手順/期待値の ID)
        ├── authorUserId (ユーザーの場合)
        ├── authorAgentSessionId (Agent の場合)
        ├── content
        ├── status (OPEN / RESOLVED)
        ├── createdAt
        └── replies[]
            └── ReviewCommentReply
                ├── id
                ├── commentId
                ├── authorUserId (ユーザーの場合)
                ├── authorAgentSessionId (Agent の場合)
                ├── content
                └── createdAt
```

---

## UI での表示イメージ

### レビュータブ

```
┌─────────────────────────────────────────────────────────────────┐
│ [レビューを開始]                    フィルター: [すべて ▼]        │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 田中太郎                           2024/01/15 14:30        │ │
│ │ ✅ 承認                                                    │ │
│ │ 問題ありません。このまま進めてください。                    │ │
│ │ 💬 3件のコメント                              [詳細→]     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 佐藤花子                           2024/01/14 10:00        │ │
│ │ ⚠ 要修正                                                   │ │
│ │ 以下の点を修正してください...                              │ │
│ │ 💬 5件のコメント                              [詳細→]     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### レビュー中バー

```
┌─────────────────────────────────────────────────────────────────┐
│ 📝 レビュー中 │ コメント: 3件 │      [キャンセル] [レビューを提出] │
└─────────────────────────────────────────────────────────────────┘
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| RV-001 | レビュー開始 | テストスイートに対するレビューセッションを開始（DRAFT 作成） |
| RV-002 | レビュー提出 | 下書きレビューを提出（評価選択） |
| RV-003 | レビュー削除 | 下書きレビューの削除（DRAFT のみ） |
| RV-004 | レビュー一覧 | 提出済みレビューの一覧表示 |
| RV-005 | レビュー詳細 | レビューの詳細とコメント一覧の表示 |
| RV-006 | 下書き一覧 | 自分の下書きレビュー一覧の取得 |
| RC-001 | コメント追加 | レビューにコメントを追加 |
| RC-002 | 返信 | コメントへの返信（スレッド形式） |
| RC-003 | コメント編集 | 投稿者本人によるコメント編集 |
| RC-004 | コメント削除 | 投稿者本人によるコメント削除 |
| RC-005 | ステータス変更 | OPEN/RESOLVED の切り替え |
| TS-005 | テストスイートレビュー | レビューコメントの登録・返信 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [テストスイート](./test-suite.md)
- [テストケース](./test-case.md)
- [Agent セッション](./agent-session.md)
- [レビュー機能仕様](../features/review-comment.md)
