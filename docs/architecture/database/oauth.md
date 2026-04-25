# OAuth 2.1 関連テーブル

## 概要

MCP クライアント（Claude Code 等）向けの OAuth 2.1 認証をサポートするためのテーブル群。
RFC 7591（動的クライアント登録）、RFC 7009（トークン失効）、RFC 8707（リソースインジケーター）、PKCE（S256）、
および CIMD（Client ID Metadata Document, draft-ietf-oauth-client-id-metadata-document-00）に対応。
リフレッシュトークンによるトークン更新もサポート。

## OAuthClient

DCR（RFC 7591）と CIMD（draft-ietf-oauth-client-id-metadata-document-00）の両経路で登録されたクライアント情報を管理するテーブル。
`isCimd` フラグで経路を識別する。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `clientId` | VARCHAR(2048) | NO | - | クライアント ID（一意。CIMD は HTTPS URL、DCR は UUID） |
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
| `isCimd` | BOOLEAN | NO | false | CIMD 経路で登録されたクライアントか |
| `metadataUrl` | VARCHAR(2048) | YES | NULL | CIMD メタデータ URL（= clientId） |
| `metadataFetchedAt` | TIMESTAMP | YES | NULL | 最終フェッチ時刻 |
| `metadataExpiresAt` | TIMESTAMP | YES | NULL | キャッシュ有効期限（Cache-Control から算出） |
| `metadataEtag` | VARCHAR(255) | YES | NULL | 条件付きリクエスト用 ETag |
| `jwksUri` | TEXT | YES | NULL | 将来の `private_key_jwt` 対応用 JWKS URI（保存のみ） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### 制約

- `clientId` は一意。最大 2048 文字（CIMD URL を許容）
- `redirectUris` の検証は経路別:
  - **DCR 経路**: `localhost` / `127.0.0.1` のみ許可（登録時に検証）
  - **CIMD 経路**: メタデータドキュメントが宣言した値をそのまま保存（任意ドメイン可）
- `tokenEndpointAuthMethod`:
  - **DCR 経路**: `"none"` のみ（Public Client）
  - **CIMD 経路**: `"none"` 既定。`client_secret_*` 系は拒否（対称鍵禁止）
- 認可コード発行時の `redirect_uri` 検証は `redirectUris` 配列との完全一致

### CIMD 経路特有の挙動

| 状態 | 動作 |
|---|---|
| 鮮度内（`metadataExpiresAt > now`） | DB のキャッシュをそのまま使用 |
| 期限切れ（ETag あり） | `If-None-Match: <metadataEtag>` で条件付きフェッチ |
| 304 Not Modified | `metadataFetchedAt` / `metadataExpiresAt` のみ更新 |
| 200 OK | 検証 → `upsert(where: { clientId })` |
| フェッチ失敗（既存キャッシュあり） | スタールキャッシュにフォールバック（`warn` ログ） |
| フェッチ失敗（新規） | `invalid_client` エラー |

### Prisma スキーマ

```prisma
model OAuthClient {
  id                      String    @id @default(uuid())
  // CIMD では client_id が HTTPS URL になり得るため最大 2048 文字を許容
  clientId                String    @unique @map("client_id") @db.VarChar(2048)
  clientSecret            String?   @map("client_secret") @db.VarChar(255)
  clientSecretExpiresAt   DateTime? @map("client_secret_expires_at")
  clientIdIssuedAt        DateTime  @default(now()) @map("client_id_issued_at")
  clientName              String    @map("client_name") @db.VarChar(100)
  clientUri               String?   @map("client_uri")
  logoUri                 String?   @map("logo_uri")
  redirectUris            String[]  @map("redirect_uris")
  grantTypes              String[]  @default(["authorization_code", "refresh_token"]) @map("grant_types")
  responseTypes           String[]  @default(["code"]) @map("response_types")
  tokenEndpointAuthMethod String    @default("none") @map("token_endpoint_auth_method")
  scopes                  String[]  @default([])
  softwareId              String?   @map("software_id") @db.VarChar(255)
  softwareVersion         String?   @map("software_version") @db.VarChar(50)
  isActive                Boolean   @default(true) @map("is_active")
  // CIMD関連フィールド
  isCimd                  Boolean   @default(false) @map("is_cimd")
  metadataUrl             String?   @map("metadata_url") @db.VarChar(2048)
  metadataFetchedAt       DateTime? @map("metadata_fetched_at")
  metadataExpiresAt       DateTime? @map("metadata_expires_at")
  metadataEtag            String?   @map("metadata_etag") @db.VarChar(255)
  jwksUri                 String?   @map("jwks_uri")
  createdAt               DateTime  @default(now()) @map("created_at")
  updatedAt               DateTime  @updatedAt @map("updated_at")

  authorizationCodes OAuthAuthorizationCode[]
  accessTokens       OAuthAccessToken[]
  refreshTokens      OAuthRefreshToken[]

  @@map("oauth_clients")
}
```

### マイグレーション履歴

| ファイル | 内容 |
|---|---|
| `20260425000000_add_cimd_columns_to_oauth_clients` | `oauth_clients` に CIMD 関連カラム（`is_cimd`, `metadata_url`, `metadata_fetched_at`, `metadata_expires_at`, `metadata_etag`, `jwks_uri`）を追加 |
| `20260425000001_extend_oauth_client_id_length` | `oauth_clients.client_id` および関連子テーブル（`oauth_authorization_codes` / `oauth_access_tokens` / `oauth_refresh_tokens`）の `client_id` 列を `VARCHAR(2048)` に拡張 |

