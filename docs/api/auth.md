# 認証 API

## 概要

OAuth 2.0 による認証を提供。GitHub / Google アカウントでログイン可能。

認証後は JWT（Access Token / Refresh Token）を発行。

## フロー

```
1. クライアント → /auth/github (or /auth/google)
2. リダイレクト → OAuth プロバイダ
3. ユーザー認可
4. コールバック → /auth/github/callback
5. JWT Cookie 設定 → クライアントにリダイレクト
```

## エンドポイント

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

## 使用例

### JavaScript (fetch)

```javascript
// ログイン（リダイレクト）
window.location.href = '/api/v1/auth/github';

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

## 関連ドキュメント

- [API 設計方針](../architecture/api-design.md)
- [ユーザー API](./users.md)
