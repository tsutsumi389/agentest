# Step 2: パスワード認証サービス

## 概要

メール/パスワード認証のコアビジネスロジックを実装する。
Admin側の `admin-auth.service.ts` のパターン（bcrypt, アカウントロック, タイミング攻撃対策）を再利用し、User側はJWT方式で認証する。

## 前提条件

- [Step 1](./password-auth-step-1-schema-validation.md) 完了（DBスキーマ + バリデーション）

## 再利用する既存実装

| ファイル | 再利用内容 |
|---------|-----------|
| `apps/api/src/services/admin/admin-auth.service.ts` | bcrypt 12ラウンド, タイミング攻撃対策, アカウントロック(5回/30分) |
| `apps/api/src/controllers/auth.controller.ts` (`oauthCallback`) | JWT生成 + クッキー設定 + RefreshToken/Session保存パターン |
| `apps/api/src/utils/pkce.ts` (`hashToken`) | SHA-256トークンハッシュ |
| `packages/auth/src/jwt.ts` (`generateTokens`) | JWTペア生成 |

---

## 新規ファイル: `apps/api/src/services/user-password-auth.service.ts`

## テストファイル: `apps/api/src/services/__tests__/user-password-auth.service.test.ts`

---

## TDD: テストケース一覧

### hashPassword / verifyPassword

```
- パスワードをbcryptでハッシュ化できる
- 同じパスワードから異なるハッシュが生成される（ランダムソルト）
- 正しいパスワードで検証が成功する
- 間違ったパスワードで検証が失敗する
```

### register

```
- 有効なデータで新規ユーザーを作成し、JWTトークンペアを返す
- メールアドレスが重複する場合にエラーを返す
- パスワードがハッシュ化されてDBに保存される（平文でない）
- RefreshTokenとSessionがDB に保存される
```

### login

```
- 正しい認証情報でJWTトークンペアを返す
- メールアドレスが存在しない場合にAuthenticationErrorを返す
- パスワードが間違っている場合にAuthenticationErrorを返す
- エラーメッセージが「メールアドレスまたはパスワードが正しくありません」で統一される（情報漏洩防止）
- ユーザー不存在時もbcrypt比較を実行する（タイミング攻撃対策）
- ログイン失敗でfailedAttemptsがインクリメントされる
- 5回失敗でアカウントがロックされる（lockedUntilが設定される）
- ロック中のユーザーがログインを試みるとロックエラーを返す
- ロック期間（30分）経過後はログインが可能になる
- ログイン成功でfailedAttemptsがリセットされる
- passwordHashがnull（OAuthのみユーザー）の場合にエラーを返す
```

### requestPasswordReset

```
- 有効なユーザーに対してリセットトークンを生成する
- トークンがSHA-256ハッシュ化されてDBに保存される
- 有効期限が1時間後に設定される
- ユーザーが存在しない場合もエラーを投げない（メール存在確認防止）
- passwordHashがnull（OAuthのみユーザー）の場合もエラーを投げない
- 生のトークン文字列を返す（メール送信用）
```

### resetPassword

```
- 有効なトークンで新しいパスワードを設定できる
- トークンが使用済みとしてマークされる（usedAt設定）
- 期限切れトークンではエラーを返す
- 存在しないトークンではエラーを返す
- 既に使用済みのトークンではエラーを返す
- パスワードリセット後にfailedAttemptsがリセットされる
- パスワードリセット後にlockedUntilがクリアされる
- パスワードリセット後に全セッション（RefreshToken）が無効化される
```

### setPassword（OAuthユーザーがパスワードを追加設定）

```
- OAuthのみユーザー（passwordHash=null）にパスワードを設定できる
- 既にパスワードが設定されている場合はエラーを返す
```

### changePassword

```
- 現在のパスワードが正しい場合に新しいパスワードに変更できる
- 現在のパスワードが間違っている場合にエラーを返す
- passwordHashがnull（パスワード未設定）の場合にエラーを返す
```

### hasPassword

```
- パスワードが設定済みの場合にtrueを返す
- パスワードが未設定（null）の場合にfalseを返す
```

---

## 実装のポイント

### Admin側との差異

| 項目 | Admin側 | User側（今回） |
|------|---------|---------------|
| 認証方式 | セッショントークン | JWT (accessToken + refreshToken) |
| ログイン成功時 | `AdminSession` 作成 | `generateTokens()` → `RefreshToken` + `Session` 作成 |
| 監査ログ | `AdminAuditLogService` | なし（将来的に追加） |
| ロック機構 | 同一 | 同一（5回/30分） |
| タイミング攻撃対策 | 同一 | 同一（DUMMY_PASSWORD_HASH） |

### クラス設計

```typescript
export class UserPasswordAuthService {
  // パスワードハッシュ化
  async hashPassword(password: string): Promise<string>

  // ログイン（JWT発行）
  async login(input: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ tokens: TokenPair; user: UserInfo }>

  // 新規登録（JWT発行）
  async register(input: {
    email: string;
    password: string;
    name: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ tokens: TokenPair; user: UserInfo }>

  // パスワードリセット要求
  async requestPasswordReset(email: string): Promise<string | null>

  // パスワードリセット実行
  async resetPassword(token: string, newPassword: string): Promise<void>

  // パスワード初回設定
  async setPassword(userId: string, password: string): Promise<void>

  // パスワード変更
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>

  // パスワード設定状況確認
  async hasPassword(userId: string): Promise<boolean>
}
```

### テストのモック戦略

```typescript
// Prismaモック
vi.mock('@agentest/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    passwordResetToken: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    refreshToken: { create: vi.fn(), updateMany: vi.fn() },
    session: { create: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));

// bcryptモック（テスト高速化）
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
    compare: vi.fn(),
  },
}));

// JWT/tokenモック
vi.mock('@agentest/auth', () => ({
  generateTokens: vi.fn().mockReturnValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  }),
}));
```

---

## 検証

```bash
# サービスのテスト
docker compose exec dev pnpm --filter @agentest/api test -- --run user-password-auth

# ビルド確認
docker compose exec dev pnpm build
```

## 成果物

### 新規ファイル
- `apps/api/src/services/user-password-auth.service.ts`
- `apps/api/src/services/__tests__/user-password-auth.service.test.ts`

## 次のステップ

→ [Step 3: メールテンプレート](./password-auth-step-3-email-templates.md)（並行可能）
→ [Step 4: 認証APIエンドポイント](./password-auth-step-4-auth-endpoints.md)
