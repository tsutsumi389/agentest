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
| `avatarUrl` | TEXT | YES | NULL | 組織アバター画像 URL |
| `plan` | ENUM | NO | TEAM | 組織プラン（TEAM, ENTERPRISE） |
| `billingEmail` | VARCHAR(255) | YES | NULL | 請求先メールアドレス |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |
| `deletedAt` | TIMESTAMP | YES | NULL | 削除日時（論理削除、30日後に物理削除） |

### 組織プラン

| プラン | 料金 | 説明 |
|--------|------|------|
| `TEAM` | $6/ユーザー/月（最低10ユーザー） | 小〜中規模チーム |
| `ENTERPRISE` | 要問合せ | 大規模組織・高度なセキュリティ要件 |

### 制約

- `slug` は一意
- `billingEmail` は有効なメールアドレス形式

### Prisma スキーマ

```prisma
enum OrganizationPlan {
  TEAM
  ENTERPRISE
}

model Organization {
  id           String           @id @default(uuid()) @db.Uuid
  name         String           @db.VarChar(100)
  slug         String           @unique @db.VarChar(100)
  description  String?
  avatarUrl    String?
  plan         OrganizationPlan @default(TEAM)
  billingEmail String?          @db.VarChar(255)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  deletedAt    DateTime?

  members      OrganizationMember[]
  invitations  OrganizationInvitation[]
  projects     Project[]
  subscription Subscription?
  apiTokens    ApiToken[]
  auditLogs    AuditLog[]
  usageRecords UsageRecord[]
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

| ロール | 説明 | 権限 |
|--------|------|------|
| `OWNER` | 組織オーナー | 全権限 + 組織削除 + オーナー移譲 |
| `ADMIN` | 管理者 | メンバー管理 + 課金管理 + 全プロジェクト Admin |
| `MEMBER` | 一般メンバー | プロジェクト単位で付与された権限のみ |

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
| `organizationId` | UUID | YES | NULL | 組織 ID（外部キー） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |
| `deletedAt` | TIMESTAMP | YES | NULL | 削除日時（論理削除） |

※ オーナーは `ProjectMember` テーブルで `OWNER` ロールとして管理

### 制約

- 同一組織内でプロジェクト名は一意
- 同一オーナー（OWNER メンバー）内でプロジェクト名は一意

### Prisma スキーマ

```prisma
model Project {
  id             String    @id @default(uuid()) @db.Uuid
  name           String    @db.VarChar(100)
  description    String?
  organizationId String?   @db.Uuid
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  organization  Organization?    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  members       ProjectMember[]
  environments  ProjectEnvironment[]
  testSuites    TestSuite[]
  histories     ProjectHistory[]
  agentSessions AgentSession[]

  @@index([organizationId])
}
```

---

## ProjectEnvironment

プロジェクトの環境設定を管理するテーブル。各環境（dev/stg/prod等）のエンドポイント URL を登録。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `projectId` | UUID | NO | - | プロジェクト ID（外部キー） |
| `name` | VARCHAR(100) | NO | - | 環境名（例: "開発環境", "ステージング", "本番"） |
| `baseUrl` | TEXT | NO | - | エンドポイント URL（例: "https://dev.example.com"） |
| `description` | TEXT | YES | NULL | 環境の説明 |
| `isDefault` | BOOLEAN | NO | false | デフォルト環境フラグ |
| `sortOrder` | INTEGER | NO | 0 | 表示順 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### 制約

- `isDefault` が true の環境はプロジェクト内で1つのみ（アプリケーション層で制御）

### Prisma スキーマ

```prisma
model ProjectEnvironment {
  id          String   @id @default(uuid()) @db.Uuid
  projectId   String   @db.Uuid
  name        String   @db.VarChar(100)
  baseUrl     String
  description String?
  isDefault   Boolean  @default(false)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project    Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  executions Execution[]

  @@index([projectId])
}
```

### 使用例

```
プロジェクト: ECサイト
├── 開発環境:      https://dev.ec-site.example.com (isDefault: true)
├── ステージング:  https://stg.ec-site.example.com
└── 本番環境:      https://ec-site.example.com
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
  "organizationId": "uuid"
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

### 排他制約（SQL）

```sql
-- changedByUserId か changedByAgentSessionId のどちらか一方のみ設定
ALTER TABLE "ProjectHistory" ADD CONSTRAINT "project_history_changer_check"
  CHECK (
    (changed_by_user_id IS NOT NULL AND changed_by_agent_session_id IS NULL) OR
    (changed_by_user_id IS NULL AND changed_by_agent_session_id IS NOT NULL)
  );
```

---

## OrganizationInvitation

