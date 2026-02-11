# Web 2FA（二要素認証）実装計画 - TDD方式

## Context

webアプリのログインに2FA（TOTP）を追加する。既存のadminアプリの2FA実装パターンを踏襲し、一貫性のあるユーザー体験を提供する。

**セキュリティモデル**: adminと同様、ログイン時にJWTトークンを発行した後、フロントエンドで2FA検証を強制する方式。

## TDD実装タスク

各タスクは **RED → GREEN → REFACTOR** サイクルで実装する。

---

### Task 1: DB スキーマ変更（基盤準備）

テスト不要の基盤作業。後続タスクの前提条件。

**変更ファイル**:
- `packages/db/prisma/schema.prisma` - UserモデルにtotpSecret/totpEnabled追加

```prisma
// パスワード認証の後に追加
// 2FA
totpSecret  String? @map("totp_secret") @db.VarChar(255)
totpEnabled Boolean @default(false) @map("totp_enabled")
```

**コマンド**:
```bash
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name add_user_totp
docker compose exec dev pnpm --filter @agentest/db prisma generate
```

---

### Task 2: Redis TOTP関数（RED → GREEN → REFACTOR）

**RED**: `apps/api/src/__tests__/unit/redis-store-user-totp.test.ts` を作成
- `setUserTotpSetupSecret` - 秘密鍵の保存テスト
- `getUserTotpSetupSecret` - 秘密鍵の取得テスト
- `deleteUserTotpSetupSecret` - 秘密鍵の削除テスト
- `markUserTotpCodeUsed` - 使用済みマークテスト
- `isUserTotpCodeUsed` - 使用済み確認テスト

**GREEN**: `apps/api/src/lib/redis-store.ts` にユーザーTOTP関数を追加
- キープレフィックス: `USER_TOTP_SETUP: 'user:totp:setup:'`, `USER_TOTP_USED: 'user:totp:used:'`
- 既存admin TOTP関数と同じパターンで実装

**参考**: 既存admin TOTP Redis関数（同ファイル行96-229）

---

### Task 3: UserRepository TOTP拡張（RED → GREEN → REFACTOR）

**RED**: `apps/api/src/__tests__/unit/user-repository-totp.test.ts` を作成
- `enableTotp(id, secret)` - totpSecret保存 + totpEnabled = true
- `disableTotp(id)` - totpSecret = null + totpEnabled = false
- `getTotpSecret(id)` - 秘密鍵取得（設定済み/未設定）
- `findByIdWithPassword(id)` - パスワードハッシュ含むユーザー取得

**GREEN**: `apps/api/src/repositories/user.repository.ts` にメソッド追加

**参考**: `apps/api/src/repositories/admin-user.repository.ts` 行110-151

---

### Task 4: UserTotpService（RED → GREEN → REFACTOR）

**RED**: `apps/api/src/__tests__/unit/user-totp.service.test.ts` を作成

テストケース:
- **setupTotp**
  - 秘密鍵生成・QRコード・otpauth URL返却
  - Redisに一時秘密鍵保存（5分TTL）
  - 監査ログ記録
- **enableTotp**
  - 正常: Redis一時鍵取得 → コード検証 → DB保存 → Redis削除
  - 異常: 既に有効 / 期限切れ / コード不正
  - 監査ログ記録（成功/失敗）
- **verifyTotp**
  - 正常: DB秘密鍵取得 → コード検証 → 使用済みマーク
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

---

### Task 5: UserTotpController（RED → GREEN → REFACTOR）

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

### Task 6: ルーティング追加 + 統合テスト（RED → GREEN → REFACTOR）

**RED**: `apps/api/src/__tests__/integration/user-totp.integration.test.ts` を作成

統合テストケース:
- 完全フロー: setup → enable → verify → disable
- 未認証でのアクセス拒否
- リプレイ攻撃対策
- 不正コードの拒否

**GREEN**: `apps/api/src/routes/auth.ts` に2FAルート追加

```typescript
router.get('/2fa/status', requireAuth(authConfig), userTotpController.status);
router.post('/2fa/setup', requireAuth(authConfig), userTotpController.setup);
router.post('/2fa/enable', requireAuth(authConfig), userTotpController.enable);
router.post('/2fa/verify', requireAuth(authConfig), userTotpController.verify);
router.post('/2fa/disable', requireAuth(authConfig), userTotpController.disable);
```

