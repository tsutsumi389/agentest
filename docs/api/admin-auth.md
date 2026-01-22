# 管理者認証 API

## 概要

管理者（システム運営者）向けの認証 API。メール/パスワード認証と 2FA（TOTP）をサポート。

ユーザー認証とは完全に独立したセッション管理を提供。

## ベース URL

```
/admin/auth
```

## エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/admin/auth/login` | 管理者ログイン |
| POST | `/admin/auth/logout` | 管理者ログアウト |
| GET | `/admin/auth/me` | 現在の管理者情報 |
| POST | `/admin/auth/refresh` | セッション延長 |
| POST | `/admin/auth/2fa/setup` | 2FA セットアップ |
| POST | `/admin/auth/2fa/enable` | 2FA 有効化 |
| POST | `/admin/auth/2fa/verify` | 2FA 検証 |
| POST | `/admin/auth/2fa/disable` | 2FA 無効化 |

---

## 認証エンドポイント

### 管理者ログイン

```
POST /admin/auth/login
```

メールアドレスとパスワードでログイン。2FA が有効な場合は追加の検証が必要。

**Request:**

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

| パラメータ | 必須 | 型 | 説明 |
|-----------|------|-----|------|
| `email` | Yes | string | メールアドレス |
| `password` | Yes | string | パスワード |

**Response (2FA 無効時):**

```json
{
  "data": {
    "user": {
      "id": "uuid-1234",
      "email": "admin@example.com",
      "name": "管理者太郎",
      "role": "ADMIN"
    }
  }
}
```

**Response (2FA 有効時):**

```json
{
  "data": {
    "requiresTwoFactor": true,
    "tempToken": "temp_xxxxx"
  }
}
```

**Cookies Set:**

```
Set-Cookie: admin_session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/admin
```

**Errors:**

| コード | HTTP | 説明 |
|-------|------|------|
| `ADMIN_INVALID_CREDENTIALS` | 401 | メールアドレスまたはパスワードが無効 |
| `ADMIN_ACCOUNT_LOCKED` | 423 | アカウントがロックされている |

---

### 管理者ログアウト

```
POST /admin/auth/logout
```

現在のセッションを終了し、Cookie を削除。

**Headers:**

Cookie に `admin_session` が必要。

**Response:**

