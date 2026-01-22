# Step 0-3: 管理者認証 API（メール/パスワード）実装計画

## 概要

管理者向けのメール/パスワード認証APIを実装する。既存の `SessionService` パターンに準拠し、ブルートフォース対策やセッション管理を含むセキュアな認証基盤を構築する。

---

## ファイル構成

### 新規作成ファイル（7ファイル）

| ファイルパス | 責務 |
|------------|------|
| `apps/api/src/repositories/admin-user.repository.ts` | AdminUser CRUD |
| `apps/api/src/repositories/admin-session.repository.ts` | AdminSession CRUD |
| `apps/api/src/services/admin/admin-session.service.ts` | セッション管理 |
| `apps/api/src/services/admin/admin-auth.service.ts` | 認証ビジネスロジック |
| `apps/api/src/services/admin/admin-audit-log.service.ts` | 監査ログ記録 |
| `apps/api/src/controllers/admin/auth.controller.ts` | HTTPリクエスト処理 |
| `apps/api/src/routes/admin/auth.ts` | ルート定義 |

### 修正ファイル（2ファイル）

| ファイルパス | 変更内容 |
|------------|----------|
| `apps/api/src/middleware/rate-limiter.ts` | `adminAuthLimiter` 追加 |
| `apps/api/src/routes/index.ts` | `/admin/auth` ルート追加 |

---

## 実装順序

### Step 1: リポジトリ層

#### 1-1. `apps/api/src/repositories/admin-user.repository.ts`

```typescript
export class AdminUserRepository {
  // メールアドレスで管理者を検索（パスワードハッシュ含む）
  async findByEmailWithPassword(email: string)

  // IDで管理者を検索（パスワードなし）
  async findById(id: string)

  // ログイン失敗回数をインクリメント
  async incrementFailedAttempts(id: string)

  // アカウントをロック
  async lockAccount(id: string, until: Date)

  // ログイン成功時にリセット
  async resetFailedAttempts(id: string)
}
```

#### 1-2. `apps/api/src/repositories/admin-session.repository.ts`

```typescript
export class AdminSessionRepository {
  async create(data: CreateAdminSessionData)
  async findByToken(token: string)      // adminUser を include
  async findById(id: string)
  async updateLastActiveAt(id: string)
  async extendExpiry(id: string, newExpiresAt: Date)
  async revoke(id: string)
  async revokeByToken(token: string)
  async revokeAllByUserId(adminUserId: string)
  async deleteExpired()
}
```

### Step 2: サービス層

#### 2-1. `apps/api/src/services/admin/admin-audit-log.service.ts`

```typescript
export class AdminAuditLogService {
  async log(input: {
    adminUserId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  })
}
```

#### 2-2. `apps/api/src/services/admin/admin-session.service.ts`

```typescript
// 定数
const SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000;      // 2時間
const SESSION_MAX_EXPIRY_MS = 8 * 60 * 60 * 1000;  // 最大8時間

export class AdminSessionService {
  generateToken(): string                          // crypto.randomBytes(64)
  async createSession(data)                        // セッション作成
  async validateSession(token: string)             // トークン検証
  async refreshSession(sessionId, createdAt)       // 有効期限延長（最大8時間まで）
  async revokeSession(token: string)               // ログアウト
  async updateActivity(sessionId: string)          // 最終活動時刻更新
}
```

#### 2-3. `apps/api/src/services/admin/admin-auth.service.ts`

```typescript
// 定数
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;  // 30分

export class AdminAuthService {
  async hashPassword(password: string): Promise<string>
  async login(input: LoginInput): Promise<LoginResult>
  async logout(token, adminUserId, ipAddress?, userAgent?)
  async refreshSession(token, adminUserId, sessionId, createdAt, ipAddress?, userAgent?)
}
```

**login() の処理フロー:**
1. ユーザー検索（存在しない場合もbcrypt実行でタイミング攻撃対策）
2. アカウントロックチェック
3. パスワード検証
4. 失敗時: failedAttempts++、5回超過でロック
5. 成功時: failedAttempts リセット、セッション作成
6. 監査ログ記録

### Step 3: コントローラー・ルート層

#### 3-1. `apps/api/src/controllers/admin/auth.controller.ts`

```typescript
const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/admin',
};

export class AdminAuthController {
  login = async (req, res, next)   // POST /admin/auth/login
  logout = async (req, res, next)  // POST /admin/auth/logout
  me = async (req, res, next)      // GET /admin/auth/me
  refresh = async (req, res, next) // POST /admin/auth/refresh
}
```

#### 3-2. `apps/api/src/routes/admin/auth.ts`

