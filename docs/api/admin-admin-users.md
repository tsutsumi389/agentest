# システム管理者管理 API

システム管理者アカウントの一覧取得・招待・更新・削除を行う API。**SUPER_ADMIN 権限を持つ管理者のみ**がアクセス可能。

## 認証

すべてのエンドポイントで Cookie 認証が必要（招待情報取得・受諾を除く）。

```
Cookie: admin_session=<session_id>
```

## エンドポイント

### GET /admin/admin-users

システム管理者の一覧を検索・フィルタリングして取得する。

#### リクエストパラメータ（Query）

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `q` | string | - | メール・名前で部分一致検索（最大 100 文字） |
| `role` | string | - | ロール（SUPER_ADMIN,ADMIN,VIEWER）カンマ区切り |
| `status` | enum | `active` | active / deleted / locked / all |
| `totpEnabled` | boolean | - | 2FA 有効状態でフィルタ |
| `createdFrom` | datetime | - | 登録日 From（ISO 8601 形式） |
| `createdTo` | datetime | - | 登録日 To（ISO 8601 形式） |
| `page` | number | 1 | ページ番号 |
| `limit` | number | 20 | 1 ページあたり件数（max: 100） |
| `sortBy` | enum | `createdAt` | createdAt / name / email / role / lastLoginAt |
| `sortOrder` | enum | `desc` | asc / desc |

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "adminUsers": [
    {
      "id": "admin_abc123",
      "email": "admin@example.com",
      "name": "管理者太郎",
      "role": "SUPER_ADMIN",
      "totpEnabled": true,
      "failedAttempts": 0,
      "lockedUntil": null,
      "createdAt": "2024-01-15T12:00:00.000Z",
      "updatedAt": "2024-06-01T09:30:00.000Z",
      "deletedAt": null,
      "activity": {
        "lastLoginAt": "2024-06-15T10:00:00.000Z",
        "activeSessionCount": 1
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### GET /admin/admin-users/:id

指定した管理者の詳細情報を取得する。

#### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | string (UUID) | 管理者 ID |

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "adminUser": {
    "id": "admin_abc123",
    "email": "admin@example.com",
    "name": "管理者太郎",
    "role": "SUPER_ADMIN",
    "totpEnabled": true,
    "failedAttempts": 0,
    "lockedUntil": null,
    "createdAt": "2024-01-15T12:00:00.000Z",
    "updatedAt": "2024-06-01T09:30:00.000Z",
    "deletedAt": null,
    "activity": {
      "lastLoginAt": "2024-06-15T10:00:00.000Z",
      "activeSessionCount": 1,
      "currentSessions": [
        {
          "id": "session_xyz",
          "ipAddress": "192.168.1.1",
          "userAgent": "Mozilla/5.0...",
          "lastActiveAt": "2024-06-15T10:00:00.000Z",
          "createdAt": "2024-06-15T08:00:00.000Z"
        }
      ]
    },
    "recentAuditLogs": [
      {
        "id": "log_123",
        "action": "LOGIN",
        "targetType": null,
        "targetId": null,
        "ipAddress": "192.168.1.1",
        "createdAt": "2024-06-15T10:00:00.000Z"
      }
    ]
  }
}
```

---

### POST /admin/admin-users

新しい管理者を招待する。招待メールが送信される。

#### リクエストボディ

```json
{
  "email": "new-admin@example.com",
  "name": "新しい管理者",
  "role": "ADMIN"
}
```

| パラメータ | 必須 | 型 | 説明 |
|-----------|------|-----|------|
| `email` | Yes | string | メールアドレス（最大 255 文字） |
| `name` | Yes | string | 表示名（最大 100 文字） |
| `role` | Yes | enum | SUPER_ADMIN / ADMIN / VIEWER |

#### レスポンス

##### 成功時 (201 Created)

```json
{
  "adminUser": {
    "id": "admin_new123",
    "email": "new-admin@example.com",
    "name": "新しい管理者",
    "role": "ADMIN",
    "totpEnabled": false,
    "createdAt": "2024-06-15T12:00:00.000Z"
  },
  "invitationSent": true
}
```

---

### PATCH /admin/admin-users/:id

管理者情報を更新する。

#### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | string (UUID) | 管理者 ID |

#### リクエストボディ

```json
{
  "name": "更新後の名前",
  "role": "VIEWER"
}
```

| パラメータ | 必須 | 型 | 説明 |
|-----------|------|-----|------|
| `name` | No | string | 表示名（最大 100 文字） |
| `role` | No | enum | SUPER_ADMIN / ADMIN / VIEWER |

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "adminUser": {
    "id": "admin_abc123",
    "email": "admin@example.com",
    "name": "更新後の名前",
    "role": "VIEWER",
    "totpEnabled": true,
    "createdAt": "2024-01-15T12:00:00.000Z",
    "updatedAt": "2024-06-15T12:00:00.000Z"
  }
}
```

---

### DELETE /admin/admin-users/:id

管理者を論理削除する。

#### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | string (UUID) | 管理者 ID |

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "message": "管理者を削除しました",
  "deletedAt": "2024-06-15T12:00:00.000Z"
}
```

---

### POST /admin/admin-users/:id/unlock

ロックされた管理者アカウントのロックを解除する。

#### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | string (UUID) | 管理者 ID |

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "message": "アカウントのロックを解除しました"
}
```

---

### POST /admin/admin-users/:id/reset-2fa

管理者の 2FA 設定をリセットする（紛失時の復旧用）。

#### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | string (UUID) | 管理者 ID |

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "message": "2FA設定をリセットしました"
}
```

---

### GET /admin/invitations/:token

招待情報を取得する。**認証不要**。

#### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `token` | string | 招待トークン |

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "email": "new-admin@example.com",
  "name": "新しい管理者",
  "role": "ADMIN",
  "invitedBy": "管理者太郎",
  "expiresAt": "2024-06-16T12:00:00.000Z"
}
```

