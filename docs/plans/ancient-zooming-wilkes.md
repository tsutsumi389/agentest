# Phase 0: 基盤整備 - 詳細実装順序

## 概要

システム管理者機能の土台となる認証・認可基盤を構築する。既存の User/Session/AuditLog 実装パターンを踏襲し、管理者専用のセキュアな認証システムを実現する。

**目的**: 管理者認証・認可の基盤を構築（すべての管理機能の前提条件）

---

## 実装順序

### Step 0-1: Prisma スキーマ追加（AdminUser, AdminSession）

**ファイル**: `packages/db/prisma/schema.prisma`

```prisma
// 管理者ロール定義
enum AdminRoleType {
  SUPER_ADMIN   // 最高権限管理者
  ADMIN         // 一般管理者
  VIEWER        // 閲覧専用
}

// 管理者ユーザー
model AdminUser {
  id             String        @id @default(uuid())
  email          String        @unique @db.VarChar(255)
  passwordHash   String        @map("password_hash") @db.VarChar(255)
  name           String        @db.VarChar(100)
  role           AdminRoleType @default(ADMIN)

  // 2FA
  totpSecret     String?       @map("totp_secret") @db.VarChar(255)
  totpEnabled    Boolean       @default(false) @map("totp_enabled")

  // セキュリティ
  failedAttempts Int           @default(0) @map("failed_attempts")
  lockedUntil    DateTime?     @map("locked_until")

  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")
  deletedAt      DateTime?     @map("deleted_at")

  sessions       AdminSession[]
  auditLogs      AdminAuditLog[]

  @@index([email])
  @@index([deletedAt])
  @@map("admin_users")
}

// 管理者セッション
model AdminSession {
  id           String    @id @default(uuid())
  adminUserId  String    @map("admin_user_id")
  token        String    @unique @db.VarChar(500)

  userAgent    String?   @map("user_agent")
  ipAddress    String?   @map("ip_address") @db.VarChar(45)

  lastActiveAt DateTime  @default(now()) @map("last_active_at")
  expiresAt    DateTime  @map("expires_at")
  revokedAt    DateTime? @map("revoked_at")

  createdAt    DateTime  @default(now()) @map("created_at")

  adminUser    AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)

  @@index([adminUserId])
  @@index([token])
  @@index([expiresAt])
  @@map("admin_sessions")
}
```

**作業内容**:
1. `schema.prisma` に上記スキーマを追加
2. `pnpm prisma migrate dev --name add_admin_auth` でマイグレーション実行
3. `pnpm prisma generate` でクライアント再生成

---

### Step 0-2: AdminAuditLog テーブル追加

**ファイル**: `packages/db/prisma/schema.prisma`（続き）

```prisma
// 管理者監査ログ
model AdminAuditLog {
  id           String   @id @default(uuid())
  adminUserId  String   @map("admin_user_id")

  action       String   @db.VarChar(100)
  targetType   String?  @map("target_type") @db.VarChar(50)
  targetId     String?  @map("target_id")

  details      Json?
  ipAddress    String?  @map("ip_address") @db.VarChar(45)
  userAgent    String?  @map("user_agent")

  createdAt    DateTime @default(now()) @map("created_at")

  adminUser    AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)

  @@index([adminUserId])
  @@index([action])
  @@index([createdAt])
  @@map("admin_audit_logs")
}
```

**作業内容**:
1. Step 0-1 と同一マイグレーションで追加
2. または別マイグレーション `add_admin_audit_log`

---

### Step 0-3: 管理者認証 API（メール/パスワード）

**新規作成ファイル**:
- `apps/api/src/routes/admin/auth.ts` - ルート定義
- `apps/api/src/controllers/admin/auth.controller.ts` - コントローラー
- `apps/api/src/services/admin/admin-auth.service.ts` - 認証サービス
- `apps/api/src/services/admin/admin-session.service.ts` - セッション管理
- `apps/api/src/repositories/admin-user.repository.ts`
- `apps/api/src/repositories/admin-session.repository.ts`

