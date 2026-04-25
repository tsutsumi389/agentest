# OAuth 2.1 API

## 概要

MCP クライアント（Claude Code 等）向けの OAuth 2.1 認証フローを提供。
RFC 7591（動的クライアント登録）、RFC 7009（トークン失効）、RFC 8707（リソースインジケーター）、PKCE（S256）、
および CIMD（Client ID Metadata Document, draft-ietf-oauth-client-id-metadata-document-00）に準拠。
リフレッシュトークンによるトークン更新もサポート。

## クライアント識別メカニズム

MCP 仕様（2025-11 更新）で CIMD がデフォルトのクライアント識別メカニズムに採用されたことを受け、
2 種類のクライアント識別経路を共存させる。

| 経路 | client_id 形式 | 識別方法 |
|------|----------------|----------|
| **CIMD** | HTTPS URL（例: `https://example.com/mcp/client.json`） | URL から JSON メタデータを取得して自己記述 |
| **DCR** | UUID（例: `1f0e9b18-...`） | 事前に `POST /oauth/register` で登録 |

`client_id` の形状（HTTPS URL か UUID か）で経路を自動判別する。詳細は [CIMD クライアント解決](#cimd-クライアント解決) を参照。

## 認証フロー

### CIMD 経路（推奨・MCP 2025-11 デフォルト）

```
Claude Code → MCP Server (401 + WWW-Authenticate)
    ↓
Claude Code → MCP Server (GET /.well-known/oauth-protected-resource)
    ↓
Claude Code → API Server (GET /.well-known/oauth-authorization-server)
    ↓
（登録不要）
    ↓
Claude Code → Browser → API Server (/oauth/authorize?client_id=https://...&code_challenge=...)
    ↓
API Server → CIMD URL (GET メタデータ取得 + 検証 + キャッシュ)
    ↓
User Login/Consent → Redirect with code
    ↓
Claude Code → API Server (POST /oauth/token + code_verifier)
    ↓
Claude Code → MCP Server (Authorization: Bearer <token>)
```

### DCR 経路（既存互換）

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
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["mcp:read", "mcp:write", "project:read", "project:write", "test-suite:read", "test-suite:write", "test-case:read", "test-case:write", "execution:read", "execution:write"],
  "client_id_metadata_document_supported": true
}
```

`client_id_metadata_document_supported: true` は CIMD（draft-ietf-oauth-client-id-metadata-document-00）に対応していることを示す。
CIMD 対応クライアントは事前登録なしで HTTPS URL の `client_id` を直接 authorize エンドポイントに渡せる。

---

### CIMD クライアント解決

CIMD 経路では `client_id` が HTTPS URL であり、その URL から取得できる JSON メタデータでクライアントを自己記述させる。
authorize / token エンドポイントの起点で `client_id` を検査し、形状に応じて経路を分岐する。

#### 経路判定

| `client_id` の形状 | 経路 | 解決方法 |
|---|---|---|
| HTTPS URL | CIMD | URL から JSON を取得 → 検証 → upsert |
| UUID | DCR | DB の登録済みクライアントを検索 |
| その他 | 失敗 | `invalid_client` エラー |

#### CIMD URL 要件

- `https:` スキーム必須（`http:` 不可）
- fragment（`#...`）を含まないこと
- userinfo（`user:pass@...`）を含まないこと
- pathname が `/` 単独でないこと（識別子を含むべき）

#### CIMD メタデータ JSON 仕様

```json
{
  "client_id": "https://example.com/mcp/client.json",
  "client_name": "Example MCP Client",
  "redirect_uris": ["https://example.com/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:read mcp:write",
  "client_uri": "https://example.com",
  "logo_uri": "https://example.com/logo.png",
  "software_id": "example-mcp",
  "software_version": "1.0.0",
  "jwks_uri": "https://example.com/jwks.json"
}
```

