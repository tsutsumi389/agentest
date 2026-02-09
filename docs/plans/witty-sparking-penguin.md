# メールアドレス確認フローの実装計画

## Context

現在のアカウント作成フローでは、メールアドレスの所有確認を行わずに即座にログイン状態になる。
これにより、他人のメールアドレスで登録が可能な状態にある。

**目標**: 登録時に確認メールを送信し、メール内リンクのクリックで確認完了するまでログインをブロックする。

## 方針

- メール確認が完了するまで**ログイン自体をブロック**（JWT発行しない）
- OAuthユーザーは**自動で確認済み**（`emailVerified=true`）
- 確認トークンは**DB**に保存（`PasswordResetToken`と同じパターン）
- 既存ユーザーのデータマイグレーション（`emailVerified=true`に更新）

---

## Phase 1: DBスキーマ変更

### 1.1 Userモデルに`emailVerified`追加 + `EmailVerificationToken`テーブル追加

**ファイル**: `packages/db/prisma/schema.prisma`

- Userモデルにフィールド追加:
  ```prisma
  emailVerified Boolean @default(false) @map("email_verified")
  emailVerificationTokens EmailVerificationToken[]
  ```
- `EmailVerificationToken`モデル新規追加（`PasswordResetToken`と同構造）:
  - `id`, `userId`, `tokenHash`(unique), `expiresAt`, `usedAt`, `createdAt`

### 1.2 マイグレーション実行 + 既存ユーザーデータ移行

```bash
docker compose exec dev pnpm --filter @agentest/db exec prisma migrate dev --name add-email-verification
```

マイグレーション後、既存ユーザーを`emailVerified=true`に更新するSQLを実行:
```sql
UPDATE users SET email_verified = true WHERE email_verified = false;
```

---

## Phase 2: バックエンド変更

### 2.1 メール確認テンプレート追加

**ファイル**: `apps/api/src/services/email.service.ts`

- `generateEmailVerificationEmail()`メソッド追加
- 件名: `【Agentest】メールアドレスの確認`
- `generatePasswordResetEmail()`と同じHTML/テキスト構造、XSS対策（`escapeHtml`, `sanitizeUrl`）

### 2.2 `register()`の変更

**ファイル**: `apps/api/src/services/user-password-auth.service.ts`

**現在**: ユーザー作成 → JWT発行 → RefreshToken/Session保存 → `AuthResult`返却
**変更後**: ユーザー作成 → 確認トークン生成 → `EmailVerificationToken`保存 → `RegisterResult`返却

- 新定数: `VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000`（24時間）
- 新型: `RegisterResult { user, verificationToken }`（JWTなし）
- JWT/RefreshToken/Session作成を**削除**
- `crypto.randomBytes(32).toString('hex')` + `hashToken()`でトークン生成・ハッシュ保存
- `ipAddress`/`userAgent`引数は不要になる（セッション作成しないため）

### 2.3 `verifyEmail()`メソッド追加

**ファイル**: `apps/api/src/services/user-password-auth.service.ts`

- トークンハッシュでDB検索 → 未使用・期限内チェック → `emailVerified=true`に更新
- `resetPassword()`と同パターン

### 2.4 `resendVerification()`メソッド追加

**ファイル**: `apps/api/src/services/user-password-auth.service.ts`

- メールアドレスでユーザー検索 → 未確認かつパスワードユーザーのみ処理
- 既存未使用トークンを無効化 → 新トークン生成
- ユーザー不在/確認済みの場合は`null`返却（メール存在確認を防ぐ）
- `requestPasswordReset()`と同パターン

### 2.5 `login()`にemailVerifiedチェック追加

**ファイル**: `apps/api/src/services/user-password-auth.service.ts`

パスワード検証成功後（L203の後）、JWT生成前に挿入:
```typescript
if (!user.emailVerified) {
  throw new AppError(401, 'EMAIL_NOT_VERIFIED', 'メールアドレスが確認されていません。受信トレイの確認メールをご確認ください');
}
```

**注**: `AuthenticationError`はコード固定（`AUTHENTICATION_ERROR`）なので、`AppError`を直接使用してカスタムコード`EMAIL_NOT_VERIFIED`を設定する。

### 2.6 コントローラー: `register`ハンドラ変更

**ファイル**: `apps/api/src/controllers/auth.controller.ts`

- `setAuthCookies()`呼び出しを**削除**
- ウェルカムメール → **確認メール**に変更
- 確認URL: `${env.FRONTEND_URL}/verify-email?token=${result.verificationToken}`
- レスポンス: `{ message, user }` （status 201）

### 2.7 コントローラー: `verifyEmail`ハンドラ追加

**ファイル**: `apps/api/src/controllers/auth.controller.ts`

- `GET /api/auth/verify-email?token=xxx`
- クエリパラメータからトークン取得 → `passwordAuthService.verifyEmail(token)` → 成功レスポンス

### 2.8 コントローラー: `resendVerification`ハンドラ追加

**ファイル**: `apps/api/src/controllers/auth.controller.ts`

- `POST /api/auth/resend-verification` (body: `{ email }`)
- `forgotPassword`と同じ火消し型パターン（成功/失敗に関わらず同一レスポンス）
- `passwordResetRequestSchema`を再利用（emailのみのバリデーション）

### 2.9 ルート追加

**ファイル**: `apps/api/src/routes/auth.ts`