---

### POST /admin/invitations/:token/accept

招待を受諾してアカウントを作成する。**認証不要**。

#### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `token` | string | 招待トークン |

#### リクエストボディ

```json
{
  "password": "SecurePassword123!"
}
```

| パラメータ | 必須 | 型 | 説明 |
|-----------|------|-----|------|
| `password` | Yes | string | パスワード（8 文字以上、大小英字・数字・記号を含む） |

#### レスポンス

##### 成功時 (201 Created)

```json
{
  "adminUser": {
    "id": "admin_new123",
    "email": "new-admin@example.com",
    "name": "新しい管理者",
    "role": "ADMIN"
  },
  "message": "アカウントが作成されました。ログインしてください。"
}
```

---

## エラーコード

| コード | ステータス | 説明 |
|--------|-----------|------|
| UNAUTHORIZED | 401 | 認証されていない |
| FORBIDDEN | 403 | SUPER_ADMIN 権限がない |
| NOT_FOUND | 404 | 管理者が存在しない |
| ADMIN_USER_ALREADY_EXISTS | 409 | メールアドレスが既に登録済み |
| CANNOT_DELETE_SELF | 400 | 自分自身は削除不可 |
| CANNOT_DELETE_LAST_SUPER_ADMIN | 400 | 最後の SUPER_ADMIN は削除不可 |
| CANNOT_EDIT_SELF_ROLE | 400 | 自分自身のロールは変更不可 |
| CANNOT_DEMOTE_LAST_SUPER_ADMIN | 400 | 最後の SUPER_ADMIN のロール変更不可 |
| INVITATION_NOT_FOUND | 404 | 招待が見つからない |
| INVITATION_EXPIRED | 400 | 招待の有効期限切れ |
| INVITATION_ALREADY_ACCEPTED | 400 | 招待が既に受諾済み |
| VALIDATION_ERROR | 400 | パラメータ不正 |
| INTERNAL_SERVER_ERROR | 500 | サーバーエラー |

---

## ビジネスルール

### 削除制約

| ルール | 説明 |
|--------|------|
| 自己削除禁止 | 自分自身のアカウントは削除不可 |
| 最後の SUPER_ADMIN 保護 | アクティブな SUPER_ADMIN が 1 人の場合、そのアカウントは削除不可 |