| フィールド | 必須 | 制約 |
|---|---|---|
| `client_id` | Yes | フェッチ URL と完全一致（仕様必須） |
| `redirect_uris` | Yes | 配列・1 件以上・URL 形式 |
| `grant_types` | No | `authorization_code` / `refresh_token` のみ受理 |
| `response_types` | No | `code` のみ受理 |
| `token_endpoint_auth_method` | No | 既定 `none`。`client_secret_*` は **拒否**（対称鍵禁止） |
| `client_secret` | - | プロパティ自体を **拒否** |
| `jwks_uri` | No | 将来の `private_key_jwt` 対応に向けて保存のみ |

#### キャッシュ・フェッチ

| ヘッダ | 動作 |
|---|---|
| `Cache-Control: max-age=N` | `metadataExpiresAt = now + N` |
| `Cache-Control: no-store` | DB 保存はするが期限ゼロ（毎回再検証） |
| ヘッダなし | 環境変数 `CIMD_CACHE_TTL_SEC`（既定 3600 秒） |
| `ETag` | DB 保存し、期限切れ時に `If-None-Match` で条件付きリクエスト |
| `304 Not Modified` | メタデータ本体を再利用、期限のみ更新 |

| 環境変数 | 既定値 | 説明 |
|---|---|---|
| `CIMD_MAX_BYTES` | `5120` (5KB) | メタデータドキュメントの最大サイズ |
| `CIMD_FETCH_TIMEOUT_MS` | `5000` | フェッチタイムアウト（ms） |
| `CIMD_CACHE_TTL_SEC` | `3600` | デフォルト TTL（秒） |

フェッチ失敗時は既存の有効キャッシュがあればフォールバック使用（`warn` ログ）。
4xx/5xx は新規クライアントの場合のみ `invalid_client` エラーを返す。

#### SSRF 対策

CIMD URL のフェッチには SSRF 対策を施した HTTP クライアント（`utils/safe-fetch.ts`）を使用する。

- `https:` スキーム必須、fragment / userinfo 禁止
- DNS 解決した全 IP を検証し、以下のレンジは拒否：
  - private / loopback / linkLocal / uniqueLocal / multicast / broadcast / reserved / unspecified
  - `169.254.0.0/16`（AWS / GCP メタデータサービス）
  - `100.64.0.0/10`（CGNAT）
- 検証済み IP に直接接続することで DNS rebinding を防止（`servername` で SNI、`Host` ヘッダはホスト名）
- リダイレクトは最大 3 ホップ手動追跡（各ホップで SSRF 再検査）
- レスポンスサイズが上限超過したら abort
- `Content-Type` が `application/json` で始まることを確認

#### 並行フェッチ抑止

同一 `client_id` への同時 authorize で二重フェッチが起きないよう、プロセス内 `Map<string, Promise>` で in-flight プロミスを共有する。
DB 側は Prisma `upsert(where: { clientId })` で冪等化する。

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
  "grant_types": ["authorization_code", "refresh_token"],
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
  "grant_types": ["authorization_code", "refresh_token"],
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

1. **クライアント解決**（`client_id` の形状で CIMD / DCR を分岐）
   - HTTPS URL → CIMD 経路（キャッシュ参照 → 期限切れなら条件付きフェッチ → 検証 → upsert）
   - UUID → DCR 経路（DB 検索）
2. redirect_uri 検証（登録済み / メタデータ宣言の URI 集合との照合）
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
CSRF 保護のため `Origin` または `Referer` ヘッダーが必須。

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

```json
{
  "redirect_url": "http://127.0.0.1:12345/callback?code=...&state=xyz789"
}
```

フロントエンドがこの URL にリダイレクトを実行する。

**Response (拒否時):**

```json
{
  "redirect_url": "http://127.0.0.1:12345/callback?error=access_denied&error_description=User%20denied%20access&state=xyz789"
}
```

**セキュリティ:**

- `Origin` または `Referer` ヘッダーによる CSRF 保護
- 許可されたオリジンからのリクエストのみ受け付ける

---

### トークンエンドポイント

```
POST /oauth/token
```

認可コードまたはリフレッシュトークンをアクセストークンと交換。

