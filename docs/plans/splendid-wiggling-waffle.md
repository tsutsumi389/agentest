# Web 2FA（二要素認証）実装計画 - TDD方式

## Context

webアプリのログインに2FA（TOTP）を追加する。既存のadminアプリの2FA実装パターンを参考にしつつ、セキュリティ上の改善を加える。

**セキュリティモデル**: ログイン時に2FAが有効なユーザーにはJWTを発行せず、一時トークン（Redis, 5分TTL）を返却する。2FA検証が完了して初めてJWTトークンペアを発行する方式。これにより、2FA未完了の状態でAPIにアクセスすることを**サーバーサイドで完全に防止**する。

**admin実装との主な違い**:
- totpSecretをアプリケーション層で暗号化してDBに保存（AES-256-GCM）
- 2FA検証完了前にはJWT/セッションを一切発行しない
- 2FA関連エンドポイントにレート制限を適用
- フロントエンドのストア・コンポーネントにもユニットテストを追加

## TDD実装タスク

各タスクは **RED → GREEN → REFACTOR** サイクルで実装する。

---

### Task 1: DB スキーマ変更（基盤準備） ✅ 完了

テスト不要の基盤作業。後続タスクの前提条件。

**変更ファイル**:
- `packages/db/prisma/schema.prisma` - UserモデルにtotpSecret/totpEnabled追加

```prisma
// 2要素認証（TOTP）
totpSecret  String? @map("totp_secret") @db.VarChar(255)
totpEnabled Boolean @default(false) @map("totp_enabled")
```

---

### Task 2: Redis TOTP関数（RED → GREEN → REFACTOR） ✅ 完了

**RED**: `apps/api/src/__tests__/unit/redis-store-user-totp.test.ts` を作成

セットアップ用一時鍵:
- `setUserTotpSetupSecret` - 秘密鍵の保存テスト（TTL 5分）
- `getUserTotpSetupSecret` - 秘密鍵の取得テスト
- `deleteUserTotpSetupSecret` - 秘密鍵の削除テスト

リプレイ攻撃対策:
- `markUserTotpCodeUsed` - 使用済みマークテスト（TTL 90秒）
- `isUserTotpCodeUsed` - 使用済み確認テスト

2FA認証用一時トークン:
- `setUserTwoFactorToken(userId, token)` - 一時トークン保存（TTL 5分）
- `getUserIdByTwoFactorToken(token)` - トークンからユーザーID取得
- `deleteUserTwoFactorToken(token)` - 一時トークン削除

**GREEN**: `apps/api/src/lib/redis-store.ts` にユーザーTOTP関数を追加
- キープレフィックス: `USER_TOTP_SETUP: 'user:totp:setup:'`, `USER_TOTP_USED: 'user:totp:used:'`, `USER_2FA_TOKEN: 'user:2fa:token:'`
- 既存admin TOTP関数と同じパターンで実装
- twoFactorTokenはcrypto.randomBytes(32)で生成したトークンをキーにuserIdを値として保存

**参考**: 既存admin TOTP Redis関数（同ファイル行96-229）

---

### Task 3: TOTP暗号化ユーティリティ（RED → GREEN → REFACTOR） ✅ 完了

**目的**: totpSecretをDBに平文で保存せず、アプリケーション層でAES-256-GCMにより暗号化する。DB漏洩時に全ユーザーの2FAがバイパスされるリスクを軽減する。

**RED**: `apps/api/src/__tests__/unit/totp-crypto.test.ts` を作成

テストケース:
- `encryptTotpSecret(plainSecret)` → 暗号化文字列を返す
- `decryptTotpSecret(encryptedSecret)` → 元の平文を返す
- 暗号化→復号のラウンドトリップで元の値と一致
- 同じ平文でも毎回異なる暗号文（IVのランダム性）
- 不正な暗号文で復号するとエラー
- 環境変数 `TOTP_ENCRYPTION_KEY` 未設定時にエラー

