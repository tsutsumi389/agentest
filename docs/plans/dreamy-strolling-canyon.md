# メール/パスワード認証の実装計画

## Context

現在Agentestのユーザー認証はOAuth2.0（GitHub/Google）のみ。メール/パスワードによるログイン・サインアップ・パスワードリセットを追加し、OAuthと併用可能にする。Admin側には既にパスワードログインが実装済みで、そのパターン（bcrypt, アカウントロック, タイミング攻撃対策）を再利用する。

## フェーズ1: DBスキーマ拡張

### 1.1 Userモデルにフィールド追加

**ファイル: `packages/db/prisma/schema.prisma`**

```prisma
model User {
  // ... 既存フィールド ...
  passwordHash    String?   @map("password_hash") @db.VarChar(255)
  failedAttempts  Int       @default(0) @map("failed_attempts")
  lockedUntil     DateTime? @map("locked_until")
  // ... 既存リレーション ...
  passwordResetTokens PasswordResetToken[]
}
```

- `passwordHash` は nullable（OAuthのみのユーザーは null）

### 1.2 PasswordResetTokenモデルの新規追加

```prisma
model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  tokenHash String    @unique @map("token_hash") @db.VarChar(64)
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}
```

- トークンは SHA-256 ハッシュ化して保存（既存の `hashToken()` を使用）
- 有効期限: 1時間

### 1.3 マイグレーション

```bash
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name add-user-password-auth
```

---

## フェーズ2: バックエンドサービス

### 2.1 バリデーションスキーマの追加

**ファイル: `packages/shared/src/validators/schemas.ts`**

既存の `acceptInvitationSchema` のパスワードルールを共通化し、以下を追加:

- `passwordSchema` — 共通パスワードバリデーション（8文字以上、大文字・小文字・数字・記号必須）
- `userRegisterSchema` — `{ email, password, name }`
- `userLoginSchema` — `{ email, password }`
- `passwordResetRequestSchema` — `{ email }`
- `passwordResetSchema` — `{ token, password }`
- `setPasswordSchema` — `{ password }`
- `changePasswordSchema` — `{ currentPassword, newPassword }`

既存の `acceptInvitationSchema` も `passwordSchema` を参照するようリファクタリング。

### 2.2 パスワード認証サービスの新規作成

**新規ファイル: `apps/api/src/services/user-password-auth.service.ts`**

Admin側の `admin-auth.service.ts` のパターンを再利用:

| メソッド | 説明 |
|---|---|
| `hashPassword(password)` | bcryptjs 12ラウンドでハッシュ化 |
| `login({ email, password, ipAddress, userAgent })` | タイミング攻撃対策 + アカウントロック(5回/30分) + JWT発行 |
| `register({ email, password, name })` | メール重複チェック + User作成 + JWT発行 |
| `requestPasswordReset(email)` | トークン生成 + メール送信（ユーザー不存在でも200を返す） |
| `resetPassword(token, newPassword)` | トークン検証 + パスワード更新 + 全セッション無効化 |
| `setPassword(userId, password)` | OAuthユーザーのパスワード追加設定 |
| `changePassword(userId, currentPassword, newPassword)` | 現在のパスワード検証 + 更新 |

**Admin側との差異**: Admin側はセッショントークン方式だが、User側は既存のJWT方式（accessToken + refreshToken）を維持。ログイン成功時に `generateTokens()` でJWTペアを生成し、`oauthCallback` と同じパターンでクッキーに設定。

### 2.3 メールテンプレートの追加

**ファイル: `apps/api/src/services/email.service.ts`**

既存の `generateAdminInvitationEmail` のHTMLスタイルを踏襲し、以下を追加:

- `generatePasswordResetEmail({ name, resetUrl, expiresAt })` — リセットリンク付きメール
- `generateWelcomeEmail({ name, loginUrl })` — サインアップ完了のウェルカムメール

---

## フェーズ3: APIエンドポイント

### 3.1 認証ルートの追加

