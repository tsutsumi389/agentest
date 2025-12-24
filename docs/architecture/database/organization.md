# 組織・プロジェクト テーブル

## 概要

組織（チーム）とプロジェクトを管理するテーブル。プロジェクトは組織または個人ユーザーに所属する。

## Organization

組織（チーム）を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `name` | VARCHAR(100) | NO | - | 組織名 |
| `slug` | VARCHAR(100) | NO | - | URL スラッグ（一意） |
| `description` | TEXT | YES | NULL | 組織の説明 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |
| `deletedAt` | TIMESTAMP | YES | NULL | 削除日時（論理削除） |

### 制約

- `slug` は一意

### Prisma スキーマ

```prisma
model Organization {
  id          String    @id @default(uuid()) @db.Uuid
  name        String    @db.VarChar(100)
  slug        String    @unique @db.VarChar(100)
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  members  OrganizationMember[]
  projects Project[]
}
```

---

## OrganizationMember

組織とユーザーの多対多関係を管理する中間テーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `organizationId` | UUID | NO | - | 組織 ID（外部キー） |
| `userId` | UUID | NO | - | ユーザー ID（外部キー） |
| `role` | ENUM | NO | MEMBER | 権限（OWNER, ADMIN, MEMBER） |
| `joinedAt` | TIMESTAMP | NO | now() | 参加日時 |

### 制約

- `organizationId` + `userId` は一意

### 権限レベル

| ロール | 説明 |
|--------|------|
| `OWNER` | 組織オーナー。全権限 + 組織削除 |
| `ADMIN` | 管理者。メンバー管理 + プロジェクト管理 |
| `MEMBER` | メンバー。プロジェクトへの参加 |

### Prisma スキーマ

```prisma
enum OrganizationRole {
  OWNER
  ADMIN
  MEMBER
}

model OrganizationMember {
  id             String           @id @default(uuid()) @db.Uuid
  organizationId String           @db.Uuid
  userId         String           @db.Uuid
  role           OrganizationRole @default(MEMBER)
  joinedAt       DateTime         @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
}
```

---

## Project

プロジェクトを管理するテーブル。組織または個人ユーザーに所属。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `name` | VARCHAR(100) | NO | - | プロジェクト名 |
| `description` | TEXT | YES | NULL | プロジェクトの説明 |
| `organizationId` | UUID | YES | NULL | 組織 ID（外部キー）※1 |
| `ownerId` | UUID | YES | NULL | オーナー ID（外部キー）※1 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |
| `deletedAt` | TIMESTAMP | YES | NULL | 削除日時（論理削除） |

※1: `organizationId` と `ownerId` はどちらか一方のみ設定（排他制約）

### 制約

- `organizationId` か `ownerId` のどちらか一方が必ず設定される（排他制約）
- 同一組織内でプロジェクト名は一意
- 同一オーナー内でプロジェクト名は一意

### Prisma スキーマ

```prisma
model Project {
  id             String    @id @default(uuid()) @db.Uuid
  name           String    @db.VarChar(100)
  description    String?
  organizationId String?   @db.Uuid
  ownerId        String?   @db.Uuid
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  organization Organization?    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  owner        User?            @relation("ProjectOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  testSuites   TestSuite[]
  histories    ProjectHistory[]

  @@index([organizationId])
  @@index([ownerId])
}
```

### 排他制約（SQL）

```sql
-- organizationId か ownerId のどちらか一方のみ設定
ALTER TABLE "Project" ADD CONSTRAINT "project_owner_check"
  CHECK (
    (organization_id IS NOT NULL AND owner_id IS NULL) OR
    (organization_id IS NULL AND owner_id IS NOT NULL)
  );
```

---

## ProjectHistory

プロジェクトの変更履歴を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `projectId` | UUID | NO | - | プロジェクト ID（外部キー） |
| `changedByUserId` | UUID | YES | NULL | 変更者ユーザー ID（外部キー）※1 |
| `changedByAgentSessionId` | UUID | YES | NULL | 変更者 Agent セッション ID（外部キー）※1 |
| `changeType` | ENUM | NO | - | 変更種別（CREATE, UPDATE, DELETE） |
| `snapshot` | JSONB | NO | - | 変更時点のスナップショット |
| `changeReason` | TEXT | YES | NULL | 変更理由 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

※1: `changedByUserId` と `changedByAgentSessionId` はどちらか一方のみ設定（排他制約）

### 変更種別

| 種別 | 説明 |
|------|------|
| `CREATE` | 新規作成 |
| `UPDATE` | 更新 |
| `DELETE` | 削除 |

### スナップショット構造

```json
{
  "name": "プロジェクト名",
  "description": "プロジェクトの説明",
  "organizationId": "uuid",
  "ownerId": null
}
```

### Prisma スキーマ

```prisma
enum ChangeType {
  CREATE
  UPDATE
  DELETE
}

model ProjectHistory {
  id                      String     @id @default(uuid()) @db.Uuid
  projectId               String     @db.Uuid
  changedByUserId         String?    @db.Uuid
  changedByAgentSessionId String?    @db.Uuid
  changeType              ChangeType
  snapshot                Json
  changeReason            String?
  createdAt               DateTime   @default(now())

  project               Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  changedByUser         User?         @relation(fields: [changedByUserId], references: [id])
  changedByAgentSession AgentSession? @relation(fields: [changedByAgentSessionId], references: [id])

  @@index([projectId])
}
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| PRJ-001 | プロジェクト作成 | ユーザーまたは組織に所属するプロジェクトを作成 |
| PRJ-002 | プロジェクト一覧 | 所属するプロジェクトの一覧表示 |
| PRJ-003 | プロジェクト設定 | 名前、説明、メンバー管理 |
| PRJ-004 | プロジェクト履歴 | 変更履歴を保持し、任意のバージョンに復元可能 |
| PRJ-005 | プロジェクト削除 | プロジェクトを削除（論理削除） |
| PRJ-006 | プロジェクト検索 | プロジェクト名・説明で検索 |
| AU-002 | 組織メンバー管理 | 組織へのメンバー招待・権限設定 |
| AU-003 | プロジェクト権限 | プロジェクト単位のアクセス制御 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [認証関連](./auth.md)
- [テストスイート](./test-suite.md)