**GREEN**: `apps/api/src/lib/totp-crypto.ts` を作成

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// 環境変数から256-bit鍵を取得
const TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY

export function encryptTotpSecret(secret: string): string {
  if (!TOTP_ENCRYPTION_KEY) {
    throw new Error('TOTP_ENCRYPTION_KEY が設定されていません')
  }
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(TOTP_ENCRYPTION_KEY, 'hex'), iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptTotpSecret(encryptedSecret: string): string {
  if (!TOTP_ENCRYPTION_KEY) {
    throw new Error('TOTP_ENCRYPTION_KEY が設定されていません')
  }
  const [ivHex, tagHex, encryptedHex] = encryptedSecret.split(':')
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(TOTP_ENCRYPTION_KEY, 'hex'), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(encryptedHex, 'hex'), undefined, 'utf8') + decipher.final('utf8')
}
```

**環境変数**: `TOTP_ENCRYPTION_KEY` を docker/.env に追加（256-bit = 64文字hex）
```bash
# 鍵生成コマンド
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Task 4: UserRepository TOTP拡張（RED → GREEN → REFACTOR） ✅ 完了

**RED**: `apps/api/src/__tests__/unit/user-repository-totp.test.ts` を作成
- `enableTotp(id, encryptedSecret)` - 暗号化済みtotpSecret保存 + totpEnabled = true
- `disableTotp(id)` - totpSecret = null + totpEnabled = false
- `getTotpSecret(id)` - 暗号化済み秘密鍵取得（設定済み/未設定）
- `findByIdWithPassword(id)` - パスワードハッシュ含むユーザー取得

**GREEN**: `apps/api/src/repositories/user.repository.ts` にメソッド追加

**注意**: Repositoryは暗号化済みの文字列をそのまま保存・取得する。暗号化/復号はService層で行う。

**参考**: `apps/api/src/repositories/admin-user.repository.ts` 行110-151

---

### Task 5: UserTotpService（RED → GREEN → REFACTOR） ✅ 完了

**RED**: `apps/api/src/__tests__/unit/user-totp.service.test.ts` を作成

テストケース:
- **setupTotp**
  - 秘密鍵生成・QRコード・otpauth URL返却
  - Redisに一時秘密鍵保存（5分TTL）
  - 監査ログ記録
- **enableTotp**
  - 正常: Redis一時鍵取得 → コード検証 → **暗号化** → DB保存 → Redis削除
  - 異常: 既に有効 / 期限切れ / コード不正
  - 監査ログ記録（成功/失敗）
- **verifyTotp**
  - 正常: DB暗号化秘密鍵取得 → **復号** → コード検証 → 使用済みマーク
  - リプレイ攻撃対策: 使用済みコード拒否
  - 異常: TOTP未設定 / コード不正
  - 監査ログ記録（成功/失敗）
- **disableTotp**
  - 正常: パスワード確認 → DB無効化
  - 異常: パスワード不正 / ユーザー不存在
  - 監査ログ記録

**GREEN**: `apps/api/src/services/user-totp.service.ts` を作成

**参考**: `apps/api/src/services/admin/admin-totp.service.ts`

主な違い:
- `UserRepository` 使用（`AdminUserRepository` ではなく）
- `AuditLogService` 使用 + カテゴリ `AUTH`（`AdminAuditLogService` ではなく）
- `setUserTotpSetupSecret`等のRedis関数使用
- APP_NAME = `'Agentest'`
- **暗号化**: `encryptTotpSecret` / `decryptTotpSecret` を使用してDB保存/読み取り

---

### Task 6: UserTotpController（RED → GREEN → REFACTOR） ✅ 完了

**RED**: `apps/api/src/__tests__/unit/user-totp.controller.test.ts` を作成

