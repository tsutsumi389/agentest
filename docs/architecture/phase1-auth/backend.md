# バックエンド詳細設計

## 概要

認証基盤のバックエンド実装は、レイヤードアーキテクチャを採用。Controller → Service → Repository の3層構造で責務を分離している。

```
┌─────────────────────────────────────────────────────────────┐
│  Routes (Express Router)                                    │
│  - エンドポイント定義                                        │
│  - ミドルウェア適用                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Controllers                                                │
│  - リクエスト/レスポンス処理                                 │
│  - バリデーション                                            │
│  - エラーハンドリング                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Services                                                   │
│  - ビジネスロジック                                          │
│  - トランザクション管理                                      │
│  - 認可チェック                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Repositories                                               │
│  - データアクセス                                            │
│  - Prisma クエリ                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 認証コントローラ (AuthController)

### ファイル

`apps/api/src/controllers/auth.controller.ts`

### 責務

- OAuth コールバック処理
- トークンリフレッシュ
- ログアウト
- 現在ユーザー情報取得

### メソッド一覧

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| `me` | GET /api/auth/me | 現在のユーザー情報取得 |
| `refresh` | POST /api/auth/refresh | トークンリフレッシュ |
| `logout` | POST /api/auth/logout | ログアウト |
| `oauthCallback` | GET /api/auth/{provider}/callback | OAuth コールバック |

### 詳細実装

#### me

```typescript
async me(req: Request, res: Response, next: NextFunction): Promise<void>
```

**処理フロー:**
1. `req.user` から認証済みユーザーを取得
2. ユーザー情報をレスポンス

**レスポンス:**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "表示名",
    "avatarUrl": "https://...",
    "plan": "FREE",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
}
```

#### refresh

```typescript
async refresh(req: Request, res: Response, next: NextFunction): Promise<void>
```

**処理フロー:**
1. Cookie または Body から `refresh_token` を取得
2. JWT 検証（署名・有効期限・type）
3. DB でトークン状態確認（失効チェック）
4. 古いトークン・セッションを無効化
5. 新規トークン・セッション作成
6. Cookie 設定（accessToken: 15分、refreshToken: 7日）

**リクエスト:**
Cookie に `refresh_token` が必要

**レスポンス:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs..."
  }
}
```

**Cookie 設定:**
```
Set-Cookie: access_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900
Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800
```

#### logout

```typescript
async logout(req: Request, res: Response, next: NextFunction): Promise<void>
```

**処理フロー:**
1. Cookie から `refresh_token` を取得
2. トークン・セッションを失効
3. Cookie をクリア

**レスポンス:**
```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### oauthCallback

```typescript
async oauthCallback(req: Request, res: Response, next: NextFunction): Promise<void>
```

**処理フロー:**
1. Passport から OAuth 結果を取得
2. `oauth_link_mode` Cookie をチェック
   - 連携追加モード: 既存ユーザーにプロバイダー追加
   - 通常モード: ログイン処理
3. JWT・Session 発行
4. Cookie 設定
5. フロントエンドにリダイレクト

**OAuth 連携追加モード:**

Cookie `oauth_link_mode` の内容:
```json
{
  "provider": "github",
  "userId": "uuid"
}
```

---

## 2. ユーザーコントローラ (UserController)

### ファイル

`apps/api/src/controllers/user.controller.ts`

### 責務

- ユーザー CRUD
- OAuth 連携管理
- プロジェクト・組織の取得

### メソッド一覧

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| `getUser` | GET /api/users/:userId | ユーザー詳細取得 |
| `updateUser` | PATCH /api/users/:userId | プロフィール更新 |
| `deleteUser` | DELETE /api/users/:userId | アカウント削除（論理削除） |
| `getUserOrganizations` | GET /api/users/:userId/organizations | 組織一覧取得 |
| `getUserProjects` | GET /api/users/:userId/projects | プロジェクト一覧取得 |
| `getAccounts` | GET /api/users/:userId/accounts | OAuth 連携一覧取得 |
| `unlinkAccount` | DELETE /api/users/:userId/accounts/:provider | OAuth 連携解除 |

### バリデーションスキーマ

```typescript
// updateUserSchema
{
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional()
}
```

### 認可ルール

| メソッド | 認可 |
|---------|------|
| getUser | 認証必須（自分自身のみ） |
| updateUser | 認証必須（自分自身のみ） |
| deleteUser | 認証必須（自分自身のみ） |
| getAccounts | 認証必須（自分自身のみ） |
| unlinkAccount | 認証必須（自分自身のみ） |

