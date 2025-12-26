# セッション管理 API

## 概要

ユーザーのログインセッションを管理する API。アクティブセッションの確認、個別・一括無効化が可能。

## エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/sessions | セッション一覧取得 |
| GET | /api/sessions/count | セッション数取得 |
| DELETE | /api/sessions/:sessionId | 特定セッション無効化 |
| DELETE | /api/sessions | 他セッション全無効化 |

---

## セッション一覧取得

```
GET /api/sessions
```

認証中ユーザーのアクティブセッション一覧を取得。

### Headers

```
Authorization: Bearer <access_token>
```

または Cookie に `access_token` が必要。

### Response

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "ipAddress": "192.168.1.1",
      "lastActiveAt": "2025-01-01T12:00:00.000Z",
      "expiresAt": "2025-01-08T12:00:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "isCurrent": true
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "ipAddress": "10.0.0.1",
      "lastActiveAt": "2025-01-01T10:00:00.000Z",
      "expiresAt": "2025-01-08T10:00:00.000Z",
      "createdAt": "2024-12-31T10:00:00.000Z",
      "isCurrent": false
    }
  ]
}
```

### Response Fields

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | string | セッション ID（UUID） |
| userAgent | string \| null | ブラウザ / クライアント情報 |
| ipAddress | string \| null | IP アドレス |
| lastActiveAt | string | 最終アクティブ日時（ISO 8601） |
| expiresAt | string | 有効期限（ISO 8601） |
| createdAt | string | 作成日時（ISO 8601） |
| isCurrent | boolean | 現在のセッションかどうか |

### Errors

| コード | HTTP | 説明 |
|-------|------|------|
| AUTH_UNAUTHORIZED | 401 | 認証が必要 |

---

## セッション数取得

```
GET /api/sessions/count
```

認証中ユーザーの有効なセッション数を取得。

### Headers

```
Authorization: Bearer <access_token>
```

### Response

```json
{
  "data": {
    "count": 3
  }
}
```

### Errors

| コード | HTTP | 説明 |
|-------|------|------|
| AUTH_UNAUTHORIZED | 401 | 認証が必要 |

---

## 特定セッション無効化

```
DELETE /api/sessions/:sessionId
```

指定したセッションを無効化（強制ログアウト）。

### Path Parameters

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| sessionId | string | Yes | セッション ID（UUID） |

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

- 現在のセッション（`isCurrent: true`）は無効化不可
- 自分のセッションのみ無効化可能
- 既に無効化済みのセッションは無効化不可

### Errors

| コード | HTTP | 説明 |
|-------|------|------|
| AUTH_UNAUTHORIZED | 401 | 認証が必要 |
| SESSION_NOT_FOUND | 404 | セッションが見つからない |
| VALIDATION_ERROR | 400 | 現在のセッションは無効化不可 |

### Error Response Example

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "現在のセッションを終了することはできません"
  }
}
```

---

## 他セッション全無効化

```
DELETE /api/sessions
```

現在のセッションを除く、全てのセッションを無効化。

### Headers

```
Authorization: Bearer <access_token>
```

### Response

```json
{
  "data": {
    "success": true,
    "revokedCount": 2
  }
}
```

### Response Fields

| フィールド | 型 | 説明 |
|-----------|-----|------|
| success | boolean | 処理成功 |
| revokedCount | number | 無効化されたセッション数 |

### Errors

| コード | HTTP | 説明 |
|-------|------|------|
| AUTH_UNAUTHORIZED | 401 | 認証が必要 |

---

## 使用例

### JavaScript (fetch)

```javascript
// セッション一覧取得
const response = await fetch('/api/sessions', {
  credentials: 'include'
});
const { data: sessions } = await response.json();

// 現在のセッションを特定
const currentSession = sessions.find(s => s.isCurrent);

// 特定セッション無効化
const revokeResponse = await fetch(`/api/sessions/${sessionId}`, {
  method: 'DELETE',
  credentials: 'include'
});

// 他のセッション全無効化
const revokeAllResponse = await fetch('/api/sessions', {
  method: 'DELETE',
  credentials: 'include'
});
const { data: { revokedCount } } = await revokeAllResponse.json();
console.log(`${revokedCount} sessions revoked`);
```

### TypeScript 型定義

```typescript
interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface RevokeSessionResult {
  success: boolean;
}

interface RevokeAllSessionsResult {
  success: boolean;
  revokedCount: number;
}

interface SessionCountResult {
  count: number;
}
```

---

## 関連ドキュメント

- [認証 API](./auth.md)
- [ユーザー API](./users.md)
- [認証基盤詳細設計](../architecture/phase1-auth/README.md)
- [セキュリティ設計](../architecture/phase1-auth/security.md)