```typescript
router.post('/login', adminAuthLimiter, controller.login);
router.post('/logout', requireAdminAuth(), controller.logout);
router.get('/me', requireAdminAuth(), controller.me);
router.post('/refresh', requireAdminAuth(), controller.refresh);
```

### Step 4: ミドルウェア・型拡張

#### 4-1. `apps/api/src/middleware/rate-limiter.ts` に追加

```typescript
export const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15分
  max: 5,                     // 5リクエスト
  skipSuccessfulRequests: true,
  skip: () => isTest,
});
```

#### 4-2. Express 型拡張（コントローラー内で定義）

```typescript
declare global {
  namespace Express {
    interface Request {
      adminUser?: { id, email, name, role, totpEnabled };
      adminSession?: { id, token, createdAt, expiresAt };
    }
  }
}
```

### Step 5: ルート登録

`apps/api/src/routes/index.ts` に追加:

```typescript
import adminAuthRoutes from './admin/auth.js';
router.use('/admin/auth', adminAuthRoutes);
```

---

## API 仕様

### POST `/admin/auth/login`

**リクエスト:**
```json
{
  "email": "admin@example.com",
  "password": "securePassword123"
}
```

**成功レスポンス (200):**
```json
{
  "admin": { "id": "uuid", "email": "...", "name": "...", "role": "SUPER_ADMIN" },
  "expiresAt": "2024-01-15T12:00:00.000Z"
}
```
- Cookie: `admin_session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/admin`

**エラー:** 400 (バリデーション), 401 (認証失敗/ロック), 429 (レートリミット)

### POST `/admin/auth/logout`

**リクエスト:** Cookie のみ（ボディ不要）

**成功レスポンス (200):**
```json
{ "message": "ログアウトしました" }
```

### GET `/admin/auth/me`

**成功レスポンス (200):**
```json
{
  "admin": { "id": "...", "email": "...", "name": "...", "role": "ADMIN", "totpEnabled": false }
}
```

### POST `/admin/auth/refresh`

**成功レスポンス (200):**
```json
{ "expiresAt": "2024-01-15T14:00:00.000Z" }
```

---

## セキュリティ実装

| 項目 | 仕様 |
|------|------|
| パスワードハッシュ | bcrypt (cost=12) |
| セッショントークン | crypto.randomBytes(64).toString('hex') |
| セッション有効期限 | 初期2時間、最大8時間まで延長可能 |
| ログイン試行制限 | 5回失敗で30分ロック |
| レートリミット | 15分間で5リクエスト |
| Cookie | HttpOnly, Secure, SameSite=Strict, Path=/admin |
| タイミング攻撃対策 | ユーザー不存在時もbcrypt実行 |

---

## 監査ログ

| アクション | タイミング | details |
|-----------|-----------|---------|
| `LOGIN_SUCCESS` | ログイン成功 | - |
| `LOGIN_FAILED` | パスワード不正 | `{ reason, failedAttempts }` |
| `LOGIN_BLOCKED_LOCKED` | ロック中の試行 | `{ reason: 'account_locked' }` |
| `ACCOUNT_LOCKED` | ロック発動 | `{ failedAttempts, lockedUntil }` |
| `LOGOUT` | ログアウト | - |
| `SESSION_REFRESHED` | セッション延長 | `{ newExpiresAt }` |

---

## 検証方法

### 1. ユニットテスト

```bash
docker compose exec dev pnpm --filter api test -- admin-auth
```

**テスト対象:**
- AdminUserRepository: 検索、失敗回数インクリメント、ロック
- AdminSessionRepository: CRUD、有効期限延長
- AdminSessionService: トークン生成、検証、延長
- AdminAuthService: ログイン成功/失敗、ロック発動

### 2. 結合テスト（curl）

```bash
# ログイン
curl -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!@#"}' \
  -c cookies.txt

# 認証情報取得
curl http://localhost:3000/admin/auth/me -b cookies.txt

# セッション延長
curl -X POST http://localhost:3000/admin/auth/refresh -b cookies.txt

# ログアウト
curl -X POST http://localhost:3000/admin/auth/logout -b cookies.txt
```

### 3. セキュリティ検証

- [ ] 5回ログイン失敗 → 30分ロック確認
- [ ] 無効なトークンでアクセス → 401エラー
- [ ] Cookie属性（HttpOnly, Secure, SameSite）確認
- [ ] レートリミット超過 → 429エラー

---

## 依存関係

### 既存依存（追加不要）

- `bcrypt`: パスワードハッシュ（既にインストール済み）
- `express-rate-limit`: レートリミット（既にインストール済み）

### 参照ファイル

- `apps/api/src/services/session.service.ts` - セッション管理パターン
- `apps/api/src/controllers/auth.controller.ts` - 認証コントローラーパターン
- `packages/shared/src/errors/index.ts` - エラークラス
