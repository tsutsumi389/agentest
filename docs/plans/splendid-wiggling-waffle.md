# Web 2FA（二要素認証）実装計画

## Context

webアプリのログインに2FA（TOTP）を追加する。既存のadminアプリの2FA実装パターンを踏襲し、一貫性のあるユーザー体験を提供する。

**セキュリティモデル**: adminと同様、ログイン時にJWTトークンを発行した後、フロントエンドで2FA検証を強制する方式。2FA検証前はフロントエンドが保護ルートへのアクセスをブロックする。

## 実装フェーズ

### Phase 1: データベーススキーマ変更

**ファイル**: `packages/db/prisma/schema.prisma`

UserモデルにTOTPフィールドを追加（AdminUserと同じパターン）:
```prisma
model User {
  // 既存フィールド...

  // 2FA
  totpSecret  String? @map("totp_secret") @db.VarChar(255)
  totpEnabled Boolean @default(false) @map("totp_enabled")
}
```

マイグレーション生成: `prisma migrate dev --name add_user_totp`

### Phase 2: Redis関数追加

**ファイル**: `apps/api/src/lib/redis-store.ts`

ユーザーTOTP用のキープレフィックスを追加（admin用との衝突回避）:
```typescript
const KEY_PREFIX = {
  // 既存...
  USER_TOTP_SETUP: 'user:totp:setup:',
  USER_TOTP_USED: 'user:totp:used:',
};
```

以下の関数を追加:
- `setUserTotpSetupSecret(userId, secret, ttl)`
- `getUserTotpSetupSecret(userId)`
- `deleteUserTotpSetupSecret(userId)`
- `markUserTotpCodeUsed(userId, code, ttl)`
- `isUserTotpCodeUsed(userId, code)`

既存のadmin TOTP関数（`setTotpSetupSecret`等）と同じ実装パターン。

### Phase 3: UserRepository拡張

**ファイル**: `apps/api/src/repositories/user.repository.ts`

以下のメソッドを追加:
- `findByIdWithPassword(id)` - TOTP無効化時のパスワード確認用
- `enableTotp(id, totpSecret)` - TOTP有効化
- `disableTotp(id)` - TOTP無効化
- `getTotpSecret(id)` - TOTP秘密鍵取得

参考: `apps/api/src/repositories/admin-user.repository.ts` (行110-151)

### Phase 4: UserTotpService作成

**新規ファイル**: `apps/api/src/services/user-totp.service.ts`

AdminTotpService（`apps/api/src/services/admin/admin-totp.service.ts`）をベースに:
- `UserRepository` を使用（AdminUserRepositoryではなく）
- `AuditLogService` を使用（AdminAuditLogServiceではなく）
- `USER_TOTP_SETUP`/`USER_TOTP_USED` Redis関数を使用
- APP_NAMEを `'Agentest'` に変更（`'Agentest Admin'` ではなく）

メソッド:
- `setupTotp(userId, email, ipAddress?, userAgent?)` - QRコード生成
- `enableTotp(userId, code, ipAddress?, userAgent?)` - 有効化
- `verifyTotp(userId, code, ipAddress?, userAgent?)` - ログイン時検証
- `disableTotp(userId, password, ipAddress?, userAgent?)` - 無効化

### Phase 5: UserTotpController作成

**新規ファイル**: `apps/api/src/controllers/user-totp.controller.ts`

AdminTotpController（`apps/api/src/controllers/admin/totp.controller.ts`）をベースに:
- `req.user` を使用（`req.adminUser` ではなく）
- `UserTotpService` を使用

エンドポイント:
- `setup` - POST `/api/auth/2fa/setup`
- `enable` - POST `/api/auth/2fa/enable`
- `verify` - POST `/api/auth/2fa/verify`
- `disable` - POST `/api/auth/2fa/disable`
- `status` - GET `/api/auth/2fa/status`（フロントエンドから2FA状態を取得）

### Phase 6: ルーティング追加

**ファイル**: `apps/api/src/routes/auth.ts`

