# Step 6: フロントエンド — ログイン/サインアップ

## 概要

ログインページにメール/パスワードフォームを追加し、サインアップページを新規作成する。
既存のOAuthボタンとの共存レイアウト（メール/パスワード → 区切り線 → OAuth）を実装。

## 前提条件

- [Step 4](./password-auth-step-4-auth-endpoints.md) 完了（認証APIエンドポイント）

---

## 変更/新規ファイル

- `apps/web/src/pages/Login.tsx` — メール/パスワードフォーム追加
- `apps/web/src/pages/Register.tsx` — 新規作成
- `apps/web/src/App.tsx` — `/register` ルート追加
- `apps/web/src/lib/api.ts` — `authApi` にlogin, register追加

## テストファイル

- `apps/web/src/pages/__tests__/Login.test.tsx`
- `apps/web/src/pages/__tests__/Register.test.tsx`

---

## TDD: テストケース一覧

### Login.tsx

```
- メールアドレスとパスワードの入力欄が表示される
- ログインボタンが表示される
- 「パスワードを忘れた場合」リンクが表示される
- OAuthボタン（GitHub/Google）が表示される
- 「アカウントをお持ちでない場合は新規登録」リンクが表示される
- 「または」の区切り線が表示される
- 有効なフォーム送信でauthApi.loginが呼ばれる
- ログイン成功後にダッシュボード（またはredirect先）に遷移する
- ログイン失敗時にエラーメッセージが表示される
- 送信中はボタンがdisabledになる
- 既にログイン済みの場合はリダイレクトされる（既存の動作を維持）
```

### Register.tsx

```
- 名前、メールアドレス、パスワード、パスワード確認の入力欄が表示される
- 「アカウント作成」ボタンが表示される
- OAuthボタンが表示される
- 「既にアカウントをお持ちの場合はログイン」リンクが表示される
- パスワード強度チェックリスト（大文字/小文字/数字/記号/8文字以上）が表示される
- 入力に応じてチェックリストが更新される
- パスワードと確認が不一致の場合にエラーが表示される
- 有効なフォーム送信でauthApi.registerが呼ばれる
- 登録成功後にダッシュボードに遷移する
- メール重複エラー時にメッセージが表示される
- 送信中はボタンがdisabledになる
```

---

## 実装のポイント

### Login.tsx レイアウト変更

```
[ロゴ: Agentest]
[カード]
  タイトル: ログイン

  [メールアドレス入力]
  [パスワード入力]
  [パスワードを忘れた場合] ← /forgot-password へのリンク
  [ログインボタン]

  ─── または ───

  [GitHubでログイン]
  [Googleでログイン]

  アカウントをお持ちでない場合は [新規登録] ← /register へのリンク
[/カード]
```

### Register.tsx レイアウト

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

  既にアカウントをお持ちの場合は [ログイン] ← /login へのリンク
[/カード]
```

### APIクライアント拡張

```typescript
// apps/web/src/lib/api.ts

export const authApi = {
  // ... 既存メソッド ...

  login: (data: { email: string; password: string }) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  register: (data: { email: string; password: string; name: string }) =>
    request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
```

### パスワード強度チェックリストコンポーネント

```typescript
// Register.tsx 内のローカルコンポーネント
function PasswordStrengthChecklist({ password }: { password: string }) {
  const checks = [
    { label: '8文字以上', met: password.length >= 8 },
    { label: '大文字を含む', met: /[A-Z]/.test(password) },
    { label: '小文字を含む', met: /[a-z]/.test(password) },
    { label: '数字を含む', met: /[0-9]/.test(password) },
    { label: '記号を含む', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];
  // チェックマーク付きリスト
}
```

### デザインガイドライン

- `/design-guidelines` スキルを参照して既存のデザインシステムに準拠
- 既存のCSS classes（`card`, `btn`, `btn-primary`, `btn-secondary` 等）を使用
- Terminal/CLI風のミニマルデザイン

### テストのモック戦略

```typescript
// React Router モック
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

// API モック
vi.mock('../../lib/api', () => ({
  authApi: { login: vi.fn(), register: vi.fn() },
}));

// Auth store モック
vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({ isAuthenticated: false, isLoading: false }),
}));
```

---

## 検証

```bash
# コンポーネントテスト
docker compose exec dev pnpm --filter @agentest/web test -- --run Login
docker compose exec dev pnpm --filter @agentest/web test -- --run Register

# ビルド確認
docker compose exec dev pnpm build

# 手動テスト
# ブラウザで /login, /register にアクセスして動作確認
```

## 成果物

### 変更ファイル
- `apps/web/src/pages/Login.tsx` — メール/パスワードフォーム追加
- `apps/web/src/App.tsx` — `/register` ルート追加
- `apps/web/src/lib/api.ts` — authApi 拡張

### 新規ファイル
- `apps/web/src/pages/Register.tsx`
- `apps/web/src/pages/__tests__/Login.test.tsx`
- `apps/web/src/pages/__tests__/Register.test.tsx`

## 次のステップ

→ [Step 7: フロントエンド — パスワードリセット](./password-auth-step-7-password-reset-ui.md)（並行可能）
