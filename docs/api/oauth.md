# OAuth 2.1 API

## 概要

MCP クライアント（Claude Code 等）向けの OAuth 2.1 認証フローを提供。
RFC 7591（動的クライアント登録）、RFC 8707（リソースインジケーター）、PKCE（S256）に準拠。

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

## エンドポイント

### Authorization Server Metadata

```
GET /.well-known/oauth-authorization-server
```

Authorization Server のメタデータを返却。

**Response:**

```json
{
  "issuer": "https://api.example.com",
  "authorization_endpoint": "https://api.example.com/oauth/authorize",
  "token_endpoint": "https://api.example.com/oauth/token",
  "registration_endpoint": "https://api.example.com/oauth/register",
  "revocation_endpoint": "https://api.example.com/oauth/revoke",
  "introspection_endpoint": "https://api.example.com/oauth/introspect",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["mcp:read", "mcp:write", "project:read", "project:write", "test-suite:read", "test-suite:write", "test-case:read", "test-case:write", "execution:read", "execution:write"]
}
```

---

### 動的クライアント登録

```
POST /oauth/register
```

MCP クライアントを動的に登録（RFC 7591）。

**Request:**

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

**Response (201 Created):**

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

**Errors:**

| エラー | 説明 |
|--------|------|
| `invalid_redirect_uri` | redirect_uri が localhost/127.0.0.1 以外 |
| `invalid_client_metadata` | 必須フィールドの欠落や不正な値 |

---

### 認可エンドポイント

```
GET /oauth/authorize
```

認可画面（同意画面）へリダイレクト。

**Query Parameters:**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `response_type` | Yes | `code` 固定 |
| `client_id` | Yes | 登録済みクライアント ID |
| `redirect_uri` | Yes | 登録済みリダイレクト URI |
| `code_challenge` | Yes | PKCE code_challenge（S256） |
| `code_challenge_method` | Yes | `S256` 固定 |
| `resource` | Yes | MCP サーバー URL（RFC 8707） |
| `state` | Yes | CSRF 対策用ランダム値 |
| `scope` | No | 要求スコープ（スペース区切り） |

**Example:**

```
GET /oauth/authorize?
  response_type=code&
  client_id=abc123&
  redirect_uri=http://127.0.0.1:12345/callback&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256&
  resource=https://mcp.example.com&
  state=xyz789&
  scope=mcp:read%20mcp:write
```

**処理:**

1. クライアント検証（登録済みか）
2. redirect_uri 検証（登録済み URI との照合）
3. PKCE パラメータ検証（S256 必須）
4. resource 検証
5. 未認証ならログインページへリダイレクト
6. 同意画面表示
7. 認可コード発行→redirect_uri へリダイレクト

---

### 同意承認エンドポイント

```
POST /oauth/authorize/consent
```

ユーザーの同意を処理し、認可コードを発行。

**Request:**

```json
{
  "client_id": "abc123",
  "redirect_uri": "http://127.0.0.1:12345/callback",
  "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  "code_challenge_method": "S256",
  "resource": "https://mcp.example.com",
  "state": "xyz789",
  "scope": "mcp:read mcp:write",
  "approved": true
}
```

**Response (承認時):**

`redirect_uri?code=...&state=...` へリダイレクト

**Response (拒否時):**

`redirect_uri?error=access_denied&state=...` へリダイレクト

---

### トークンエンドポイント

```
POST /oauth/token
```

認可コードをアクセストークンと交換。

**Request (application/x-www-form-urlencoded):**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `grant_type` | Yes | `authorization_code` 固定 |
| `code` | Yes | 認可コード |
| `redirect_uri` | Yes | 認可リクエスト時と同じ URI |
| `client_id` | Yes | クライアント ID |
| `code_verifier` | Yes | PKCE code_verifier |
| `resource` | Yes | MCP サーバー URL |

**Response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "mcp:read mcp:write"
}
```

**Errors:**

| エラー | 説明 |
|--------|------|
| `invalid_grant` | 無効または期限切れの認可コード |
| `invalid_client` | 無効なクライアント ID |
| `invalid_request` | PKCE 検証失敗 |

---

### トークンイントロスペクション

```
POST /oauth/introspect
```

アクセストークンの有効性を検証（内部 API）。

**Request (application/x-www-form-urlencoded):**

```
token=<access_token>
```

**Response (有効なトークン):**

```json
{
  "active": true,
  "sub": "user-uuid",
  "client_id": "abc123",
  "scope": "mcp:read mcp:write",
  "aud": "https://mcp.example.com",
  "exp": 1704070800,
  "iat": 1704067200
}
```

**Response (無効なトークン):**

```json
{
  "active": false
}
```

---

### トークン失効

```
POST /oauth/revoke
```

アクセストークンを無効化。

**Request (application/x-www-form-urlencoded):**

```
token=<access_token>
```

**Response:**

```
200 OK
```

失効成功・失敗に関わらず 200 を返却（RFC 7009 準拠）。

---

## Protected Resource Metadata (MCP サーバー)

```
GET /.well-known/oauth-protected-resource
```

MCP サーバー（Resource Server）のメタデータを返却。

**Response:**

```json
{
  "resource": "https://mcp.example.com",
  "authorization_servers": ["https://api.example.com"],
  "scopes_supported": ["mcp:read", "mcp:write", "project:read", "project:write", "test-suite:read", "test-suite:write", "test-case:read", "test-case:write", "execution:read", "execution:write"],
  "bearer_methods_supported": ["header"]
}
```

---

## MCP サーバーでの認証

MCP サーバーへのリクエストには Bearer トークンを使用：

```
Authorization: Bearer <access_token>
```

**認証失敗時のレスポンス:**

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Unauthorized"
  },
  "id": null
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
- **アクセストークン有効期限**: 1時間
- **認可コード有効期限**: 10分
- **HTTPS 必須**: 本番環境では HTTPS のみ

## 関連ドキュメント

- [認証 API](./auth.md)
- [MCP 連携機能](../architecture/features/mcp-integration.md)
- [OAuth 2.1 データベース設計](../architecture/database/oauth.md)