```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

### 現在の管理者情報

```
GET /admin/auth/me
```

認証中の管理者情報を取得。

**Headers:**

Cookie に `admin_session` が必要。

**Response:**

```json
{
  "data": {
    "id": "uuid-1234",
    "email": "admin@example.com",
    "name": "管理者太郎",
    "role": "ADMIN",
    "totpEnabled": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

**Errors:**

| コード | HTTP | 説明 |
|-------|------|------|
| `ADMIN_UNAUTHORIZED` | 401 | セッションが無効または期限切れ |

---

### セッション延長

```
POST /admin/auth/refresh
```

セッションの有効期限を延長。

**Headers:**

Cookie に `admin_session` が必要。

**Response:**

```json
{
  "data": {
    "expiresAt": "2024-01-01T08:00:00Z"
  }
}
```

---

## 2FA エンドポイント

### 2FA セットアップ

```
POST /admin/auth/2fa/setup
```

TOTP 認証のセットアップを開始。QR コード用の URI とシークレットを取得。

**Headers:**

Cookie に `admin_session` が必要。

**Response:**

```json
{
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "uri": "otpauth://totp/Agentest%20Admin:admin@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Agentest%20Admin"
  }
}
```

**Note:** クライアント側で URI を QR コードに変換して表示。

---

### 2FA 有効化

```
POST /admin/auth/2fa/enable
```

セットアップ完了後、確認コードを送信して 2FA を有効化。

**Headers:**

Cookie に `admin_session` が必要。

**Request:**

```json
{
  "code": "123456"
}
```

| パラメータ | 必須 | 型 | 説明 |
|-----------|------|-----|------|
| `code` | Yes | string | TOTP コード（6桁） |

**Response:**

```json
{
  "data": {
    "message": "2FA enabled successfully"
  }
}
```

**Errors:**

| コード | HTTP | 説明 |
|-------|------|------|
| `ADMIN_INVALID_TOTP_CODE` | 400 | TOTP コードが無効 |
| `ADMIN_2FA_NOT_SETUP` | 400 | セットアップが完了していない |

---

### 2FA 検証

```
POST /admin/auth/2fa/verify
```

ログイン時の 2FA 検証。`/login` で `requiresTwoFactor: true` が返された後に呼び出す。

**Request:**

```json
{
  "tempToken": "temp_xxxxx",
  "code": "123456"
}
```

| パラメータ | 必須 | 型 | 説明 |
|-----------|------|-----|------|
| `tempToken` | Yes | string | ログイン時に取得した一時トークン |
| `code` | Yes | string | TOTP コード（6桁） |

**Response:**

```json
{
  "data": {
    "user": {
      "id": "uuid-1234",
      "email": "admin@example.com",
      "name": "管理者太郎",
      "role": "ADMIN"
    }
  }
}
```

**Cookies Set:**

```
Set-Cookie: admin_session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/admin
```

**Errors:**

| コード | HTTP | 説明 |
|-------|------|------|
| `ADMIN_INVALID_TOTP_CODE` | 400 | TOTP コードが無効 |
| `ADMIN_INVALID_TEMP_TOKEN` | 400 | 一時トークンが無効または期限切れ |

---

### 2FA 無効化

```
POST /admin/auth/2fa/disable
```

2FA を無効化。現在のパスワードと TOTP コードが必要。

**Headers:**

Cookie に `admin_session` が必要。

**Request:**

```json
{
  "password": "password123",
  "code": "123456"
}
```

| パラメータ | 必須 | 型 | 説明 |
|-----------|------|-----|------|
| `password` | Yes | string | 現在のパスワード |
| `code` | Yes | string | TOTP コード（6桁） |

**Response:**

```json
{
  "data": {
    "message": "2FA disabled successfully"
  }
}
```

**Errors:**

| コード | HTTP | 説明 |
|-------|------|------|
| `ADMIN_INVALID_CREDENTIALS` | 401 | パスワードが無効 |
| `ADMIN_INVALID_TOTP_CODE` | 400 | TOTP コードが無効 |

---

## セッション管理

### Cookie 設定

```
Set-Cookie: admin_session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/admin
```

| 属性 | 値 | 説明 |
|------|-----|------|
| `HttpOnly` | true | JavaScript からのアクセスを禁止 |
| `Secure` | true | HTTPS のみ（本番環境） |
| `SameSite` | Strict | クロスサイトリクエストを禁止 |
| `Path` | /admin | 管理画面パスのみに制限 |

### セッション有効期限

| 項目 | 値 |
|------|-----|
| 有効期限 | 8時間 |
| 非アクティブタイムアウト | 30分 |
| 延長後の有効期限 | 現在時刻 + 8時間 |

---

## エラーコード一覧

| コード | HTTP | 説明 |
|-------|------|------|
| `ADMIN_INVALID_CREDENTIALS` | 401 | 認証情報が無効 |
| `ADMIN_UNAUTHORIZED` | 401 | 認証が必要 |
| `ADMIN_FORBIDDEN` | 403 | 権限が不足 |
| `ADMIN_ACCOUNT_LOCKED` | 423 | アカウントがロックされている |
| `ADMIN_INVALID_TOTP_CODE` | 400 | TOTP コードが無効 |
| `ADMIN_INVALID_TEMP_TOKEN` | 400 | 一時トークンが無効 |
| `ADMIN_2FA_NOT_SETUP` | 400 | 2FA がセットアップされていない |
| `ADMIN_2FA_ALREADY_ENABLED` | 400 | 2FA は既に有効 |

---

## レート制限

| エンドポイント | 制限 |
|---------------|------|
| `/admin/auth/login` | 5回 / 15分（IP単位） |
| `/admin/auth/2fa/verify` | 5回 / 15分（IP単位） |
| その他 | 100回 / 15分 |

制限超過時は `429 Too Many Requests` を返却。

---

## 使用例

### JavaScript (fetch)

```javascript
// ログイン
const loginResponse = await fetch('/admin/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'password123'
  })
});
const loginData = await loginResponse.json();

// 2FA が必要な場合
if (loginData.data.requiresTwoFactor) {
  const verifyResponse = await fetch('/admin/auth/2fa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      tempToken: loginData.data.tempToken,
      code: '123456'
    })
  });
  const user = await verifyResponse.json();
}

// 現在のユーザー情報取得
const meResponse = await fetch('/admin/auth/me', {
  credentials: 'include'
});
const { data: adminUser } = await meResponse.json();

// ログアウト
await fetch('/admin/auth/logout', {
  method: 'POST',
  credentials: 'include'
});
```

---

## 関連ドキュメント

- [認証機能](../architecture/features/authentication.md#管理者認証機能)
- [管理者認証テーブル設計](../architecture/database/admin-auth.md)
- [API 設計方針](../architecture/api-design.md)