**参考**: `apps/api/src/__tests__/integration/admin-totp.integration.test.ts`

---

### Task 7: ログインフロー変更（RED → GREEN → REFACTOR）

**RED**: 既存の認証テストを更新/拡張
- `user-password-auth.service` のテスト: loginが`totpEnabled`を返すことを確認
- `auth.controller` のテスト: login/meが`totpEnabled`を含むことを確認

**GREEN**:

1. `apps/api/src/services/user-password-auth.service.ts`:
   - `AuthResult.user` に `totpEnabled: boolean` 追加
   - `login()` で `user.totpEnabled` を返却

2. `apps/api/src/controllers/auth.controller.ts`:
   - `login`: レスポンスに `totpEnabled` 含める
   - `me`: レスポンスに `totpEnabled` 含める

---

### Task 8: フロントエンド - API・型定義・ストア更新

テスト対象外（UIレイヤー）。

**変更ファイル**:

1. `apps/web/src/lib/api.ts`:
   - `User` 型に `totpEnabled: boolean` 追加
   - `authApi` に 2FA メソッド追加（get2FAStatus, setup2FA, enable2FA, verify2FA, disable2FA）

2. `apps/web/src/stores/auth.ts`:
   - `requires2FA: boolean` ステート追加
   - `login(email, password)` アクション追加（totpEnabledチェック）
   - `verify2FA(code)` アクション追加

**参考**: `apps/admin/src/stores/admin-auth.store.ts`

---

### Task 9: フロントエンド - 2FA認証ページ・フォーム

テスト対象外（UIレイヤー）。

**新規ファイル**:

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

### Task 10: フロントエンド - 設定ページ2FAセクション

テスト対象外（UIレイヤー）。

**変更ファイル**: `apps/web/src/pages/Settings.tsx`

SecuritySettings内に2FAセクションを追加:
- 2FA状態表示（有効/無効バッジ）
- **有効化フロー**: ボタン → QRコード表示モーダル → コード入力 → 有効化確認
- **無効化フロー**: ボタン → パスワード確認モーダル → 無効化

---

## タスク依存関係

```
Task 1 (DB) ─┬─→ Task 2 (Redis)
              ├─→ Task 3 (Repository)
              │     └─→ Task 4 (Service) ─→ Task 5 (Controller) ─→ Task 6 (Routes+統合テスト)
              └─→ Task 7 (ログインフロー変更)
                    └─→ Task 8 (FE API・ストア) ─→ Task 9 (FE 2FAページ)
                                                  └─→ Task 10 (FE 設定ページ)
```

Task 2, 3, 7 は Task 1 完了後に並列実行可能。

---

## 再利用するリソース

| リソース | パス |
|---------|------|
| otplib (generateSecret, generateURI, verifySync) | 既存api依存関係 |
| qrcode (toDataURL) | 既存api依存関係 |
| AuditLogService | `apps/api/src/services/audit-log.service.ts` |
| extractClientInfo | `apps/api/src/middleware/session.middleware.ts` |
| Admin TOTP Service（参考実装） | `apps/api/src/services/admin/admin-totp.service.ts` |
| Admin TOTP Controller（参考実装） | `apps/api/src/controllers/admin/totp.controller.ts` |
| Admin TwoFactorForm（参考実装） | `apps/admin/src/components/auth/TwoFactorForm.tsx` |
| Admin Auth Store（参考実装） | `apps/admin/src/stores/admin-auth.store.ts` |

## 検証方法

1. **マイグレーション**: `docker compose exec dev pnpm --filter @agentest/db prisma migrate dev`
2. **ビルド**: `docker compose exec dev pnpm build`
3. **テスト実行**: `docker compose exec dev pnpm test`
4. **手動テスト**:
   - 設定 → セキュリティ → 2FA有効化（QRスキャン → コード入力）
   - ログアウト → ログイン → 2FA画面 → コード入力 → ダッシュボード
   - 設定 → 2FA無効化（パスワード確認）→ ログアウト → ログイン → 直接ダッシュボード
