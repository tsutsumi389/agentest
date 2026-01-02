# OAuth 2.1 関連テーブル

## 概要

MCP クライアント（Claude Code 等）向けの OAuth 2.1 認証をサポートするためのテーブル群。
RFC 7591（動的クライアント登録）、RFC 8707（リソースインジケーター）、PKCE（S256）に対応。

## OAuthClient

動的クライアント登録（RFC 7591）で登録されたクライアント情報を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `clientId` | VARCHAR(255) | NO | - | クライアント ID（一意） |
| `clientSecret` | VARCHAR(255) | YES | NULL | クライアントシークレット（Public Client では NULL） |
| `clientSecretExpiresAt` | TIMESTAMP | YES | NULL | クライアントシークレット有効期限 |
| `clientIdIssuedAt` | TIMESTAMP | NO | now() | クライアント ID 発行日時 |
| `clientName` | VARCHAR(100) | NO | - | クライアント名 |
| `clientUri` | TEXT | YES | NULL | クライアント URI |
| `logoUri` | TEXT | YES | NULL | ロゴ URI |
| `redirectUris` | TEXT[] | NO | - | 許可されたリダイレクト URI 配列 |
| `grantTypes` | TEXT[] | NO | ["authorization_code"] | 許可されたグラントタイプ |
| `responseTypes` | TEXT[] | NO | ["code"] | 許可されたレスポンスタイプ |
| `tokenEndpointAuthMethod` | VARCHAR(50) | NO | "none" | トークンエンドポイント認証方式 |
| `scopes` | TEXT[] | NO | [] | 許可されたスコープ |
| `softwareId` | VARCHAR(255) | YES | NULL | ソフトウェア ID |
| `softwareVersion` | VARCHAR(50) | YES | NULL | ソフトウェアバージョン |
| `isActive` | BOOLEAN | NO | true | クライアントの有効/無効 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### 制約

- `clientId` は一意
- `redirectUris` は localhost/127.0.0.1 のみ許可（セキュリティ要件）
- `tokenEndpointAuthMethod` は "none" のみサポート（Public Client）

### Prisma スキーマ

```prisma
model OAuthClient {
  id                      String    @id @default(uuid())
  clientId                String    @unique @map("client_id") @db.VarChar(255)
  clientSecret            String?   @map("client_secret") @db.VarChar(255)
  clientSecretExpiresAt   DateTime? @map("client_secret_expires_at")
  clientIdIssuedAt        DateTime  @default(now()) @map("client_id_issued_at")
  clientName              String    @map("client_name") @db.VarChar(100)
  clientUri               String?   @map("client_uri")
  logoUri                 String?   @map("logo_uri")
  redirectUris            String[]  @map("redirect_uris")
  grantTypes              String[]  @default(["authorization_code"]) @map("grant_types")
  responseTypes           String[]  @default(["code"]) @map("response_types")
  tokenEndpointAuthMethod String    @default("none") @map("token_endpoint_auth_method")
  scopes                  String[]  @default([])
  softwareId              String?   @map("software_id") @db.VarChar(255)
  softwareVersion         String?   @map("software_version") @db.VarChar(50)
  isActive                Boolean   @default(true) @map("is_active")
  createdAt               DateTime  @default(now()) @map("created_at")
  updatedAt               DateTime  @updatedAt @map("updated_at")

  authorizationCodes OAuthAuthorizationCode[]
  accessTokens       OAuthAccessToken[]

  @@map("oauth_clients")
}
```

---

## OAuthAuthorizationCode

認可コードを管理するテーブル。PKCE（S256）とリソースインジケーターをサポート。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `code` | VARCHAR(255) | NO | - | 認可コード（一意） |
| `clientId` | VARCHAR(255) | NO | - | クライアント ID（外部キー） |
| `userId` | UUID | NO | - | ユーザー ID（外部キー） |
| `redirectUri` | TEXT | NO | - | リダイレクト URI |
| `scopes` | TEXT[] | NO | - | 認可されたスコープ |
| `codeChallenge` | VARCHAR(128) | NO | - | PKCE code_challenge |
| `codeChallengeMethod` | VARCHAR(10) | NO | "S256" | PKCE code_challenge_method |
| `resource` | VARCHAR(500) | NO | - | リソースインジケーター（RFC 8707） |
| `expiresAt` | TIMESTAMP | NO | - | 有効期限（10分） |
| `usedAt` | TIMESTAMP | YES | NULL | 使用日時（再利用防止） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### 認可コード有効期限

