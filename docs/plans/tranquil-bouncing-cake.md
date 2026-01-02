# MCP OAuth 2.1 対応実装計画

## 概要
MCPサーバーをMCP仕様のOAuth 2.1認証フローに対応させる。

- **MCPサーバー**: Resource Server (RFC 9728準拠)
- **APIサーバー**: Authorization Server (OAuth 2.1準拠)
- **クライアント登録**: Dynamic Client Registration (RFC 7591準拠)
- **想定クライアント**: Claude Code (CLI)

## 認証フロー

```
Claude Code → MCP Server (401 + WWW-Authenticate)
    ↓
Claude Code → MCP Server (GET /.well-known/oauth-protected-resource)
    ↓
Claude Code → API Server (GET /.well-known/oauth-authorization-server)
    ↓
Claude Code → API Server (POST /oauth/register)  ← 動的クライアント登録
    ↓
Claude Code → Browser → API Server (/oauth/authorize?code_challenge=...&resource=...)
    ↓
User Login/Consent → Redirect with code
    ↓
Claude Code → API Server (POST /oauth/token + code_verifier)
    ↓
Claude Code → MCP Server (Authorization: Bearer <token>)
```

---

## Phase 1: Prismaスキーマ追加

**ファイル**: `packages/db/prisma/schema.prisma`

### 新規モデル

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

  authorizationCodes    OAuthAuthorizationCode[]
  accessTokens          OAuthAccessToken[]

  @@map("oauth_clients")
}

model OAuthAuthorizationCode {
  id                  String    @id @default(uuid())
  code                String    @unique @db.VarChar(255)
  clientId            String    @map("client_id")
  userId              String    @map("user_id")
  redirectUri         String    @map("redirect_uri")
  scopes              String[]
  codeChallenge       String    @map("code_challenge") @db.VarChar(128)
  codeChallengeMethod String    @default("S256") @map("code_challenge_method")
  resource            String    @db.VarChar(500)  // RFC 8707
  expiresAt           DateTime  @map("expires_at")
  usedAt              DateTime? @map("used_at")
  createdAt           DateTime  @default(now()) @map("created_at")

  client OAuthClient @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  user   User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([code])
  @@map("oauth_authorization_codes")
}

model OAuthAccessToken {
  id        String    @id @default(uuid())
  tokenHash String    @unique @map("token_hash") @db.VarChar(64)
  clientId  String    @map("client_id")
  userId    String    @map("user_id")
  scopes    String[]
  audience  String    @db.VarChar(500)  // RFC 8707
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")

  client OAuthClient @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  user   User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("oauth_access_tokens")
}
```

### Userモデルへのリレーション追加
```prisma
oauthAuthorizationCodes OAuthAuthorizationCode[]
oauthAccessTokens       OAuthAccessToken[]
```

---

## Phase 2: APIサーバー (Authorization Server)

### 新規ファイル

| ファイル | 説明 |
|---------|------|
| `src/routes/oauth.ts` | OAuth 2.1ルート定義 |
| `src/controllers/oauth.controller.ts` | OAuth処理ロジック |
| `src/services/oauth.service.ts` | OAuthビジネスロジック |
| `src/services/client-registration.service.ts` | 動的クライアント登録ロジック |
| `src/repositories/oauth.repository.ts` | OAuthデータアクセス |
| `src/utils/pkce.ts` | PKCE検証ユーティリティ |
| `src/validators/oauth.validator.ts` | OAuthリクエスト検証 |

### エンドポイント

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/.well-known/oauth-authorization-server` | GET | Authorization Server Metadata |
| `/oauth/register` | POST | 動的クライアント登録 (RFC 7591) |
| `/oauth/authorize` | GET | 認可エンドポイント |
| `/oauth/token` | POST | トークンエンドポイント |
| `/oauth/introspect` | POST | トークンイントロスペクション (内部用) |
| `/oauth/revoke` | POST | トークン失効 |

### Authorization Server Metadata