**エンドポイント**:
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/admin/auth/login` | 管理者ログイン（email/password） |
| POST | `/admin/auth/logout` | 管理者ログアウト |
| GET | `/admin/auth/me` | 現在の管理者情報取得 |
| POST | `/admin/auth/refresh` | セッション延長 |

**既存パターン参照**:
- `apps/api/src/services/session.service.ts` → AdminSessionService
- `apps/api/src/repositories/session.repository.ts` → AdminSessionRepository

**セキュリティ実装**:
```typescript
// パスワードハッシュ: bcrypt (cost=12)
// セッショントークン: crypto.randomBytes(64).toString('hex')
// セッション有効期限: 2時間（延長で最大8時間）
// ログイン試行制限: 5回失敗で30分ロック
```

---

### Step 0-4: 管理者 2FA（TOTP）API

**追加エンドポイント**:
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/admin/auth/2fa/setup` | 2FA セットアップ開始（QRコード生成） |
| POST | `/admin/auth/2fa/verify` | 2FA 検証（ログイン時） |
| POST | `/admin/auth/2fa/enable` | 2FA 有効化 |
| POST | `/admin/auth/2fa/disable` | 2FA 無効化（SUPER_ADMINのみ） |

**新規作成ファイル**:
- `apps/api/src/services/admin/admin-totp.service.ts`

**依存パッケージ**:
```bash
pnpm add otplib qrcode
pnpm add -D @types/qrcode
```

**実装内容**:
```typescript
// otplib を使用した TOTP 生成・検証
// QRコード生成（otpauth:// URI）
// バックアップコード生成（オプション）
```

---

### Step 0-5: requireAdminRole ミドルウェア

**新規作成ファイル**:
- `apps/api/src/middleware/require-admin-role.ts`

**既存パターン参照**:
- `apps/api/src/middleware/require-org-role.ts`
- `apps/api/src/middleware/require-test-suite-role.ts`

**実装内容**:
```typescript
export function requireAdminRole(roles: AdminRoleType[] = []) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. AdminSession トークンを Cookie から取得
    // 2. セッションの有効性チェック（期限、失効）
    // 3. AdminUser を取得し、req.adminUser にセット
    // 4. ロール権限チェック
    //    - SUPER_ADMIN は全権限
    //    - roles が指定されている場合は含まれるかチェック
    // 5. AdminAuditLog に操作を記録
  };
}

export function requireAdminAuth() {
  // ロールチェックなしの認証のみ
  return requireAdminRole([]);
}
```

---

### Step 0-6: 管理者ログイン画面（Frontend）

**新規作成ファイル**:
- `apps/admin/src/pages/auth/Login.tsx` - ログイン画面
- `apps/admin/src/pages/auth/TwoFactorAuth.tsx` - 2FA入力画面
- `apps/admin/src/stores/admin-auth.store.ts` - 認証状態（Zustand）
- `apps/admin/src/hooks/useAdminAuth.ts` - 認証フック
- `apps/admin/src/components/auth/LoginForm.tsx`
- `apps/admin/src/components/auth/TwoFactorForm.tsx`

**ルーティング更新**: `apps/admin/src/App.tsx`
```typescript
<Routes>
  {/* 認証不要 */}
  <Route path="/login" element={<Login />} />
  <Route path="/2fa" element={<TwoFactorAuth />} />

  {/* 認証必要 */}
  <Route element={<AuthGuard />}>
    <Route path="/" element={<Dashboard />} />
    {/* 他の管理画面ルート */}
  </Route>
</Routes>
```

**UI デザイン**:
- Terminal/CLI風のミニマルデザイン（既存のスタイルガイドに準拠）
- エラーメッセージの明確な表示
- ロック状態の表示

---

## 実装順序サマリー

