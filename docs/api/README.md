# API リファレンス

Agentest REST API のドキュメントです。

## ベース URL

| 環境 | URL |
|-----|-----|
| Development | `http://localhost:3001/api/v1` |
| Staging | `https://staging-api.agentest.example.com/api/v1` |
| Production | `https://api.agentest.example.com/api/v1` |

## 認証

Bearer トークン認証を使用：

```
Authorization: Bearer <access_token>
```

詳細は [認証 API](./auth.md) を参照。

## エンドポイント一覧

### 認証

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/auth/github` | GitHub OAuth 開始 |
| GET | `/auth/google` | Google OAuth 開始 |
| POST | `/auth/refresh` | トークン更新 |
| POST | `/auth/logout` | ログアウト |
| GET | `/auth/me` | 現在のユーザー情報 |

→ [認証 API 詳細](./auth.md)

### OAuth 2.1（MCP クライアント向け）

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/.well-known/oauth-authorization-server` | Authorization Server Metadata |
| POST | `/oauth/register` | 動的クライアント登録（RFC 7591） |
| GET | `/oauth/authorize` | 認可エンドポイント |
| POST | `/oauth/authorize/consent` | 同意承認エンドポイント |
| POST | `/oauth/token` | トークンエンドポイント |
| POST | `/oauth/introspect` | トークンイントロスペクション |
| POST | `/oauth/revoke` | トークン失効 |

→ [OAuth 2.1 API 詳細](./oauth.md)

### ユーザー

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/users/:id` | ユーザー詳細 |
| PATCH | `/users/:id` | ユーザー更新 |
| DELETE | `/users/:id` | ユーザー削除（論理削除） |
| GET | `/users/:id/dashboard` | ダッシュボード統計 |

→ [ユーザー API 詳細](./users.md)

### セッション管理

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/sessions` | セッション一覧 |
| GET | `/sessions/count` | セッション数 |
| DELETE | `/sessions/:sessionId` | 特定セッション無効化 |
| DELETE | `/sessions` | 他セッション全無効化 |

→ [セッション API 詳細](./sessions.md)

### OAuth 連携管理

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/users/:userId/accounts` | 連携一覧 |
| GET | `/auth/:provider/link` | 連携追加開始 |
| DELETE | `/users/:userId/accounts/:provider` | 連携解除 |

→ [OAuth 連携 API 詳細](./accounts.md)

### API トークン管理

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api-tokens` | API トークン一覧 |
| POST | `/api-tokens` | API トークン作成 |
| DELETE | `/api-tokens/:id` | API トークン失効 |

→ [認証 API 詳細](./auth.md#apiキー管理エンドポイント)

### 組織

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/organizations` | 組織一覧 |
| POST | `/organizations` | 組織作成 |
| GET | `/organizations/:id` | 組織詳細 |
| PUT | `/organizations/:id` | 組織更新 |
| DELETE | `/organizations/:id` | 組織削除 |

### プロジェクト

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/projects` | プロジェクト一覧 |
| POST | `/projects` | プロジェクト作成 |
| GET | `/projects/:id` | プロジェクト詳細 |
| PUT | `/projects/:id` | プロジェクト更新 |
| DELETE | `/projects/:id` | プロジェクト削除 |
| GET | `/projects/:id/dashboard` | プロジェクトダッシュボード |

### ラベル

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/projects/:projectId/labels` | ラベル一覧取得 |
| POST | `/projects/:projectId/labels` | ラベル作成 |
| PATCH | `/projects/:projectId/labels/:labelId` | ラベル更新 |
| DELETE | `/projects/:projectId/labels/:labelId` | ラベル削除 |

→ [ラベル API 詳細](./labels.md)

### テストスイート

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/projects/:projectId/test-suites` | テストスイート一覧 |
| POST | `/projects/:projectId/test-suites` | テストスイート作成 |
| GET | `/test-suites/:id` | テストスイート詳細 |
| PUT | `/test-suites/:id` | テストスイート更新 |
| DELETE | `/test-suites/:id` | テストスイート削除 |

### テストスイートラベル

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/test-suites/:testSuiteId/labels` | テストスイートのラベル取得 |
| PUT | `/test-suites/:testSuiteId/labels` | テストスイートのラベル一括更新 |

→ [ラベル API 詳細](./labels.md)

### テストケース

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/test-suites/:suiteId/test-cases` | テストケース一覧 |
| POST | `/test-suites/:suiteId/test-cases` | テストケース作成 |
| GET | `/test-cases/:id` | テストケース詳細 |
| PUT | `/test-cases/:id` | テストケース更新 |
| DELETE | `/test-cases/:id` | テストケース削除 |

### レビュー

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/test-suites/:testSuiteId/reviews` | レビュー開始 |
| GET | `/test-suites/:testSuiteId/reviews` | レビュー一覧取得 |
| GET | `/reviews/drafts` | 下書き一覧 |
| GET | `/reviews/:reviewId` | レビュー詳細 |
| PATCH | `/reviews/:reviewId` | レビュー更新 |
| POST | `/reviews/:reviewId/submit` | レビュー提出 |
| PATCH | `/reviews/:reviewId/verdict` | 評価変更 |
| DELETE | `/reviews/:reviewId` | レビュー削除（DRAFT のみ） |

→ [レビュー API 詳細](./reviews.md)

### レビューコメント

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/reviews/:reviewId/comments` | コメント追加 |
| PATCH | `/reviews/:reviewId/comments/:commentId` | コメント編集 |
| PATCH | `/reviews/:reviewId/comments/:commentId/status` | ステータス変更 |
| DELETE | `/reviews/:reviewId/comments/:commentId` | コメント削除 |
| POST | `/reviews/:reviewId/comments/:commentId/replies` | 返信追加 |
| PATCH | `/reviews/:reviewId/comments/:commentId/replies/:replyId` | 返信編集 |
| DELETE | `/reviews/:reviewId/comments/:commentId/replies/:replyId` | 返信削除 |

→ [レビュー API 詳細](./reviews.md#コメント操作)

### テスト実行

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/executions` | 実行開始 |
| GET | `/executions/:id` | 実行詳細 |
| PUT | `/executions/:id/results` | 結果更新 |

### 編集ロック

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/locks` | ロック取得 |
| GET | `/locks` | ロック状態確認 |
| PATCH | `/locks/:lockId/heartbeat` | ハートビート更新 |
| DELETE | `/locks/:lockId` | ロック解放 |
| DELETE | `/locks/:lockId/force` | 強制解除（管理者） |

→ [編集ロック API 詳細](./edit-locks.md)

## レスポンス形式

### 成功

```json
{
  "data": { ... }
}
```

### 一覧

```json
{
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 20
  }
}
```

### エラー

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## ステータスコード

| コード | 説明 |
|-------|------|
| 200 | 成功 |
| 201 | 作成成功 |
| 400 | リクエスト不正 |
| 401 | 認証エラー |
| 403 | 権限エラー |
| 404 | リソース未発見 |
| 500 | サーバーエラー |

## レート制限

| エンドポイント | 制限 |
|---------------|------|
| 一般 | 100 req / 15分 |
| 認証 | 5 req / 1時間 |

制限超過時は `429 Too Many Requests` を返却。
