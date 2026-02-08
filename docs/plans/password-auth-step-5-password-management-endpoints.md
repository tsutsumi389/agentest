# Step 5: パスワード管理APIエンドポイント

## 概要

認証済みユーザーが自分のパスワードを管理するためのAPIエンドポイント。
パスワードの設定状況確認、初回設定（OAuthユーザー向け）、変更を提供する。

## 前提条件

- [Step 2](./password-auth-step-2-auth-service.md) 完了（認証サービス）

---

## 変更ファイル

- `apps/api/src/routes/users.ts` — パスワード管理ルート追加

## 新規ファイル

- `apps/api/src/controllers/user-password.controller.ts` — パスワード管理コントローラー

## テストファイル: `apps/api/src/controllers/__tests__/user-password.controller.test.ts`

---

## TDD: テストケース一覧

### GET /api/users/:userId/password/status

```
- 認証済みユーザーが自身のパスワード設定状況を取得できる
- パスワード設定済みの場合 { hasPassword: true } を返す
- パスワード未設定の場合 { hasPassword: false } を返す
- 未認証の場合401を返す
- 他ユーザーのIDを指定した場合403を返す（requireOwnership）
```

### POST /api/users/:userId/password

```
- OAuthユーザーがパスワードを初回設定できる（201を返す）
- バリデーションエラー（パスワード要件不足）で400を返す
- 既にパスワード設定済みの場合は409を返す
- 未認証の場合401を返す
- 他ユーザーのIDを指定した場合403を返す
```

### PUT /api/users/:userId/password

```
- 正しい現在のパスワードで新しいパスワードに変更できる（200を返す）
- 現在のパスワードが間違っている場合は401を返す
- バリデーションエラーで400を返す
- パスワード未設定ユーザーの場合は400を返す
- 未認証の場合401を返す
- 他ユーザーのIDを指定した場合403を返す
```

---

## 実装のポイント

### コントローラー設計

```typescript
// apps/api/src/controllers/user-password.controller.ts

export class UserPasswordController {
  private authService = new UserPasswordAuthService();

  // パスワード設定状況確認
  getPasswordStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. req.params.userId でユーザーIDを取得
    // 2. authService.hasPassword() 呼び出し
    // 3. { hasPassword: boolean } を返す
  }

  // パスワード初回設定
  setPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. setPasswordSchema でバリデーション
    // 2. authService.setPassword() 呼び出し
    // 3. 201を返す
  }

  // パスワード変更
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. changePasswordSchema でバリデーション
    // 2. authService.changePassword() 呼び出し
    // 3. 200を返す
  }
}
```

### ルート追加

```typescript
// apps/api/src/routes/users.ts に追加
// 既存の requireAuth + requireOwnership ミドルウェアチェーンを使用

router.get('/api/users/:userId/password/status', requireAuth(authConfig), requireOwnership(), passwordController.getPasswordStatus);
router.post('/api/users/:userId/password', requireAuth(authConfig), requireOwnership(), passwordController.setPassword);
router.put('/api/users/:userId/password', requireAuth(authConfig), requireOwnership(), passwordController.changePassword);
```

---

## 検証

```bash
# コントローラーテスト
docker compose exec dev pnpm --filter @agentest/api test -- --run user-password.controller

# ビルド確認
docker compose exec dev pnpm build
```

## 成果物

### 変更ファイル
- `apps/api/src/routes/users.ts` — パスワード管理ルート追加

### 新規ファイル
- `apps/api/src/controllers/user-password.controller.ts`
- `apps/api/src/controllers/__tests__/user-password.controller.test.ts`

## 次のステップ

→ [Step 8: フロントエンド — 設定画面パスワード管理](./password-auth-step-8-settings-ui.md)