---

## 3. セッションコントローラ (SessionController)

### ファイル

`apps/api/src/controllers/session.controller.ts`

### 責務

- セッション一覧取得
- セッション無効化
- セッション数取得

### メソッド一覧

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| `getSessions` | GET /api/sessions | セッション一覧取得 |
| `revokeSession` | DELETE /api/sessions/:sessionId | 特定セッション無効化 |
| `revokeOtherSessions` | DELETE /api/sessions | 他セッション全無効化 |
| `getSessionCount` | GET /api/sessions/count | セッション数取得 |

### 詳細実装

#### getSessions

**レスポンス:**
```json
{
  "data": [
    {
      "id": "session-uuid",
      "userAgent": "Mozilla/5.0 ...",
      "ipAddress": "192.168.1.1",
      "lastActiveAt": "2025-01-01T12:00:00Z",
      "expiresAt": "2025-01-08T12:00:00Z",
      "createdAt": "2025-01-01T00:00:00Z",
      "isCurrent": true
    }
  ]
}
```

#### revokeSession

**ビジネスルール:**
- 現在のセッションは無効化不可
- 自分のセッションのみ無効化可能

**レスポンス:**
```json
{
  "data": { "success": true }
}
```

#### revokeOtherSessions

**レスポンス:**
```json
{
  "data": { "revokedCount": 3 }
}
```

---

## 4. 認証サービス (AuthService)

### ファイル

`apps/api/src/services/auth.service.ts`

### 責務

- OAuth コールバック処理
- トークン発行・検証
- ユーザー作成/取得

### メソッド一覧

| メソッド | 説明 |
|---------|------|
| `handleOAuthCallback` | OAuth コールバック処理、ユーザー作成/取得 |
| `generateTokens` | JWT アクセス・リフレッシュトークン生成 |
| `refreshTokens` | トークンリフレッシュ処理 |
| `revokeToken` | トークン無効化 |

---

## 5. ユーザーサービス (UserService)

### ファイル

`apps/api/src/services/user.service.ts`

### 責務

- ユーザー検索・更新
- 論理削除
- 関連リソース取得

### メソッド一覧

| メソッド | 説明 |
|---------|------|
| `findById` | ID でユーザー検索（NotFoundError 発出） |
| `update` | ユーザー情報更新 |
| `softDelete` | 論理削除（deletedAt 設定） |
| `getOrganizations` | ユーザーの組織一覧取得 |
| `getProjects` | ユーザーのプロジェクト一覧取得 |

### プロジェクト取得ロジック

```
1. オーナープロジェクト取得（Project.ownerId = userId）
2. メンバープロジェクト取得（ProjectMember.userId = userId）
3. 重複排除してマージ
4. role フィールド付加（owner / メンバーロール）
5. deletedAt が null のプロジェクトのみ返却
```

---

## 6. セッションサービス (SessionService)

### ファイル

`apps/api/src/services/session.service.ts`

### 責務

- セッション CRUD
- セッション検証
- 失効処理

### メソッド一覧

| メソッド | 説明 |
|---------|------|
| `createSession` | 新規セッション作成 |
| `getSessionByToken` | トークンでセッション取得（失効・期限切れチェック） |
| `getUserSessions` | ユーザーのセッション一覧取得 |
| `updateSessionActivity` | 最終活動時刻を更新 |
| `revokeSession` | セッション無効化 |
| `revokeOtherSessions` | 指定セッション以外を全て失効 |
| `revokeAllSessions` | 全セッション失効 |
| `getActiveSessionCount` | 有効なセッション数をカウント |
| `cleanupExpiredSessions` | 期限切れセッション削除 |

### セッション有効性判定

```typescript
// 有効なセッション条件
revokedAt === null && expiresAt > 現在時刻
```

### セッション有効期限

| 定数 | 値 | 説明 |
|------|-----|------|
| `SESSION_EXPIRY_MS` | 7 * 24 * 60 * 60 * 1000 | 7日間 |

### SessionInfo インターフェース

```typescript
interface SessionInfo {
  id: string
  userAgent: string | null
  ipAddress: string | null
  lastActiveAt: Date
  expiresAt: Date
  createdAt: Date
  isCurrent: boolean
}
```

---

## 7. アカウントサービス (AccountService)

### ファイル

`apps/api/src/services/account.service.ts`

