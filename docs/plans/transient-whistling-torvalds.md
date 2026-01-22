# Step 0-4: 管理者 2FA（TOTP）API 実装計画

## 概要

管理者認証に2要素認証（TOTP: Time-based One-Time Password）を追加する。Google Authenticatorなどの認証アプリと連携し、セキュリティを強化。

## エンドポイント

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| POST | `/admin/auth/2fa/setup` | 2FA セットアップ開始（QRコード生成） | 必須 |
| POST | `/admin/auth/2fa/enable` | 2FA 有効化（コード確認後） | 必須 |
| POST | `/admin/auth/2fa/verify` | 2FA 検証（ログイン時） | 必須（2FA待ち状態） |
| POST | `/admin/auth/2fa/disable` | 2FA 無効化 | 必須 |

## 依存パッケージ

```bash
docker compose exec dev pnpm add otplib qrcode --filter @agentest/api
docker compose exec dev pnpm add -D @types/qrcode --filter @agentest/api
```

---

## 実装詳細

### 1. AdminUserRepository の拡張

**ファイル**: `apps/api/src/repositories/admin-user.repository.ts`

追加メソッド:
```typescript
// TOTP秘密鍵を保存し、2FAを有効化
async enableTotp(id: string, totpSecret: string): Promise<void>

// TOTPを無効化（秘密鍵をnullに）
async disableTotp(id: string): Promise<void>

// TOTP秘密鍵を取得（検証用）
async getTotpSecret(id: string): Promise<string | null>
```

### 2. AdminTotpService の新規作成

**ファイル**: `apps/api/src/services/admin/admin-totp.service.ts`

```typescript
export class AdminTotpService {
  // TOTP秘密鍵を生成し、QRコードを返却
  // 秘密鍵はRedisに一時保存（有効期限5分）
  async setupTotp(adminUserId: string): Promise<TotpSetupResult>

  // TOTPコードを検証し、有効化
  // Redisから一時秘密鍵を取得して検証後、DBに保存
  async enableTotp(adminUserId: string, code: string): Promise<void>

  // ログイン時の2FA検証
  // DBから秘密鍵を取得して検証
  async verifyTotp(adminUserId: string, code: string): Promise<boolean>

  // 2FA無効化（パスワード確認必須）
  async disableTotp(adminUserId: string, password: string): Promise<void>
}
```

### 3. Redis一時ストレージ

**ファイル**: `apps/api/src/lib/redis-store.ts`（新規）

```typescript
// TOTP秘密鍵の一時保存（5分間）
await setTotpSetupSecret(adminUserId, secret, 300)
await getTotpSetupSecret(adminUserId)
await deleteTotpSetupSecret(adminUserId)

// 使用済みコード記録（リプレイ攻撃対策、90秒）
await markTotpCodeUsed(adminUserId, code, 90)
await isTotpCodeUsed(adminUserId, code)
```

### 4. TotpController の新規作成

**ファイル**: `apps/api/src/controllers/admin/totp.controller.ts`

```typescript
export class AdminTotpController {
  // POST /2fa/setup - セットアップ開始
  setup = async (req, res, next) => { ... }

  // POST /2fa/enable - 有効化
  enable = async (req, res, next) => { ... }

  // POST /2fa/verify - ログイン時検証
  verify = async (req, res, next) => { ... }

  // POST /2fa/disable - 無効化
  disable = async (req, res, next) => { ... }
}
```

### 5. ルート定義の追加

**ファイル**: `apps/api/src/routes/admin/auth.ts`

```typescript
// 2FAエンドポイント追加
router.post('/2fa/setup', adminAuthLimiter, requireAdminAuth(), controller.setup);
router.post('/2fa/enable', adminAuthLimiter, requireAdminAuth(), controller.enable);
router.post('/2fa/verify', adminAuthLimiter, requireAdminAuth(), controller.verify);
router.post('/2fa/disable', adminAuthLimiter, requireAdminAuth(), controller.disable);
```

---

## 処理フロー

### セットアップ → 有効化フロー

