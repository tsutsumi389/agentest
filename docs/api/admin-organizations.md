# 管理者組織管理 API

管理者向け組織一覧取得API。検索・フィルタ・ソート機能を提供する。

## エンドポイント

### GET /admin/organizations

全組織の一覧を検索・フィルタリングして取得する。

#### 認証

Cookie認証が必要。

```
Cookie: admin_session=<session_id>
```

#### リクエストパラメータ（Query）

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `q` | string | - | 名前で部分一致検索（最大100文字） |
| `status` | enum | `active` | active / deleted / all |
| `createdFrom` | datetime | - | 登録日From（ISO 8601形式） |
| `createdTo` | datetime | - | 登録日To（ISO 8601形式） |
| `page` | number | 1 | ページ番号 |
| `limit` | number | 20 | 1ページあたり件数（max: 100） |
| `sortBy` | enum | `createdAt` | createdAt / name |
| `sortOrder` | enum | `desc` | asc / desc |

**バリデーション:**
- `createdFrom`は`createdTo`以前の日付を指定する必要がある

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "organizations": [
    {
      "id": "org_abc123",
      "name": "サンプル株式会社",
      "description": "サンプルの組織です",
      "avatarUrl": "https://example.com/avatar.png",
      "createdAt": "2024-01-15T12:00:00.000Z",
      "updatedAt": "2024-06-01T09:30:00.000Z",
      "deletedAt": null,
      "stats": {
        "memberCount": 5,
        "projectCount": 10
      },
      "owner": {
        "id": "user_xyz789",
        "name": "田中太郎",
        "email": "tanaka@example.com",
        "avatarUrl": "https://example.com/user-avatar.png"
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

### AdminOrganizationListResponse

| フィールド | 型 | 説明 |
|-----------|------|------|
| organizations | AdminOrganizationListItem[] | 組織一覧 |
| pagination | AdminOrganizationPagination | ページネーション情報 |

### AdminOrganizationListItem

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | 組織ID |
| name | string | 組織名 |
| description | string \| null | 説明 |
| avatarUrl | string \| null | アバター画像URL |
| createdAt | string | 作成日時（ISO 8601形式） |
| updatedAt | string | 更新日時（ISO 8601形式） |
| deletedAt | string \| null | 削除日時（論理削除時のみ） |
| stats | AdminOrganizationStats | 組織統計情報 |
| owner | AdminOrganizationOwner \| null | オーナー情報 |

### AdminOrganizationStats

| フィールド | 型 | 説明 |
|-----------|------|------|
| memberCount | number | メンバー数 |
| projectCount | number | プロジェクト数 |

### AdminOrganizationOwner

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | ユーザーID |
| name | string | 表示名 |
| email | string | メールアドレス |
| avatarUrl | string \| null | アバター画像URL |

### AdminOrganizationPagination

| フィールド | 型 | 説明 |
|-----------|------|------|
| page | number | 現在のページ番号 |
| limit | number | 1ページあたりの件数 |
| total | number | 総件数 |
| totalPages | number | 総ページ数 |

## TypeScript型定義

```typescript
interface AdminOrganizationListResponse {
  organizations: AdminOrganizationListItem[];
  pagination: AdminOrganizationPagination;
}

interface AdminOrganizationListItem {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  stats: AdminOrganizationStats;
  owner: AdminOrganizationOwner | null;
}

interface AdminOrganizationStats {
  memberCount: number;
  projectCount: number;
}

interface AdminOrganizationOwner {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface AdminOrganizationPagination {
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
| BAD_REQUEST | 400 | パラメータ不正（不正な日付形式、limit超過、日付範囲不整合など） |
| INTERNAL_SERVER_ERROR | 500 | サーバーエラー |

## キャッシュ仕様

- **TTL**: 60秒
- **キャッシュキー**: `admin:organizations:${paramsHash}`
- キャッシュはRedisに保存される
- 検索条件が変わるとキャッシュキーも変わる

## 使用例

### cURL

```bash
# 基本的な取得
curl -X GET "http://localhost:3001/api/v1/admin/organizations" \
  -H "Cookie: admin_session=your-session-id"

# 検索・フィルタ付き
curl -X GET "http://localhost:3001/api/v1/admin/organizations?q=sample&status=active&page=1&limit=50" \
  -H "Cookie: admin_session=your-session-id"

# ソート指定
curl -X GET "http://localhost:3001/api/v1/admin/organizations?sortBy=name&sortOrder=asc" \
  -H "Cookie: admin_session=your-session-id"

# 日付範囲フィルタ
curl -X GET "http://localhost:3001/api/v1/admin/organizations?createdFrom=2024-01-01T00:00:00Z&createdTo=2024-06-30T23:59:59Z" \
  -H "Cookie: admin_session=your-session-id"
```

### TypeScript (fetch)

```typescript
// 基本的な取得
const response = await fetch('/api/v1/admin/organizations', {
  method: 'GET',
  credentials: 'include',
});

const { organizations, pagination } = await response.json();
console.log(`総組織数: ${pagination.total}`);

// 検索・フィルタ付き
const params = new URLSearchParams({
  q: 'sample',
  status: 'active',
  page: '1',
  limit: '50',
  sortBy: 'createdAt',
  sortOrder: 'desc',
});

const filteredResponse = await fetch(`/api/v1/admin/organizations?${params}`, {
  method: 'GET',
  credentials: 'include',
});

const data = await filteredResponse.json();
data.organizations.forEach((org) => {
  console.log(`${org.name}`);
  console.log(`  メンバー: ${org.stats.memberCount}名`);
  console.log(`  プロジェクト: ${org.stats.projectCount}件`);
  if (org.owner) {
    console.log(`  オーナー: ${org.owner.name}`);
  }
});
```

---

### GET /admin/organizations/:id

指定した組織の詳細情報を取得する。

#### 認証

Cookie認証が必要。

```
Cookie: admin_session=<session_id>
```

#### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `id` | string | 組織ID |

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "organization": {
    "id": "org_abc123",
    "name": "サンプル株式会社",
    "description": "サンプルの組織です",
    "avatarUrl": "https://example.com/avatar.png",
    "createdAt": "2024-01-15T12:00:00.000Z",
    "updatedAt": "2024-06-01T09:30:00.000Z",
    "deletedAt": null,
    "stats": {
      "memberCount": 5,
      "projectCount": 10,
      "testSuiteCount": 25,
      "executionCount": 150
    },
    "members": [
      {
        "id": "mem_xyz789",
        "userId": "user_xyz789",
        "name": "田中太郎",
        "email": "tanaka@example.com",
        "avatarUrl": "https://example.com/user-avatar.png",
        "role": "OWNER",
        "joinedAt": "2024-01-15T12:00:00.000Z"
      }
    ],
    "projects": [
      {
        "id": "proj_abc123",
        "name": "メインプロジェクト",
        "description": "主要なテストプロジェクト",
        "memberCount": 5,
        "testSuiteCount": 10,
        "createdAt": "2024-02-01T10:00:00.000Z"
      }
    ],
    "recentAuditLogs": [
      {
        "id": "log_123",
        "category": "ORGANIZATION",
        "action": "PROJECT_CREATED",
        "targetType": "Project",
        "targetId": "proj_abc123",
        "user": {
          "id": "user_xyz789",
          "name": "田中太郎",
          "email": "tanaka@example.com"
        },
        "ipAddress": "192.168.1.1",
        "createdAt": "2024-06-01T09:30:00.000Z"
      }
    ]
  }
}
```

## レスポンス型定義（詳細）

### AdminOrganizationDetailResponse

| フィールド | 型 | 説明 |
|-----------|------|------|
| organization | AdminOrganizationDetail | 組織詳細 |

### AdminOrganizationDetail

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | 組織ID |
| name | string | 組織名 |
| description | string \| null | 説明 |
| avatarUrl | string \| null | アバター画像URL |
| createdAt | string | 作成日時（ISO 8601形式） |
| updatedAt | string | 更新日時（ISO 8601形式） |
| deletedAt | string \| null | 削除日時（論理削除時のみ） |
| stats | AdminOrganizationDetailStats | 組織統計情報 |
| members | AdminOrganizationMember[] | メンバー一覧（最新20件） |
| projects | AdminOrganizationProject[] | プロジェクト一覧（最新10件） |
| recentAuditLogs | AdminOrganizationAuditLogEntry[] | 監査ログ（最新10件） |

### AdminOrganizationDetailStats

| フィールド | 型 | 説明 |
|-----------|------|------|
| memberCount | number | メンバー数 |
| projectCount | number | プロジェクト数 |
| testSuiteCount | number | テストスイート数 |
| executionCount | number | テスト実行数 |

### AdminOrganizationMember

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | メンバーシップID |
| userId | string | ユーザーID |
| name | string | 表示名 |
| email | string | メールアドレス |
| avatarUrl | string \| null | アバター画像URL |
| role | `OWNER` \| `ADMIN` \| `MEMBER` | 組織内役割 |
| joinedAt | string | 参加日時（ISO 8601形式） |

### AdminOrganizationProject

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | プロジェクトID |
| name | string | プロジェクト名 |
| description | string \| null | 説明 |
| memberCount | number | メンバー数 |
| testSuiteCount | number | テストスイート数 |
| createdAt | string | 作成日時（ISO 8601形式） |

### AdminOrganizationAuditLogEntry

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | ログID |
| category | string | カテゴリ |
| action | string | アクション |
| targetType | string \| null | 対象タイプ |
| targetId | string \| null | 対象ID |
| user | object \| null | 実行ユーザー情報（id, name, email） |
| ipAddress | string \| null | IPアドレス |
| createdAt | string | 作成日時（ISO 8601形式） |

## TypeScript型定義（詳細）

```typescript
interface AdminOrganizationDetailResponse {
  organization: AdminOrganizationDetail;
}

interface AdminOrganizationDetail {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  stats: AdminOrganizationDetailStats;
  members: AdminOrganizationMember[];
  projects: AdminOrganizationProject[];
  recentAuditLogs: AdminOrganizationAuditLogEntry[];
}

interface AdminOrganizationDetailStats {
  memberCount: number;
  projectCount: number;
  testSuiteCount: number;
  executionCount: number;
}

interface AdminOrganizationMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
}

interface AdminOrganizationProject {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  testSuiteCount: number;
  createdAt: string;
}

interface AdminOrganizationAuditLogEntry {
  id: string;
  category: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  user: { id: string; name: string; email: string } | null;
  ipAddress: string | null;
  createdAt: string;
}
```

## エラーコード

| コード | ステータス | 説明 |
|--------|-----------|------|
| UNAUTHORIZED | 401 | 認証されていない |
| FORBIDDEN | 403 | 管理者権限がない |
| NOT_FOUND | 404 | 組織が存在しない |
| BAD_REQUEST | 400 | パラメータ不正（不正な日付形式、limit超過、日付範囲不整合など） |
| INTERNAL_SERVER_ERROR | 500 | サーバーエラー |

## キャッシュ仕様

### 組織一覧

- **TTL**: 60秒
- **キャッシュキー**: `admin:organizations:${paramsHash}`
- キャッシュはRedisに保存される
- 検索条件が変わるとキャッシュキーも変わる

### 組織詳細

- **TTL**: 30秒
- **キャッシュキー**: `admin:organization:detail:${id}`
- キャッシュはRedisに保存される

## 使用例

### cURL

```bash
# 基本的な取得
curl -X GET "http://localhost:3001/api/v1/admin/organizations" \
  -H "Cookie: admin_session=your-session-id"

# 検索・フィルタ付き
curl -X GET "http://localhost:3001/api/v1/admin/organizations?q=sample&status=active&page=1&limit=50" \
  -H "Cookie: admin_session=your-session-id"

# ソート指定
curl -X GET "http://localhost:3001/api/v1/admin/organizations?sortBy=name&sortOrder=asc" \
  -H "Cookie: admin_session=your-session-id"

# 日付範囲フィルタ
curl -X GET "http://localhost:3001/api/v1/admin/organizations?createdFrom=2024-01-01T00:00:00Z&createdTo=2024-06-30T23:59:59Z" \
  -H "Cookie: admin_session=your-session-id"

# 組織詳細取得
curl -X GET "http://localhost:3001/api/v1/admin/organizations/org_abc123" \
  -H "Cookie: admin_session=your-session-id"
```

### TypeScript (fetch)

```typescript
// 基本的な取得
const response = await fetch('/api/v1/admin/organizations', {
  method: 'GET',
  credentials: 'include',
});

const { organizations, pagination } = await response.json();
console.log(`総組織数: ${pagination.total}`);

// 検索・フィルタ付き
const params = new URLSearchParams({
  q: 'sample',
  status: 'active',
  page: '1',
  limit: '50',
  sortBy: 'createdAt',
  sortOrder: 'desc',
});

const filteredResponse = await fetch(`/api/v1/admin/organizations?${params}`, {
  method: 'GET',
  credentials: 'include',
});

const data = await filteredResponse.json();
data.organizations.forEach((org) => {
  console.log(`${org.name}`);
  console.log(`  メンバー: ${org.stats.memberCount}名`);
  console.log(`  プロジェクト: ${org.stats.projectCount}件`);
  if (org.owner) {
    console.log(`  オーナー: ${org.owner.name}`);
  }
});

// 組織詳細取得
const detailResponse = await fetch('/api/v1/admin/organizations/org_abc123', {
  method: 'GET',
  credentials: 'include',
});

const { organization } = await detailResponse.json();
console.log(`組織名: ${organization.name}`);
console.log(`メンバー数: ${organization.stats.memberCount}`);
console.log(`プロジェクト数: ${organization.stats.projectCount}`);
console.log(`テストスイート数: ${organization.stats.testSuiteCount}`);
console.log(`テスト実行数: ${organization.stats.executionCount}`);

organization.members.forEach((member) => {
  console.log(`  ${member.name} (${member.role})`);
});
```

## 関連ドキュメント

- [管理者認証 API](./admin-auth.md)
- [管理者ダッシュボード API](./admin-dashboard.md)
- [管理者ユーザー管理 API](./admin-users.md)
- [システム管理者機能](../architecture/features/admin-system.md)
