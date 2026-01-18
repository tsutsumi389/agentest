# ラベル API

テストスイートに付与するラベルの管理 API です。

## 概要

ラベルはプロジェクト単位で管理され、テストスイートに複数付与できます。
GitHub の issue ラベルのように、名前・説明・色を設定できます。

## エンドポイント一覧

### ラベル管理（プロジェクト）

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/projects/:projectId/labels` | ラベル一覧取得 |
| POST | `/projects/:projectId/labels` | ラベル作成 |
| PATCH | `/projects/:projectId/labels/:labelId` | ラベル更新 |
| DELETE | `/projects/:projectId/labels/:labelId` | ラベル削除 |

### テストスイートラベル

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/test-suites/:testSuiteId/labels` | テストスイートのラベル一覧取得 |
| PUT | `/test-suites/:testSuiteId/labels` | テストスイートのラベル一括更新 |

---

## ラベル管理 API

### ラベル一覧取得

プロジェクトに属するラベルの一覧を取得します。

**リクエスト**
```
GET /api/projects/:projectId/labels
```

**クエリパラメータ**

| パラメータ | 型 | 説明 | デフォルト |
|-----------|-----|------|-----------|
| includeUsageCount | boolean | 使用中テストスイート数を含める | false |

**レスポンス**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "projectId": "550e8400-e29b-41d4-a716-446655440001",
      "name": "回帰テスト",
      "description": "リリース前に実行する回帰テスト",
      "color": "#FF5733",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "_count": {
        "testSuiteLabels": 5
      }
    }
  ]
}
```

**権限**: READ 以上

---

### ラベル作成

新規ラベルを作成します。

**リクエスト**
```
POST /api/projects/:projectId/labels
```

**リクエストボディ**
```json
{
  "name": "回帰テスト",
  "description": "リリース前に実行する回帰テスト",
  "color": "#FF5733"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|:----:|------|
| name | string | ✓ | ラベル名（1〜50文字、プロジェクト内で一意） |
| description | string | - | 説明（最大200文字） |
| color | string | ✓ | 色（HEX形式: #RRGGBB） |

**レスポンス**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "projectId": "550e8400-e29b-41d4-a716-446655440001",
    "name": "回帰テスト",
    "description": "リリース前に実行する回帰テスト",
    "color": "#FF5733",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**権限**: WRITE 以上

---

### ラベル更新

既存のラベルを更新します。

**リクエスト**
```
PATCH /api/projects/:projectId/labels/:labelId
```

**リクエストボディ**
```json
{
  "name": "リグレッションテスト",
  "description": "更新後の説明",
  "color": "#3366FF"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|:----:|------|
| name | string | - | ラベル名（1〜50文字、プロジェクト内で一意） |
| description | string | - | 説明（最大200文字、null で削除） |
| color | string | - | 色（HEX形式: #RRGGBB） |

**レスポンス**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "projectId": "550e8400-e29b-41d4-a716-446655440001",
    "name": "リグレッションテスト",
    "description": "更新後の説明",
    "color": "#3366FF",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-02T00:00:00.000Z"
  }
}
```

**権限**: WRITE 以上

---

### ラベル削除

ラベルを削除します。関連するテストスイートラベルも自動的に削除されます。

**リクエスト**
```
DELETE /api/projects/:projectId/labels/:labelId
```

**レスポンス**
```json
{
  "data": {
    "success": true
  }
}
```

**権限**: ADMIN 以上

---

## テストスイートラベル API

### テストスイートのラベル一覧取得

テストスイートに付与されているラベルの一覧を取得します。

**リクエスト**
```
GET /api/test-suites/:testSuiteId/labels
```

**レスポンス**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "projectId": "550e8400-e29b-41d4-a716-446655440001",
      "name": "回帰テスト",
      "description": "リリース前に実行する回帰テスト",
      "color": "#FF5733",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**権限**: READ 以上

---

### テストスイートのラベル一括更新

テストスイートに付与するラベルを一括で更新します。
指定されたラベル ID のリストで既存の関連付けを置き換えます。

**リクエスト**
```
PUT /api/test-suites/:testSuiteId/labels
```

**リクエストボディ**
```json
{
  "labelIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440002"
  ]
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|:----:|------|
| labelIds | string[] | ✓ | ラベル ID の配列（同一プロジェクトのラベルのみ） |

**レスポンス**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "projectId": "550e8400-e29b-41d4-a716-446655440001",
      "name": "回帰テスト",
      "description": "リリース前に実行する回帰テスト",
      "color": "#FF5733",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "projectId": "550e8400-e29b-41d4-a716-446655440001",
      "name": "スモークテスト",
      "description": "基本機能の確認",
      "color": "#33CC66",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**権限**: WRITE 以上

---

## エラーコード

| コード | 説明 |
|-------|------|
| LABEL_NOT_FOUND | 指定されたラベルが存在しない |
| LABEL_NAME_DUPLICATE | 同一プロジェクト内に同名のラベルが既に存在する |
| LABEL_NOT_IN_PROJECT | 指定されたラベルがテストスイートと同じプロジェクトに属していない |
| INVALID_COLOR_FORMAT | 色の形式が不正（HEX形式: #RRGGBB が必要） |

---

## 権限要件

| 操作 | OWNER | ADMIN | WRITE | READ |
|------|:-----:|:-----:|:-----:|:----:|
| ラベル一覧取得 | ✓ | ✓ | ✓ | ✓ |
| ラベル作成 | ✓ | ✓ | ✓ | - |
| ラベル更新 | ✓ | ✓ | ✓ | - |
| ラベル削除 | ✓ | ✓ | - | - |
| テストスイートラベル取得 | ✓ | ✓ | ✓ | ✓ |
| テストスイートラベル更新 | ✓ | ✓ | ✓ | - |

---

## 関連ドキュメント

- [プロジェクト管理機能](../architecture/features/project-management.md)
- [テストスイート管理機能](../architecture/features/test-suite-management.md)
- [ラベル データベース設計](../architecture/database/label.md)
