# 認証 API

## 概要

メール/パスワード認証および OAuth 2.0 による認証を提供。メールアドレスとパスワード、または GitHub / Google アカウントでログイン可能。

認証後は JWT（Access Token / Refresh Token）を発行。

## フロー

### メール/パスワード認証

```
■ 新規登録
1. クライアント → POST /auth/register
2. サーバーでユーザー作成 + 確認メール送信
3. ユーザー情報を返却（JWT は未発行）
4. ユーザーが確認メール内リンクをクリック → GET /auth/verify-email?token=xxx
5. メールアドレス確認完了 → ログイン可能に

■ ログイン
1. クライアント → POST /auth/login
2. サーバーで認証（メールアドレス確認済みチェックを含む）
3. JWT Cookie 設定 → ユーザー情報を返却
```

### OAuth 認証

```
1. クライアント → /auth/github (or /auth/google)
2. リダイレクト → OAuth プロバイダ
3. ユーザー認可
4. コールバック → /auth/github/callback
5. JWT Cookie 設定 → クライアントにリダイレクト
```

## エンドポイント

### メール/パスワードログイン

```
POST /auth/login
```

メールアドレスとパスワードでログイン。

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecureP@ss1"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `email` | string | Yes | メールアドレス |
| `password` | string | Yes | パスワード |

**Response:**

```json
{
  "data": {
    "user": {
      "id": "usr_123456",
      "email": "user@example.com",
      "name": "John Doe",
      "avatarUrl": "https://..."
    }
  }
}
```

**Errors:**

| コード | ステータス | 説明 |
|-------|-----------|------|
| `AUTH_INVALID_CREDENTIALS` | 401 | メールアドレスまたはパスワードが不正 |
| `AUTH_ACCOUNT_LOCKED` | 401 | アカウントがロック中（5回連続失敗で30分ロック） |
| `EMAIL_NOT_VERIFIED` | 401 | メールアドレスが未確認 |
| `VALIDATION_ERROR` | 400 | 入力値が不正 |

---

### 新規登録

```
POST /auth/register
```

メールアドレスとパスワードでアカウントを作成。確認メールが送信される（自動ログインはされない）。

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecureP@ss1",
  "name": "John Doe"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `email` | string | Yes | メールアドレス |
| `password` | string | Yes | パスワード（8〜100文字、大文字・小文字・数字・記号必須） |
| `name` | string | Yes | 表示名（1〜100文字） |

**Response (201):**

```json
{
  "data": {
    "message": "確認メールを送信しました。メールをご確認ください。",
    "user": {
      "id": "usr_123456",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

**注意:** 登録後は自動ログインされず、確認メール内のリンクをクリックしてメールアドレスを確認する必要がある。確認完了後にログイン可能になる。

**Errors:**

| コード | ステータス | 説明 |
|-------|-----------|------|
| `AUTH_EMAIL_EXISTS` | 409 | メールアドレスが既に使用されている |
| `VALIDATION_ERROR` | 400 | 入力値が不正 |

---

### メールアドレス確認

```
GET /auth/verify-email?token=xxx
```

確認メール内のリンクから呼び出され、メールアドレスの所有を確認する。

**Query Parameters:**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `token` | Yes | 確認メールに含まれるトークン |

**Response:**

```json
{
  "data": {
    "message": "メールアドレスが確認されました。ログインしてください。"
  }
}
```

**Errors:**

| コード | ステータス | 説明 |
|-------|-----------|------|
| `AUTH_INVALID_TOKEN` | 400 | トークンが無効または期限切れ |

---

### 確認メール再送信

```
POST /auth/resend-verification
```

メールアドレス確認メールを再送信する。セキュリティのため、ユーザーが存在しない場合や既に確認済みの場合も同じレスポンスを返す。

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "data": {
    "message": "確認メールを再送信しました。"
  }
}
```

---

### パスワードリセット要求

```
POST /auth/forgot-password
```

パスワードリセット用のリンクをメールで送信。セキュリティのため、ユーザーが存在しない場合も同じレスポンスを返す。

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "data": {
    "message": "パスワードリセットのメールを送信しました。"
  }
}
```

---

### パスワードリセット実行

```
POST /auth/reset-password
```

リセットトークンを使ってパスワードを変更。成功時、全セッションが無効化される。

**Request:**

```json
{
  "token": "abcdef1234567890...",
  "password": "NewSecureP@ss1"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `token` | string | Yes | メールで受け取ったリセットトークン |
| `password` | string | Yes | 新しいパスワード（8〜100文字、大文字・小文字・数字・記号必須） |

**Response:**

```json
{
  "data": {
    "message": "パスワードがリセットされました。"
  }
}
```

**Errors:**

| コード | ステータス | 説明 |
|-------|-----------|------|
| `AUTH_INVALID_TOKEN` | 400 | トークンが無効または期限切れ |
| `VALIDATION_ERROR` | 400 | 入力値が不正 |

---

### GitHub OAuth 開始

```
GET /auth/github
```

GitHub の認可画面にリダイレクト。

**Query Parameters:**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `redirect` | No | 認証後のリダイレクト先 |

**Example:**

```
GET /auth/github?redirect=/dashboard
```

---

### GitHub OAuth コールバック

```
GET /auth/github/callback
```

GitHub からのコールバック。内部で処理され、JWT Cookie を設定後リダイレクト。

---

### Google OAuth 開始

```
GET /auth/google
```

Google の認可画面にリダイレクト。

---

### トークン更新

```
POST /auth/refresh
```

Refresh Token を使って新しい Access Token を取得。

**Request:**

Cookie に `refresh_token` が必要。

**Response:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs..."
  }
}
```

**Errors:**

| コード | 説明 |
|-------|------|
| 401 | Refresh Token が無効または期限切れ |

---

### ログアウト

```
POST /auth/logout
```

Refresh Token を無効化し、Cookie を削除。

**Response:**

```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