```json
{
  "issuer": "https://api.example.com",
  "authorization_endpoint": "https://api.example.com/oauth/authorize",
  "token_endpoint": "https://api.example.com/oauth/token",
  "registration_endpoint": "https://api.example.com/oauth/register",
  "revocation_endpoint": "https://api.example.com/oauth/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["mcp:read", "mcp:write", "project:read", ...]
}
```

### 動的クライアント登録エンドポイント (/oauth/register)

**RFC 7591準拠**

リクエスト:
```json
{
  "client_name": "Claude Code",
  "redirect_uris": ["http://127.0.0.1:12345/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:read mcp:write"
}
```

レスポンス (201 Created):
```json
{
  "client_id": "generated-uuid-client-id",
  "client_id_issued_at": 1704067200,
  "client_name": "Claude Code",
  "redirect_uris": ["http://127.0.0.1:12345/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:read mcp:write"
}
```

処理:
1. リクエストボディのバリデーション
2. redirect_urisの検証 (localhost/127.0.0.1のみ許可)
3. client_id生成 (UUID)
4. クライアント情報をDBに保存
5. クライアント情報を返却

エラーレスポンス:
- `invalid_redirect_uri`: 不正なredirect_uri
- `invalid_client_metadata`: 不正なメタデータ

### 認可エンドポイント (/oauth/authorize)

必須パラメータ:
- `response_type=code`
- `client_id`
- `redirect_uri`
- `code_challenge` (PKCE S256)
- `code_challenge_method=S256`
- `resource` (RFC 8707: MCPサーバーURL)
- `state`
- `scope`

処理:
1. クライアント検証 (動的登録済みクライアント)
2. redirect_uri検証 (登録済みURIとの照合)
3. PKCE検証 (S256必須)
4. resource検証
5. 未認証ならログイン画面へ
6. **同意画面表示** (フロントエンドに実装)
7. 認可コード発行→リダイレクト

### 同意画面 (Consent Screen)

**フロントエンド**: `apps/web/src/pages/oauth/consent.tsx`

表示内容:
- アプリケーション名 (client_name)
- 要求されるスコープ一覧
- 「許可」「拒否」ボタン

処理:
1. `/oauth/authorize` から同意画面へリダイレクト
2. ユーザーが許可/拒否を選択
3. 許可: 認可コード発行→redirect_uriへ
4. 拒否: error=access_denied→redirect_uriへ

### トークンエンドポイント (/oauth/token)

必須パラメータ:
- `grant_type=authorization_code`
- `code`
- `redirect_uri`
- `client_id`
- `code_verifier` (PKCE)
- `resource`

処理:
1. 認可コード検証
2. PKCE検証 (`SHA256(code_verifier) == code_challenge`)
3. resource検証
4. アクセストークン発行 (audience = resource)

### 修正ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/app.ts` | OAuthルート追加 |
| `src/config/env.ts` | `API_BASE_URL` 環境変数追加 |

---

## Phase 3: MCPサーバー (Resource Server)

### 新規ファイル

| ファイル | 説明 |
|---------|------|
| `src/routes/oauth-metadata.ts` | Protected Resource Metadata |
| `src/middleware/oauth-auth.middleware.ts` | Bearer Token認証 |
| `src/services/token-introspection.service.ts` | トークン検証サービス |

### Protected Resource Metadata (/.well-known/oauth-protected-resource)

```json
{
  "resource": "https://mcp.example.com",
  "authorization_servers": ["https://api.example.com"],
  "scopes_supported": ["mcp:read", "mcp:write", ...],
  "bearer_methods_supported": ["header"]
}
```

### Bearer Token認証ミドルウェア