### ロール変更制約

| ルール | 説明 |
|--------|------|
| 自己ロール変更禁止 | 自分自身のロールは変更不可 |
| 最後の SUPER_ADMIN 降格禁止 | アクティブな SUPER_ADMIN が 1 人の場合、ロール変更不可 |

### 招待フロー

1. SUPER_ADMIN が招待 API を実行
2. 招待トークンが生成され、DB に保存
3. 招待メールが送信（招待リンク含む）
4. 新管理者が招待リンクにアクセス
5. パスワードを設定して招待を受諾
6. アカウントが作成され、ログイン可能に

### 招待有効期限

- 招待は作成から **24 時間** 有効

---

## レスポンス型定義

### SystemAdminListItem

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | 管理者 ID |
| email | string | メールアドレス |
| name | string | 表示名 |
| role | `SUPER_ADMIN` \| `ADMIN` \| `VIEWER` | ロール |
| totpEnabled | boolean | 2FA 有効状態 |
| failedAttempts | number | ログイン失敗回数 |
| lockedUntil | string \| null | ロック解除日時 |
| createdAt | string | 作成日時（ISO 8601 形式） |
| updatedAt | string | 更新日時（ISO 8601 形式） |
| deletedAt | string \| null | 削除日時（論理削除時のみ） |
| activity | SystemAdminListActivity | アクティビティ情報 |

### SystemAdminListActivity

| フィールド | 型 | 説明 |
|-----------|------|------|
| lastLoginAt | string \| null | 最終ログイン日時 |
| activeSessionCount | number | アクティブセッション数 |

### SystemAdminDetail

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | 管理者 ID |
| email | string | メールアドレス |
| name | string | 表示名 |
| role | `SUPER_ADMIN` \| `ADMIN` \| `VIEWER` | ロール |
| totpEnabled | boolean | 2FA 有効状態 |
| failedAttempts | number | ログイン失敗回数 |
| lockedUntil | string \| null | ロック解除日時 |
| createdAt | string | 作成日時（ISO 8601 形式） |
| updatedAt | string | 更新日時（ISO 8601 形式） |
| deletedAt | string \| null | 削除日時（論理削除時のみ） |
| activity | SystemAdminDetailActivity | アクティビティ情報 |
| recentAuditLogs | SystemAdminAuditLogEntry[] | 最近の監査ログ（10 件） |

### SystemAdminDetailActivity

| フィールド | 型 | 説明 |
|-----------|------|------|
| lastLoginAt | string \| null | 最終ログイン日時 |
| activeSessionCount | number | アクティブセッション数 |
| currentSessions | SystemAdminCurrentSession[] | 現在のセッション一覧 |

### SystemAdminCurrentSession

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | セッション ID |
| ipAddress | string \| null | IP アドレス |
| userAgent | string \| null | ユーザーエージェント |
| lastActiveAt | string | 最終活動日時 |
| createdAt | string | 作成日時 |

### SystemAdminAuditLogEntry

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | ログ ID |
| action | string | アクション |
| targetType | string \| null | 対象タイプ |
| targetId | string \| null | 対象 ID |
| ipAddress | string \| null | IP アドレス |
| createdAt | string | 作成日時 |

### SystemAdminPagination

| フィールド | 型 | 説明 |
|-----------|------|------|
| page | number | 現在のページ番号 |
| limit | number | 1 ページあたりの件数 |
| total | number | 総件数 |
| totalPages | number | 総ページ数 |

---

## キャッシュ仕様

| 対象 | TTL | キャッシュキー | 無効化タイミング |
|------|-----|---------------|-----------------|
| 一覧 | 60 秒 | `admin:admin-users:${paramsHash}` | 作成/更新/削除時 |
| 詳細 | 30 秒 | `admin:admin-user:detail:${id}` | 対象の更新/削除時 |

---

## 監査ログ記録

