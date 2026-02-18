# 認証 API

## 概要

メール/パスワード認証および OAuth 2.0 による認証を提供。メールアドレスとパスワード、または GitHub / Google アカウントでログイン可能。

認証後は JWT（Access Token / Refresh Token）を発行。

## フロー

### メール/パスワード認証

```
■ 新規登録（REQUIRE_EMAIL_VERIFICATION=true、デフォルト）
1. クライアント → POST /auth/register
2. サーバーでユーザー作成 + 確認メール送信
3. ユーザー情報を返却（JWT は未発行）
4. ユーザーが確認メール内リンクをクリック → GET /auth/verify-email?token=xxx
5. メールアドレス確認完了 → ログイン可能に

■ 新規登録（REQUIRE_EMAIL_VERIFICATION=false、メール認証スキップ）
1. クライアント → POST /auth/register
2. サーバーで emailVerified=true のユーザー作成 + JWT 即発行
3. Cookie 設定 + ユーザー情報を返却（emailVerificationSkipped: true）
4. 確認メールは送信されない

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

> **Note:** OAuthプロバイダーは環境変数（`GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` 等）が設定されている場合のみ有効になります。未設定のプロバイダーのエンドポイントは登録されず、404を返します。利用可能なプロバイダーは `GET /api/config` で確認できます。

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

**Response（2FA無効ユーザー）:**

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

**Response（2FA有効ユーザー）:**

2FA有効ユーザーの場合、JWTは発行されず一時トークンが返却される。`POST /auth/2fa/verify` で検証完了後にJWTが発行される。

```json
{
  "data": {
    "requires2FA": true,
    "twoFactorToken": "a1b2c3d4e5f6..."
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

メールアドレスとパスワードでアカウントを作成。`REQUIRE_EMAIL_VERIFICATION=true`（デフォルト）の場合、確認メールが送信される（自動ログインはされない）。`REQUIRE_EMAIL_VERIFICATION=false` の場合、メール認証をスキップして即ログインされる。

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

**Response (201) - メール認証あり（デフォルト）:**

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

**Response (201) - メール認証スキップ時（`REQUIRE_EMAIL_VERIFICATION=false`）:**

JWT Cookie（`access_token`, `refresh_token`）が設定される。

```json
{
  "data": {
    "message": "アカウントが作成されました。",
    "user": {
      "id": "usr_123456",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "emailVerificationSkipped": true
  }
}
```

**注意:**
- `REQUIRE_EMAIL_VERIFICATION=true`（デフォルト）: 登録後は自動ログインされず、確認メール内のリンクをクリックしてメールアドレスを確認する必要がある。確認完了後にログイン可能になる。
- `REQUIRE_EMAIL_VERIFICATION=false`: 登録と同時に `emailVerified=true` でユーザーが作成され、JWT が即発行される。確認メールは送信されない。

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

## 2FA（二要素認証）エンドポイント

TOTP（Time-based One-Time Password）による二要素認証。

### 2FAステータス取得

```
GET /auth/2fa/status
```

2FAの有効/無効状態を取得。**認証必須。** レート制限: 3回/分。

**Response:**

```json
{
  "data": {
    "totpEnabled": false
  }
}
```

---

### 2FAセットアップ

```
POST /auth/2fa/setup
```

TOTP秘密鍵を生成し、QRコードを返却。**認証必須。** レート制限: 3回/分。

**Response:**

```json
{
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,...",
    "otpauthUrl": "otpauth://totp/Agentest:user@example.com?secret=..."
  }
}
```

**注意:** 秘密鍵はRedisに一時保存（5分TTL）。有効期限内に `POST /auth/2fa/enable` で有効化する必要がある。

---

### 2FA有効化

```
POST /auth/2fa/enable
```

セットアップ時のTOTPコードを検証し、2FAを有効化。**認証必須。** レート制限: 5回/分。

**Request:**

```json
{
  "code": "123456"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `code` | string | Yes | 6桁のTOTPコード |

**Response:**

```json
{
  "data": {
    "message": "2FAが有効化されました"
  }
}
```

**Errors:**

| コード | ステータス | 説明 |
|-------|-----------|------|
| `2FA_ALREADY_ENABLED` | 400 | 既に2FAが有効 |
| `2FA_SETUP_EXPIRED` | 400 | セットアップ秘密鍵が期限切れ |
| `2FA_INVALID_CODE` | 400 | TOTPコードが不正 |

---

### 2FA検証（ログイン時）

```
POST /auth/2fa/verify
```

ログイン時の2FA検証。**認証不要**（一時トークンで認証）。レート制限: 5回/分。

**Request:**

```json
{
  "twoFactorToken": "a1b2c3d4e5f6...",
  "code": "123456"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `twoFactorToken` | string | Yes | ログイン時に返却された一時トークン |
| `code` | string | Yes | 6桁のTOTPコード |

**Response:**

検証成功時、JWTが発行されCookieに設定される。

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
| `AUTH_INVALID_TOKEN` | 401 | 一時トークンが無効または期限切れ（5分） |
| `2FA_INVALID_CODE` | 400 | TOTPコードが不正 |
| `2FA_CODE_ALREADY_USED` | 400 | TOTPコードが既に使用済み（リプレイ攻撃対策） |
| `RATE_LIMIT_EXCEEDED` | 429 | レート制限超過 |

---

### 2FA無効化

```
POST /auth/2fa/disable
```

パスワード確認後、2FAを無効化。**認証必須。** レート制限: 5回/分。

**Request:**

```json
{
  "password": "SecureP@ss1"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `password` | string | Yes | 現在のパスワード |

**Response:**

```json
{
  "data": {
    "message": "2FAが無効化されました"
  }
}
```

**Errors:**

| コード | ステータス | 説明 |
|-------|-----------|------|
| `AUTH_INVALID_CREDENTIALS` | 401 | パスワードが不正 |
| `2FA_NOT_ENABLED` | 400 | 2FAが有効化されていない |

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
    "totpEnabled": false,
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
| `2FA_ALREADY_ENABLED` | 2FAが既に有効化されている |
| `2FA_SETUP_EXPIRED` | 2FAセットアップの秘密鍵が期限切れ |
| `2FA_INVALID_CODE` | TOTPコードが不正 |
| `2FA_CODE_ALREADY_USED` | TOTPコードが既に使用済み |
| `2FA_NOT_ENABLED` | 2FAが有効化されていない |
| `RATE_LIMIT_EXCEEDED` | レート制限超過 |

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

// ログイン（2FA有効ユーザーの場合）
const loginRes = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'SecureP@ss1' }),
  credentials: 'include'
});
const loginData = await loginRes.json();
if (loginData.data.requires2FA) {
  // 2FA検証
  const verifyRes = await fetch('/api/v1/auth/2fa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      twoFactorToken: loginData.data.twoFactorToken,
      code: '123456'
    }),
    credentials: 'include'
  });
  const { data: { user } } = await verifyRes.json();
}

// 2FAセットアップ（設定画面から）
const setupRes = await fetch('/api/v1/auth/2fa/setup', {
  method: 'POST',
  credentials: 'include'
});
const { data: { qrCode, secret } } = await setupRes.json();
// QRコードを表示 → ユーザーが認証アプリでスキャン

// 2FA有効化
await fetch('/api/v1/auth/2fa/enable', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: '123456' }),
  credentials: 'include'
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
