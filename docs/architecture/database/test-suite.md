# テストスイート テーブル

## 概要

テストスイート（テストケースのグループ）を管理するテーブル群。

## TestSuite

テストスイートを管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `projectId` | UUID | NO | - | プロジェクト ID（外部キー） |
| `name` | VARCHAR(200) | NO | - | テストスイート名 |
| `description` | TEXT | YES | NULL | 説明 |
| `status` | ENUM | NO | DRAFT | ステータス |
| `createdByUserId` | UUID | YES | NULL | 作成者ユーザー ID（外部キー）※1 |
| `createdByAgentSessionId` | UUID | YES | NULL | 作成者 Agent セッション ID（外部キー）※1 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |
| `deletedAt` | TIMESTAMP | YES | NULL | 削除日時（論理削除） |

※1: `createdByUserId` と `createdByAgentSessionId` はどちらか一方のみ設定（排他制約）

### ステータス

| ステータス | 説明 |
|------------|------|
| `DRAFT` | 下書き |
| `ACTIVE` | 有効 |
| `ARCHIVED` | アーカイブ済み |

### Prisma スキーマ

```prisma
// EntityStatus は TestSuite / TestCase 共通の ENUM
enum EntityStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

model TestSuite {
  id                      String       @id @default(uuid()) @db.Uuid
  projectId               String       @db.Uuid
  name                    String       @db.VarChar(200)
  description             String?
  status                  EntityStatus @default(DRAFT)
  createdByUserId         String?         @db.Uuid
  createdByAgentSessionId String?         @db.Uuid
  createdAt               DateTime        @default(now())
  updatedAt               DateTime        @updatedAt
  deletedAt               DateTime?

  project             Project                 @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdByUser       User?                   @relation(fields: [createdByUserId], references: [id])
  createdByAgentSession AgentSession?         @relation(fields: [createdByAgentSessionId], references: [id])
  preconditions       TestSuitePrecondition[]
  testCases           TestCase[]
  histories           TestSuiteHistory[]
  executions          Execution[]

  @@index([projectId])
}
```

### 排他制約（SQL）

```sql
-- createdByUserId か createdByAgentSessionId のどちらか一方のみ設定
ALTER TABLE "TestSuite" ADD CONSTRAINT "test_suite_creator_check"
  CHECK (
    (created_by_user_id IS NOT NULL AND created_by_agent_session_id IS NULL) OR
    (created_by_user_id IS NULL AND created_by_agent_session_id IS NOT NULL)
  );
```

---

## TestSuitePrecondition

テストスイートの前提条件を管理するテーブル。1つのテストスイートに複数の前提条件を設定可能。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `testSuiteId` | UUID | NO | - | テストスイート ID（外部キー） |
| `content` | TEXT | NO | - | 前提条件の内容 |
| `orderKey` | VARCHAR(255) | NO | - | 表示順序キー（Fractional Indexing） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### 順序管理（Fractional Indexing）

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

### Prisma スキーマ

```prisma
model TestSuitePrecondition {
  id          String   @id @default(uuid()) @db.Uuid
  testSuiteId String   @db.Uuid
  content     String
  orderKey    String   @db.VarChar(255)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  testSuite TestSuite @relation(fields: [testSuiteId], references: [id], onDelete: Cascade)

  @@index([testSuiteId])
  @@index([testSuiteId, orderKey])
}
```

---

## TestSuiteHistory

テストスイートの変更履歴を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `testSuiteId` | UUID | NO | - | テストスイート ID（外部キー） |
| `changedByUserId` | UUID | YES | NULL | 変更者ユーザー ID（外部キー）※1 |
| `changedByAgentSessionId` | UUID | YES | NULL | 変更者 Agent セッション ID（外部キー）※1 |
| `changeType` | ENUM | NO | - | 変更種別（CREATE, UPDATE, DELETE, RESTORE） |
| `snapshot` | JSONB | NO | - | 変更時点のスナップショット |
| `changeReason` | TEXT | YES | NULL | 変更理由 |
| `groupId` | VARCHAR(36) | YES | NULL | 変更グループID |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

※1: `changedByUserId` と `changedByAgentSessionId` はどちらか一方のみ設定（排他制約）

### スナップショット構造

```json
{
  "name": "テストスイート名",
  "description": "説明",
  "status": "ACTIVE",
  "preconditions": [
    {
      "id": "uuid-1",
      "content": "前提条件1",
      "orderKey": "a"
    },
    {
      "id": "uuid-2",
      "content": "前提条件2",
      "orderKey": "b"
    }
  ]
}
```

### Prisma スキーマ