```
┌─────────────────────────────────────────────────────────────┐
│  Step 0-1: Prisma スキーマ (AdminUser, AdminSession)        │
│  Step 0-2: Prisma スキーマ (AdminAuditLog)                  │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 0-3: 管理者認証 API（Repository, Service, Controller）│
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 0-4: 2FA (TOTP) API                                   │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 0-5: requireAdminRole ミドルウェア                    │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 0-6: 管理者ログイン画面 (Frontend)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 変更対象ファイル一覧

### 新規作成
| パス | 説明 |
|------|------|
| `packages/db/prisma/migrations/xxx_add_admin_auth/` | マイグレーション |
| `apps/api/src/routes/admin/auth.ts` | 認証ルート |
| `apps/api/src/routes/admin/index.ts` | 管理者ルート集約 |
| `apps/api/src/controllers/admin/auth.controller.ts` | 認証コントローラー |
| `apps/api/src/services/admin/admin-auth.service.ts` | 認証サービス |
| `apps/api/src/services/admin/admin-session.service.ts` | セッションサービス |
| `apps/api/src/services/admin/admin-totp.service.ts` | TOTPサービス |
| `apps/api/src/services/admin/admin-audit-log.service.ts` | 監査ログサービス |
| `apps/api/src/repositories/admin-user.repository.ts` | AdminUserリポジトリ |
| `apps/api/src/repositories/admin-session.repository.ts` | AdminSessionリポジトリ |
| `apps/api/src/repositories/admin-audit-log.repository.ts` | AdminAuditLogリポジトリ |
| `apps/api/src/middleware/require-admin-role.ts` | 認可ミドルウェア |
| `apps/admin/src/pages/auth/Login.tsx` | ログイン画面 |
| `apps/admin/src/pages/auth/TwoFactorAuth.tsx` | 2FA画面 |
| `apps/admin/src/stores/admin-auth.store.ts` | 認証ストア |
| `apps/admin/src/hooks/useAdminAuth.ts` | 認証フック |
| `apps/admin/src/components/auth/LoginForm.tsx` | ログインフォーム |
| `apps/admin/src/components/auth/TwoFactorForm.tsx` | 2FAフォーム |
| `apps/admin/src/components/layout/AuthGuard.tsx` | 認証ガード |

### 修正
| パス | 変更内容 |
|------|----------|
| `packages/db/prisma/schema.prisma` | AdminUser, AdminSession, AdminAuditLog 追加 |
| `apps/api/src/routes/index.ts` | `/admin` ルート追加 |
| `apps/admin/src/App.tsx` | ルーティング更新 |
| `apps/admin/package.json` | 依存追加（otplib, qrcode） |

---

## 検証方法

### 1. DBスキーマ検証
```bash
docker compose exec dev pnpm prisma migrate dev
docker compose exec dev pnpm prisma studio  # テーブル確認
```

### 2. 認証API検証
```bash
# シードデータで管理者作成
docker compose exec dev pnpm prisma db seed

# ログインテスト
curl -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!@#"}'

# 認証チェック
curl http://localhost:3000/admin/auth/me \
  -H "Cookie: admin_refresh_token=xxx"
```

### 3. セキュリティ検証
- ログイン5回失敗 → 30分ロック確認
- 無効なトークンでアクセス → 401エラー確認
- VIEWER ロールで操作 → 403エラー確認

### 4. フロントエンド検証
- http://localhost:5174/login でログイン画面表示
- 正常ログイン → ダッシュボードへリダイレクト
- 2FA有効時 → 2FA入力画面へ遷移

---

## 非機能要件チェックリスト

- [ ] パスワード: 12文字以上、大小英字・数字・記号
- [ ] bcrypt cost factor: 12
- [ ] セッション有効期限: 2時間（最大8時間延長）
- [ ] ログイン試行制限: 5回失敗で30分ロック
- [ ] すべての操作を AdminAuditLog に記録
- [ ] Cookie: HttpOnly, Secure, SameSite=Strict
