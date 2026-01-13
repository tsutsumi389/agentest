# レビュー API

テストスイートに対するレビュー機能を提供する API。GitHub PR Review のようなセッションベースのレビューを実現。

## 概要

レビューは以下の2つのステータスを持つ:
- **DRAFT**: 下書き状態（投稿者のみ閲覧可能）
- **SUBMITTED**: 提出済み（公開）

評価（Verdict）は3種類:
- **APPROVED**: 承認
- **CHANGES_REQUESTED**: 要修正
- **COMMENT_ONLY**: コメントのみ

## エンドポイント一覧

### レビュー操作

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| POST | `/test-suites/:testSuiteId/reviews` | レビュー開始（DRAFT 作成） | WRITE 以上 |
| GET | `/test-suites/:testSuiteId/reviews` | レビュー一覧取得（SUBMITTED のみ） | READ 以上 |
| GET | `/reviews/drafts` | 自分の下書き一覧 | 認証済み |
| GET | `/reviews/:reviewId` | レビュー詳細取得 | READ 以上 |
| PATCH | `/reviews/:reviewId` | レビュー更新 | 投稿者本人 |
| POST | `/reviews/:reviewId/submit` | レビュー提出 | 投稿者本人 |
| PATCH | `/reviews/:reviewId/verdict` | 評価変更 | 投稿者本人 |
| DELETE | `/reviews/:reviewId` | レビュー削除（DRAFT のみ） | 投稿者本人 |

### コメント操作

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| POST | `/reviews/:reviewId/comments` | コメント追加 | DRAFT: 投稿者本人 / SUBMITTED: WRITE 以上 |
| PATCH | `/reviews/:reviewId/comments/:commentId` | コメント編集 | 投稿者本人 |
| PATCH | `/reviews/:reviewId/comments/:commentId/status` | ステータス変更 | WRITE 以上 |
| DELETE | `/reviews/:reviewId/comments/:commentId` | コメント削除 | 投稿者本人 |

### 返信操作

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| POST | `/reviews/:reviewId/comments/:commentId/replies` | 返信追加 | WRITE 以上 |
| PATCH | `/reviews/:reviewId/comments/:commentId/replies/:replyId` | 返信編集 | 投稿者本人 |
| DELETE | `/reviews/:reviewId/comments/:commentId/replies/:replyId` | 返信削除 | 投稿者本人 |

---

## レビュー開始

レビューを開始し、DRAFT 状態のレビューを作成する。

```
POST /api/test-suites/:testSuiteId/reviews
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `testSuiteId` | UUID | テストスイート ID |

### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `summary` | string | No | 初期サマリー（Markdown 対応） |

```json
{
  "summary": "オプションの初期サマリー"
}
```

### レスポンス

**201 Created**

```json
{
  "review": {
    "id": "uuid",
    "testSuiteId": "uuid",
    "authorUserId": "uuid",
    "authorAgentSessionId": null,
    "status": "DRAFT",
    "verdict": null,
    "summary": null,
    "submittedAt": null,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "author": {
      "id": "uuid",
      "name": "山田太郎",
      "avatarUrl": "https://..."
    },
    "agentSession": null,
    "comments": [],
    "_count": { "comments": 0 }
  }
}
```

**409 Conflict（既存の下書きあり）**

```json
{
  "error": {
    "code": "REVIEW_ALREADY_EXISTS",
    "message": "Draft review already exists for this test suite"
  }
}
```

---

## レビュー一覧取得

テストスイートの提出済みレビュー一覧を取得する。

```
GET /api/test-suites/:testSuiteId/reviews
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `testSuiteId` | UUID | テストスイート ID |

### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 | デフォルト |
|-----------|------|------|------|-----------|
| `verdict` | enum | No | 評価フィルタ（`APPROVED` / `CHANGES_REQUESTED` / `COMMENT_ONLY`） | - |
| `limit` | number | No | 取得件数（1-100） | 50 |
| `offset` | number | No | オフセット | 0 |