```typescript
// 2FAエンドポイント
router.get('/2fa/status', requireAuth(authConfig), userTotpController.status);
router.post('/2fa/setup', requireAuth(authConfig), userTotpController.setup);
router.post('/2fa/enable', requireAuth(authConfig), userTotpController.enable);
router.post('/2fa/verify', requireAuth(authConfig), userTotpController.verify);
router.post('/2fa/disable', requireAuth(authConfig), userTotpController.disable);
```

### Phase 7: ログインフロー変更

**ファイル**: `apps/api/src/services/user-password-auth.service.ts`

`AuthResult`の`user`に`totpEnabled`を追加:
```typescript
export interface AuthResult {
  tokens: TokenPair;
  user: {
    id: string;
    email: string;
    name: string;
    totpEnabled: boolean;  // 追加
  };
}
```

login()メソッドで`totpEnabled`を返却。

**ファイル**: `apps/api/src/controllers/auth.controller.ts`

- `login` メソッド: レスポンスに `totpEnabled` を含める
- `me` メソッド: レスポンスに `totpEnabled` を含める

### Phase 8: フロントエンドAPI型定義更新

**ファイル**: `apps/web/src/lib/api.ts`

User型に`totpEnabled`を追加:
```typescript
export interface User {
  // 既存フィールド...
  totpEnabled: boolean;
}
```

authApiに2FAメソッドを追加:
```typescript
export const authApi = {
  // 既存...
  get2FAStatus: () => api.get<{ totpEnabled: boolean }>('/api/auth/2fa/status'),
  setup2FA: () => api.post<{ secret: string; qrCodeDataUrl: string; otpauthUrl: string }>('/api/auth/2fa/setup'),
  enable2FA: (code: string) => api.post<{ message: string }>('/api/auth/2fa/enable', { code }),
  verify2FA: (code: string) => api.post<{ message: string; verified: boolean }>('/api/auth/2fa/verify', { code }),
  disable2FA: (password: string) => api.post<{ message: string }>('/api/auth/2fa/disable', { password }),
};
```

### Phase 9: 認証ストア変更

**ファイル**: `apps/web/src/stores/auth.ts`

admin-auth.store.tsのパターンを踏襲:
```typescript
interface AuthState {
  // 既存フィールド...
  requires2FA: boolean;  // 追加

  // 既存アクション...
  login: (email: string, password: string) => Promise<void>;  // 変更
  verify2FA: (code: string) => Promise<void>;  // 追加
}
```

- `login`: authApi.loginの戻り値から`totpEnabled`を確認。trueなら`requires2FA = true`, `isAuthenticated = false`
- `verify2FA`: authApi.verify2FAを呼び出し、成功時に`isAuthenticated = true`, `requires2FA = false`
- `initialize`: meレスポンスの`totpEnabled`状態を確認（既にログイン済みの場合はrequires2FAは不要）

### Phase 10: フロントエンドコンポーネント

#### 10a: TwoFactorFormコンポーネント
**新規ファイル**: `apps/web/src/components/auth/TwoFactorForm.tsx`

admin版（`apps/admin/src/components/auth/TwoFactorForm.tsx`）をベースに:
- `useAuth` フックを使用（`useAdminAuth` ではなく）
- スタイリングをwebアプリのデザインに合わせる
- CLI風の装飾テキストを `$ auth --verify-2fa` に変更

#### 10b: TwoFactorAuthページ
**新規ファイル**: `apps/web/src/pages/TwoFactorAuth.tsx`

admin版（`apps/admin/src/pages/auth/TwoFactorAuth.tsx`）をベースに:
- `useAuthStore` を使用
- ロゴをAgentestLogoに変更

#### 10c: 2FAセットアップUI（設定ページ内）
**ファイル**: `apps/web/src/pages/Settings.tsx`

SecuritySettings内に2FAセクションを追加:
- 2FA状態表示（有効/無効）
- 「有効化」ボタン → セットアップフロー（QRコード表示 + コード入力）
- 「無効化」ボタン → パスワード確認ダイアログ

