# Step 7: フロントエンド — パスワードリセット

## 概要

パスワードリセットフロー（リセット要求ページ + リセット実行ページ）を新規作成する。

## 前提条件

- [Step 4](./password-auth-step-4-auth-endpoints.md) 完了（認証APIエンドポイント）

---

## 新規ファイル

- `apps/web/src/pages/ForgotPassword.tsx` — リセット要求ページ
- `apps/web/src/pages/ResetPassword.tsx` — リセット実行ページ

## 変更ファイル

- `apps/web/src/App.tsx` — ルート追加
- `apps/web/src/lib/api.ts` — authApi 拡張

## テストファイル

- `apps/web/src/pages/__tests__/ForgotPassword.test.tsx`
- `apps/web/src/pages/__tests__/ResetPassword.test.tsx`

---

## TDD: テストケース一覧

### ForgotPassword.tsx

```
ステップ1: メールアドレス入力
- メールアドレス入力欄が表示される
- 「リセットリンクを送信」ボタンが表示される
- 「ログインに戻る」リンクが表示される
- 有効なメール入力で送信するとauthApi.forgotPasswordが呼ばれる
- 無効なメール形式ではバリデーションエラーが表示される
- 送信中はボタンがdisabledになる

ステップ2: 送信完了
- 送信成功後に「メールを送信しました」メッセージが表示される
- 「再送信」ボタンが表示される（クールダウン付き）
- 「ログインに戻る」リンクが表示される
```

### ResetPassword.tsx

```
- URLパラメータ（?token=xxx）からトークンを取得する
- 新しいパスワード入力欄が表示される
- パスワード確認入力欄が表示される
- パスワード強度チェックリストが表示される
- パスワードと確認が一致しない場合にエラーが表示される
- 有効なフォーム送信でauthApi.resetPasswordが呼ばれる
- リセット成功後に「パスワードを変更しました」メッセージとログインリンクが表示される
- トークンが無効な場合にエラーメッセージが表示される
- トークンが期限切れの場合にエラーメッセージと再送信リンクが表示される
- トークンがURLに含まれない場合にエラーが表示される
```

---

## 実装のポイント

### ForgotPassword.tsx レイアウト

```
[ロゴ: Agentest]
[カード]
  タイトル: パスワードリセット

  ---- ステップ1 ----
  <p>登録されたメールアドレスにリセットリンクを送信します。</p>
  [メールアドレス入力]
  [リセットリンクを送信ボタン]

  ---- ステップ2 (送信後) ----
  <p>メールを送信しました。</p>
  <p>受信トレイを確認してください。</p>

  [ログインに戻る] ← /login へのリンク
[/カード]
```

### ResetPassword.tsx レイアウト

```
[ロゴ: Agentest]
[カード]
  タイトル: 新しいパスワードを設定

  [新しいパスワード入力] + パスワード強度チェックリスト
  [パスワード確認入力]
  [パスワードを変更ボタン]

  ---- 成功後 ----
  <p>パスワードを変更しました。</p>
  [ログインする] ← /login へのリンク
[/カード]
```

### ルーティング追加

```typescript
// apps/web/src/App.tsx — パブリックルートに追加
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

### APIクライアント拡張

```typescript
// apps/web/src/lib/api.ts

export const authApi = {
  // ... 既存 ...

  forgotPassword: (data: { email: string }) =>
    request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  resetPassword: (data: { token: string; password: string }) =>
    request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
```

### パスワード強度チェックリストの共有

Step 6 で作成した `PasswordStrengthChecklist` コンポーネントを再利用。
Register.tsx と ResetPassword.tsx の両方で使うため、共通コンポーネントとして抽出する:

```
apps/web/src/components/PasswordStrengthChecklist.tsx
```

---

## 検証

```bash
# コンポーネントテスト
docker compose exec dev pnpm --filter @agentest/web test -- --run ForgotPassword
docker compose exec dev pnpm --filter @agentest/web test -- --run ResetPassword

# ビルド確認
docker compose exec dev pnpm build

# 手動テスト
# ブラウザで /forgot-password, /reset-password?token=xxx にアクセス
# Mailpit (localhost:8025) でリセットメール確認
```

## 成果物

### 変更ファイル
- `apps/web/src/App.tsx` — ルート追加
- `apps/web/src/lib/api.ts` — authApi 拡張

### 新規ファイル
- `apps/web/src/pages/ForgotPassword.tsx`
- `apps/web/src/pages/ResetPassword.tsx`
- `apps/web/src/components/PasswordStrengthChecklist.tsx`（Step 6 で抽出）
- `apps/web/src/pages/__tests__/ForgotPassword.test.tsx`
- `apps/web/src/pages/__tests__/ResetPassword.test.tsx`

## 次のステップ

→ [Step 8: フロントエンド — 設定画面パスワード管理](./password-auth-step-8-settings-ui.md)
