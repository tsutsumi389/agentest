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
| `createdBy` | UUID | NO | - | 作成者 ID |
| `createdByType` | ENUM | NO | USER | 作成者種別（USER, AGENT） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |
| `deletedAt` | TIMESTAMP | YES | NULL | 削除日時（論理削除） |

### ステータス

| ステータス | 説明 |
|------------|------|
| `DRAFT` | 下書き |
| `ACTIVE` | 有効 |
| `ARCHIVED` | アーカイブ済み |

### Prisma スキーマ

```prisma
enum TestSuiteStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

model TestSuite {
  id            String          @id @default(uuid()) @db.Uuid
  projectId     String          @db.Uuid
  name          String          @db.VarChar(200)
  description   String?
  status        TestSuiteStatus @default(DRAFT)
  createdBy     String          @db.Uuid
  createdByType ActorType       @default(USER)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  deletedAt     DateTime?

  project       Project                 @relation(fields: [projectId], references: [id], onDelete: Cascade)
  preconditions TestSuitePrecondition[]
  testCases     TestCase[]
  histories     TestSuiteHistory[]
  executions    Execution[]

  @@index([projectId])
}
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
| `orderIndex` | INTEGER | NO | - | 表示順序 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### Prisma スキーマ

```prisma
model TestSuitePrecondition {
  id          String   @id @default(uuid()) @db.Uuid
  testSuiteId String   @db.Uuid
  content     String
  orderIndex  Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  testSuite TestSuite @relation(fields: [testSuiteId], references: [id], onDelete: Cascade)

  @@index([testSuiteId])
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
| `changedBy` | UUID | NO | - | 変更者 ID |
| `changedByType` | ENUM | NO | - | 変更者種別（USER, AGENT） |
| `changeType` | ENUM | NO | - | 変更種別（CREATE, UPDATE, DELETE） |
| `snapshot` | JSONB | NO | - | 変更時点のスナップショット |
| `changeReason` | TEXT | YES | NULL | 変更理由 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### スナップショット構造

```json
{
  "name": "テストスイート名",
  "description": "説明",
  "status": "ACTIVE",
  "preconditions": [
    {
      "content": "前提条件1",
      "orderIndex": 0
    },
    {
      "content": "前提条件2",
      "orderIndex": 1
    }
  ]
}
```

### Prisma スキーマ

```prisma
model TestSuiteHistory {
  id            String     @id @default(uuid()) @db.Uuid
  testSuiteId   String     @db.Uuid
  changedBy     String     @db.Uuid
  changedByType ActorType
  changeType    ChangeType
  snapshot      Json
  changeReason  String?
  createdAt     DateTime   @default(now())

  testSuite TestSuite @relation(fields: [testSuiteId], references: [id], onDelete: Cascade)

  @@index([testSuiteId])
}
```

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