### Phase 11: ルーティング追加

**ファイル**: `apps/web/src/App.tsx`

```typescript
// パブリックルートに追加
<Route path="/2fa" element={<TwoFactorAuthPage />} />
```

LoginPageのhandleSubmit変更:
- ログイン成功時、`totpEnabled`がtrueなら`/2fa`にリダイレクト

### Phase 12: テスト

#### バックエンドテスト
- **ユニットテスト**: `apps/api/src/__tests__/unit/user-totp.service.test.ts`
  - 参考: `apps/api/src/__tests__/unit/admin-totp.service.test.ts`
- **ユニットテスト**: `apps/api/src/__tests__/unit/user-totp.controller.test.ts`
  - 参考: `apps/api/src/__tests__/unit/admin-totp.controller.test.ts`
- **統合テスト**: `apps/api/src/__tests__/integration/user-totp.integration.test.ts`
  - 参考: `apps/api/src/__tests__/integration/admin-totp.integration.test.ts`

## 主要ファイル一覧

### 変更するファイル
| ファイル | 変更内容 |
|---------|---------|
| `packages/db/prisma/schema.prisma` | UserモデルにtotpSecret/totpEnabled追加 |
| `apps/api/src/lib/redis-store.ts` | ユーザーTOTP用Redis関数追加 |
| `apps/api/src/repositories/user.repository.ts` | TOTP関連メソッド追加 |
| `apps/api/src/services/user-password-auth.service.ts` | ログインにtotpEnabled返却追加 |
| `apps/api/src/controllers/auth.controller.ts` | login/meにtotpEnabled追加 |
| `apps/api/src/routes/auth.ts` | 2FAルート追加 |
| `apps/web/src/lib/api.ts` | User型にtotpEnabled追加、2FA API追加 |
| `apps/web/src/stores/auth.ts` | requires2FA/verify2FA/login変更 |
| `apps/web/src/pages/Login.tsx` | 2FAリダイレクト処理追加 |
| `apps/web/src/pages/Settings.tsx` | セキュリティタブに2FAセクション追加 |
| `apps/web/src/App.tsx` | /2faルート追加 |

### 新規作成するファイル
| ファイル | 内容 |
|---------|------|
| `apps/api/src/services/user-totp.service.ts` | ユーザーTOTPサービス |
| `apps/api/src/controllers/user-totp.controller.ts` | ユーザーTOTPコントローラー |
| `apps/web/src/components/auth/TwoFactorForm.tsx` | 2FAフォームコンポーネント |
| `apps/web/src/pages/TwoFactorAuth.tsx` | 2FA認証ページ |
| `apps/api/src/__tests__/unit/user-totp.service.test.ts` | サービスユニットテスト |
| `apps/api/src/__tests__/unit/user-totp.controller.test.ts` | コントローラーユニットテスト |
| `apps/api/src/__tests__/integration/user-totp.integration.test.ts` | 統合テスト |

## 再利用するリソース
- `otplib` (generateSecret, generateURI, verifySync) - 既にapi依存関係に含まれる
- `qrcode` (toDataURL) - 既にapi依存関係に含まれる
- `AuditLogService` (`apps/api/src/services/audit-log.service.ts`) - AUTH カテゴリ
- `extractClientInfo` (`apps/api/src/middleware/session.middleware.ts`)
- Redisストアのジェネリックパターン (`apps/api/src/lib/redis-store.ts`)

## 検証方法

1. **マイグレーション**: `docker compose exec dev pnpm --filter @agentest/db prisma migrate dev`
2. **ビルド**: `docker compose exec dev pnpm build`
3. **テスト実行**: `docker compose exec dev pnpm test`
4. **手動テスト**:
   - ログイン → 設定 → セキュリティ → 2FA有効化（QRコードスキャン → コード入力）
   - ログアウト → ログイン → 2FA入力画面表示 → コード入力 → ダッシュボード表示
   - 設定 → 2FA無効化（パスワード確認）
   - ログアウト → ログイン → 2FA画面スキップ → 直接ダッシュボード
