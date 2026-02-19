# 管理者ダッシュボード API

管理者向けシステムダッシュボード統計情報の取得API。

## エンドポイント

### GET /admin/dashboard

システム全体の統計情報とヘルスステータスを取得する。

#### 認証

Cookie認証が必要。

```
Cookie: admin_session=<session_id>
```

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "data": {
    "users": {
      "total": 1234,
      "newThisMonth": 45,
      "activeUsers": 567
    },
    "organizations": {
      "total": 89,
      "newThisMonth": 5,
      "activeOrgs": 42
    },
    "executions": {
      "totalThisMonth": 15678,
      "passCount": 14500,
      "failCount": 1000,
      "passRate": 93.5
    },
    "systemHealth": {
      "api": { "status": "healthy", "latency": 0 },
      "database": { "status": "healthy", "latency": 5 },
      "redis": { "status": "healthy", "latency": 2 },
      "minio": { "status": "healthy", "latency": 10 }
    },
    "fetchedAt": "2024-01-15T12:00:00.000Z"
  }
}
```

## レスポンス型定義

### AdminDashboardStats

| フィールド | 型 | 説明 |
|-----------|------|------|
| users | AdminDashboardUserStats | ユーザー統計 |
| organizations | AdminDashboardOrgStats | 組織統計 |
| executions | AdminDashboardExecutionStats | テスト実行統計 |
| systemHealth | AdminDashboardSystemHealth | システムヘルス |
| fetchedAt | string | 取得日時（ISO 8601形式） |

### AdminDashboardUserStats

| フィールド | 型 | 説明 |
|-----------|------|------|
| total | number | 総ユーザー数 |
| newThisMonth | number | 当月新規ユーザー数 |
| activeUsers | number | アクティブユーザー数（30日以内にログイン） |

### AdminDashboardOrgStats

| フィールド | 型 | 説明 |
|-----------|------|------|
| total | number | 総組織数 |
| newThisMonth | number | 当月新規組織数 |
| activeOrgs | number | アクティブ組織数（30日以内にテスト実行あり） |

### AdminDashboardExecutionStats

| フィールド | 型 | 説明 |
|-----------|------|------|
| totalThisMonth | number | 当月の総テスト実行数 |
| passCount | number | 成功数 |
| failCount | number | 失敗数 |
| passRate | number | 成功率（%） |

### AdminDashboardSystemHealth

| フィールド | 型 | 説明 |
|-----------|------|------|
| api | SystemHealthStatus | API サーバー |
| database | SystemHealthStatus | PostgreSQL データベース |
| redis | SystemHealthStatus | Redis キャッシュ |
| minio | SystemHealthStatus | MinIO オブジェクトストレージ |

### SystemHealthStatus

| フィールド | 型 | 説明 |
|-----------|------|------|
| status | string | `healthy` / `unhealthy` / `not_configured` |
| latency | number | レイテンシ（ミリ秒） |
| error | string | エラーメッセージ（unhealthy時のみ） |

## エラーコード

| コード | ステータス | 説明 |
|--------|-----------|------|
| UNAUTHORIZED | 401 | 認証されていない |
| FORBIDDEN | 403 | 管理者権限がない |
| INTERNAL_SERVER_ERROR | 500 | サーバーエラー |

## キャッシュ仕様

- **TTL**: 5分（300秒）
- **キャッシュキー**: `admin:dashboard`
- キャッシュはRedisに保存される
- キャッシュヒット時は `fetchedAt` フィールドでデータの鮮度を確認可能

## 使用例

### cURL

```bash
curl -X GET http://localhost:3001/api/v1/admin/dashboard \
  -H "Cookie: admin_session=your-session-id"
```

### TypeScript (fetch)

```typescript
const response = await fetch('/api/v1/admin/dashboard', {
  method: 'GET',
  credentials: 'include',
});

const { data } = await response.json();
console.log(data.users.total); // ユーザー総数
console.log(data.systemHealth.database.status); // DBステータス
```

## 関連ドキュメント

- [管理者認証 API](./admin-auth.md)
- [システム管理者機能](../architecture/features/admin-system.md)