### 責務

- OAuth 連携管理
- 連携解除の検証

### メソッド一覧

| メソッド | 説明 |
|---------|------|
| `getAccounts` | ユーザーの OAuth 連携一覧取得 |
| `getAccountByProvider` | 特定プロバイダー連携取得 |
| `unlinkAccount` | OAuth 連携解除 |
| `checkCanLink` | 連携可否チェック |

### ビジネスルール

**連携解除の前提条件:**
- 最低1つの OAuth 連携は必須
- 連携数 ≤ 1 の場合は解除不可

**エラーメッセージ:**
```
ValidationError: "最低1つのOAuth連携が必要です。連携を解除する前に別のプロバイダーを連携してください。"
```

---

## 8. リポジトリ層

### UserRepository

**ファイル:** `apps/api/src/repositories/user.repository.ts`

| メソッド | 説明 |
|---------|------|
| `findById` | ID でユーザー検索（deletedAt null チェック） |
| `findByEmail` | メールでユーザー検索（deletedAt null チェック） |
| `update` | ユーザー更新 |
| `softDelete` | deletedAt を現在時刻に設定 |

### SessionRepository

**ファイル:** `apps/api/src/repositories/session.repository.ts`

| メソッド | 説明 |
|---------|------|
| `create` | セッション作成 |
| `findByToken` | トークンでセッション取得（ユニークキー） |
| `findById` | ID でセッション取得 |
| `findActiveByUserId` | ユーザーの有効なセッション一覧取得 |
| `updateLastActiveAt` | 最終活動時刻を現在時刻に更新 |
| `revoke` | revokedAt を現在時刻に設定 |
| `revokeByToken` | トークンでセッション失効 |
| `revokeAllExcept` | 指定セッション以外を全て失効 |
| `revokeAllByUserId` | ユーザーの全セッション失効 |
| `countActiveByUserId` | 有効なセッション数をカウント |
| `deleteExpired` | 期限切れ・失効済みセッション削除 |

### AccountRepository

**ファイル:** `apps/api/src/repositories/account.repository.ts`

| メソッド | 説明 |
|---------|------|
| `findByUserId` | ユーザーの連携一覧取得 |
| `findByUserIdAndProvider` | ユーザーのプロバイダー連携取得（ユニーク） |
| `countByUserId` | ユーザーの連携数をカウント |
| `delete` | OAuth 連携を削除 |
| `findByProviderAccountId` | プロバイダーアカウント ID で検索（ユニーク） |

---

## 9. ミドルウェア

### 認証ミドルウェア

**ファイル:** `packages/auth/src/middleware.ts`

#### requireAuth

認証必須ミドルウェア。未認証の場合は 401 エラー。

```typescript
function requireAuth(config: AuthConfig): RequestHandler
```

**トークン抽出順序:**
1. Authorization ヘッダー（`Bearer {token}`）
2. Cookie（`access_token`）

**処理フロー:**
1. トークン抽出
2. JWT 検証（署名・有効期限・type）
3. Prisma から ユーザー取得
4. deletedAt チェック
5. `req.user` に設定

#### optionalAuth

認証任意ミドルウェア。未認証でもエラーにならない。

```typescript
function optionalAuth(config: AuthConfig): RequestHandler
```

### セッション追跡ミドルウェア

**ファイル:** `apps/api/src/middleware/session.middleware.ts`

```typescript
function trackSession(): RequestHandler
```

**処理フロー:**
1. `refresh_token` Cookie からセッション検索
2. セッション有効確認（revokedAt null && expiresAt > now）
3. `req.sessionId` を設定
4. 認証済みリクエストの場合、非同期でセッション活動時刻を更新

**クライアント情報抽出:**
```typescript
function extractClientInfo(req: Request): { userAgent?: string; ipAddress?: string }

// userAgent: User-Agent ヘッダー
// ipAddress: X-Forwarded-For ヘッダー（複数値は最初）または req.socket.remoteAddress
```

---

## 10. JWT 管理

### ファイル

`packages/auth/src/jwt.ts`

### 関数一覧

| 関数 | 説明 |
|------|------|
| `generateTokens` | アクセス・リフレッシュトークンペア生成 |
| `verifyAccessToken` | アクセストークン検証 |
| `verifyRefreshToken` | リフレッシュトークン検証 |
| `decodeToken` | トークンをデコード（検証なし） |
| `getTokenExpiry` | expiresIn 文字列から期限日時を計算 |