- **有効期限**: 10分
- **使用回数**: 1回のみ（使用後は `usedAt` を設定）

### 制約

- `code` は一意
- `codeChallengeMethod` は "S256" のみサポート（plain は禁止）
- 使用済みコード（`usedAt` が設定されている）は無効

### Prisma スキーマ

```prisma
model OAuthAuthorizationCode {
  id                  String    @id @default(uuid())
  code                String    @unique @db.VarChar(255)
  clientId            String    @map("client_id")
  userId              String    @map("user_id")
  redirectUri         String    @map("redirect_uri")
  scopes              String[]
  codeChallenge       String    @map("code_challenge") @db.VarChar(128)
  codeChallengeMethod String    @default("S256") @map("code_challenge_method")
  resource            String    @db.VarChar(500)
  expiresAt           DateTime  @map("expires_at")
  usedAt              DateTime? @map("used_at")
  createdAt           DateTime  @default(now()) @map("created_at")

  client OAuthClient @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  user   User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([code])
  @@map("oauth_authorization_codes")
}
```

---

## OAuthAccessToken

アクセストークンを管理するテーブル。トークン自体はハッシュ化して保存。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `tokenHash` | VARCHAR(64) | NO | - | トークンハッシュ（SHA256、一意） |
| `clientId` | VARCHAR(255) | NO | - | クライアント ID（外部キー） |
| `userId` | UUID | NO | - | ユーザー ID（外部キー） |
| `scopes` | TEXT[] | NO | - | 認可されたスコープ |
| `audience` | VARCHAR(500) | NO | - | オーディエンス（RFC 8707 resource） |
| `expiresAt` | TIMESTAMP | NO | - | 有効期限（1時間） |
| `revokedAt` | TIMESTAMP | YES | NULL | 失効日時 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### トークン仕様

| 項目 | 値 | 説明 |
|------|-----|------|
| トークン形式 | ランダム文字列（32バイト） | Base64URL エンコード |
| 保存方法 | SHA256 ハッシュ | 平文は保存しない |
| 有効期限 | 1時間 | セキュリティ要件 |
| 失効 | `revokedAt` を設定 | 論理削除 |

### 制約

- `tokenHash` は一意
- 有効なトークンは `expiresAt` が未来かつ `revokedAt` が NULL

### Prisma スキーマ

```prisma
model OAuthAccessToken {
  id        String    @id @default(uuid())
  tokenHash String    @unique @map("token_hash") @db.VarChar(64)
  clientId  String    @map("client_id")
  userId    String    @map("user_id")
  scopes    String[]
  audience  String    @db.VarChar(500)
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")

  client OAuthClient @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  user   User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("oauth_access_tokens")
}
```

---

## スコープ一覧

| スコープ | 説明 |
|----------|------|
| `mcp:read` | MCP ツールの読み取り操作 |
| `mcp:write` | MCP ツールの書き込み操作 |
| `project:read` | プロジェクト情報の読み取り |
| `project:write` | プロジェクトの作成・更新 |
| `test-suite:read` | テストスイートの読み取り |
| `test-suite:write` | テストスイートの作成・更新・削除 |
| `test-case:read` | テストケースの読み取り |
| `test-case:write` | テストケースの作成・更新・削除 |
| `execution:read` | テスト実行の読み取り |
| `execution:write` | テスト実行の作成・更新 |

## セキュリティ要件

- **PKCE 必須**: S256 のみサポート（plain は禁止）
- **リソースインジケーター**: RFC 8707 準拠のオーディエンス検証
- **動的クライアント登録**: redirect_uri は localhost/127.0.0.1 のみ許可
- **HTTPS 必須**: 本番環境では HTTPS のみ

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| MCP-OAuth-001 | 動的クライアント登録 | MCP クライアントの自動登録 |
| MCP-OAuth-002 | 認可フロー | PKCE 付き認可コードフロー |
| MCP-OAuth-003 | トークン発行 | アクセストークンの発行 |
| MCP-OAuth-004 | トークン検証 | イントロスペクションによる検証 |
| MCP-OAuth-005 | トークン失効 | アクセストークンの無効化 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [認証関連テーブル](./auth.md)
- [MCP 連携機能](../features/mcp-integration.md)
- [OAuth 2.1 API](../../api/oauth.md)
