# 管理者ユーザー管理 API

管理者向けユーザー一覧取得API。検索・フィルタ・ソート機能を提供する。

## エンドポイント

### GET /admin/users

全ユーザーの一覧を検索・フィルタリングして取得する。

#### 認証

Cookie認証が必要。

```
Cookie: admin_session=<session_id>
```

#### リクエストパラメータ（Query）

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `q` | string | - | メール・名前で部分一致検索 |
| `status` | enum | `active` | active / deleted / all |
| `createdFrom` | datetime | - | 登録日From（ISO 8601形式） |
| `createdTo` | datetime | - | 登録日To（ISO 8601形式） |
| `page` | number | 1 | ページ番号 |
| `limit` | number | 20 | 1ページあたり件数（max: 100） |
| `sortBy` | enum | `createdAt` | createdAt / name / email |
| `sortOrder` | enum | `desc` | asc / desc |

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "users": [
    {
      "id": "user_abc123",
      "email": "user@example.com",
      "name": "田中太郎",
      "avatarUrl": "https://example.com/avatar.png",
      "createdAt": "2024-01-15T12:00:00.000Z",
      "updatedAt": "2024-06-01T09:30:00.000Z",
      "deletedAt": null,
      "stats": {
        "organizationCount": 2,
        "projectCount": 5,
        "lastActiveAt": "2024-06-15T10:00:00.000Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1234,
    "totalPages": 62
  }
}
```

## レスポンス型定義

### AdminUserListResponse

| フィールド | 型 | 説明 |
|-----------|------|------|
| users | AdminUserListItem[] | ユーザー一覧 |
| pagination | AdminUserPagination | ページネーション情報 |

### AdminUserListItem

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | ユーザーID |
| email | string | メールアドレス |
| name | string | 表示名 |
| avatarUrl | string \| null | アバター画像URL |
| createdAt | string | 作成日時（ISO 8601形式） |
| updatedAt | string | 更新日時（ISO 8601形式） |
| deletedAt | string \| null | 削除日時（論理削除時のみ） |
| stats | AdminUserStats | ユーザー統計情報 |

### AdminUserStats

| フィールド | 型 | 説明 |
|-----------|------|------|
| organizationCount | number | 所属組織数 |
| projectCount | number | 参加プロジェクト数 |
| lastActiveAt | string \| null | 最終アクティブ日時 |

### AdminUserPagination

| フィールド | 型 | 説明 |
|-----------|------|------|
| page | number | 現在のページ番号 |
| limit | number | 1ページあたりの件数 |
| total | number | 総件数 |
| totalPages | number | 総ページ数 |

## TypeScript型定義

```typescript
interface AdminUserListResponse {
  users: AdminUserListItem[];
  pagination: AdminUserPagination;
}

interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  stats: {
    organizationCount: number;
    projectCount: number;
    lastActiveAt: string | null;
  };
}

interface AdminUserPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

## エラーコード

| コード | ステータス | 説明 |
|--------|-----------|------|
| UNAUTHORIZED | 401 | 認証されていない |
| FORBIDDEN | 403 | 管理者権限がない |
| BAD_REQUEST | 400 | パラメータ不正（不正な日付形式、limit超過など） |
| INTERNAL_SERVER_ERROR | 500 | サーバーエラー |

## キャッシュ仕様

- **TTL**: 60秒
- **キャッシュキー**: `admin:users:${paramsHash}`
- キャッシュはRedisに保存される
- 検索条件が変わるとキャッシュキーも変わる

## 使用例

### cURL

```bash
# 基本的な取得
curl -X GET "http://localhost:3001/api/v1/admin/users" \
  -H "Cookie: admin_session=your-session-id"

# 検索・フィルタ付き
curl -X GET "http://localhost:3001/api/v1/admin/users?q=tanaka&plan=PRO&status=active&page=1&limit=50" \
  -H "Cookie: admin_session=your-session-id"

# ソート指定
curl -X GET "http://localhost:3001/api/v1/admin/users?sortBy=name&sortOrder=asc" \
  -H "Cookie: admin_session=your-session-id"

# 日付範囲フィルタ
curl -X GET "http://localhost:3001/api/v1/admin/users?createdFrom=2024-01-01T00:00:00Z&createdTo=2024-06-30T23:59:59Z" \
  -H "Cookie: admin_session=your-session-id"
```

### TypeScript (fetch)

```typescript
// 基本的な取得
const response = await fetch('/api/v1/admin/users', {
  method: 'GET',
  credentials: 'include',
});

const { users, pagination } = await response.json();
console.log(`総ユーザー数: ${pagination.total}`);

// 検索・フィルタ付き
const params = new URLSearchParams({
  q: 'tanaka',
  plan: 'PRO',
  status: 'active',
  page: '1',
  limit: '50',
  sortBy: 'createdAt',
  sortOrder: 'desc',
});

const filteredResponse = await fetch(`/api/v1/admin/users?${params}`, {
  method: 'GET',
  credentials: 'include',
});

const data = await filteredResponse.json();
data.users.forEach((user) => {
  console.log(`${user.name} (${user.email})`);
});
```