```
1. POST /2fa/setup
   - 新しい秘密鍵を生成（authenticator.generateSecret()）
   - QRコード生成（otpauth:// URI）
   - Redisに秘密鍵を一時保存（5分間）
   - レスポンス: { secret, qrCodeDataUrl, otpauthUrl }

2. POST /2fa/enable { code: "123456" }
   - Redisから一時秘密鍵を取得
   - TOTPコードを検証
   - 成功: DBに秘密鍵を保存、totpEnabled=true
   - Redisの一時データを削除
```

### ログイン時の2FA検証フロー

```
1. POST /admin/auth/login
   - パスワード認証成功
   - totpEnabled=true の場合、レスポンスに requiresTwoFactor: true を含める
   - セッションは作成するが、2FA未検証状態としてマーク

2. POST /2fa/verify { code: "123456" }
   - セッションの2FA待ち状態を確認
   - DBから秘密鍵を取得
   - TOTPコードを検証
   - 成功: セッションを完全認証状態に更新
```

### 2FA無効化フロー

```
POST /2fa/disable { password: "current-password" }
- パスワードを再検証
- totpSecret=null, totpEnabled=false に更新
- 監査ログ記録
```

---

## セキュリティ考慮事項

1. **時間許容幅**: 前後1ステップ（30秒）のみ許可
2. **リプレイ攻撃対策**: 使用済みコードをRedisに記録（90秒間）
3. **レート制限**: 既存の adminAuthLimiter を適用
4. **監査ログ**: 全操作を記録
   - TOTP_SETUP_INITIATED
   - TOTP_ENABLED
   - TOTP_VERIFY_SUCCESS / TOTP_VERIFY_FAILED
   - TOTP_DISABLED

---

## ファイル一覧

### 新規作成

| ファイル | 説明 |
|----------|------|
| `apps/api/src/services/admin/admin-totp.service.ts` | TOTPサービス |
| `apps/api/src/controllers/admin/totp.controller.ts` | TOTPコントローラー |
| `apps/api/src/lib/redis-store.ts` | Redis一時ストレージ |
| `apps/api/src/__tests__/unit/admin-totp.service.test.ts` | サービスユニットテスト |
| `apps/api/src/__tests__/unit/admin-totp.controller.test.ts` | コントローラーユニットテスト |
| `apps/api/src/__tests__/integration/admin-totp.integration.test.ts` | 結合テスト |

### 修正

| ファイル | 変更内容 |
|----------|----------|
| `apps/api/src/repositories/admin-user.repository.ts` | TOTP関連メソッド追加 |
| `apps/api/src/routes/admin/auth.ts` | 2FAルート追加 |
| `apps/api/src/__tests__/unit/admin-user.repository.test.ts` | TOTP関連テスト追加 |
| `apps/api/src/__tests__/integration/test-helpers.ts` | TOTPテストヘルパー追加 |

---

## 実装順序

1. **依存パッケージの追加** - otplib, qrcode
2. **Redis一時ストレージ** - redis-store.ts 新規作成
3. **AdminUserRepository拡張** - TOTP関連メソッド追加 + テスト
4. **AdminTotpService実装** - サービス + テスト
5. **TotpController実装** - コントローラー + テスト
6. **ルート定義追加** - auth.ts に2FAエンドポイント追加
7. **結合テスト作成** - 完全フローのテスト

---

## 検証方法

### 1. ユニットテスト
```bash
docker compose exec dev pnpm test --filter @agentest/api -- admin-totp
```

### 2. 結合テスト
```bash
docker compose exec dev pnpm test --filter @agentest/api -- admin-totp.integration
```

### 3. 手動テスト
```bash
# セットアップ開始（認証済みセッション必要）
curl -X POST http://localhost:3000/admin/auth/2fa/setup \
  -H "Cookie: admin_session=xxx"

# 有効化（QRコードをGoogle Authenticatorでスキャン後）
curl -X POST http://localhost:3000/admin/auth/2fa/enable \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=xxx" \
  -d '{"code":"123456"}'

# ログイン後の2FA検証
curl -X POST http://localhost:3000/admin/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=xxx" \
  -d '{"code":"123456"}'
```
