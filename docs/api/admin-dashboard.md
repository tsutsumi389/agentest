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
      "byPlan": {
        "free": 1000,
        "pro": 234
      },
      "newThisMonth": 45,
      "activeUsers": 567
    },
    "organizations": {
      "total": 89,
      "byPlan": {
        "team": 70,
        "enterprise": 19
      },
      "newThisMonth": 5,
      "activeOrgs": 42
    },
    "executions": {
      "totalThisMonth": 15678,
      "passCount": 14500,
      "failCount": 1000,
      "passRate": 93.5
    },
    "revenue": {
      "mrr": 1234567,
      "invoices": {
        "paid": 156,
        "pending": 12,
        "failed": 3
      }
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
| revenue | AdminDashboardRevenueStats | 収益統計 |
| systemHealth | AdminDashboardSystemHealth | システムヘルス |
| fetchedAt | string | 取得日時（ISO 8601形式） |

### AdminDashboardUserStats

| フィールド | 型 | 説明 |
|-----------|------|------|
| total | number | 総ユーザー数 |
| byPlan.free | number | FREEプランユーザー数 |
| byPlan.pro | number | PROプランユーザー数 |
| newThisMonth | number | 当月新規ユーザー数 |
| activeUsers | number | アクティブユーザー数（30日以内にログイン） |

### AdminDashboardOrgStats

| フィールド | 型 | 説明 |
|-----------|------|------|
| total | number | 総組織数 |
| byPlan.team | number | TEAMプラン組織数 |
| byPlan.enterprise | number | ENTERPRISEプラン組織数 |
| newThisMonth | number | 当月新規組織数 |
| activeOrgs | number | アクティブ組織数（30日以内にテスト実行あり） |

### AdminDashboardExecutionStats

| フィールド | 型 | 説明 |
|-----------|------|------|
| totalThisMonth | number | 当月の総テスト実行数 |
| passCount | number | 成功数 |
| failCount | number | 失敗数 |
| passRate | number | 成功率（%） |

### AdminDashboardRevenueStats

| フィールド | 型 | 説明 |
|-----------|------|------|
| mrr | number | 月間経常収益（円） |
| invoices.paid | number | 支払済み請求書数 |
| invoices.pending | number | 未払い請求書数 |
| invoices.failed | number | 支払失敗請求書数 |

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

---

## アクティブユーザーメトリクス API

### GET /admin/metrics/active-users

DAU/WAU/MAUの時系列データを取得する。

#### 認証

Cookie認証が必要。

```
Cookie: admin_session=<session_id>
```

#### クエリパラメータ

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|-----|-----------|------|
| `granularity` | enum | - | `day` | 粒度: `day`, `week`, `month` |
| `startDate` | string | - | 30日前 | 開始日 (ISO 8601) |
| `endDate` | string | - | 本日 | 終了日 (ISO 8601) |
| `timezone` | string | - | `Asia/Tokyo` | タイムゾーン |

#### レスポンス

##### 成功時 (200 OK)

```json
{
  "granularity": "day",
  "startDate": "2026-01-01T00:00:00.000Z",
  "endDate": "2026-01-31T23:59:59.999Z",
  "timezone": "Asia/Tokyo",
  "data": [
    { "date": "2026-01-01", "count": 150 },
    { "date": "2026-01-02", "count": 142 }
  ],
  "summary": {
    "average": 130,
    "max": 150,
    "min": 98,
    "changeRate": 5.2
  },
  "fetchedAt": "2026-02-01T10:00:00.000Z"
}
```

#### レスポンス型定義

##### ActiveUserMetricsResponse

| フィールド | 型 | 説明 |
|-----------|------|------|
| granularity | string | 粒度（day/week/month） |
| startDate | string | 開始日時（ISO 8601形式） |
| endDate | string | 終了日時（ISO 8601形式） |
| timezone | string | タイムゾーン |
| data | ActiveUserMetricDataPoint[] | 時系列データ |
| summary | ActiveUserMetricSummary | サマリー統計 |
| fetchedAt | string | 取得日時（ISO 8601形式） |

##### ActiveUserMetricDataPoint

| フィールド | 型 | 説明 |
|-----------|------|------|
| date | string | 日付（YYYY-MM-DD形式） |
| count | number | アクティブユーザー数 |

##### ActiveUserMetricSummary

| フィールド | 型 | 説明 |
|-----------|------|------|
| average | number | 期間内平均 |
| max | number | 最大値 |
| min | number | 最小値 |
| changeRate | number \| null | 前期間比（%） |

#### バリデーション

- `startDate` は `endDate` 以前の日付を指定
- 期間は最大365日まで
- `timezone` は有効なタイムゾーン識別子

#### キャッシュ仕様

- **過去データのみ**: TTL 5分
- **当日データ含む**: TTL 1分
- **キャッシュキー**: `admin:metrics:active-users:${hash}`

#### 使用例

##### cURL

```bash
curl -X GET "http://localhost:3001/api/v1/admin/metrics/active-users?granularity=day&startDate=2026-01-01" \
  -H "Cookie: admin_session=your-session-id"
```

##### TypeScript (fetch)

```typescript
const params = new URLSearchParams({
  granularity: 'day',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
});

const response = await fetch(`/api/v1/admin/metrics/active-users?${params}`, {
  method: 'GET',
  credentials: 'include',
});

const data = await response.json();
console.log(data.summary.average); // 期間平均
```

## 関連ドキュメント

- [管理者認証 API](./admin-auth.md)
- [システム管理者機能要件](../requirements/admin-system.md)
