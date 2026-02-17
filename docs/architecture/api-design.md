# API 設計方針

## 概要

RESTful API を Express 5 で実装。認証は JWT（RS256）を使用。

## 設計原則

1. **リソース指向** - URL はリソースを表す（動詞ではなく名詞）
2. **HTTP メソッドの適切な使用** - GET/POST/PUT/DELETE
3. **一貫したレスポンス形式** - 成功・エラーともに統一フォーマット
4. **適切なステータスコード** - 200, 201, 400, 401, 403, 404, 500

## URL 設計

```
GET    /api/v1/projects                 # 一覧取得
GET    /api/v1/projects/:id             # 詳細取得
POST   /api/v1/projects                 # 作成
PUT    /api/v1/projects/:id             # 更新
DELETE /api/v1/projects/:id             # 削除

GET    /api/v1/projects/:id/test-suites # ネストしたリソース
```

## レスポンス形式

### 成功時

```json
{
  "data": {
    "id": "123",
    "name": "Example Project"
  }
}
```

### 一覧取得時

```json
{
  "data": [
    { "id": "123", "name": "Project A" },
    { "id": "456", "name": "Project B" }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 20
  }
}
```

### エラー時

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

## 認証

### JWT トークン

| 種類 | 有効期限 | 用途 |
|------|---------|------|
| Access Token | 15分 | API リクエスト認証 |
| Refresh Token | 7日 | Access Token 再発行 |

### Cookie 設定

認証トークンは HttpOnly Cookie で管理します。

| 属性 | 値 | 目的 |
|------|-----|------|
| `HttpOnly` | `true` | XSS 攻撃からトークンを保護 |
| `Secure` | `true` (本番) | HTTPS 通信のみで送信 |
| `SameSite` | `Strict` | CSRF 攻撃を防止 |
| `Path` | `/` | 全パスで有効 |
| `Max-Age` | トークン有効期限に準拠 | 自動期限切れ |

```
Set-Cookie: access_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900
Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=604800
```

### 認証エンドポイント

```
GET  /auth/github          # GitHub OAuth 開始
GET  /auth/github/callback # GitHub コールバック
GET  /auth/google          # Google OAuth 開始
GET  /auth/google/callback # Google コールバック
POST /auth/refresh         # トークン更新
POST /auth/logout          # ログアウト
GET  /auth/me              # 現在のユーザー情報
```

## バリデーション

Zod を使用してリクエストボディをバリデーション。

```typescript
// packages/shared/src/validators/schemas.ts
export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// apps/api/src/routes/projects.ts
router.post('/', validate(createProjectSchema), projectController.create);
```

## エラーハンドリング

```typescript
// packages/shared/src/errors/index.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

// 使用例
throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
```

## レート制限

| エンドポイント | 制限 |
|---------------|------|
| 一般 API | 300 req / 15分 / IP |
| 認証 API | 10 req / 1時間 / IP |

## CORS 設定

Cookie ベース認証のため、CORS は厳格に設定します。

| 設定 | 値 | 説明 |
|------|-----|------|
| `Access-Control-Allow-Origin` | `https://app.agentest.io` | ワイルドカード禁止 |
| `Access-Control-Allow-Credentials` | `true` | Cookie 送信を許可 |
| `Access-Control-Allow-Methods` | `GET, POST, PUT, DELETE, OPTIONS` | 許可する HTTP メソッド |
| `Access-Control-Allow-Headers` | `Content-Type, X-Requested-With` | 許可するヘッダー |
| `Access-Control-Max-Age` | `86400` | プリフライトキャッシュ (24時間) |

```typescript
// apps/api/src/middleware/cors.ts
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With'],
  maxAge: 86400,
};
```

## セキュリティヘッダー

すべてのレスポンスに以下のヘッダーを付与します。

| ヘッダー | 値 | 目的 |
|---------|-----|------|
| `X-Content-Type-Options` | `nosniff` | MIME スニッフィング防止 |
| `X-Frame-Options` | `DENY` | クリックジャッキング防止 |
| `X-XSS-Protection` | `1; mode=block` | XSS フィルター有効化 |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS 強制 |
| `Content-Security-Policy` | `default-src 'self'` | リソース読み込み制限 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | リファラー制御 |

```typescript
// apps/api/src/middleware/security.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

## 関連ドキュメント

- [認証 API リファレンス](../api/auth.md)
- [システム全体像](./overview.md)
