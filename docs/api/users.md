# ユーザー API

## 概要

ユーザー情報の取得・更新を行う API。

## エンドポイント

### ユーザー詳細取得

```
GET /users/:id
```

指定したユーザーの情報を取得。

**Path Parameters:**

| パラメータ | 説明 |
|-----------|------|
| `id` | ユーザー ID |

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
    "avatarUrl": "https://avatars.githubusercontent.com/u/...",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T12:00:00Z"
  }
}
```

**Errors:**

| コード | ステータス | 説明 |
|-------|-----------|------|
| `USER_NOT_FOUND` | 404 | ユーザーが存在しない |
| `AUTH_UNAUTHORIZED` | 401 | 認証が必要 |

---

### ユーザー更新

```
PUT /users/:id
```

ユーザー情報を更新。自分自身のみ更新可能。

**Path Parameters:**

| パラメータ | 説明 |
|-----------|------|
| `id` | ユーザー ID |

**Headers:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Jane Doe",
  "avatarUrl": "https://example.com/avatar.png"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `name` | string | No | 表示名（1-100文字） |
| `avatarUrl` | string | No | アバター画像 URL |

**Response:**

```json
{
  "data": {
    "id": "usr_123456",
    "email": "user@example.com",
    "name": "Jane Doe",
    "avatarUrl": "https://example.com/avatar.png",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-20T10:30:00Z"
  }
}
```

**Errors:**

| コード | ステータス | 説明 |
|-------|-----------|------|
| `USER_NOT_FOUND` | 404 | ユーザーが存在しない |
| `AUTH_UNAUTHORIZED` | 401 | 認証が必要 |
| `AUTH_FORBIDDEN` | 403 | 他人のプロフィールは編集不可 |
| `VALIDATION_ERROR` | 400 | 入力値が不正 |

---

## データモデル

### User

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | ユーザー ID（`usr_` プレフィックス） |
| `email` | string | メールアドレス |
| `name` | string | 表示名 |
| `avatarUrl` | string \| null | アバター画像 URL |
| `createdAt` | string | 作成日時（ISO 8601） |
| `updatedAt` | string | 更新日時（ISO 8601） |

## 使用例

### JavaScript (fetch)

```javascript
// ユーザー取得
const response = await fetch('/api/v1/users/usr_123456', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
const { data: user } = await response.json();

// ユーザー更新
const response = await fetch('/api/v1/users/usr_123456', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'New Name'
  })
});
const { data: updatedUser } = await response.json();
```

## 関連ドキュメント

- [認証 API](./auth.md)
- [API リファレンス](./README.md)