```typescript
// 現在: Cookie (access_token) から JWT 抽出
// 変更後: Authorization: Bearer <token> からトークン抽出

export function mcpOAuthAuthenticate() {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return sendUnauthorized(res);  // WWW-Authenticate ヘッダー付き
    }

    const token = authHeader.slice(7);
    const tokenInfo = await introspectToken(token);  // APIサーバーに検証依頼

    if (!tokenInfo.active) return sendUnauthorized(res);
    if (tokenInfo.aud !== env.MCP_SERVER_URL) return sendUnauthorized(res);  // Audience検証

    req.user = await prisma.user.findUnique({ where: { id: tokenInfo.sub } });
    next();
  };
}

function sendUnauthorized(res) {
  res.setHeader('WWW-Authenticate',
    `Bearer resource_metadata="${env.MCP_SERVER_URL}/.well-known/oauth-protected-resource"`
  );
  res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
}
```

### 修正ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/app.ts` | メタデータルート追加、認証ミドルウェア変更 |
| `src/config/env.ts` | `MCP_SERVER_URL`, `AUTH_SERVER_URL` 追加 |
| `src/middleware/mcp-auth.middleware.ts` | 廃止 or 後方互換用に残す |

---

## Phase 4: スコープ設計

```
mcp:read       - 全MCPツールの読み取り
mcp:write      - 全MCPツールの書き込み
project:read   - プロジェクト情報の読み取り
project:write  - プロジェクトの作成・更新
test-suite:read/write
test-case:read/write
execution:read/write
```

ツールとスコープのマッピング:
- `search_*`, `get_*` → `mcp:read` + 対応リソーススコープ
- `create_*`, `update_*`, `delete_*` → `mcp:write` + 対応リソーススコープ

---

## Phase 5: 環境変数追加

### APIサーバー
```
API_BASE_URL=https://api.example.com
```

### MCPサーバー
```
MCP_SERVER_URL=https://mcp.example.com
AUTH_SERVER_URL=https://api.example.com
```

---

## 実装順序

1. **Prismaスキーマ追加・マイグレーション**
2. **APIサーバー: Authorization Server Metadata**
3. **APIサーバー: 動的クライアント登録エンドポイント**
4. **APIサーバー: 認可エンドポイント**
5. **APIサーバー: トークンエンドポイント**
6. **APIサーバー: イントロスペクションエンドポイント**
7. **MCPサーバー: Protected Resource Metadata**
8. **MCPサーバー: Bearer Token認証ミドルウェア**
9. **テスト作成**

---

## 重要ファイル一覧

### 新規作成

**データベース:**
- `packages/db/prisma/schema.prisma` (スキーマ追加)

**APIサーバー:**
- `apps/api/src/routes/oauth.ts`
- `apps/api/src/controllers/oauth.controller.ts`
- `apps/api/src/services/oauth.service.ts`
- `apps/api/src/services/client-registration.service.ts`
- `apps/api/src/repositories/oauth.repository.ts`
- `apps/api/src/utils/pkce.ts`
- `apps/api/src/validators/oauth.validator.ts`

**MCPサーバー:**
- `apps/mcp-server/src/routes/oauth-metadata.ts`
- `apps/mcp-server/src/middleware/oauth-auth.middleware.ts`
- `apps/mcp-server/src/services/token-introspection.service.ts`

**フロントエンド (同意画面):**
- `apps/web/src/pages/oauth/consent.tsx`
- `apps/web/src/routes/oauth.tsx` (ルート定義)

### 修正
- `apps/api/src/app.ts`
- `apps/api/src/config/env.ts`
- `apps/mcp-server/src/app.ts`
- `apps/mcp-server/src/config/env.ts`
- `apps/web/src/router.tsx` (OAuth同意画面ルート追加)

---

## セキュリティ要件

- PKCE必須 (S256のみ)
- Resource Indicators (RFC 8707) でAudience検証
- アクセストークン有効期限: 1時間
- 認可コード有効期限: 10分
- HTTPS必須 (本番環境)
- **動的クライアント登録**: redirect_uriはlocalhost/127.0.0.1のみ許可
- **クライアント検証**: 登録済みredirect_uriとの完全一致検証
- **レート制限**: 登録エンドポイントへの過剰リクエスト防止
