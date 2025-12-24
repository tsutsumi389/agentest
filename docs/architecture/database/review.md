# レビューコメント テーブル

## 概要

テストスイート・テストケースに対するレビューコメントを管理するテーブル群。GitHub のようにテストケースの詳細な項目（手順1、期待値2など）に対してコメント可能。スレッド形式で返信が可能。

## ReviewComment

レビューコメントを管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `targetType` | ENUM | NO | - | 対象種別（SUITE, CASE） |
| `targetId` | UUID | NO | - | 対象 ID（テストスイート or テストケース） |
| `targetField` | ENUM | YES | NULL | 対象フィールド（詳細項目へのコメント時） |
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

### 対象フィールド（詳細項目へのコメント時）

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
  targetType           ReviewTargetType
  targetId             String             @db.Uuid
  targetField          ReviewTargetField?
  targetItemId         String?            @db.Uuid
  authorUserId         String?            @db.Uuid
  authorAgentSessionId String?            @db.Uuid
  content              String
  status               ReviewStatus       @default(OPEN)
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  authorUser         User?                @relation(fields: [authorUserId], references: [id])
  authorAgentSession AgentSession?        @relation(fields: [authorAgentSessionId], references: [id])
  replies            ReviewCommentReply[]

  @@index([targetType, targetId])
  @@index([targetType, targetId, targetField, targetItemId])
}
```

### 排他制約（SQL）

```sql
-- authorUserId か authorAgentSessionId のどちらか一方のみ設定
ALTER TABLE "ReviewComment" ADD CONSTRAINT "review_comment_author_check"
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
  commentId            String    @db.Uuid
  authorUserId         String?   @db.Uuid
  authorAgentSessionId String?   @db.Uuid
  content              String
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  comment            ReviewComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  authorUser         User?         @relation(fields: [authorUserId], references: [id])
  authorAgentSession AgentSession? @relation(fields: [authorAgentSessionId], references: [id])

  @@index([commentId])
}
```

### 排他制約（SQL）

```sql
-- authorUserId か authorAgentSessionId のどちらか一方のみ設定
ALTER TABLE "ReviewCommentReply" ADD CONSTRAINT "review_comment_reply_author_check"
  CHECK (
    (author_user_id IS NOT NULL AND author_agent_session_id IS NULL) OR
    (author_user_id IS NULL AND author_agent_session_id IS NOT NULL)
  );
```

---

## コメント対象の例

### テストスイート全体へのコメント

```json
{
  "targetType": "SUITE",
  "targetId": "suite-uuid-1",
  "targetField": null,
  "targetItemId": null,
  "content": "全体的にテストケースが不足しています"
}
```

### テストケース全体へのコメント

```json
{
  "targetType": "CASE",
  "targetId": "case-uuid-1",
  "targetField": null,
  "targetItemId": null,
  "content": "このテストケースは境界値テストが必要です"
}
```

### テストケースの手順1へのコメント

```json
{
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
  "targetType": "CASE",
  "targetId": "case-uuid-1",
  "targetField": "EXPECTED_RESULT",
  "targetItemId": "expected-uuid-2",
  "content": "期待値が曖昧です。具体的な値を記載してください"
}
```

### テストスイートの前提条件へのコメント

```json
{
  "targetType": "SUITE",
  "targetId": "suite-uuid-1",
  "targetField": "PRECONDITION",
  "targetItemId": "precond-uuid-1",
  "content": "この前提条件は環境依存があります"
}
```

---

## レビューワークフロー

```
1. Agent がテストケースを作成・編集
2. 人がレビューコメントを登録
   └─▶ ReviewComment 作成（status: OPEN）
   └─▶ 特定の項目（手順、期待値など）に対してコメント可能
3. Agent がコメントを確認して修正
4. Agent がコメントに返信（対応内容を説明）
   └─▶ ReviewCommentReply 作成
5. 人が確認してコメントを解決済みにする
   └─▶ ReviewComment.status → RESOLVED
```

---

## コメント構造（階層表示）

```
ReviewComment
├── id
├── targetType (SUITE / CASE)
├── targetId
├── targetField (TITLE / DESCRIPTION / PRECONDITION / STEP / EXPECTED_RESULT)
├── targetItemId (前提条件/手順/期待値の ID)
├── authorUserId (人の場合)
├── authorAgentSessionId (Agent の場合)
├── content
├── status (OPEN / RESOLVED)
├── createdAt
└── replies[]
    └── ReviewCommentReply
        ├── id
        ├── commentId
        ├── authorUserId (人の場合)
        ├── authorAgentSessionId (Agent の場合)
        ├── content
        └── createdAt
```

---

## UI での表示イメージ

```
┌─────────────────────────────────────────────────────────────────┐
│ テストケース: ログイン機能の正常系テスト                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 前提条件:                                                       │
│   1. ユーザーアカウントが存在すること 💬(1)                       │
│   2. ユーザーがログアウト状態であること                            │
│                                                                 │
│ 手順:                                                           │
│   1. ログインページを開く                                        │
│   2. ユーザー名を入力する 💬(2)                                   │
│      └─ 💬 [Agent] 「具体的なユーザー名を記載してください」        │
│         └─ ↳ [User] 「test@example.com を使用します」            │
│         └─ ↳ [Agent] 「修正しました」 ✅ Resolved                │
│   3. パスワードを入力する                                        │
│   4. ログインボタンをクリックする                                 │
│                                                                 │
│ 期待値:                                                         │
│   1. ダッシュボード画面が表示されること                           │
│   2. ユーザー名が右上に表示されること 💬(1)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| RC-001 | コメント登録 | テストスイート・テストケースにレビューコメントを登録 |
| RC-002 | コメント返信 | レビューコメントに対する返信（スレッド形式） |
| RC-003 | Agent コメント確認 | Coding Agent のレビューコメントを確認 |
| RC-004 | コメント対応修正 | レビューコメントに対応した修正を実施 |
| RC-005 | コメント解決 | 対応完了したコメントを解決済みにする |
| TS-005 | テストスイートレビュー | レビューコメントの登録・返信 |
| TC-006 | テストケースレビュー | レビューコメントの登録・返信 |
| AG-005 | Agent 作成レビュー | Agent が作成・編集した内容をレビュー・承認 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [テストスイート](./test-suite.md)
- [テストケース](./test-case.md)
- [Agent セッション](./agent-session.md)
