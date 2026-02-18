# 監査ログ API

組織の監査ログを取得・エクスポートするためのAPI。

## エンドポイント一覧

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | `/organizations/:organizationId/audit-logs` | 監査ログ一覧取得 | OWNER, ADMIN |
| GET | `/organizations/:organizationId/audit-logs/export` | 監査ログエクスポート | OWNER, ADMIN |

## 監査ログ一覧取得

### リクエスト

```
GET /api/v1/organizations/:organizationId/audit-logs
```

### クエリパラメータ

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|------------|------|
| page | number | - | 1 | ページ番号（1以上） |
| limit | number | - | 50 | 1ページあたりの件数（1-100） |
| category | string | - | - | カテゴリでフィルタリング |
| startDate | date | - | - | 開始日時（ISO 8601形式） |
| endDate | date | - | - | 終了日時（ISO 8601形式） |

### カテゴリ一覧

| カテゴリ | 説明 |
|----------|------|
| AUTH | 認証関連 |
| USER | ユーザー操作 |
| ORGANIZATION | 組織操作 |
| MEMBER | メンバー操作 |
| PROJECT | プロジェクト操作 |
| API_TOKEN | APIトークン操作 |

### レスポンス例

```json
{
  "logs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "category": "MEMBER",
      "action": "member.invited",
      "targetType": "user",
      "targetId": "user-uuid",
      "details": {
        "email": "user@example.com",
        "role": "MEMBER"
      },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0 ...",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "user": {
        "id": "user-uuid",
        "name": "Admin User",
        "email": "admin@example.com",
        "avatarUrl": "https://..."
      }
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

### エラーレスポンス

| ステータス | コード | 説明 |
|-----------|--------|------|
| 401 | UNAUTHORIZED | 認証が必要 |
| 403 | FORBIDDEN | OWNER/ADMIN権限が必要 |
| 404 | NOT_FOUND | 組織が見つからない |

## 監査ログエクスポート

監査ログをCSVまたはJSON形式でダウンロードする。

### リクエスト

```
GET /api/v1/organizations/:organizationId/audit-logs/export
```

### クエリパラメータ

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|------------|------|
| format | string | ○ | - | 出力形式（`csv` または `json`） |
| category | string | - | - | カテゴリでフィルタリング |
| startDate | date | - | - | 開始日時（ISO 8601形式） |
| endDate | date | - | - | 終了日時（ISO 8601形式） |

### CSV形式レスポンス

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="audit-logs-20240115-103000.csv"
```

```csv
ID,日時,カテゴリ,アクション,ユーザー,対象タイプ,対象ID,IPアドレス,詳細
550e8400-e29b-41d4-a716-446655440000,2024-01-15T10:30:00.000Z,MEMBER,member.invited,admin@example.com,user,user-uuid,192.168.1.1,"{""email"":""user@example.com"",""role"":""MEMBER""}"
```

**CSV仕様**:
- BOM付きUTF-8（Excel対応）
- ヘッダー行あり
- ダブルクォート、カンマ、改行を含むフィールドは適切にエスケープ

### JSON形式レスポンス

```
Content-Type: application/json
Content-Disposition: attachment; filename="audit-logs-20240115-103000.json"
```

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "category": "MEMBER",
    "action": "member.invited",
    "user": {
      "id": "admin-uuid",
      "email": "admin@example.com",
      "name": "Admin User"
    },
    "targetType": "user",
    "targetId": "user-uuid",
    "ipAddress": "192.168.1.1",
    "details": {
      "email": "user@example.com",
      "role": "MEMBER"
    }
  }
]
```

### エラーレスポンス

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | VALIDATION_ERROR | formatパラメータが不正 |
| 401 | UNAUTHORIZED | 認証が必要 |
| 403 | FORBIDDEN | OWNER/ADMIN権限が必要 |
| 404 | NOT_FOUND | 組織が見つからない |

## 権限

| 操作 | OWNER | ADMIN | MEMBER |
|------|-------|-------|--------|
| 監査ログ一覧取得 | ○ | ○ | - |
| 監査ログエクスポート | ○ | ○ | - |

## 使用例

### cURL

```bash
# 監査ログ一覧取得
curl -X GET "https://api.agentest.example.com/api/v1/organizations/{orgId}/audit-logs?page=1&limit=20&category=MEMBER" \
  -H "Authorization: Bearer <access_token>"

# CSVエクスポート
curl -X GET "https://api.agentest.example.com/api/v1/organizations/{orgId}/audit-logs/export?format=csv&startDate=2024-01-01" \
  -H "Authorization: Bearer <access_token>" \
  -o audit-logs.csv

# JSONエクスポート（特定期間）
curl -X GET "https://api.agentest.example.com/api/v1/organizations/{orgId}/audit-logs/export?format=json&startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer <access_token>" \
  -o audit-logs.json
```

## 関連ドキュメント

- [監査ログ機能仕様](../architecture/features/audit-log.md)
- [組織 API](./README.md#組織)