| アクション | 記録内容 |
|-----------|---------|
| ADMIN_USER_LIST | 一覧閲覧（検索条件） |
| ADMIN_USER_VIEW | 詳細閲覧（対象 ID） |
| ADMIN_USER_INVITE | 招待（メール、ロール） |
| ADMIN_USER_UPDATE | 更新（変更前後の値） |
| ADMIN_USER_DELETE | 削除（対象 ID） |
| ADMIN_USER_UNLOCK | ロック解除（対象 ID） |
| ADMIN_USER_RESET_2FA | 2FA リセット（対象 ID） |
| ADMIN_INVITATION_ACCEPTED | 招待受諾（対象 ID） |

---

## 使用例

### cURL

```bash
# 管理者一覧取得
curl -X GET "http://localhost:3001/api/v1/admin/admin-users" \
  -H "Cookie: admin_session=your-session-id"

# 検索・フィルタ付き
curl -X GET "http://localhost:3001/api/v1/admin/admin-users?q=admin&role=ADMIN,VIEWER&status=active" \
  -H "Cookie: admin_session=your-session-id"

# 管理者詳細取得
curl -X GET "http://localhost:3001/api/v1/admin/admin-users/admin_abc123" \
  -H "Cookie: admin_session=your-session-id"

# 管理者招待
curl -X POST "http://localhost:3001/api/v1/admin/admin-users" \
  -H "Cookie: admin_session=your-session-id" \
  -H "Content-Type: application/json" \
  -d '{"email":"new-admin@example.com","name":"新しい管理者","role":"ADMIN"}'

# 管理者更新
curl -X PATCH "http://localhost:3001/api/v1/admin/admin-users/admin_abc123" \
  -H "Cookie: admin_session=your-session-id" \
  -H "Content-Type: application/json" \
  -d '{"name":"更新後の名前"}'

# 管理者削除
curl -X DELETE "http://localhost:3001/api/v1/admin/admin-users/admin_abc123" \
  -H "Cookie: admin_session=your-session-id"

# アカウントロック解除
curl -X POST "http://localhost:3001/api/v1/admin/admin-users/admin_abc123/unlock" \
  -H "Cookie: admin_session=your-session-id"

# 2FAリセット
curl -X POST "http://localhost:3001/api/v1/admin/admin-users/admin_abc123/reset-2fa" \
  -H "Cookie: admin_session=your-session-id"

# 招待情報取得（認証不要）
curl -X GET "http://localhost:3001/api/v1/admin/invitations/abc123token"

# 招待受諾（認証不要）
curl -X POST "http://localhost:3001/api/v1/admin/invitations/abc123token/accept" \
  -H "Content-Type: application/json" \
  -d '{"password":"SecurePassword123!"}'
```

### TypeScript (fetch)

```typescript
// 管理者一覧取得
const listResponse = await fetch('/api/v1/admin/admin-users', {
  method: 'GET',
  credentials: 'include',
});
const { adminUsers, pagination } = await listResponse.json();
console.log(`総管理者数: ${pagination.total}`);

// 検索・フィルタ付き
const params = new URLSearchParams({
  q: 'admin',
  role: 'ADMIN,VIEWER',
  status: 'active',
  page: '1',
  limit: '50',
});
const filteredResponse = await fetch(`/api/v1/admin/admin-users?${params}`, {
  method: 'GET',
  credentials: 'include',
});

// 管理者招待
const inviteResponse = await fetch('/api/v1/admin/admin-users', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'new-admin@example.com',
    name: '新しい管理者',
    role: 'ADMIN',
  }),
});
const { adminUser, invitationSent } = await inviteResponse.json();
console.log(`招待メール送信: ${invitationSent}`);

// 招待受諾（認証不要）
const acceptResponse = await fetch('/api/v1/admin/invitations/abc123token/accept', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    password: 'SecurePassword123!',
  }),
});
const { message } = await acceptResponse.json();
console.log(message);
```

---

## 関連ドキュメント

- [管理者認証 API](./admin-auth.md)
- [管理者ダッシュボード API](./admin-dashboard.md)
- [管理者認証テーブル設計](../architecture/database/admin-auth.md)
- [システム管理者機能](../architecture/features/admin-system.md)
