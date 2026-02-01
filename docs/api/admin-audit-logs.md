# 管理者監査ログ API

全組織の監査ログを横断検索・閲覧するための管理者向けAPI。検索・フィルタ・ソート機能を提供する。

## エンドポイント

### GET /admin/audit-logs

全組織の監査ログを検索・フィルタリングして取得する。

#### 認証

Cookie認証が必要。

```
Cookie: admin_session=<session_id>
```

#### リクエストパラメータ（Query）

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `q` | string | - | アクション名で部分一致検索 |
| `category` | string | - | カテゴリフィルタ（カンマ区切り） |
| `organizationId` | string (UUID) | - | 組織IDでフィルタ |
| `userId` | string (UUID) | - | ユーザーIDでフィルタ |
| `startDate` | datetime | - | 開始日時（ISO 8601形式） |
| `endDate` | datetime | - | 終了日時（ISO 8601形式） |
| `page` | number | 1 | ページ番号 |
| `limit` | number | 50 | 1ページあたり件数（max: 100） |
| `sortBy` | enum | `createdAt` | createdAt |
| `sortOrder` | enum | `desc` | asc / desc |

#### カテゴリ一覧

| カテゴリ | 説明 |
|---------|------|
| `AUTH` | 認証関連（ログイン、ログアウト等） |
| `USER` | ユーザー操作（プロフィール更新等） |
| `ORGANIZATION` | 組織操作（作成、更新、削除等） |
| `MEMBER` | メンバー操作（招待、ロール変更等） |
| `PROJECT` | プロジェクト操作（作成、更新、削除等） |
| `API_TOKEN` | APIトークン操作（作成、失効等） |
| `BILLING` | 課金操作（サブスクリプション変更等） |

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "auditLogs": [
    {
      "id": "log_abc123",
      "category": "AUTH",
      "action": "login",
      "targetType": null,
      "targetId": null,
      "details": null,
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0 ...",
      "createdAt": "2024-06-15T10:00:00.000Z",
      "organization": {
        "id": "org_xyz789",
        "name": "サンプル組織"
      },
      "user": {
        "id": "user_abc123",
        "name": "田中太郎",
        "email": "user@example.com",
        "avatarUrl": "https://example.com/avatar.png"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1234,
    "totalPages": 25
  }
}
```

## レスポンス型定義

### AdminAuditLogListResponse

| フィールド | 型 | 説明 |
|-----------|------|------|
| auditLogs | AdminAuditLogEntry[] | 監査ログ一覧 |
| pagination | AdminAuditLogPagination | ページネーション情報 |

### AdminAuditLogEntry

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | ログID |
| category | AdminAuditLogCategory | カテゴリ |
| action | string | アクション名 |
| targetType | string \| null | 対象リソースのタイプ |
| targetId | string \| null | 対象リソースのID |
| details | object \| null | 詳細情報（JSON） |
| ipAddress | string \| null | IPアドレス |
| userAgent | string \| null | ユーザーエージェント |
| createdAt | string | 作成日時（ISO 8601形式） |
| organization | AdminAuditLogOrganization \| null | 組織情報 |
| user | AdminAuditLogUser \| null | ユーザー情報 |

### AdminAuditLogOrganization

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | 組織ID |
| name | string | 組織名 |

### AdminAuditLogUser

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | ユーザーID |
| name | string | 表示名 |
| email | string | メールアドレス |
| avatarUrl | string \| null | アバター画像URL |

### AdminAuditLogPagination

| フィールド | 型 | 説明 |
|-----------|------|------|
| page | number | 現在のページ番号 |
| limit | number | 1ページあたりの件数 |
| total | number | 総件数 |
| totalPages | number | 総ページ数 |

## TypeScript型定義

```typescript
type AdminAuditLogCategory =
  | 'AUTH'
  | 'USER'
  | 'ORGANIZATION'
  | 'MEMBER'
  | 'PROJECT'
  | 'API_TOKEN'
  | 'BILLING';

interface AdminAuditLogListResponse {
  auditLogs: AdminAuditLogEntry[];
  pagination: AdminAuditLogPagination;
}

interface AdminAuditLogEntry {
  id: string;
  category: AdminAuditLogCategory;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  organization: AdminAuditLogOrganization | null;
  user: AdminAuditLogUser | null;
}

interface AdminAuditLogOrganization {
  id: string;
  name: string;
}

interface AdminAuditLogUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface AdminAuditLogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminAuditLogSearchParams {
  q?: string;
  category?: AdminAuditLogCategory[];
  organizationId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt';
  sortOrder?: 'asc' | 'desc';
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

- **TTL**: 30秒
- **キャッシュキー**: `admin:audit-logs:${paramsHash}`
- キャッシュはRedisに保存される
- 検索条件が変わるとキャッシュキーも変わる

## 使用例

### cURL

```bash
# 基本的な取得
curl -X GET "http://localhost:3001/api/v1/admin/audit-logs" \
  -H "Cookie: admin_session=your-session-id"

# 検索・フィルタ付き
curl -X GET "http://localhost:3001/api/v1/admin/audit-logs?q=login&category=AUTH&page=1&limit=50" \
  -H "Cookie: admin_session=your-session-id"

# 組織・ユーザーでフィルタ
curl -X GET "http://localhost:3001/api/v1/admin/audit-logs?organizationId=org_xyz789&userId=user_abc123" \
  -H "Cookie: admin_session=your-session-id"

# 日付範囲フィルタ
curl -X GET "http://localhost:3001/api/v1/admin/audit-logs?startDate=2024-01-01T00:00:00Z&endDate=2024-06-30T23:59:59Z" \
  -H "Cookie: admin_session=your-session-id"

# 複数カテゴリでフィルタ
curl -X GET "http://localhost:3001/api/v1/admin/audit-logs?category=AUTH,USER,ORGANIZATION" \
  -H "Cookie: admin_session=your-session-id"

# ソート指定（古い順）
curl -X GET "http://localhost:3001/api/v1/admin/audit-logs?sortBy=createdAt&sortOrder=asc" \
  -H "Cookie: admin_session=your-session-id"
```

### TypeScript (fetch)

```typescript
// 基本的な取得
const response = await fetch('/api/v1/admin/audit-logs', {
  method: 'GET',
  credentials: 'include',
});

const { auditLogs, pagination } = await response.json();
console.log(`総ログ数: ${pagination.total}`);

// 検索・フィルタ付き
const params = new URLSearchParams({
  q: 'login',
  category: 'AUTH,USER',
  page: '1',
  limit: '50',
  sortBy: 'createdAt',
  sortOrder: 'desc',
});

const filteredResponse = await fetch(`/api/v1/admin/audit-logs?${params}`, {
  method: 'GET',
  credentials: 'include',
});

const data = await filteredResponse.json();
data.auditLogs.forEach((log) => {
  console.log(`[${log.category}] ${log.action} by ${log.user?.name ?? 'Unknown'}`);
});

// 日付範囲でフィルタ
const dateParams = new URLSearchParams({
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-06-30T23:59:59Z',
});

const dateFilteredResponse = await fetch(`/api/v1/admin/audit-logs?${dateParams}`, {
  method: 'GET',
  credentials: 'include',
});
```

## 関連ドキュメント

- [管理者認証 API](./admin-auth.md)
- [管理者ダッシュボード API](./admin-dashboard.md)
- [管理者ユーザー管理 API](./admin-users.md)
- [管理者組織管理 API](./admin-organizations.md)
- [システム管理者機能要件](../architecture/features/admin-system.md)