テストケース:
- **setup**: req.user存在確認 → サービス呼び出し → QRコードレスポンス
- **enable**: Zodバリデーション（6桁数字） → サービス呼び出し
- **verify**: Zodバリデーション → サービス呼び出し → verified: true レスポンス
- **disable**: Zodバリデーション（password必須） → サービス呼び出し
- **status**: req.user.totpEnabled返却
- 認証なしの場合 → AuthenticationError
- バリデーションエラー → ValidationError

**GREEN**: `apps/api/src/controllers/user-totp.controller.ts` を作成

**参考**: `apps/api/src/controllers/admin/totp.controller.ts`

主な違い:
- `req.user` 使用（`req.adminUser` ではなく）
- `UserTotpService` 使用
- statusエンドポイント追加

---

### Task 7: ルーティング + レート制限 + 統合テスト（RED → GREEN → REFACTOR） ✅ 完了

**RED**: `apps/api/src/__tests__/integration/user-totp.integration.test.ts` を作成

統合テストケース:
- 完全フロー: setup → enable → verify → disable
- 未認証でのアクセス拒否
- リプレイ攻撃対策
- 不正コードの拒否
- **レート制限テスト**: 連続失敗でブロックされることを確認

**GREEN**:

1. `apps/api/src/routes/auth.ts` に2FAルート追加:

```typescript
router.get('/2fa/status', requireAuth(authConfig), userTotpController.status);
router.post('/2fa/setup', requireAuth(authConfig), rateLimiter({ max: 3, windowMs: 60000 }), userTotpController.setup);
router.post('/2fa/enable', requireAuth(authConfig), rateLimiter({ max: 5, windowMs: 60000 }), userTotpController.enable);
router.post('/2fa/verify', rateLimiter({ max: 5, windowMs: 60000 }), userTotpController.verify);
router.post('/2fa/disable', requireAuth(authConfig), rateLimiter({ max: 5, windowMs: 60000 }), userTotpController.disable);
```

2. レート制限:
   - `/2fa/setup`: 3回/分（QRコード生成コスト）
   - `/2fa/enable`: 5回/分
   - `/2fa/verify`: 5回/分（ブルートフォース対策。TOTPは6桁=100万通り）
   - `/2fa/disable`: 5回/分

**注意**: `/2fa/verify` は認証なし（JWT未発行状態で呼ばれるため）。twoFactorTokenで認証する。

**参考**: `apps/api/src/__tests__/integration/admin-totp.integration.test.ts`

---

### Task 8: ログインフロー変更（RED → GREEN → REFACTOR） ✅ 完了

**セキュリティ設計の核心**: 2FA有効ユーザーにはJWTを発行しない。

**RED**: 既存の認証テストを更新/拡張

`user-password-auth.service` テスト追加:
- 2FA無効ユーザー: 従来通りJWTトークンペア返却
- **2FA有効ユーザー: JWTを返却せず、`{ requires2FA: true, twoFactorToken: '...' }` を返却**
- twoFactorTokenがRedisに保存されることを確認

`auth.controller` テスト追加:
- 2FA無効ユーザー: 従来通りクッキーにJWT設定
- **2FA有効ユーザー: クッキー未設定、レスポンスに `requires2FA: true` + `twoFactorToken`**
- `/2fa/verify` 成功時: クッキーにJWT設定、`requires2FA: false` レスポンス
- `me`: レスポンスに `totpEnabled` 含める

**GREEN**:

1. `apps/api/src/services/user-password-auth.service.ts`:
   ```typescript
   // AuthResult型を拡張
   type AuthResult =
     | { success: true; user: UserInfo; tokens: TokenPair }                    // 2FA無効
     | { success: true; requires2FA: true; twoFactorToken: string }            // 2FA有効

   async login(email, password, res):
     // ... 既存のパスワード検証ロジック ...
     if (user.totpEnabled) {
       // JWTを発行しない。一時トークンをRedisに保存して返す
       const token = crypto.randomBytes(32).toString('hex')
       await setUserTwoFactorToken(user.id, token)  // Redis 5分TTL
       return { success: true, requires2FA: true, twoFactorToken: token }
     }
     // 2FA無効: 従来通りJWT発行
     return { success: true, user: ..., tokens: ... }
   ```

