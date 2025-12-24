# レビューコメント テーブル

## 概要

テストスイート・テストケースに対するレビューコメントを管理するテーブル群。スレッド形式で返信が可能。

## ReviewComment

レビューコメントを管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `targetType` | ENUM | NO | - | 対象種別（SUITE, CASE） |
| `targetId` | UUID | NO | - | 対象 ID（テストスイート or テストケース） |
| `authorId` | UUID | NO | - | 作成者 ID |
| `authorType` | ENUM | NO | USER | 作成者種別（USER, AGENT） |
| `content` | TEXT | NO | - | コメント内容 |
| `status` | ENUM | NO | OPEN | ステータス |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### 対象種別

| 種別 | 説明 |
|------|------|
| `SUITE` | テストスイート |
| `CASE` | テストケース |

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

enum ReviewStatus {
  OPEN
  RESOLVED
}

model ReviewComment {
  id         String           @id @default(uuid()) @db.Uuid
  targetType ReviewTargetType
  targetId   String           @db.Uuid
  authorId   String           @db.Uuid
  authorType ActorType        @default(USER)
  content    String
  status     ReviewStatus     @default(OPEN)
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  author  User                 @relation(fields: [authorId], references: [id])
  replies ReviewCommentReply[]

  @@index([targetType, targetId])
}
```

---

## ReviewCommentReply

レビューコメントへの返信を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `commentId` | UUID | NO | - | コメント ID（外部キー） |
| `authorId` | UUID | NO | - | 作成者 ID |
| `authorType` | ENUM | NO | USER | 作成者種別（USER, AGENT） |
| `content` | TEXT | NO | - | 返信内容 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### Prisma スキーマ

```prisma
model ReviewCommentReply {
  id         String    @id @default(uuid()) @db.Uuid
  commentId  String    @db.Uuid
  authorId   String    @db.Uuid
  authorType ActorType @default(USER)
  content    String
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  comment ReviewComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  author  User          @relation(fields: [authorId], references: [id])

  @@index([commentId])
}
```

---

## レビューワークフロー

```
1. Agent がテストケースを作成・編集
2. 人がレビューコメントを登録
   └─▶ ReviewComment 作成（status: OPEN）
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
├── authorId (人 or Agent)
├── authorType (USER / AGENT)
├── content
├── status (OPEN / RESOLVED)
├── createdAt
└── replies[]
    └── ReviewCommentReply
        ├── id
        ├── commentId
        ├── authorId
        ├── authorType (USER / AGENT)
        ├── content
        └── createdAt
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
