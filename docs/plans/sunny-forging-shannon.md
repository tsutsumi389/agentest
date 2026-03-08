# 管理者パスワードリセット機能

## Context

管理者（AdminUser）がパスワードを忘れた場合、現在は復旧手段がない。ユーザー側にはパスワードリセット機能が存在するが、管理者側には未実装。メールベースのセルフサービスリセット機能を追加し、管理者が自分でパスワードを再設定できるようにする。

## 方針

ユーザー側の既存パスワードリセット実装（`user-password-auth.service.ts`）のパターンを踏襲し、管理者専用のモデル・サービス・UIを追加する。

## 実装計画

### 1. DBスキーマ追加

**`packages/db/prisma/schema.prisma`** に `AdminPasswordResetToken` モデルを追加:

```prisma
model AdminPasswordResetToken {
  id          String    @id @default(uuid())
  adminUserId String    @map("admin_user_id")
  tokenHash   String    @unique @map("token_hash") @db.VarChar(64)
  expiresAt   DateTime  @map("expires_at")
  usedAt      DateTime? @map("used_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  adminUser AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)

  @@index([adminUserId])
  @@index([expiresAt])
  @@map("admin_password_reset_tokens")
}
```

`AdminUser` モデルに `passwordResetTokens AdminPasswordResetToken[]` リレーションを追加。

### 2. 共有バリデーションスキーマ

**`packages/shared/src/validators/schemas.ts`** に追加:
- `adminPasswordResetRequestSchema` (email)
- `adminPasswordResetSchema` (token, password)

### 3. バックエンドサービス

**新規: `apps/api/src/services/admin/admin-password-reset.service.ts`**

- `requestPasswordReset(email)`: トークン生成、ハッシュしてDB保存、既存未使用トークン無効化（1時間有効）
- `resetPassword(token, newPassword)`: トークン検証、パスワード更新（bcrypt 12 rounds）、全セッション無効化、アカウントロック解除

再利用:
- `hashToken()` from `apps/api/src/utils/pkce.ts`
- `crypto.randomBytes(32)` でトークン生成
- `AdminAuditLogService` で監査ログ記録（`PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`）

### 4. バックエンドコントローラー・ルート

**新規: `apps/api/src/controllers/admin/password-reset.controller.ts`**

- `requestReset`: メール送信（成功/失敗に関わらず同じレスポンス = メール列挙防止）
- `resetPassword`: トークン検証 → パスワード更新

**変更: `apps/api/src/routes/admin/auth.ts`** に認証不要エンドポイント追加:
- `POST /admin/auth/password-reset/request`
- `POST /admin/auth/password-reset/reset`

メール送信は `apps/api/src/services/email.service.ts` の `generatePasswordResetEmail()` を再利用。

### 5. フロントエンドAPI

**変更: `apps/admin/src/lib/api.ts`** に `passwordResetApi` 追加:
- `requestReset(email)` → POST `/admin/auth/password-reset/request`
- `resetPassword(token, password)` → POST `/admin/auth/password-reset/reset`

### 6. フロントエンドページ

**新規: `apps/admin/src/pages/auth/ForgotPassword.tsx`**
- Terminal/CLI風UI（`LoginForm.tsx` と同じテーマ）
- メールアドレス入力 → 送信後に確認メッセージ表示
- ログインページへのリンク

**新規: `apps/admin/src/pages/auth/ResetPassword.tsx`**
- URL: `/reset-password/:token`
- `AcceptInvitation.tsx` のUIパターンを踏襲
- `PasswordRequirementsList` コンポーネント再利用
- パスワード + 確認パスワード入力
- 成功後にログインページへ誘導

### 7. フロントエンドルーティング

**変更: `apps/admin/src/App.tsx`** に認証不要ルート追加:
- `/forgot-password` → `ForgotPasswordPage`
- `/reset-password/:token` → `ResetPasswordPage`

**変更: `apps/admin/src/components/auth/LoginForm.tsx`**
- ログインボタン下部に「パスワードをお忘れですか？」リンク追加

## セキュリティ

- メール列挙防止: メールが存在しなくても同じレスポンス
- トークン: SHA-256ハッシュをDB保存（生トークンは保存しない）
- 1回限り使用、1時間で期限切れ
- パスワードリセット後に全既存セッション無効化
- 監査ログ記録

## 変更ファイル一覧

| 区分 | ファイル |
|------|---------|
| 変更 | `packages/db/prisma/schema.prisma` |
| 変更 | `packages/shared/src/validators/schemas.ts` |
| 新規 | `apps/api/src/services/admin/admin-password-reset.service.ts` |
| 新規 | `apps/api/src/controllers/admin/password-reset.controller.ts` |
| 変更 | `apps/api/src/routes/admin/auth.ts` |
| 変更 | `apps/admin/src/lib/api.ts` |
| 新規 | `apps/admin/src/pages/auth/ForgotPassword.tsx` |
| 新規 | `apps/admin/src/pages/auth/ResetPassword.tsx` |
| 変更 | `apps/admin/src/App.tsx` |
| 変更 | `apps/admin/src/components/auth/LoginForm.tsx` |
| 自動 | Prisma migration ファイル |

## テスト

| テスト | 内容 |
|--------|------|
| 新規 | `apps/api/src/__tests__/unit/admin-password-reset.service.test.ts` |
| 新規 | `apps/api/src/__tests__/unit/password-reset.controller.test.ts` |

## 検証手順

1. `docker compose exec dev pnpm prisma migrate dev` でマイグレーション実行
2. `docker compose exec dev pnpm build` でビルド確認
3. `docker compose exec dev pnpm test` でテスト実行
4. ブラウザでログインページ → 「パスワードをお忘れですか？」リンク確認
5. メールアドレス入力 → Mailpit でリセットメール受信確認
6. リセットリンクからパスワード再設定 → ログイン確認
