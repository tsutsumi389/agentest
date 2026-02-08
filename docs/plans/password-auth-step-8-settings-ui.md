# Step 8: フロントエンド — 設定画面パスワード管理

## 概要

ユーザー設定画面（SecuritySettings）にパスワード管理セクションを追加し、OAuth解除制約を更新する。

## 前提条件

- [Step 5](./password-auth-step-5-password-management-endpoints.md) 完了（パスワード管理API）
- [Step 6](./password-auth-step-6-login-register-ui.md) 完了（PasswordStrengthChecklist 共通コンポーネント）

---

## 変更ファイル

- `apps/web/src/pages/Settings.tsx` — SecuritySettings にパスワードセクション追加
- `apps/web/src/lib/api.ts` — `passwordApi` 新規追加

## テストファイル

- `apps/web/src/pages/__tests__/SecuritySettings.test.tsx`

---

## TDD: テストケース一覧

### パスワード管理セクション表示

```
- パスワード未設定時に「パスワードを設定」ボタンが表示される
- パスワード設定済み時に「パスワードを変更」ボタンが表示される
- パスワード管理セクションが「接続済みアカウント」セクションの前に表示される
```

### パスワード設定モーダル（未設定時）

```
- 「パスワードを設定」ボタンクリックでモーダルが開く
- 新しいパスワード入力欄が表示される
- パスワード確認入力欄が表示される
- パスワード強度チェックリストが表示される
- パスワードと確認が一致しない場合にエラーが表示される
- 有効な入力で送信するとpasswordApi.setPasswordが呼ばれる
- 設定成功後にモーダルが閉じ、ステータスが更新される
- エラー時にエラーメッセージが表示される
```

### パスワード変更モーダル（設定済み時）

```
- 「パスワードを変更」ボタンクリックでモーダルが開く
- 現在のパスワード入力欄が表示される
- 新しいパスワード入力欄が表示される
- パスワード確認入力欄が表示される
- 有効な入力で送信するとpasswordApi.changePasswordが呼ばれる
- 現在のパスワードが間違っている場合にエラーが表示される
- 変更成功後にモーダルが閉じる
```

### OAuth解除制約の更新

```
- パスワード設定済み＆OAuth連携1つの場合、OAuth解除ボタンが有効になる
- パスワード未設定＆OAuth連携1つの場合、OAuth解除ボタンが無効のまま
- パスワード未設定＆OAuth連携2つ以上の場合、OAuth解除ボタンが有効（既存動作維持）
```

---

## 実装のポイント

### APIクライアント拡張

```typescript
// apps/web/src/lib/api.ts

export const passwordApi = {
  getStatus: (userId: string) =>
    request<{ hasPassword: boolean }>(`/api/users/${userId}/password/status`),

  setPassword: (userId: string, data: { password: string }) =>
    request<void>(`/api/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  changePassword: (userId: string, data: { currentPassword: string; newPassword: string }) =>
    request<void>(`/api/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
```

### SecuritySettings 変更箇所

#### パスワードセクション追加（接続済みアカウントの前）

```tsx
// パスワード管理セクション
<section>
  <h3>パスワード</h3>
  {hasPassword ? (
    <>
      <p>パスワードが設定されています</p>
      <button onClick={() => setShowChangeModal(true)}>パスワードを変更</button>
    </>
  ) : (
    <>
      <p>パスワードが設定されていません</p>
      <button onClick={() => setShowSetModal(true)}>パスワードを設定</button>
    </>
  )}
</section>
```

#### OAuth解除制約の更新

```typescript
// 変更前
const canUnlink = accounts.length > 1;

// 変更後
const canUnlink = accounts.length > 1 || hasPassword;
```

### パスワード設定/変更モーダル

既存のモーダルパターンがあればそれを再利用。なければ、シンプルなダイアログコンポーネントを作成。

### PasswordStrengthChecklist の再利用

Step 6/7 で作成した `apps/web/src/components/PasswordStrengthChecklist.tsx` を import して使用。

---

## 検証

```bash
# コンポーネントテスト
docker compose exec dev pnpm --filter @agentest/web test -- --run SecuritySettings

# ビルド確認
docker compose exec dev pnpm build

# 手動テスト
# ブラウザで /settings?tab=security にアクセス
# OAuthユーザーでパスワード設定フロー確認
# パスワード変更フロー確認
# OAuth解除ボタンの有効/無効状態確認
```

## 成果物

### 変更ファイル
- `apps/web/src/pages/Settings.tsx` — パスワード管理セクション + OAuth解除制約更新
- `apps/web/src/lib/api.ts` — passwordApi 追加

### 新規ファイル
- `apps/web/src/pages/__tests__/SecuritySettings.test.tsx`

## 完了条件

全ステップ完了後に以下を実施:

```bash
# 全体ビルド
docker compose exec dev pnpm build

# 全テスト
docker compose exec dev pnpm test

# E2Eテスト（手動）
# 1. サインアップ → ログイン → ダッシュボード
# 2. パスワードリセットフロー（Mailpit確認）
# 3. OAuthユーザーのパスワード設定
# 4. パスワード変更
# 5. OAuth解除（パスワード設定済みの場合）
```