```prisma
model TestSuiteHistory {
  id                      String     @id @default(uuid()) @db.Uuid
  testSuiteId             String     @db.Uuid
  changedByUserId         String?    @db.Uuid
  changedByAgentSessionId String?    @db.Uuid
  changeType              ChangeType
  snapshot                Json
  changeReason            String?
  groupId                 String?    @map("group_id") @db.VarChar(36)
  createdAt               DateTime   @default(now())

  testSuite             TestSuite     @relation(fields: [testSuiteId], references: [id], onDelete: Cascade)
  changedByUser         User?         @relation(fields: [changedByUserId], references: [id])
  changedByAgentSession AgentSession? @relation(fields: [changedByAgentSessionId], references: [id])

  @@index([testSuiteId])
  @@index([testSuiteId, groupId])
  @@index([createdAt])
}
```

### 排他制約（SQL）

```sql
-- changedByUserId か changedByAgentSessionId のどちらか一方のみ設定
ALTER TABLE "TestSuiteHistory" ADD CONSTRAINT "test_suite_history_changer_check"
  CHECK (
    (changed_by_user_id IS NOT NULL AND changed_by_agent_session_id IS NULL) OR
    (changed_by_user_id IS NULL AND changed_by_agent_session_id IS NOT NULL)
  );
```

### groupId（変更グループ ID）

同一トランザクション内で行われた複数の変更を1つのグループとしてまとめるための ID。

#### 用途

- **一括更新のグループ化**: テストスイートの基本情報と前提条件を同時に更新した場合、同じ groupId が付与される
- **履歴表示の統合**: フロントエンドで同じ groupId を持つ履歴レコードを1つの更新として表示
- **カテゴリ別分類**: グループ内の変更を基本情報/前提条件の2カテゴリに分類して表示

#### 仕様

| 項目 | 値 |
|------|-----|
| 形式 | UUID v4（36文字） |
| 生成タイミング | 履歴作成時に自動生成、または呼び出し元から指定 |
| 既存データ | NULL（グループ化されていない単独の変更） |

#### グループ化のイメージ

```
┌─────────────────────────────────────────────────┐
│ groupId = "abc-123-..."                         │
├─────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────────────────────┐ │
│ │ 基本情報     │ │ 前提条件                    │ │
│ │ BASIC_INFO  │ │ PRECONDITION_ADD/UPDATE/    │ │
│ │ _UPDATE     │ │ DELETE/REORDER              │ │
│ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                       ↓
           フロントエンドで1つの更新として表示
```

#### changeDetail 型

スナップショット内に格納される変更詳細情報。

| type | 説明 |
|------|------|
| `BASIC_INFO_UPDATE` | 基本情報（名前、説明、ステータス）の変更 |
| `PRECONDITION_ADD` | 前提条件の追加 |
| `PRECONDITION_UPDATE` | 前提条件の更新 |
| `PRECONDITION_DELETE` | 前提条件の削除 |
| `PRECONDITION_REORDER` | 前提条件の並び替え |
| `TEST_CASE_REORDER` | テストケースの並び替え |

---

## 履歴管理

### 履歴保持ルール

| 項目 | 要件 |
|------|------|
| 履歴保持期間 | 無期限（ストレージ容量による制限） |
| 履歴件数上限 | エンティティあたり 1,000 件（超過時は古いものを削除） |

### 履歴活用機能

- **履歴一覧表示**: 変更履歴を時系列で表示
- **差分表示**: 任意の2バージョン間の差分を表示
- **バージョン復元**: 任意のバージョンの内容に復元
- **Agent 変更の一括リバート**: Agent による変更を一括で取り消し

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| TS-001 | テストスイート作成 | プロジェクト内にテストスイートを作成 |
| TS-002 | テストスイート前提条件 | スイート単位の前提条件を複数登録 |
| TS-003 | テストスイート一覧 | プロジェクト内のスイート一覧表示 |
| TS-004 | テストスイート履歴 | 変更履歴を保持し、任意のバージョンに復元可能 |
| TS-005 | テストスイートレビュー | レビューコメントの登録・返信 |
| TS-006 | テストスイート削除 | テストスイートを削除（論理削除） |
| TS-007 | テストスイート検索 | スイート名・前提条件で検索 |
| TS-008 | テストスイートフィルタ | ステータス・作成者・更新日でフィルタ |
| AG-001 | Agent テストスイート作成 | Coding Agent がテストスイートを作成 |
| AG-002 | Agent テストスイート編集 | Coding Agent がテストスイートを編集 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [組織・プロジェクト](./organization.md)
- [テストケース](./test-case.md)
- [テスト実行](./execution.md)
- [Agent セッション](./agent-session.md)