2. `apps/api/src/controllers/auth.controller.ts`:
   ```typescript
   // login
   if (result.requires2FA) {
     return res.json({
       requires2FA: true,
       twoFactorToken: result.twoFactorToken,
     })
     // クッキーは設定しない
   }
   // 従来通りのJWT設定フロー

   // POST /2fa/verify（認証不要エンドポイント）
   async verifyTwoFactor(req, res):
     const { twoFactorToken, code } = req.body
     const userId = await getUserIdByTwoFactorToken(twoFactorToken)
     if (!userId) throw new AuthenticationError('トークンが無効または期限切れ')
     await userTotpService.verifyTotp(userId, code)
     await deleteUserTwoFactorToken(twoFactorToken)
     // 検証成功: JWT発行 + セッション作成 + クッキー設定
     const tokens = await generateTokens(userId)
     setTokenCookies(res, tokens)
     return res.json({ success: true, user: ... })
   ```

3. `apps/api/src/controllers/auth.controller.ts`:
   - `me`: レスポンスに `totpEnabled` 含める

---

### Task 9: フロントエンド - API・型定義・ストア更新（RED → GREEN → REFACTOR）

**RED**: `apps/web/src/stores/__tests__/auth-2fa.test.ts` を作成

テストケース:
- `login()` で2FA不要ユーザー → `isAuthenticated: true`
- `login()` で2FA必要ユーザー → `requires2FA: true`, `twoFactorToken` 保持
- `verify2FA(code)` 成功 → `isAuthenticated: true`, `requires2FA: false`
- `verify2FA(code)` 失敗 → エラーメッセージ設定
- `logout()` → 全状態リセット

**GREEN**:

1. `apps/web/src/lib/api.ts`:
   - `User` 型に `totpEnabled: boolean` 追加
   - `authApi` に 2FA メソッド追加（get2FAStatus, setup2FA, enable2FA, verify2FA, disable2FA）

2. `apps/web/src/stores/auth.ts`:
   - `requires2FA: boolean` ステート追加
   - `twoFactorToken: string | null` ステート追加
   - `login(email, password)`: レスポンスの `requires2FA` をチェック、`twoFactorToken` を保持
   - `verify2FA(code)`: `twoFactorToken` + `code` を送信、成功時に `isAuthenticated: true`

**参考**: `apps/admin/src/stores/admin-auth.store.ts`

---

### Task 10: フロントエンド - 2FA認証ページ・フォーム（RED → GREEN → REFACTOR）

**RED**: `apps/web/src/pages/__tests__/TwoFactorAuth.test.tsx` を作成

テストケース:
- 6桁コード入力 → verify2FA呼び出し
- 不正コード → エラーメッセージ表示
- requires2FA=false → /login にリダイレクト
- isAuthenticated=true → /dashboard にリダイレクト
- ログアウトボタン → logout呼び出し

**GREEN**:

1. `apps/web/src/components/auth/TwoFactorForm.tsx` - 6桁コード入力フォーム
   - 参考: `apps/admin/src/components/auth/TwoFactorForm.tsx`
   - `useAuthStore` の `verify2FA`/`logout` を使用

2. `apps/web/src/pages/TwoFactorAuth.tsx` - 2FA認証ページ
   - 参考: `apps/admin/src/pages/auth/TwoFactorAuth.tsx`
   - requires2FAがfalseなら `/login` にリダイレクト
   - isAuthenticatedなら `/dashboard` にリダイレクト

**変更ファイル**:

3. `apps/web/src/App.tsx`:
   - `/2fa` ルート追加（パブリック）