#### grant_type: authorization_code

認可コードを使用してアクセストークンとリフレッシュトークンを取得。

**Request (application/x-www-form-urlencoded または application/json):**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `grant_type` | Yes | `authorization_code` |
| `code` | Yes | 認可コード |
| `redirect_uri` | Yes | 認可リクエスト時と同じ URI |
| `client_id` | Yes | クライアント ID |
| `code_verifier` | Yes | PKCE code_verifier |
| `resource` | No | MCP サーバー URL（認可時と同じ） |

**Response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
  "scope": "mcp:read mcp:write"
}
```

#### grant_type: refresh_token

リフレッシュトークンを使用して新しいアクセストークンを取得。

**Request (application/x-www-form-urlencoded または application/json):**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `grant_type` | Yes | `refresh_token` |
| `refresh_token` | Yes | リフレッシュトークン |
| `client_id` | Yes | クライアント ID |
| `scope` | No | 要求スコープ（元のスコープ以下のみ可） |

**Response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "mcp:read mcp:write"
}
```

**注意:** リフレッシュトークンのローテーションは行わない（元のリフレッシュトークンは有効なまま）。

**Errors:**

| エラー | 説明 |
|--------|------|
| `invalid_grant` | 無効、期限切れ、または失効済みの認可コード/リフレッシュトークン |
| `invalid_client` | 無効なクライアント ID |
| `invalid_request` | PKCE 検証失敗、必須パラメータ不足 |
| `invalid_scope` | 要求スコープが元のスコープを超過 |
| `invalid_target` | リソースが認可時と不一致 |

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

アクセストークンまたはリフレッシュトークンを無効化（RFC 7009 準拠）。

**Request (application/x-www-form-urlencoded または application/json):**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `token` | Yes | 失効させるトークン（アクセストークンまたはリフレッシュトークン） |
| `client_id` | No | クライアント ID（検証用） |

**Response:**

```
200 OK
```

**注意:**
- 失効成功・失敗に関わらず 200 を返却（RFC 7009 準拠）
- 存在しないトークンでもエラーにならない
- `client_id` が指定された場合、トークンの所有クライアントと一致しない場合は失効しない
  - セキュリティログに警告が記録される

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
- **redirect_uri 検証（経路別）**:
  - **DCR 経路**: `localhost` / `127.0.0.1` のみ許可（`POST /oauth/register` 時に検証）
  - **CIMD 経路**: メタデータ宣言の `redirect_uris` 集合と完全一致のみ許可（任意ドメイン可）
- **CIMD SSRF 対策**: プライベート / ループバック / メタデータサービス / CGNAT レンジ拒否、DNS rebinding 対策、サイズ上限 5KB、タイムアウト 5 秒、最大 3 ホップ
- **CIMD 対称鍵禁止**: `client_secret*` プロパティ・`client_secret_basic` / `client_secret_post` / `client_secret_jwt` は拒否
- **CIMD client_id 一致**: フェッチ URL とメタデータ JSON 内 `client_id` の完全一致を検証（仕様必須）
- **CSRF 保護**: 同意エンドポイントで Origin/Referer ヘッダーを検証
- **アクセストークン有効期限**: 1時間
- **リフレッシュトークン有効期限**: 30日
- **認可コード有効期限**: 10分
- **認可コード使用回数**: 1回のみ（再利用時は関連トークン全て無効化）
- **スコープダウングレード**: リフレッシュ時に元のスコープ以下のみ許可
- **HTTPS 必須**: 本番環境では HTTPS のみ
- **本番環境シークレット必須**: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET は必須（開発環境はデフォルト値使用可）

## 関連ドキュメント

- [認証 API](./auth.md)
- [MCP 連携機能](../architecture/features/mcp-integration.md)
- [OAuth 2.1 データベース設計](../architecture/database/oauth.md)
- [ADR-0004: MCP クライアント識別に CIMD を採用（DCR と共存）](../adr/0004-mcp-cimd.md)
