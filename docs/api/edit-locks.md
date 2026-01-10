# 編集ロック API

テストスイート・テストケースの同時編集制御を行う API。

## 概要

編集ロックは、複数ユーザーが同じリソースを同時に編集することを防ぐ仕組み。

- **人間ユーザー**: 悲観的ロック（編集開始時にロック取得、ハートビートで延長）
- **Agent（MCP）**: 楽観的ロック（ロック確認のみ、取得しない）

## エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/locks` | ロック取得 |
| GET | `/locks` | ロック状態確認 |
| PATCH | `/locks/:lockId/heartbeat` | ハートビート更新 |
| DELETE | `/locks/:lockId` | ロック解放 |
| DELETE | `/locks/:lockId/force` | 強制解除（管理者） |

---

## ロック取得

編集ロックを取得する。

```
POST /api/locks
```

### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `targetType` | string | Yes | ロック対象種別（`SUITE` or `CASE`） |
| `targetId` | UUID | Yes | ロック対象の ID |

```json
{
  "targetType": "SUITE",
  "targetId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### レスポンス

**201 Created（成功）**

```json
{
  "lock": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "targetType": "SUITE",
    "targetId": "550e8400-e29b-41d4-a716-446655440000",
    "lockedBy": {
      "type": "user",
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "Alice"
    },
    "expiresAt": "2024-01-10T12:01:30.000Z"
  },
  "config": {
    "heartbeatIntervalSeconds": 30
  }
}
```

**409 Conflict（他者がロック中）**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Resource is already locked",
    "lockedBy": {
      "type": "user",
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "name": "Bob"
    },
    "expiresAt": "2024-01-10T12:01:30.000Z"
  }
}
```

---

## ロック状態確認

指定したリソースのロック状態を確認する。

```
GET /api/locks?targetType={type}&targetId={id}
```

### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `targetType` | string | Yes | ロック対象種別（`SUITE` or `CASE`） |
| `targetId` | UUID | Yes | ロック対象の ID |

### レスポンス

**200 OK（ロックあり）**

```json
{
  "isLocked": true,
  "lock": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "targetType": "SUITE",
    "targetId": "550e8400-e29b-41d4-a716-446655440000",
    "lockedBy": {
      "type": "user",
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "Alice"
    },
    "expiresAt": "2024-01-10T12:01:30.000Z"
  }
}
```

**200 OK（ロックなし）**

```json
{
  "isLocked": false,
  "lock": null
}
```

---

## ハートビート更新

ロックの有効期限を延長する。30 秒間隔での呼び出しを推奨。

```
PATCH /api/locks/:lockId/heartbeat
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `lockId` | UUID | ロック ID |

### レスポンス

**200 OK**

```json
{
  "lock": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "targetType": "SUITE",
    "targetId": "550e8400-e29b-41d4-a716-446655440000",
    "lockedBy": {
      "type": "user",
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "Alice"
    },
    "expiresAt": "2024-01-10T12:03:00.000Z"
  }
}
```

**403 Forbidden（他者のロック）**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Not lock owner"
  }
}
```

---

## ロック解放

ロックを解放する。

```
DELETE /api/locks/:lockId
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `lockId` | UUID | ロック ID |

### レスポンス

**204 No Content**

ロック解放成功。

**403 Forbidden（他者のロック）**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Not lock owner"
  }
}
```

---

## 強制ロック解除（管理者）

管理者が他者のロックを強制的に解除する。

```
DELETE /api/locks/:lockId/force
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `lockId` | UUID | ロック ID |

### 権限要件

以下のいずれかの権限が必要:
- プロジェクトの `OWNER` または `ADMIN` ロール
- 組織の `OWNER` または `ADMIN` ロール

### レスポンス

**200 OK**

```json
{
  "message": "Lock forcibly released",
  "releasedLock": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "targetType": "SUITE",
    "targetId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**403 Forbidden（権限不足）**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin permission required to force release lock"
  }
}
```

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Lock not found"
  }
}
```

---

## エラーコード

| コード | 説明 |
|-------|------|
| `CONFLICT` | リソースが他者にロックされている |
| `FORBIDDEN` | 権限不足（ロック所有者でない、または管理者権限がない） |
| `NOT_FOUND` | ロックが存在しない |
| `UNAUTHORIZED` | 認証エラー |

---

## 使用フロー

### 人間ユーザーの編集フロー

```
1. 編集画面を開く
   └─▶ POST /api/locks（ロック取得）

2. 編集中（30秒ごと）
   └─▶ PATCH /api/locks/:lockId/heartbeat

3. 保存/キャンセル
   └─▶ DELETE /api/locks/:lockId（ロック解放）

※ ハートビートが60秒以上途絶えると自動解除
```

### Agent（MCP）の更新フロー

```
1. 更新ツール実行（update_test_suite 等）
   │
   ├─▶ 内部で GET /api/locks（ロック確認）
   │
   ├─▶ ロックなし → 更新実行
   │
   └─▶ ロックあり → 409 Conflict
       「ユーザー '{name}' が現在このテストスイートを編集中です」
```

---

## 関連ドキュメント

- [同時編集制御テーブル](../architecture/database/edit-lock.md)
- [WebSocket イベント](../architecture/overview.md)