**ファイル: `apps/api/src/routes/auth.ts`** / **`apps/api/src/controllers/auth.controller.ts`**

| エンドポイント | メソッド | 認証 | 説明 |
|---|---|---|---|
| `POST /api/auth/login` | login | 不要 | メール/パスワードログイン |
| `POST /api/auth/register` | register | 不要 | サインアップ |
| `POST /api/auth/forgot-password` | requestPasswordReset | 不要 | リセットリンク送信 |
| `POST /api/auth/reset-password` | resetPassword | 不要 | パスワードリセット実行 |

### 3.2 パスワード管理ルートの追加

**ファイル: `apps/api/src/routes/users.ts`** (既存) / **新規: `apps/api/src/controllers/user-password.controller.ts`**

| エンドポイント | メソッド | 認証 | 説明 |
|---|---|---|---|
| `GET /api/users/:id/password/status` | hasPassword | 必須 | パスワード設定状況確認 |
| `POST /api/users/:id/password` | setPassword | 必須 | パスワード追加設定 |
| `PUT /api/users/:id/password` | changePassword | 必須 | パスワード変更 |

### 3.3 レート制限

ブルートフォース攻撃対策（Redis使用、既存のRedis設定を活用）:

- `/api/auth/login` — 同一IP: 10回/15分
- `/api/auth/register` — 同一IP: 5回/1時間
- `/api/auth/forgot-password` — 同一IP: 3回/1時間

---

## フェーズ4: フロントエンド — ログイン/サインアップ

### 4.1 ログインページの拡張

**ファイル: `apps/web/src/pages/Login.tsx`**

OAuthボタンの上にメール/パスワードフォームを追加:

```
[ロゴ: Agentest]
[カード]
  タイトル: ログイン

  [メールアドレス入力]
  [パスワード入力]
  [パスワードを忘れた場合] ← リンク
  [ログインボタン]

  ─── または ───

  [GitHubでログイン]
  [Googleでログイン]

  アカウントをお持ちでない場合は [新規登録]
[/カード]
```

### 4.2 サインアップページの新規作成

**新規ファイル: `apps/web/src/pages/Register.tsx`**

```
[ロゴ: Agentest]
[カード]
  タイトル: アカウント作成

  [名前入力]
  [メールアドレス入力]
  [パスワード入力] + パスワード強度チェックリスト
  [パスワード確認入力]
  [アカウント作成ボタン]

  ─── または ───

  [GitHubで登録] / [Googleで登録]

  既にアカウントをお持ちの場合は [ログイン]
[/カード]
```

### 4.3 パスワードリセットページの新規作成

**新規ファイル: `apps/web/src/pages/ForgotPassword.tsx`**

- ステップ1: メールアドレス入力 → リセットリンク送信
- ステップ2: 送信完了メッセージ表示

**新規ファイル: `apps/web/src/pages/ResetPassword.tsx`**

- URLパラメータからトークンを取得
- 新しいパスワード入力 + 確認入力 → パスワード設定

### 4.4 ルーティングの更新

**ファイル: `apps/web/src/App.tsx`**

パブリックルートに追加:
- `/register` → `RegisterPage`
- `/forgot-password` → `ForgotPasswordPage`
- `/reset-password` → `ResetPasswordPage`

### 4.5 APIクライアントの拡張

**ファイル: `apps/web/src/lib/api.ts`**

`authApi` に `login`, `register`, `forgotPassword`, `resetPassword` を追加。
新規 `passwordApi` に `hasPassword`, `setPassword`, `changePassword` を追加。

---

## フェーズ5: フロントエンド — 設定画面のパスワード管理

### 5.1 セキュリティ設定にパスワードセクション追加

**ファイル: `apps/web/src/pages/Settings.tsx` (`SecuritySettings` コンポーネント)**

「接続済みアカウント」セクションの前にパスワード管理セクションを追加:

- **パスワード未設定時**: 「パスワードを設定」ボタン → モーダル（新パスワード + 確認）
- **パスワード設定済み時**: 「パスワードを変更」ボタン → モーダル（現パスワード + 新パスワード + 確認）