> btree インデックスの 2704 byte 上限に注意。`client_id` 単独 VARCHAR(2048) は許容されるが、複合インデックス追加時はサイズを再計算すること。

---

## OAuthAuthorizationCode

認可コードを管理するテーブル。PKCE（S256）とリソースインジケーターをサポート。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `code` | VARCHAR(255) | NO | - | 認可コード（一意） |
| `clientId` | VARCHAR(2048) | NO | - | クライアント ID（外部キー、CIMD URL 対応） |
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
  clientId            String    @map("client_id") @db.VarChar(2048)
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
| `clientId` | VARCHAR(2048) | NO | - | クライアント ID（外部キー、CIMD URL 対応） |
| `userId` | UUID | NO | - | ユーザー ID（外部キー） |
| `refreshTokenId` | UUID | YES | NULL | リフレッシュトークン ID（外部キー） |
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
- `refreshTokenId` はリフレッシュトークンから発行された場合のみ設定

### Prisma スキーマ

```prisma
model OAuthAccessToken {
  id             String    @id @default(uuid())
  tokenHash      String    @unique @map("token_hash") @db.VarChar(64)
  clientId       String    @map("client_id") @db.VarChar(2048)
  userId         String    @map("user_id")
  refreshTokenId String?   @map("refresh_token_id")
  scopes         String[]
  audience       String    @db.VarChar(500)
  expiresAt      DateTime  @map("expires_at")
  revokedAt      DateTime? @map("revoked_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  client       OAuthClient        @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  user         User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshToken OAuthRefreshToken? @relation(fields: [refreshTokenId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@map("oauth_access_tokens")
}
```

---

## OAuthRefreshToken

リフレッシュトークンを管理するテーブル。アクセストークン更新に使用。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `tokenHash` | VARCHAR(64) | NO | - | トークンハッシュ（SHA256、一意） |
| `clientId` | VARCHAR(2048) | NO | - | クライアント ID（外部キー、CIMD URL 対応） |
| `userId` | UUID | NO | - | ユーザー ID（外部キー） |
| `scopes` | TEXT[] | NO | - | 認可されたスコープ |
| `audience` | VARCHAR(500) | NO | - | オーディエンス（RFC 8707 resource） |
| `expiresAt` | TIMESTAMP | NO | - | 有効期限（30日） |
| `revokedAt` | TIMESTAMP | YES | NULL | 失効日時 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### トークン仕様

| 項目 | 値 | 説明 |
|------|-----|------|
| トークン形式 | ランダム文字列（32バイト） | Base64URL エンコード |
| 保存方法 | SHA256 ハッシュ | 平文は保存しない |
| 有効期限 | 30日 | 長期間有効 |
| 失効 | `revokedAt` を設定 | 論理削除 |
| ローテーション | なし | リフレッシュ時に新しいトークンは発行しない |

### 制約

- `tokenHash` は一意
- 有効なトークンは `expiresAt` が未来かつ `revokedAt` が NULL
- スコープダウングレードのみ許可（リフレッシュ時に元のスコープ以下のみ要求可能）

### Prisma スキーマ

```prisma
model OAuthRefreshToken {
  id        String    @id @default(uuid())
  tokenHash String    @unique @map("token_hash") @db.VarChar(64)
  clientId  String    @map("client_id") @db.VarChar(2048)
  userId    String    @map("user_id")
  scopes    String[]
  audience  String    @db.VarChar(500)
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")

  client       OAuthClient        @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  user         User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessTokens OAuthAccessToken[]

  @@index([userId])
  @@map("oauth_refresh_tokens")
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
- **redirect_uri 検証（経路別）**:
  - DCR 経路: `localhost` / `127.0.0.1` のみ許可
  - CIMD 経路: メタデータ宣言の `redirect_uris` 集合と完全一致のみ許可
- **CIMD SSRF 対策**: プライベート / ループバック / メタデータサービス / CGNAT レンジ拒否、DNS rebinding 対策、5KB 上限
- **CIMD 対称鍵禁止**: `client_secret*` プロパティ・`client_secret_*` 認証方式を拒否
- **CSRF 保護**: 同意エンドポイントで Origin/Referer ヘッダーを検証
- **トークン失効**: RFC 7009 準拠、クライアント ID 不一致時は警告ログを記録
- **HTTPS 必須**: 本番環境では HTTPS のみ
- **本番環境シークレット必須**: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET は必須

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| MCP-OAuth-001 | 動的クライアント登録 | MCP クライアントの自動登録（DCR） |
| MCP-OAuth-002 | 認可フロー | PKCE 付き認可コードフロー |
| MCP-OAuth-003 | トークン発行 | アクセストークン + リフレッシュトークンの発行 |
| MCP-OAuth-004 | トークン検証 | イントロスペクションによる検証 |
| MCP-OAuth-005 | トークン失効 | アクセストークン/リフレッシュトークンの無効化 |
| MCP-OAuth-006 | トークン更新 | リフレッシュトークンによるアクセストークン更新 |
| MCP-OAuth-007 | CIMD クライアント識別 | HTTPS URL `client_id` からメタデータ自動取得（事前登録不要） |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [認証関連テーブル](./auth.md)
- [MCP 連携機能](../features/mcp-integration.md)
- [OAuth 2.1 API](../../api/oauth.md)
- [ADR-0004: MCP クライアント識別に CIMD を採用（DCR と共存）](../../adr/0004-mcp-cimd.md)