---

### GET /admin/users/:id

指定したユーザーの詳細情報を取得する。

#### 認証

Cookie認証が必要。

```
Cookie: admin_session=<session_id>
```

#### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | string (UUID) | ユーザーID |

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "田中太郎",
    "avatarUrl": "https://example.com/avatar.png",
    "createdAt": "2024-01-15T12:00:00.000Z",
    "updatedAt": "2024-06-01T09:30:00.000Z",
    "deletedAt": null,
    "activity": {
      "lastActiveAt": "2024-06-15T10:00:00.000Z",
      "activeSessionCount": 2
    },
    "stats": {
      "organizationCount": 2,
      "projectCount": 5,
      "testSuiteCount": 10,
      "executionCount": 50
    },
    "organizations": [
      {
        "id": "org_xyz789",
        "name": "サンプル組織",
        "role": "ADMIN",
        "joinedAt": "2024-02-01T00:00:00.000Z"
      }
    ],
    "oauthProviders": [
      {
        "provider": "github",
        "createdAt": "2024-01-15T12:00:00.000Z"
      }
    ],
    "recentAuditLogs": [
      {
        "id": "log_123",
        "category": "AUTH",
        "action": "login",
        "targetType": null,
        "targetId": null,
        "ipAddress": "192.168.1.1",
        "createdAt": "2024-06-15T10:00:00.000Z"
      }
    ]
  }
}
```

##### エラー時 (404 Not Found)

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "ユーザーが見つかりません"
  }
}
```

##### エラー時 (400 Bad Request)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "無効なユーザーIDです",
    "details": {
      "id": ["有効なUUID形式で指定してください"]
    }
  }
}
```

## レスポンス型定義（詳細）

### AdminUserDetail

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | ユーザーID |
| email | string | メールアドレス |
| name | string | 表示名 |
| avatarUrl | string \| null | アバター画像URL |
| createdAt | string | 作成日時（ISO 8601形式） |
| updatedAt | string | 更新日時（ISO 8601形式） |
| deletedAt | string \| null | 削除日時（論理削除時のみ） |
| activity | AdminUserActivity | アクティビティ情報 |
| stats | AdminUserDetailStats | ユーザー統計情報 |
| organizations | AdminUserOrganization[] | 所属組織一覧 |
| oauthProviders | AdminUserOAuthProvider[] | OAuth連携プロバイダー一覧 |
| recentAuditLogs | AdminUserAuditLogEntry[] | 最近の監査ログ（10件） |

### AdminUserActivity

| フィールド | 型 | 説明 |
|-----------|------|------|
| lastActiveAt | string \| null | 最終アクティブ日時 |
| activeSessionCount | number | アクティブセッション数 |

### AdminUserDetailStats

| フィールド | 型 | 説明 |
|-----------|------|------|
| organizationCount | number | 所属組織数 |
| projectCount | number | 参加プロジェクト数 |
| testSuiteCount | number | 作成したテストスイート数 |
| executionCount | number | テスト実行数 |

### AdminUserOrganization

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | 組織ID |
| name | string | 組織名 |
| role | `OWNER` \| `ADMIN` \| `MEMBER` | 役割 |
| joinedAt | string | 参加日時（ISO 8601形式） |

### AdminUserOAuthProvider

| フィールド | 型 | 説明 |
|-----------|------|------|
| provider | string | プロバイダー名（github, google等） |
| createdAt | string | 連携日時（ISO 8601形式） |

### AdminUserAuditLogEntry

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | ログID |
| category | string | カテゴリ（AUTH, USER等） |
| action | string | アクション |
| targetType | string \| null | 対象タイプ |
| targetId | string \| null | 対象ID |
| ipAddress | string \| null | IPアドレス |
| createdAt | string | 作成日時（ISO 8601形式） |

## キャッシュ仕様（詳細）

- **TTL**: 30秒
- **キャッシュキー**: `admin:user:detail:${userId}`
- キャッシュはRedisに保存される

## 使用例（詳細）

### cURL

```bash
# ユーザー詳細取得
curl -X GET "http://localhost:3001/api/v1/admin/users/user_abc123" \
  -H "Cookie: admin_session=your-session-id"
```

### TypeScript (fetch)

```typescript
const response = await fetch('/api/v1/admin/users/user_abc123', {
  method: 'GET',
  credentials: 'include',
});

const { user } = await response.json();
console.log(`ユーザー名: ${user.name}`);
console.log(`所属組織数: ${user.stats.organizationCount}`);
console.log(`最終アクティブ: ${user.activity.lastActiveAt}`);
```

## 関連ドキュメント

- [管理者認証 API](./admin-auth.md)
- [管理者ダッシュボード API](./admin-dashboard.md)
- [システム管理者機能](../architecture/features/admin-system.md)