### レスポンス

**200 OK**

```json
{
  "reviews": [
    {
      "id": "uuid",
      "testSuiteId": "uuid",
      "status": "SUBMITTED",
      "verdict": "APPROVED",
      "summary": "問題ありません",
      "submittedAt": "2024-01-15T14:30:00Z",
      "author": {
        "id": "uuid",
        "name": "山田太郎",
        "avatarUrl": "https://..."
      },
      "agentSession": null,
      "_count": { "comments": 3 }
    }
  ],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

---

## 下書き一覧取得

自分の下書きレビュー一覧を取得する。

```
GET /api/reviews/drafts
```

### レスポンス

**200 OK**

```json
{
  "reviews": [
    {
      "id": "uuid",
      "testSuiteId": "uuid",
      "status": "DRAFT",
      "summary": null,
      "createdAt": "2024-01-10T10:00:00Z",
      "testSuite": {
        "id": "uuid",
        "title": "ログイン機能テスト",
        "project": {
          "id": "uuid",
          "name": "プロジェクトA"
        }
      },
      "_count": { "comments": 2 }
    }
  ]
}
```

---

## レビュー詳細取得

レビューの詳細を取得する。

```
GET /api/reviews/:reviewId
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `reviewId` | UUID | レビュー ID |

### レスポンス

**200 OK**

```json
{
  "review": {
    "id": "uuid",
    "testSuiteId": "uuid",
    "authorUserId": "uuid",
    "status": "SUBMITTED",
    "verdict": "APPROVED",
    "summary": "全体的に問題ありません。",
    "submittedAt": "2024-01-01T10:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z",
    "author": { ... },
    "agentSession": null,
    "comments": [
      {
        "id": "uuid",
        "targetType": "CASE",
        "targetId": "uuid",
        "targetField": "STEP",
        "targetItemId": "uuid",
        "content": "このステップの説明を明確にしてください",
        "status": "OPEN",
        "author": { ... },
        "replies": [
          {
            "id": "uuid",
            "content": "修正しました",
            "author": { ... }
          }
        ]
      }
    ],
    "_count": { "comments": 1 }
  }
}
```

**403 Forbidden（DRAFT で投稿者以外）**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Cannot access draft review"
  }
}
```

---

## レビュー更新

DRAFT 状態のレビューを更新する。

```
PATCH /api/reviews/:reviewId
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `reviewId` | UUID | レビュー ID |

### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `summary` | string | No | サマリー（Markdown 対応） |

```json
{
  "summary": "更新されたサマリー"
}
```

### レスポンス

**200 OK**

```json
{
  "review": {
    "id": "uuid",
    "status": "DRAFT",
    "summary": "更新されたサマリー",
    ...
  }
}
```

---

## レビュー提出

DRAFT レビューを提出し、SUBMITTED 状態に変更する。

```
POST /api/reviews/:reviewId/submit
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `reviewId` | UUID | レビュー ID |

### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `verdict` | enum | Yes | 評価（`APPROVED` / `CHANGES_REQUESTED` / `COMMENT_ONLY`） |
| `summary` | string | No | サマリー（Markdown 対応） |

```json
{
  "verdict": "APPROVED",
  "summary": "全体的に問題ありません。"
}
```

### レスポンス

**200 OK**

```json
{
  "review": {
    "id": "uuid",
    "status": "SUBMITTED",
    "verdict": "APPROVED",
    "summary": "全体的に問題ありません。",
    "submittedAt": "2024-01-01T10:00:00Z",
    ...
  }
}
```

**400 Bad Request（DRAFT 以外）**

```json
{
  "error": {
    "code": "INVALID_STATUS",
    "message": "Only draft reviews can be submitted"
  }
}
```

---

## 評価変更

提出済みレビューの評価を変更する。

```
PATCH /api/reviews/:reviewId/verdict
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `reviewId` | UUID | レビュー ID |

### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `verdict` | enum | Yes | 新しい評価（`APPROVED` / `CHANGES_REQUESTED` / `COMMENT_ONLY`） |

```json
{
  "verdict": "CHANGES_REQUESTED"
}
```

### レスポンス

**200 OK**

```json
{
  "review": {
    "id": "uuid",
    "status": "SUBMITTED",
    "verdict": "CHANGES_REQUESTED",
    ...
  }
}
```

**400 Bad Request（SUBMITTED 以外）**

```json
{
  "error": {
    "code": "INVALID_STATUS",
    "message": "Only submitted reviews can have verdict changed"
  }
}
```

---

## レビュー削除

DRAFT 状態のレビューを削除する。

```
DELETE /api/reviews/:reviewId
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `reviewId` | UUID | レビュー ID |

### レスポンス

**204 No Content**

削除成功。

**400 Bad Request（SUBMITTED のレビュー）**

```json
{
  "error": {
    "code": "INVALID_STATUS",
    "message": "Only draft reviews can be deleted"
  }
}
```

---

## コメント追加

レビューにコメントを追加する。

```
POST /api/reviews/:reviewId/comments
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `reviewId` | UUID | レビュー ID |

### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `targetType` | enum | Yes | 対象種別（`SUITE` / `CASE`） |
| `targetId` | UUID | Yes | 対象 ID（テストスイート or テストケース ID） |
| `targetField` | enum | Yes | 対象フィールド（`TITLE` / `DESCRIPTION` / `PRECONDITION` / `STEP` / `EXPECTED_RESULT`） |
| `targetItemId` | UUID | No | 対象アイテム ID（前提条件/ステップ/期待結果の行 ID） |
| `content` | string | Yes | コメント内容（Markdown 対応、最大 2000 文字） |

```json
{
  "targetType": "CASE",
  "targetId": "550e8400-e29b-41d4-a716-446655440000",
  "targetField": "STEP",
  "targetItemId": "660e8400-e29b-41d4-a716-446655440001",
  "content": "このステップの説明をもう少し詳しく書いてください"
}
```

### レスポンス

**201 Created**

```json
{
  "comment": {
    "id": "uuid",
    "reviewId": "uuid",
    "targetType": "CASE",
    "targetId": "uuid",
    "targetField": "STEP",
    "targetItemId": "uuid",
    "authorUserId": "uuid",
    "authorAgentSessionId": null,
    "content": "このステップの説明をもう少し詳しく書いてください",
    "status": "OPEN",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "author": {
      "id": "uuid",
      "name": "山田太郎",
      "avatarUrl": "https://..."
    },
    "agentSession": null,
    "replies": [],
    "_count": { "replies": 0 }
  }
}
```

---

## コメント編集

コメントを編集する。

```
PATCH /api/reviews/:reviewId/comments/:commentId
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `reviewId` | UUID | レビュー ID |
| `commentId` | UUID | コメント ID |

### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `content` | string | Yes | 新しいコメント内容（Markdown 対応、最大 2000 文字） |

```json
{
  "content": "編集されたコメント内容"
}
```

### レスポンス

**200 OK**

```json
{
  "comment": {
    "id": "uuid",
    "content": "編集されたコメント内容",
    "updatedAt": "2024-01-01T01:00:00Z",
    ...
  }
}
```

---

## コメントステータス変更

コメントのステータスを OPEN/RESOLVED に変更する。

```
PATCH /api/reviews/:reviewId/comments/:commentId/status
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `reviewId` | UUID | レビュー ID |
| `commentId` | UUID | コメント ID |

### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `status` | enum | Yes | 新しいステータス（`OPEN` / `RESOLVED`） |

```json
{
  "status": "RESOLVED"
}
```

### レスポンス

**200 OK**

```json
{
  "comment": {
    "id": "uuid",
    "status": "RESOLVED",
    "updatedAt": "2024-01-01T03:00:00Z",
    ...
  }
}
```