### 5.2 OAuth解除制約の更新

現在: `const canUnlink = accounts.length > 1`
変更後: `const canUnlink = accounts.length > 1 || hasPassword`

パスワードが設定されていれば、OAuth連携が1つでも解除可能にする（最低1つの認証方法が残る制約）。

---

## セキュリティ考慮事項

| 項目 | 対策 |
|---|---|
| パスワードハッシュ | bcryptjs 12ラウンド（Admin側と同一） |
| タイミング攻撃 | ユーザー不存在時もダミーハッシュと比較 |
| アカウントロック | 5回連続失敗で30分ロック |
| リセットトークン | SHA-256ハッシュ化してDB保存、有効期限1時間、使用済みマーク |
| メール存在確認防止 | forgot-password は常に200を返す |
| セッション無効化 | パスワードリセット時は全セッション無効化 |
| クッキー | httpOnly, secure(本番), sameSite=strict（既存設定） |
| 入力バリデーション | Zodスキーマ（packages/shared から共有） |
| レート制限 | Redis使用、エンドポイントごとに制限 |

---

## 変更対象ファイル一覧

### 変更
| ファイル | 内容 |
|---|---|
| `packages/db/prisma/schema.prisma` | Userフィールド追加 + PasswordResetTokenモデル |
| `packages/shared/src/validators/schemas.ts` | パスワード関連バリデーションスキーマ追加 |
| `apps/api/src/routes/auth.ts` | login, register, forgot-password, reset-password ルート追加 |
| `apps/api/src/routes/users.ts` | パスワード管理ルート追加 |
| `apps/api/src/controllers/auth.controller.ts` | login, register, forgot/reset-password メソッド追加 |
| `apps/api/src/services/email.service.ts` | リセットメール/ウェルカムメールテンプレート追加 |
| `apps/web/src/pages/Login.tsx` | メール/パスワードフォーム追加 |
| `apps/web/src/pages/Settings.tsx` | パスワード管理セクション + OAuth解除制約更新 |
| `apps/web/src/App.tsx` | 新規ルート追加 |
| `apps/web/src/lib/api.ts` | authApi/passwordApi 拡張 |

### 新規作成
| ファイル | 内容 |
|---|---|
| `apps/api/src/services/user-password-auth.service.ts` | パスワード認証サービス |
| `apps/api/src/controllers/user-password.controller.ts` | パスワード管理コントローラー |
| `apps/web/src/pages/Register.tsx` | サインアップページ |
| `apps/web/src/pages/ForgotPassword.tsx` | パスワードリセットリクエスト |
| `apps/web/src/pages/ResetPassword.tsx` | パスワードリセット実行 |

### 再利用する既存実装
| ファイル | 再利用内容 |
|---|---|
| `apps/api/src/services/admin/admin-auth.service.ts` | bcrypt/ロック/タイミング攻撃対策パターン |
| `apps/api/src/controllers/auth.controller.ts` (`oauthCallback`) | JWT発行+クッキー設定パターン |
| `apps/api/src/utils/pkce.ts` (`hashToken`) | トークンハッシュ化 |
| `packages/auth/src/jwt.ts` (`generateTokens`) | JWTペア生成 |

---

## 実装順序

```
フェーズ1: DBスキーマ
    ↓
フェーズ2: バックエンドサービス + バリデーション
    ↓
フェーズ3: APIエンドポイント
    ↓
フェーズ4: ログイン/サインアップUI    ← 並行可能 →    フェーズ5: 設定画面
```

## 検証方法

1. **ユニットテスト**: パスワードハッシュ、ログイン成功/失敗、アカウントロック、トークン検証
2. **統合テスト**: サインアップ→ログイン→ダッシュボード、リセットフロー完全テスト
3. **手動テスト**: ブラウザでの全フロー確認、Mailpitでリセットメール確認
4. **ビルド確認**: `docker compose exec dev pnpm build && pnpm test`
