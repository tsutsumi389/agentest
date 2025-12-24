# テストケース テーブル

## 概要

テストケースとその構成要素（前提条件・手順・期待値）を管理するテーブル群。

## TestCase

テストケースを管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `testSuiteId` | UUID | NO | - | テストスイート ID（外部キー） |
| `title` | VARCHAR(300) | NO | - | テストケースタイトル |
| `description` | TEXT | YES | NULL | 説明 |
| `priority` | ENUM | NO | MEDIUM | 優先度 |
| `status` | ENUM | NO | DRAFT | ステータス |
| `orderKey` | VARCHAR(255) | NO | - | 表示順序キー（Fractional Indexing） |
| `createdByUserId` | UUID | YES | NULL | 作成者ユーザー ID（外部キー）※1 |
| `createdByAgentSessionId` | UUID | YES | NULL | 作成者 Agent セッション ID（外部キー）※1 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |
| `deletedAt` | TIMESTAMP | YES | NULL | 削除日時（論理削除） |

※1: `createdByUserId` と `createdByAgentSessionId` はどちらか一方のみ設定（排他制約）

### 優先度

| 優先度 | 説明 |
|--------|------|
| `CRITICAL` | 最重要 |
| `HIGH` | 高 |
| `MEDIUM` | 中 |
| `LOW` | 低 |

### ステータス

| ステータス | 説明 |
|------------|------|
| `DRAFT` | 下書き |
| `ACTIVE` | 有効 |
| `ARCHIVED` | アーカイブ済み |

### Prisma スキーマ

```prisma
enum TestCasePriority {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum TestCaseStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

model TestCase {
  id                      String           @id @default(uuid()) @db.Uuid
  testSuiteId             String           @db.Uuid
  title                   String           @db.VarChar(300)
  description             String?
  priority                TestCasePriority @default(MEDIUM)
  status                  TestCaseStatus   @default(DRAFT)
  orderKey                String           @db.VarChar(255)
  createdByUserId         String?          @db.Uuid
  createdByAgentSessionId String?          @db.Uuid
  createdAt               DateTime         @default(now())
  updatedAt               DateTime         @updatedAt
  deletedAt               DateTime?

  testSuite             TestSuite                 @relation(fields: [testSuiteId], references: [id], onDelete: Cascade)
  createdByUser         User?                     @relation(fields: [createdByUserId], references: [id])
  createdByAgentSession AgentSession?             @relation(fields: [createdByAgentSessionId], references: [id])
  preconditions         TestCasePrecondition[]
  steps                 TestCaseStep[]
  expectedResults       TestCaseExpectedResult[]
  histories             TestCaseHistory[]

  @@index([testSuiteId])
  @@index([testSuiteId, orderKey])
}
```

---

## TestCasePrecondition

テストケースの前提条件を管理するテーブル。1つのテストケースに複数の前提条件を設定可能。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `testCaseId` | UUID | NO | - | テストケース ID（外部キー） |
| `content` | TEXT | NO | - | 前提条件の内容 |
| `orderKey` | VARCHAR(255) | NO | - | 表示順序キー（Fractional Indexing） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### Prisma スキーマ

```prisma
model TestCasePrecondition {
  id         String   @id @default(uuid()) @db.Uuid
  testCaseId String   @db.Uuid
  content    String
  orderKey   String   @db.VarChar(255)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  testCase TestCase @relation(fields: [testCaseId], references: [id], onDelete: Cascade)

  @@index([testCaseId])
  @@index([testCaseId, orderKey])
}
```

---

## TestCaseStep

テストケースの手順を管理するテーブル。1つのテストケースに複数の手順を設定可能。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `testCaseId` | UUID | NO | - | テストケース ID（外部キー） |
| `content` | TEXT | NO | - | 手順の内容 |
| `orderKey` | VARCHAR(255) | NO | - | 表示順序キー（Fractional Indexing） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### Prisma スキーマ

```prisma
model TestCaseStep {
  id         String   @id @default(uuid()) @db.Uuid
  testCaseId String   @db.Uuid
  content    String
  orderKey   String   @db.VarChar(255)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  testCase TestCase @relation(fields: [testCaseId], references: [id], onDelete: Cascade)

  @@index([testCaseId])
  @@index([testCaseId, orderKey])
}
```

---

## TestCaseExpectedResult

テストケースの期待値を管理するテーブル。1つのテストケースに複数の期待値を設定可能。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `testCaseId` | UUID | NO | - | テストケース ID（外部キー） |
| `content` | TEXT | NO | - | 期待値の内容 |
| `orderKey` | VARCHAR(255) | NO | - | 表示順序キー（Fractional Indexing） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### Prisma スキーマ

