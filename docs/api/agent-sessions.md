# MCPセッション管理 API

## 概要

MCPセッション（AgentSession + OAuthトークン）を横断的に管理する API。Settings画面からアクティブなMCPセッションの確認・終了が可能。

2つのデータソース（AgentSession / OAuthAccessToken）を `source` フィールドで区別し、統一的なインターフェースで管理する。

## エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/agent-sessions | MCPセッション一覧取得 |
| DELETE | /api/agent-sessions/:sessionId | MCPセッション終了 |

---

## MCPセッション一覧取得

```
GET /api/agent-sessions
```

認証中ユーザーに関連するMCPセッション一覧を取得。AgentSessionとOAuthトークンを統合して返却する。

### Headers

```
Authorization: Bearer <access_token>
```

または Cookie に `access_token` が必要。

### Query Parameters

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| status | string | No | `ACTIVE,IDLE` | フィルタするステータス（カンマ区切り）。有効値: `ACTIVE`, `IDLE`, `ENDED`, `TIMEOUT` |
| page | number | No | 1 | ページ番号（1以上） |
| limit | number | No | 50 | 1ページあたりの件数（1〜100） |

### Response

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "source": "agent",
      "projectId": "project-uuid-001",
      "projectName": "My Project",
      "clientId": "claude-code",
      "clientName": "Claude Code",
      "status": "ACTIVE",
      "startedAt": "2025-01-01T12:00:00.000Z",
      "lastHeartbeat": "2025-01-01T12:05:00.000Z",
      "endedAt": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "source": "oauth",
      "projectId": null,
      "projectName": null,
      "clientId": "client-uuid-001",
      "clientName": "My MCP Client",
      "status": "ACTIVE",
      "startedAt": "2025-01-01T10:00:00.000Z",
      "lastHeartbeat": "2025-01-01T10:00:00.000Z",
      "endedAt": null
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 50
  }
}
```

### Response Fields

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | string | セッション/トークン ID（UUID） |
| source | `'agent'` \| `'oauth'` | データソース。`agent` = AgentSession、`oauth` = OAuthAccessToken |
| projectId | string \| null | プロジェクト ID。`oauth` の場合は常に `null` |
| projectName | string \| null | プロジェクト名。`oauth` の場合は常に `null` |
| clientId | string | クライアント ID |
| clientName | string \| null | クライアント表示名 |
| status | string | ステータス: `ACTIVE`, `IDLE`, `ENDED`, `TIMEOUT` |
| startedAt | string | 開始日時（ISO 8601） |
| lastHeartbeat | string | 最終ハートビート日時（ISO 8601）。`oauth` の場合は `startedAt` と同値 |
| endedAt | string \| null | 終了日時（ISO 8601）。未終了の場合は `null` |

### ステータス判定ルール

| ソース | 条件 | ステータス |
|--------|------|-----------|
| agent | AgentSession の status カラムをそのまま使用 | `ACTIVE` / `IDLE` / `ENDED` / `TIMEOUT` |
| oauth | `revokedAt` が設定済み | `ENDED` |
| oauth | `expiresAt` < 現在時刻 | `TIMEOUT` |
| oauth | その他 | `ACTIVE` |

### Errors

| コード | HTTP | 説明 |
|-------|------|------|
| AUTH_UNAUTHORIZED | 401 | 認証が必要 |

---

## MCPセッション終了

```
DELETE /api/agent-sessions/:sessionId
```

指定したMCPセッションを終了する。

### Path Parameters

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| sessionId | string | Yes | セッション ID（UUID） |

### Query Parameters

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| source | `'agent'` \| `'oauth'` | No | セッションの種別。省略時は自動判定（AgentSession → OAuthToken の順に検索） |

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

**AgentSession（`source: 'agent'`）の場合:**
- ユーザーがセッションの所属プロジェクトのメンバーであることを確認
- ステータスが `ENDED` または `TIMEOUT` の場合は終了不可
- 終了時: `status` → `ENDED`、`endedAt` → 現在時刻

**OAuthToken（`source: 'oauth'`）の場合:**
- トークンの所有者（`userId`）が認証中ユーザーと一致することを確認
- 既に `revokedAt` が設定済みの場合は終了不可
- 終了時: `revokedAt` → 現在時刻

**自動判定（`source` 省略時）:**
1. まず AgentSession として検索
2. 見つからない場合は OAuthToken として処理
3. いずれも見つからない場合は 404 エラー

### Errors

| コード | HTTP | 説明 |
|-------|------|------|
| AUTH_UNAUTHORIZED | 401 | 認証が必要 |
| AUTH_FORBIDDEN | 403 | セッションを終了する権限がない |
| NOT_FOUND | 404 | セッションが見つからない |
| VALIDATION_ERROR | 400 | セッションは既に終了済み / UUID形式不正 |

### Error Response Example

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "このセッションは既に終了しています"
  }
}
```

---

## TypeScript 型定義

```typescript
type SessionSource = 'agent' | 'oauth'

type AgentSessionStatus = 'ACTIVE' | 'IDLE' | 'ENDED' | 'TIMEOUT'

interface AgentSessionInfo {
  id: string
  source: SessionSource
  projectId: string | null
  projectName: string | null
  clientId: string
  clientName: string | null
  status: AgentSessionStatus
  startedAt: string
  lastHeartbeat: string
  endedAt: string | null
}

interface GetAgentSessionsResponse {
  data: AgentSessionInfo[]
  meta: {
    total: number
    page: number
    limit: number
  }
}

interface EndAgentSessionResponse {
  data: {
    success: boolean
  }
}
```

---

## 関連ドキュメント

- [セッション API](./sessions.md) - ログインセッション管理
- [OAuth 2.1 API](./oauth.md) - MCPクライアント向けOAuth認証
- [MCP連携機能](../architecture/features/mcp-integration.md) - MCP連携の全体設計