### JwtPayload インターフェース

```typescript
interface JwtPayload {
  sub: string      // ユーザー ID
  email: string    // メールアドレス
  type: 'access' | 'refresh'
  iat: number      // 発行時刻
  exp: number      // 有効期限
}
```

### トークン検証エラー

| 条件 | エラー |
|------|--------|
| 期限切れ | `AuthenticationError('Token expired')` |
| 無効トークン | `AuthenticationError('Invalid token')` |
| type 不一致 | `AuthenticationError('Invalid token type')` |

### Expiry 形式

```
\d+[smhd]
例: '15m' (15分), '7d' (7日), '1h' (1時間)
```

---

## 11. Passport 設定

### ファイル

`packages/auth/src/passport.ts`

### 対応プロバイダー

| プロバイダー | scope | 備考 |
|-------------|-------|------|
| GitHub | `user:email` | メールなしの場合 `{id}@users.noreply.github.com` |
| Google | `profile, email` | メール必須 |

### OAuthCallbackResult インターフェース

```typescript
interface OAuthCallbackResult {
  userId: string
  email: string
  profile: {
    provider: string
    providerAccountId: string
    accessToken?: string
    refreshToken?: string
  }
}
```

---

## 12. ルート定義

### 認証ルート

**ファイル:** `apps/api/src/routes/auth.ts`

| メソッド | パス | ミドルウェア | ハンドラ |
|---------|------|-------------|---------|
| GET | /api/auth/me | requireAuth | AuthController.me |
| POST | /api/auth/refresh | - | AuthController.refresh |
| POST | /api/auth/logout | requireAuth | AuthController.logout |
| GET | /api/auth/github | passport.authenticate | (リダイレクト) |
| GET | /api/auth/github/callback | passport.authenticate | AuthController.oauthCallback |
| GET | /api/auth/github/link | requireAuth | (Cookie 設定 + リダイレクト) |
| GET | /api/auth/google | passport.authenticate | (リダイレクト) |
| GET | /api/auth/google/callback | passport.authenticate | AuthController.oauthCallback |
| GET | /api/auth/google/link | requireAuth | (Cookie 設定 + リダイレクト) |

### ユーザールート

**ファイル:** `apps/api/src/routes/users.ts`

| メソッド | パス | ミドルウェア | ハンドラ |
|---------|------|-------------|---------|
| GET | /api/users/:userId | requireAuth | UserController.getUser |
| PATCH | /api/users/:userId | requireAuth | UserController.updateUser |
| DELETE | /api/users/:userId | requireAuth | UserController.deleteUser |
| GET | /api/users/:userId/organizations | requireAuth | UserController.getUserOrganizations |
| GET | /api/users/:userId/projects | requireAuth | UserController.getUserProjects |
| GET | /api/users/:userId/accounts | requireAuth | UserController.getAccounts |
| DELETE | /api/users/:userId/accounts/:provider | requireAuth | UserController.unlinkAccount |

### セッションルート

**ファイル:** `apps/api/src/routes/sessions.ts`

| メソッド | パス | ミドルウェア | ハンドラ |
|---------|------|-------------|---------|
| GET | /api/sessions | requireAuth | SessionController.getSessions |
| GET | /api/sessions/count | requireAuth | SessionController.getSessionCount |
| DELETE | /api/sessions | requireAuth | SessionController.revokeOtherSessions |
| DELETE | /api/sessions/:sessionId | requireAuth | SessionController.revokeSession |

---

## 13. エラーハンドリング

### カスタムエラークラス

| クラス | HTTP ステータス | 用途 |
|--------|---------------|------|
| `AuthenticationError` | 401 | 認証失敗 |
| `AuthorizationError` | 403 | 認可失敗 |
| `NotFoundError` | 404 | リソース未発見 |
| `ValidationError` | 400 | バリデーション失敗 |

### エラーコード

| コード | 説明 |
|-------|------|
| `AUTH_INVALID_TOKEN` | トークンが無効 |
| `AUTH_TOKEN_EXPIRED` | トークンが期限切れ |
| `AUTH_UNAUTHORIZED` | 認証が必要 |
| `AUTH_OAUTH_FAILED` | OAuth 認証に失敗 |
| `USER_NOT_FOUND` | ユーザーが見つからない |
| `SESSION_NOT_FOUND` | セッションが見つからない |
| `VALIDATION_ERROR` | バリデーションエラー |
