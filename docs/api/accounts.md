# OAuth 連携管理 API

## 概要

ユーザーの OAuth プロバイダー連携を管理する API。連携一覧の取得、連携追加、連携解除が可能。

## サポートプロバイダー

| プロバイダー | ID | スコープ |
|-------------|-----|---------|
| GitHub | `github` | `user:email` |
| Google | `google` | `profile, email` |

## エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/users/:userId/accounts | 連携一覧取得 |
| GET | /api/auth/:provider/link | 連携追加開始 |
| DELETE | /api/users/:userId/accounts/:provider | 連携解除 |

---

## 連携一覧取得

```
GET /api/users/:userId/accounts
```

指定ユーザーの OAuth 連携一覧を取得。

### Path Parameters

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| userId | string | Yes | ユーザー ID（UUID） |

### Headers

```
Authorization: Bearer <access_token>
```

### Response

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "provider": "github",
      "providerAccountId": "12345678",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "provider": "google",
      "providerAccountId": "987654321",
      "createdAt": "2025-01-02T00:00:00.000Z",
      "updatedAt": "2025-01-02T00:00:00.000Z"
    }
  ]
}
```

### Response Fields

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | string | 連携 ID（UUID） |
| provider | string | プロバイダー名（github / google） |
| providerAccountId | string | プロバイダー側のアカウント ID |
| createdAt | string | 連携日時（ISO 8601） |
| updatedAt | string | 更新日時（ISO 8601） |

### Authorization

- 自分のアカウント情報のみ取得可能

### Errors

| コード | HTTP | 説明 |
|-------|------|------|
| AUTH_UNAUTHORIZED | 401 | 認証が必要 |
| AUTH_FORBIDDEN | 403 | 他ユーザーの情報は取得不可 |
| USER_NOT_FOUND | 404 | ユーザーが見つからない |

---

## 連携追加開始

```
GET /api/auth/:provider/link
```

新しい OAuth プロバイダーを既存アカウントに連携。OAuth フローを開始。

### Path Parameters

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| provider | string | Yes | プロバイダー名（github / google） |

### Headers

```
Authorization: Bearer <access_token>
```

### Response

OAuth プロバイダーの認可画面にリダイレクト。

### Flow

```
1. GET /api/auth/github/link
2. oauth_link_mode Cookie を設定
3. GitHub 認可画面にリダイレクト
4. ユーザー認可
5. GET /api/auth/github/callback
6. oauth_link_mode Cookie を検出
7. 既存ユーザーに連携追加
8. フロントエンドにリダイレクト（/settings?link=success）
```

### Cookie 設定

```
Set-Cookie: oauth_link_mode={"provider":"github","userId":"xxx"}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=300
```

### Redirect on Success

```
/settings?link=success
```

### Redirect on Error

```
/settings?link=error&message=<エラーメッセージ>
```

### Business Rules

- 認証済みユーザーのみ利用可能
- 同じプロバイダーの重複連携は不可
- 同じプロバイダーアカウントが別ユーザーに連携されている場合はエラー

### Errors

| コード | HTTP | 説明 |
|-------|------|------|
| AUTH_UNAUTHORIZED | 401 | 認証が必要 |
| VALIDATION_ERROR | 400 | 既に連携済みのプロバイダー |
| ACCOUNT_ALREADY_LINKED | 400 | このアカウントは別ユーザーに連携済み |

---

## 連携解除

```
DELETE /api/users/:userId/accounts/:provider
```

指定プロバイダーの連携を解除。

### Path Parameters

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| userId | string | Yes | ユーザー ID（UUID） |
| provider | string | Yes | プロバイダー名（github / google） |

### Headers

```
Authorization: Bearer <access_token>
```

### Response

```json
{
  "data": {
    "success": true
  }
}
```

### Business Rules

- 自分の連携のみ解除可能
- **最低1つの OAuth 連携は必須**
- 連携数が1の場合は解除不可

### Errors

| コード | HTTP | 説明 |
|-------|------|------|
| AUTH_UNAUTHORIZED | 401 | 認証が必要 |
| AUTH_FORBIDDEN | 403 | 他ユーザーの連携は解除不可 |
| ACCOUNT_NOT_FOUND | 404 | 連携が見つからない |
| VALIDATION_ERROR | 400 | 最低1つの連携が必要 |

### Error Response Example

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "最低1つのOAuth連携が必要です。連携を解除する前に別のプロバイダーを連携してください。"
  }
}
```

---

## 使用例

### JavaScript (fetch)

```javascript
const userId = 'current-user-id';

// 連携一覧取得
const response = await fetch(`/api/users/${userId}/accounts`, {
  credentials: 'include'
});
const { data: accounts } = await response.json();

// GitHub が連携済みか確認
const hasGitHub = accounts.some(a => a.provider === 'github');

// 連携追加（リダイレクト）
if (!hasGitHub) {
  window.location.href = '/api/auth/github/link';
}

// 連携解除
const unlinkResponse = await fetch(`/api/users/${userId}/accounts/google`, {
  method: 'DELETE',
  credentials: 'include'
});

if (!unlinkResponse.ok) {
  const { error } = await unlinkResponse.json();
  console.error(error.message);
}
```

### OAuth 連携追加後の結果取得

```javascript
// Settings ページでの結果検出
const params = new URLSearchParams(window.location.search);
const linkResult = params.get('link');
const message = params.get('message');

if (linkResult === 'success') {
  toast.success('OAuth 連携を追加しました');
} else if (linkResult === 'error') {
  toast.error(message || 'OAuth 連携に失敗しました');
}

// URL パラメータをクリア
window.history.replaceState({}, '', '/settings');
```

### TypeScript 型定義

```typescript
type OAuthProvider = 'github' | 'google';

interface Account {
  id: string;
  provider: OAuthProvider;
  providerAccountId: string;
  createdAt: string;
  updatedAt: string;
}

interface UnlinkResult {
  success: boolean;
}
```

---

## 関連ドキュメント

- [認証 API](./auth.md)
- [ユーザー API](./users.md)
- [セッション API](./sessions.md)
- [認証基盤詳細設計](../architecture/phase1-auth/README.md)
- [セキュリティ設計](../architecture/phase1-auth/security.md)