```prisma
model TestCaseExpectedResult {
  id         String   @id @default(uuid()) @db.Uuid
  testCaseId String   @db.Uuid
  content    String
  orderKey   String   @db.VarChar(255)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  testCase TestCase @relation(fields: [testCaseId], references: [id], onDelete: Cascade)

  @@index([testCaseId])
  @@index([testCaseId, orderKey])
}
```

---

## TestCaseHistory

テストケースの変更履歴を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `testCaseId` | UUID | NO | - | テストケース ID（外部キー） |
| `changedByUserId` | UUID | YES | NULL | 変更者ユーザー ID（外部キー）※1 |
| `changedByAgentSessionId` | UUID | YES | NULL | 変更者 Agent セッション ID（外部キー）※1 |
| `changeType` | ENUM | NO | - | 変更種別（CREATE, UPDATE, DELETE） |
| `snapshot` | JSONB | NO | - | 変更時点のスナップショット |
| `changeReason` | TEXT | YES | NULL | 変更理由 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

※1: `changedByUserId` と `changedByAgentSessionId` はどちらか一方のみ設定（排他制約）

### スナップショット構造

```json
{
  "title": "テストケースタイトル",
  "description": "説明",
  "priority": "HIGH",
  "status": "ACTIVE",
  "orderKey": "a",
  "preconditions": [
    {
      "id": "uuid-1",
      "content": "ユーザーがログイン済みであること",
      "orderKey": "a"
    }
  ],
  "steps": [
    {
      "id": "uuid-2",
      "content": "ダッシュボード画面を開く",
      "orderKey": "a"
    },
    {
      "id": "uuid-3",
      "content": "「設定」ボタンをクリックする",
      "orderKey": "b"
    }
  ],
  "expectedResults": [
    {
      "id": "uuid-4",
      "content": "設定画面が表示されること",
      "orderKey": "a"
    }
  ]
}
```

### Prisma スキーマ

```prisma
model TestCaseHistory {
  id                      String     @id @default(uuid()) @db.Uuid
  testCaseId              String     @db.Uuid
  changedByUserId         String?    @db.Uuid
  changedByAgentSessionId String?    @db.Uuid
  changeType              ChangeType
  snapshot                Json
  changeReason            String?
  createdAt               DateTime   @default(now())

  testCase              TestCase      @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
  changedByUser         User?         @relation(fields: [changedByUserId], references: [id])
  changedByAgentSession AgentSession? @relation(fields: [changedByAgentSessionId], references: [id])

  @@index([testCaseId])
}
```

---

## 順序管理（Fractional Indexing）

間への挿入時に後続要素の更新が不要な方式を採用。

```
初期状態:
  項目A: "a"
  項目B: "b"
  項目C: "c"

AとBの間に挿入:
  項目A: "a"
  項目X: "aV"  ← 新規挿入
  項目B: "b"
  項目C: "c"
```

### 実装ライブラリ

- JavaScript: [fractional-indexing](https://github.com/rocicorp/fractional-indexing)
- その他言語: 同等のアルゴリズムを実装

---

## テストケース参照入力（TC-004）

`@テストスイート/テストケース` 形式で他のテストケースを参照・コピーする機能。

### 動作フロー

1. テストケースのタイトル入力欄で `@` を入力
2. テストスイート名の候補をリスト表示
3. スイート選択後 `/` を入力
4. テストケース名の候補をリスト表示
5. 選択するとそのテストケースの内容をコピー

### 入力例

```
@ログイン機能/正常系ログイン
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| TC-001 | テストケース作成 | テストスイート内にテストケースを作成 |
| TC-002 | テストケース構造 | 前提条件・手順・期待値を別テーブルで管理 |
| TC-003 | テストケースコピー | 同一プロジェクト内のテストケースをコピー |
| TC-004 | テストケース参照入力 | `@テストスイート/テストケース` 形式で参照 |
| TC-005 | テストケース履歴 | 変更履歴を保持し、任意のバージョンに復元可能 |
| TC-006 | テストケースレビュー | レビューコメントの登録・返信 |
| TC-007 | テストケース削除 | テストケースを削除（論理削除） |
| TC-008 | テストケース検索 | タイトル・手順・期待値で全文検索 |
| TC-009 | テストケースフィルタ | ステータス・作成者・更新日でフィルタ |
| TC-010 | テストケースソート | 作成日・更新日・タイトルでソート |
| AG-003 | Agent テストケース作成 | Coding Agent がテストケースを作成 |
| AG-004 | Agent テストケース編集 | Coding Agent がテストケースを編集 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [テストスイート](./test-suite.md)
- [テスト実行](./execution.md)
- [レビュー](./review.md)
- [Agent セッション](./agent-session.md)