---

## コメント削除

コメントを削除する。

```
DELETE /api/reviews/:reviewId/comments/:commentId
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `reviewId` | UUID | レビュー ID |
| `commentId` | UUID | コメント ID |

### レスポンス

**204 No Content**

削除成功。

---

## 返信追加

コメントに返信を追加する。

```
POST /api/reviews/:reviewId/comments/:commentId/replies
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `reviewId` | UUID | レビュー ID |
| `commentId` | UUID | コメント ID |

### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `content` | string | Yes | 返信内容（Markdown 対応、最大 2000 文字） |

```json
{
  "content": "返信内容"
}
```

### レスポンス

**201 Created**

```json
{
  "reply": {
    "id": "uuid",
    "commentId": "uuid",
    "authorUserId": "uuid",
    "authorAgentSessionId": null,
    "content": "返信内容",
    "createdAt": "2024-01-01T04:00:00Z",
    "updatedAt": "2024-01-01T04:00:00Z",
    "author": {
      "id": "uuid",
      "name": "佐藤花子",
      "avatarUrl": "https://..."
    },
    "agentSession": null
  }
}
```

---

## 返信編集

返信を編集する。

```
PATCH /api/reviews/:reviewId/comments/:commentId/replies/:replyId
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `reviewId` | UUID | レビュー ID |
| `commentId` | UUID | コメント ID |
| `replyId` | UUID | 返信 ID |

### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `content` | string | Yes | 新しい返信内容（Markdown 対応、最大 2000 文字） |

```json
{
  "content": "編集された返信内容"
}
```

### レスポンス

**200 OK**

```json
{
  "reply": {
    "id": "uuid",
    "content": "編集された返信内容",
    "updatedAt": "2024-01-01T05:00:00Z",
    ...
  }
}
```

---

## 返信削除

返信を削除する。

```
DELETE /api/reviews/:reviewId/comments/:commentId/replies/:replyId
```

### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `reviewId` | UUID | レビュー ID |
| `commentId` | UUID | コメント ID |
| `replyId` | UUID | 返信 ID |

### レスポンス

**204 No Content**

削除成功。

---

## エラーコード

| コード | 説明 |
|-------|------|
| `REVIEW_ALREADY_EXISTS` | 同じテストスイートに対する下書きレビューが既に存在する |
| `REVIEW_NOT_FOUND` | レビューが見つからない |
| `COMMENT_NOT_FOUND` | コメントが見つからない |
| `REPLY_NOT_FOUND` | 返信が見つからない |
| `INVALID_STATUS` | 不正なステータス遷移 |
| `INVALID_TARGET` | 不正なコメント対象 |
| `FORBIDDEN` | 権限不足 |
| `UNAUTHORIZED` | 認証エラー |

---

## 使用フロー

### レビュー開始から提出まで

```
1. レビュー開始
   └─▶ POST /api/test-suites/:testSuiteId/reviews
       （DRAFT 状態のレビュー作成）

2. コメント追加（繰り返し）
   └─▶ POST /api/reviews/:reviewId/comments
       （テストスイート/テストケースの各フィールドにコメント）

3. レビュー提出
   └─▶ POST /api/reviews/:reviewId/submit
       （評価を選択して SUBMITTED に変更）
```

### コメントへの返信と解決

```
1. コメントへの返信
   └─▶ POST /api/reviews/:reviewId/comments/:commentId/replies

2. コメント解決
   └─▶ PATCH /api/reviews/:reviewId/comments/:commentId/status
       { "status": "RESOLVED" }

3. 評価変更（必要に応じて）
   └─▶ PATCH /api/reviews/:reviewId/verdict
       { "verdict": "APPROVED" }
```

---

## 関連ドキュメント

- [レビュー機能仕様](../architecture/features/review-comment.md)
- [レビュー テーブル定義](../architecture/database/review.md)