4. `apps/web/src/pages/Login.tsx`:
   - handleSubmit変更: ストアの `login()` を呼び出し、requires2FAなら `/2fa` にリダイレクト

---

### Task 11: フロントエンド - 設定ページ2FAセクション

**変更ファイル**: `apps/web/src/pages/Settings.tsx`

SecuritySettings内に2FAセクションを追加:
- 2FA状態表示（有効/無効バッジ）
- **有効化フロー**: ボタン → QRコード表示モーダル → コード入力 → 有効化確認
- **無効化フロー**: ボタン → パスワード確認モーダル → 無効化

---

## タスク依存関係

```
Task 1 (DB) ✅ ─┬─→ Task 2 (Redis)
                ├─→ Task 3 (暗号化) ─→ Task 4 (Repository)
                │                       └─→ Task 5 (Service) ─→ Task 6 (Controller) ─→ Task 7 (Routes+統合テスト)
                └─→ Task 8 (ログインフロー変更) ※Task 2, 5 にも依存
                      └─→ Task 9 (FE API・ストア) ─→ Task 10 (FE 2FAページ)
                                                     └─→ Task 11 (FE 設定ページ)
```

並列実行可能:
- Task 2, 3 は Task 1 完了後に並列実行可能
- Task 4 は Task 3 完了後に開始
- Task 8 は Task 2, 5 完了後に開始

---

## セキュリティ対策まとめ

| 脅威 | 対策 | 実装箇所 |
|------|------|---------|
| DB漏洩による2FAバイパス | totpSecretをAES-256-GCMで暗号化 | Task 3, 5 |
| フロントエンドバイパスによる2FAスキップ | JWT未発行方式（2FA完了まで一切のAPIアクセス不可） | Task 8 |
| TOTPブルートフォース | レート制限（5回/分） | Task 7 |
| TOTPリプレイ攻撃 | 使用済みコードをRedisで記録（90秒TTL） | Task 2, 5 |
| 一時トークン窃取 | 5分TTL + 検証成功時に即削除 | Task 2, 8 |
| タイミング攻撃 | 既存のbcryptダミー比較パターンを継続 | 既存実装 |

---

## 再利用するリソース

| リソース | パス |
|---------|------|
| otplib (generateSecret, generateURI, verifySync) | 既存api依存関係 |
| qrcode (toDataURL) | 既存api依存関係 |
| crypto (createCipheriv, randomBytes) | Node.js標準 |
| AuditLogService | `apps/api/src/services/audit-log.service.ts` |
| extractClientInfo | `apps/api/src/middleware/session.middleware.ts` |
| Admin TOTP Service（参考実装） | `apps/api/src/services/admin/admin-totp.service.ts` |
| Admin TOTP Controller（参考実装） | `apps/api/src/controllers/admin/totp.controller.ts` |
| Admin TwoFactorForm（参考実装） | `apps/admin/src/components/auth/TwoFactorForm.tsx` |
| Admin Auth Store（参考実装） | `apps/admin/src/stores/admin-auth.store.ts` |

## 環境変数追加

```bash
# docker/.env に追加
TOTP_ENCRYPTION_KEY=<64文字hex>  # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 検証方法

1. **マイグレーション**: `docker compose exec dev pnpm --filter @agentest/db prisma migrate dev`
2. **ビルド**: `docker compose exec dev pnpm build`
3. **テスト実行**: `docker compose exec dev pnpm test`
4. **手動テスト**:
   - 設定 → セキュリティ → 2FA有効化（QRスキャン → コード入力）
   - ログアウト → ログイン → **JWTなし状態で2FA画面** → コード入力 → JWT発行 → ダッシュボード
   - 設定 → 2FA無効化（パスワード確認）→ ログアウト → ログイン → 直接ダッシュボード
   - **セキュリティテスト**: 2FA有効ユーザーのログイン後（2FA未完了）、直接APIを叩いて401になることを確認
