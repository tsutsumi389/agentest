# API トークン テーブル

## 概要

個人用/組織用の API トークンを管理するテーブル。MCP サーバーとの連携に使用。

## ApiToken

API トークンを管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `userId` | UUID | YES | NULL | ユーザー ID（外部キー）※1 |
| `organizationId` | UUID | YES | NULL | 組織 ID（外部キー）※1 |
| `name` | VARCHAR(100) | NO | - | トークン名（識別用） |
| `tokenHash` | VARCHAR(64) | NO | - | トークンハッシュ（SHA-256） |
| `tokenPrefix` | VARCHAR(8) | NO | - | トークンプレフィックス（表示用） |
| `scopes` | TEXT[] | NO | - | 権限スコープ配列 |
| `expiresAt` | TIMESTAMP | YES | NULL | 有効期限（NULL は無期限） |
| `lastUsedAt` | TIMESTAMP | YES | NULL | 最終使用日時 |
| `revokedAt` | TIMESTAMP | YES | NULL | 失効日時 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

※1: `userId` と `organizationId` はどちらか一方のみ設定（排他制約）

### トークン形式

- ランダム 32 バイト
- SHA-256 でハッシュ化して保存
- プレフィックス（先頭8文字）は平文で保存（識別用）

### API トークンスコープ

| スコープ | 説明 |
|----------|------|
| `read:projects` | プロジェクトの閲覧 |
| `write:projects` | プロジェクトの作成・編集・削除 |
| `read:test-suites` | テストスイートの閲覧 |
| `write:test-suites` | テストスイートの作成・編集・削除 |
| `read:test-cases` | テストケースの閲覧 |
| `write:test-cases` | テストケースの作成・編集・削除 |
| `execute:tests` | テストの実行 |
| `read:executions` | 実行結果の閲覧 |
| `admin:org` | 組織の管理（メンバー招待等） |
| `admin:billing` | 課金情報の管理 |

### 制約

- `tokenHash` は一意
- `userId` か `organizationId` のどちらか一方が必ず設定される（排他制約）

### Prisma スキーマ

```prisma
model ApiToken {
  id             String    @id @default(uuid()) @db.Uuid
  userId         String?   @db.Uuid
  organizationId String?   @db.Uuid
  name           String    @db.VarChar(100)
  tokenHash      String    @unique @db.VarChar(64)
  tokenPrefix    String    @db.VarChar(8)
  scopes         String[]
  expiresAt      DateTime?
  lastUsedAt     DateTime?
  revokedAt      DateTime?
  createdAt      DateTime  @default(now())

  user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([organizationId])
  @@index([tokenHash])
}
```

### 排他制約（SQL）

```sql
-- userId か organizationId のどちらか一方のみ設定
ALTER TABLE "ApiToken" ADD CONSTRAINT "api_token_owner_check"
  CHECK (
    (user_id IS NOT NULL AND organization_id IS NULL) OR
    (user_id IS NULL AND organization_id IS NOT NULL)
  );
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| TKN-001 | 個人トークン発行 | 個人用 API トークンの発行 |
| TKN-002 | 組織トークン発行 | 組織用 API トークンの発行（Admin以上） |
| TKN-003 | トークンスコープ | トークンの権限範囲を設定 |
| TKN-004 | トークン有効期限 | トークンの有効期限を設定 |
| TKN-005 | トークン一覧 | 発行済みトークンの一覧表示 |
| TKN-006 | トークン無効化 | トークンを無効化 |
| TKN-007 | 最終使用日時 | トークンの最終使用日時を表示 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [認証関連](./auth.md)
- [組織・プロジェクト](./organization.md)
