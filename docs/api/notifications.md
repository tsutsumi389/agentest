# 通知 API

通知機能に関する API エンドポイント。

## エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/notifications` | 通知一覧取得 |
| GET | `/notifications/unread-count` | 未読数取得 |
| PATCH | `/notifications/:id/read` | 既読にする |
| POST | `/notifications/mark-all-read` | 全て既読にする |
| DELETE | `/notifications/:id` | 通知を削除 |
| GET | `/notifications/preferences` | 通知設定取得 |
| PATCH | `/notifications/preferences/:type` | 通知設定更新 |

---

## GET `/notifications`

通知一覧を取得する。

### クエリパラメータ

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `limit` | number | - | `20` | 取得件数（1-100） |
| `offset` | number | - | `0` | オフセット |
| `unreadOnly` | boolean | - | `false` | 未読のみ取得 |

### レスポンス

```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "ORG_INVITATION",
      "title": "組織への招待",
      "body": "Example Org から招待されました",
      "data": {
        "organizationId": "uuid",
        "invitationId": "uuid",
        "inviteToken": "token-string"
      },
      "readAt": null,
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

### ステータスコード

| コード | 説明 |
|-------|------|
| 200 | 成功 |
| 401 | 認証エラー |

---

## GET `/notifications/unread-count`

未読通知の件数を取得する。

### レスポンス

```json
{
  "count": 5
}
```

### ステータスコード

| コード | 説明 |
|-------|------|
| 200 | 成功 |
| 401 | 認証エラー |

---

## PATCH `/notifications/:id/read`

通知を既読にする。

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | uuid | 通知 ID |

### レスポンス

```json
{
  "notification": {
    "id": "uuid",
    "type": "ORG_INVITATION",
    "title": "組織への招待",
    "body": "Example Org から招待されました",
    "data": { ... },
    "readAt": "2025-01-15T11:00:00.000Z",
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

### ステータスコード

| コード | 説明 |
|-------|------|
| 200 | 成功 |
| 401 | 認証エラー |
| 403 | アクセス権限エラー（他ユーザーの通知） |
| 404 | 通知が見つからない |

---

## POST `/notifications/mark-all-read`

全ての通知を既読にする。

### レスポンス

```json
{
  "updatedCount": 10
}
```

### ステータスコード

| コード | 説明 |
|-------|------|
| 200 | 成功 |
| 401 | 認証エラー |

---

## DELETE `/notifications/:id`

通知を削除する。

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | uuid | 通知 ID |

### レスポンス

ステータスコード 204（本文なし）

### ステータスコード

| コード | 説明 |
|-------|------|
| 204 | 成功（本文なし） |
| 401 | 認証エラー |
| 403 | アクセス権限エラー（他ユーザーの通知） |
| 404 | 通知が見つからない |

---

## GET `/notifications/preferences`

通知設定を取得する。全ての通知タイプについて、デフォルト値を含めて返却する。

### レスポンス

```json
{
  "preferences": [
    {
      "type": "ORG_INVITATION",
      "emailEnabled": true,
      "inAppEnabled": true
    },
    {
      "type": "INVITATION_ACCEPTED",
      "emailEnabled": true,
      "inAppEnabled": true
    },
    {
      "type": "PROJECT_ADDED",
      "emailEnabled": false,
      "inAppEnabled": true
    }
    // ... 他の通知タイプ
  ]
}
```

### ステータスコード

| コード | 説明 |
|-------|------|
| 200 | 成功 |
| 401 | 認証エラー |

---

## PATCH `/notifications/preferences/:type`

通知設定を更新する。

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `type` | string | 通知タイプ（NotificationType） |

### リクエストボディ

```json
{
  "emailEnabled": false,
  "inAppEnabled": true
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `emailEnabled` | boolean | - | メール通知の有効/無効 |
| `inAppEnabled` | boolean | - | アプリ内通知の有効/無効 |

### レスポンス

```json
{
  "preference": {
    "type": "ORG_INVITATION",
    "emailEnabled": false,
    "inAppEnabled": true
  }
}
```

### ステータスコード

| コード | 説明 |
|-------|------|
| 200 | 成功 |
| 400 | 無効な通知タイプ |
| 401 | 認証エラー |

### エラーレスポンス（400）

```json
{
  "error": {
    "code": "INVALID_NOTIFICATION_TYPE",
    "message": "無効な通知タイプです",
    "statusCode": 400
  }
}
```

---

## 通知タイプ（NotificationType）

| タイプ | 説明 |
|--------|------|
| `ORG_INVITATION` | 組織への招待 |
| `INVITATION_ACCEPTED` | 招待の承諾 |
| `PROJECT_ADDED` | プロジェクト追加 |
| `REVIEW_COMMENT` | レビューコメント |
| `TEST_COMPLETED` | テスト完了 |
| `TEST_FAILED` | テスト失敗 |

---

## 通知データ（data フィールド）のナビゲーション用キー

フロントエンドは通知クリック時に `data` フィールドの以下のキーを使用して関連ページへ遷移する。

| 通知タイプ | キー | 遷移先 |
|-----------|------|--------|
| `ORG_INVITATION` | `inviteToken` | `/invitations/:inviteToken` |
| `INVITATION_ACCEPTED` | `organizationId` | `/organizations/:organizationId/settings` |
| `PROJECT_ADDED` | `projectId` | `/projects/:projectId` |
| `REVIEW_COMMENT` | `testSuiteId` | `/test-suites/:testSuiteId` |
| `TEST_COMPLETED` | `executionId` | `/executions/:executionId` |
| `TEST_FAILED` | `executionId` | `/executions/:executionId` |

---

## 関連ドキュメント

- [通知機能 仕様](../architecture/features/notification.md)