```typescript
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
```

### 2.10 OAuthコールバックで`emailVerified=true`

**ファイル**: `apps/api/src/app.ts`

- L138: `prisma.user.create`に`emailVerified: true`追加
- L132-145: 既存ユーザーがOAuthでログインした場合、未確認なら`emailVerified: true`に更新

---

## Phase 3: フロントエンド変更

### 3.1 APIクライアント更新

**ファイル**: `apps/web/src/lib/api.ts`

- `register`の戻り型を`{ message, user }`に変更
- `verifyEmail(token)` 追加（GET）
- `resendVerification({ email })` 追加（POST）

### 3.2 `CheckEmail`ページ新規作成

**ファイル**: `apps/web/src/pages/CheckEmail.tsx`（新規）

- 登録後に表示する「確認メール送信済み」ページ
- `ForgotPasswordPage`と同じレイアウト・スタイル
- メールアドレス表示（URLクエリパラメータ`?email=xxx`から取得）
- 「再送信」ボタン → `authApi.resendVerification({ email })`
- 「ログインに戻る」リンク

### 3.3 `VerifyEmail`ページ新規作成

**ファイル**: `apps/web/src/pages/VerifyEmail.tsx`（新規）

- メール内リンクのランディングページ
- マウント時にURLクエリパラメータ`?token=xxx`を取得 → `authApi.verifyEmail(token)`呼び出し
- 成功: 「メールアドレスが確認されました」+ ログインリンク
- 失敗: エラーメッセージ + 再送信リンク
- ローディング状態表示

### 3.4 `Register`ページ修正

**ファイル**: `apps/web/src/pages/Register.tsx`

- `handleSubmit`の変更:
  - `setUser(user)` + `navigate('/dashboard')` を **削除**
  - 代わりに `navigate('/check-email?email=...', { replace: true })` にリダイレクト

### 3.5 `Login`ページ修正

**ファイル**: `apps/web/src/pages/Login.tsx`

- catchブロックで`ApiError`の`code`をチェック:
  - `EMAIL_NOT_VERIFIED` → `/check-email?email=...`にリダイレクト

### 3.6 ルーティング追加

**ファイル**: `apps/web/src/App.tsx`

- パブリックルートに追加:
  ```tsx
  <Route path="/check-email" element={<CheckEmailPage />} />
  <Route path="/verify-email" element={<VerifyEmailPage />} />
  ```

---

## Phase 4: テスト

### 4.1 サービス層ユニットテスト

**ファイル**: `apps/api/src/__tests__/unit/user-password-auth.service.test.ts`

- `register()`: JWT未発行、EmailVerificationToken作成を確認
- `verifyEmail()`: 正常系、無効トークン、期限切れ、使用済み、冪等性
- `resendVerification()`: 正常系、ユーザー不在、確認済み、OAuthのみ
- `login()`: 未確認ユーザーで`EMAIL_NOT_VERIFIED`エラー

### 4.2 メールテンプレートテスト

**ファイル**: `apps/api/src/services/__tests__/email-templates.test.ts`

- `generateEmailVerificationEmail()`: 件名、URL、XSSエスケープ

---

## 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `packages/db/prisma/schema.prisma` | `emailVerified`フィールド、`EmailVerificationToken`モデル追加 |
| `apps/api/src/services/user-password-auth.service.ts` | register変更、verifyEmail/resendVerification追加、loginチェック追加 |
| `apps/api/src/services/email.service.ts` | `generateEmailVerificationEmail()`追加 |
| `apps/api/src/controllers/auth.controller.ts` | register変更、verifyEmail/resendVerification追加 |
| `apps/api/src/routes/auth.ts` | 2ルート追加 |
| `apps/api/src/app.ts` | OAuthコールバックで`emailVerified: true`設定 |
| `apps/web/src/lib/api.ts` | API関数追加・型変更 |
| `apps/web/src/pages/Register.tsx` | リダイレクト先変更 |
| `apps/web/src/pages/Login.tsx` | `EMAIL_NOT_VERIFIED`エラーハンドリング |
| `apps/web/src/pages/CheckEmail.tsx` | **新規** |
| `apps/web/src/pages/VerifyEmail.tsx` | **新規** |
| `apps/web/src/App.tsx` | 2ルート追加 |

## 再利用する既存パターン

- トークン生成: `crypto.randomBytes(32).toString('hex')` (`user-password-auth.service.ts:L256`)
- トークンハッシュ: `hashToken()` (`apps/api/src/utils/pkce.ts`)
- メールテンプレート: `generatePasswordResetEmail()` (`email.service.ts`)
- タイミング攻撃対策: `forgotPassword`パターン (`auth.controller.ts`)
- フロントエンドページ: `ForgotPasswordPage`のレイアウト

## 検証方法

1. `docker compose exec dev pnpm build` - ビルド成功確認
2. `docker compose exec dev pnpm test` - 全テスト通過
3. 手動検証:
   - メール/パスワードで登録 → `/check-email`にリダイレクト、Mailpitで確認メール受信
   - 確認前にログイン試行 → エラー表示、`/check-email`にリダイレクト
   - メール内リンクをクリック → `/verify-email`で確認完了
   - 確認後にログイン → 正常にダッシュボードへ
   - OAuth（GitHub/Google）で登録 → 確認不要で即ログイン
   - 確認メール再送信 → 新しいメール受信