組織への招待を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `organizationId` | UUID | NO | - | 組織 ID（外部キー） |
| `email` | VARCHAR(255) | NO | - | 招待先メールアドレス |
| `role` | ENUM | NO | MEMBER | 招待時のロール（ADMIN, MEMBER） |
| `token` | VARCHAR(255) | NO | - | 招待トークン（一意） |
| `invitedByUserId` | UUID | NO | - | 招待者ユーザー ID（外部キー） |
| `expiresAt` | TIMESTAMP | NO | - | 有効期限（7日間） |
| `acceptedAt` | TIMESTAMP | YES | NULL | 承諾日時 |
| `declinedAt` | TIMESTAMP | YES | NULL | 辞退日時 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### 制約

- `token` は一意
- `organizationId` + `email` は一意（同一メールへの重複招待不可）

### Prisma スキーマ

```prisma
model OrganizationInvitation {
  id              String           @id @default(uuid()) @db.Uuid
  organizationId  String           @db.Uuid
  email           String           @db.VarChar(255)
  role            OrganizationRole @default(MEMBER)
  token           String           @unique @db.VarChar(255)
  invitedByUserId String           @db.Uuid
  expiresAt       DateTime
  acceptedAt      DateTime?
  declinedAt      DateTime?
  createdAt       DateTime         @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  invitedBy    User         @relation(fields: [invitedByUserId], references: [id])

  @@unique([organizationId, email])
  @@index([organizationId])
  @@index([token])
  @@index([email])
}
```

---

## ProjectMember

プロジェクトとユーザーの多対多関係を管理する中間テーブル。プロジェクト単位でのアクセス権限を設定。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `projectId` | UUID | NO | - | プロジェクト ID（外部キー） |
| `userId` | UUID | NO | - | ユーザー ID（外部キー） |
| `role` | ENUM | NO | READ | 権限（OWNER, ADMIN, WRITE, READ） |
| `addedAt` | TIMESTAMP | NO | now() | 追加日時 |

### 制約

- `projectId` + `userId` は一意

### 権限レベル

| ロール | 説明 | 権限 |
|--------|------|------|
| `OWNER` | プロジェクトオーナー | 全権限 + 削除・ロール変更不可 |
| `ADMIN` | プロジェクト管理者 | プロジェクト設定 + メンバー管理 + 全編集権限 |
| `WRITE` | 編集者 | テストスイート/ケースの作成・編集・削除 |
| `READ` | 閲覧者 | 閲覧のみ（エクスポート可） |

### Prisma スキーマ

```prisma
enum ProjectRole {
  OWNER
  ADMIN
  WRITE
  READ
}

model ProjectMember {
  id        String      @id @default(uuid()) @db.Uuid
  projectId String      @db.Uuid
  userId    String      @db.Uuid
  role      ProjectRole @default(READ)
  addedAt   DateTime    @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
}
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| ORG-001 | 組織作成 | 新規組織の作成（URL スラッグ設定） |
| ORG-002 | 組織設定 | 組織名、説明、アバター、URL の設定 |
| ORG-003 | 組織一覧 | 所属する組織の一覧表示 |
| ORG-004 | オーナー権限移譲 | 組織のオーナー権限を他のメンバーに移譲 |
| ORG-005 | 組織削除 | 組織を削除（オーナーのみ、30日後に物理削除） |
| ORG-006 | 組織プラン選択 | Team / Enterprise プランの選択・変更 |
| ORG-007 | 請求先設定 | 組織の請求先情報を設定 |
| MBR-001 | メンバー招待 | メールアドレスで組織にメンバーを招待 |
| MBR-002 | 招待承諾/辞退 | 招待の承諾または辞退 |
| MBR-003 | メンバー一覧 | 組織メンバーの一覧表示 |
| MBR-004 | ロール変更 | メンバーのロールを変更（オーナー/管理者のみ） |
| MBR-005 | メンバー削除 | メンバーを組織から削除 |
| MBR-006 | 招待リンク発行 | 有効期限付き招待リンクの生成 |
| MBR-007 | 保留中招待一覧 | 未承諾の招待一覧を表示・取り消し |
| ROL-001 | 組織ロール | Owner / Admin / Member の3種類 |
| ROL-002 | プロジェクトロール | Owner / Admin / Write / Read の4種類 |
| ROL-003 | プロジェクトアクセス制御 | プロジェクト単位でメンバーのアクセス権を設定 |
| ROL-004 | デフォルト権限設定 | 新規メンバーのデフォルト権限を設定 |
| ROL-005 | 権限継承 | 組織 Admin は全プロジェクトに Admin 権限 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [認証関連](./auth.md)
- [テストスイート](./test-suite.md)
- [API トークン](./api-token.md)
- [課金・サブスクリプション](./billing.md)