### 現在のユーザー情報

```
GET /auth/me
```

認証中のユーザー情報を取得。

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": {
    "id": "usr_123456",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": "https://...",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

**Errors:**

| コード | 説明 |
|-------|------|
| 401 | Access Token が無効または期限切れ |

## トークン仕様

| 種類 | 有効期限 | 保存場所 |
|-----|---------|---------|
| Access Token | 15分 | メモリ / Authorization ヘッダー |
| Refresh Token | 7日 | HttpOnly Cookie |

## Cookie 設定

```
Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/
```

## エラーコード

| コード | 説明 |
|-------|------|
| `AUTH_INVALID_TOKEN` | トークンが無効 |
| `AUTH_TOKEN_EXPIRED` | トークンが期限切れ |
| `AUTH_UNAUTHORIZED` | 認証が必要 |
| `AUTH_OAUTH_FAILED` | OAuth 認証に失敗 |
| `AUTH_INVALID_CREDENTIALS` | メールアドレスまたはパスワードが不正 |
| `AUTH_ACCOUNT_LOCKED` | アカウントがロック中 |
| `AUTH_EMAIL_EXISTS` | メールアドレスが既に使用されている |
| `EMAIL_NOT_VERIFIED` | メールアドレスが未確認（確認メールのリンクをクリックしてください） |

## 使用例

### JavaScript (fetch)

```javascript
// メール/パスワードログイン
const response = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'SecureP@ss1' }),
  credentials: 'include'
});
const { data: { user } } = await response.json();

// 新規登録（確認メールが送信される、自動ログインなし）
const response = await fetch('/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'SecureP@ss1', name: 'John' }),
  credentials: 'include'
});
// → /check-email にリダイレクト

// メールアドレス確認（確認メール内リンクから）
const response = await fetch('/api/v1/auth/verify-email?token=abcdef1234567890', {
  credentials: 'include'
});

// 確認メール再送信
await fetch('/api/v1/auth/resend-verification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

// OAuthログイン（リダイレクト）
window.location.href = '/api/v1/auth/github';

// パスワードリセット要求
await fetch('/api/v1/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

// パスワードリセット実行
await fetch('/api/v1/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'reset-token', password: 'NewSecureP@ss1' })
});

// ユーザー情報取得
const response = await fetch('/api/v1/auth/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
const { data: user } = await response.json();

// トークン更新
const response = await fetch('/api/v1/auth/refresh', {
  method: 'POST',
  credentials: 'include' // Cookie を送信
});
const { data: { accessToken } } = await response.json();
```

## APIキー認証

MCP サーバーへのアクセスに使用できる API キー認証。OAuth 2.1 に対応していない Coding Agent（Claude Code 等）向け。

### 認証ヘッダー

```
X-API-Key: agentest_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 認証優先順位

MCPサーバーでは以下の優先順位で認証を行う：

1. **OAuth Bearer Token** - `Authorization: Bearer <token>`
2. **API キー** - `X-API-Key: agentest_...`
3. **Cookie JWT** - `access_token` Cookie

### 特徴

- ユーザーと同等の権限（フルアクセス）
- 有効期限設定可能（または無期限）
- WebUI から管理可能
- 最終使用日時を記録

詳細は [認証機能](../architecture/features/authentication.md#apiキー認証) を参照。

---

## APIキー管理エンドポイント

WebUI でのAPIキー管理用エンドポイント。

### APIキー一覧取得

```
GET /api/api-tokens
```

認証中のユーザーが発行した API キー一覧を取得。

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": [
    {
      "id": "uuid-1234",
      "name": "Claude Code Token",
      "tokenPrefix": "agentest_x",
      "scopes": ["*"],
      "expiresAt": "2025-12-31T23:59:59Z",
      "lastUsedAt": "2025-01-15T12:00:00Z",
      "revokedAt": null,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### APIキー作成

```
POST /api/api-tokens
```

新しい API キーを作成。生トークンは作成直後の1回のみ取得可能。

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request:**

```json
{
  "name": "Claude Code Token",
  "expiresInDays": 90
}
```

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `name` | Yes | トークン名（1-100文字） |
| `expiresInDays` | No | 有効期限（日数）。省略時は無期限 |

**Response:**

```json
{
  "data": {
    "id": "uuid-1234",
    "name": "Claude Code Token",
    "tokenPrefix": "agentest_x",
    "rawToken": "agentest_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "scopes": ["*"],
    "expiresAt": "2025-04-01T00:00:00Z",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

**重要:** `rawToken` は作成時の1回のみ返却される。以後は取得不可。

---

### APIキー失効

```
DELETE /api/api-tokens/:id
```

指定した API キーを即時無効化。

**Headers:**

```
Authorization: Bearer <access_token>
```

**Path Parameters:**

| パラメータ | 説明 |
|-----------|------|
| `id` | API キー ID |

**Response:**

```json
{
  "data": {
    "message": "Token revoked successfully"
  }
}
```

**Errors:**

| コード | 説明 |
|-------|------|
| 400 | 無効なトークンID |
| 401 | 認証が必要 |
| 403 | 他ユーザーのトークン |
| 404 | トークンが存在しない |

---

## 関連ドキュメント

- [API 設計方針](../architecture/api-design.md)
- [ユーザー API](./users.md)
- [APIトークン データベース設計](../architecture/database/api-token.md)
- [認証機能](../architecture/features/authentication.md)
