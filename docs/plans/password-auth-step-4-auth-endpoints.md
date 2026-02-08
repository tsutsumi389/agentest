# Step 4: 認証APIエンドポイント

## 概要

メール/パスワード認証の公開APIエンドポイント（ログイン、サインアップ、パスワードリセット）を追加する。
既存の `auth.controller.ts` の `oauthCallback` と同じJWT+クッキーパターンを使用。

## 前提条件

- [Step 2](./password-auth-step-2-auth-service.md) 完了（認証サービス）
- [Step 3](./password-auth-step-3-email-templates.md) 完了（メールテンプレート）

---

## 変更ファイル

- `apps/api/src/controllers/auth.controller.ts` — メソッド追加
- `apps/api/src/routes/auth.ts` — ルート追加

## テストファイル: `apps/api/src/controllers/__tests__/auth-password.controller.test.ts`

---

## TDD: テストケース一覧

### POST /api/auth/login

```
- 正しい認証情報でトークンクッキーが設定され200を返す
- バリデーションエラー（不正なメール形式）で400を返す
- 認証失敗で401を返す
- アカウントロック中は401を返す
- レスポンスにユーザー情報（id, email, name）が含まれる
```

### POST /api/auth/register

```
- 有効なデータでユーザーが作成され201を返す
- トークンクッキーが設定される
- バリデーションエラー（パスワード要件不足）で400を返す
- メールアドレス重複で409を返す
- レスポンスにユーザー情報が含まれる
```

### POST /api/auth/forgot-password

```
- 有効なメールアドレスで200を返す（ユーザー存在時）
- 存在しないメールアドレスでも200を返す（メール存在確認防止）
- バリデーションエラーで400を返す
- レスポンスに共通のメッセージが含まれる
```

### POST /api/auth/reset-password

```
- 有効なトークンと新パスワードで200を返す
- 無効なトークンで400を返す
- 期限切れトークンで400を返す
- パスワード要件を満たさない場合は400を返す
```

---

## 実装のポイント

### AuthController へのメソッド追加

```typescript
// apps/api/src/controllers/auth.controller.ts に追加

// メール/パスワードログイン
login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // 1. userLoginSchema でバリデーション
  // 2. userPasswordAuthService.login() 呼び出し
  // 3. クッキーにトークン設定（oauthCallback と同パターン）
  // 4. RefreshToken + Session をDB保存（oauthCallback と同パターン）
  // 5. ユーザー情報を返す
}

// サインアップ
register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // 1. userRegisterSchema でバリデーション
  // 2. userPasswordAuthService.register() 呼び出し
  // 3. クッキーにトークン設定
  // 4. RefreshToken + Session をDB保存
  // 5. 201でユーザー情報を返す
}

// パスワードリセット要求
forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // 1. passwordResetRequestSchema でバリデーション
  // 2. userPasswordAuthService.requestPasswordReset() 呼び出し
  // 3. トークンがある場合はリセットメールを送信
  // 4. 常に200と同じメッセージを返す
}

// パスワードリセット実行
resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // 1. passwordResetSchema でバリデーション
  // 2. userPasswordAuthService.resetPassword() 呼び出し
  // 3. 200を返す
}
```

### ルート追加

```typescript
// apps/api/src/routes/auth.ts に追加（OAuthルートの前に配置）

// メール/パスワード認証
router.post('/api/auth/login', authController.login);
router.post('/api/auth/register', authController.register);
router.post('/api/auth/forgot-password', authController.forgotPassword);
router.post('/api/auth/reset-password', authController.resetPassword);
```

### クッキー設定パターン（oauthCallback と共通化）

JWT + クッキー設定ロジックが `oauthCallback` と重複するため、プライベートメソッドとして抽出:

```typescript
private setAuthCookies(res: Response, tokens: TokenPair): void {
  res.cookie('access_token', tokens.accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15分
  });
  res.cookie('refresh_token', tokens.refreshToken, {
    ...cookieOptions,
    maxAge: SESSION_EXPIRY_MS,
  });
}

private async saveTokenAndSession(
  userId: string,
  refreshToken: string,
  clientInfo: { userAgent?: string; ipAddress?: string }
): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await Promise.all([
    prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
      },
    }),
    this.sessionService.createSession({
      userId,
      tokenHash,
      userAgent: clientInfo.userAgent,
      ipAddress: clientInfo.ipAddress,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
    }),
  ]);
}
```

### テストのモック戦略

```typescript
// supertest を使った統合テスト風のアプローチ
// サービス層はモック、HTTPレイヤーはsupertest

vi.mock('../../services/user-password-auth.service.js');
vi.mock('../../services/email.service.js');

// Expressアプリのセットアップ
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json());
app.use(cookieParser());
// ルート登録
```

---

## 検証

```bash
# コントローラーテスト
docker compose exec dev pnpm --filter @agentest/api test -- --run auth-password.controller

# ビルド確認
docker compose exec dev pnpm build

# 手動テスト（curl）
docker compose exec dev curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Test1234!","name":"テスト"}'
```

## 成果物

### 変更ファイル
- `apps/api/src/controllers/auth.controller.ts` — login, register, forgotPassword, resetPassword メソッド追加
- `apps/api/src/routes/auth.ts` — ルート追加

### 新規ファイル
- `apps/api/src/controllers/__tests__/auth-password.controller.test.ts`

## 次のステップ

→ [Step 5: パスワード管理APIエンドポイント](./password-auth-step-5-password-management-endpoints.md)
→ [Step 6: フロントエンド — ログイン/サインアップ](./password-auth-step-6-login-register-ui.md)（並行可能）
→ [Step 7: フロントエンド — パスワードリセット](./password-auth-step-7-password-reset-ui.md)（並行可能）
