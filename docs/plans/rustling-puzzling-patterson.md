# Admin プロフィール編集機能

## Context

ログイン中の管理者が自分のユーザー情報を編集する機能が存在しない。現在、管理者アカウント編集は SUPER_ADMIN が他の管理者を管理する `PATCH /admin/admin-users/:id` のみ。自分自身の名前変更、パスワード変更、2FA設定を行うプロフィールページを追加する。

## スコープ

- 表示名の編集
- パスワード変更（現在のパスワード検証付き）
- 2FA設定（セットアップ/無効化）- バックエンドは既存エンドポイント利用
- ヘッダーのアバター/名前クリックでプロフィールページに遷移

## 実装計画

### Phase 1: Backend

#### 1.1 Repository メソッド追加

**`apps/api/src/repositories/admin-user.repository.ts`**

- `updateName(id, name)` - 名前更新、AdminUser の公開フィールドを返す
- `updatePassword(id, passwordHash)` - パスワードハッシュ更新

#### 1.2 Service メソッド追加

**`apps/api/src/services/admin/admin-auth.service.ts`**

- `updateProfile(adminUserId, name, ipAddress?, userAgent?)` - 名前更新 + 監査ログ `PROFILE_UPDATED`
- `changePassword(adminUserId, currentPassword, newPassword, ipAddress?, userAgent?)` - 現在のパスワード検証 → bcryptハッシュ → 更新 → 監査ログ `PASSWORD_CHANGED`

#### 1.3 Controller 新規作成

**新規: `apps/api/src/controllers/admin/profile.controller.ts`**

- `updateProfile` - `PATCH /admin/auth/profile`
  - バリデーション: `z.object({ name: z.string().min(1).max(100).trim() })`
- `changePassword` - `PUT /admin/auth/password`
  - バリデーション: 既存の `changePasswordSchema`（`packages/shared/src/validators/schemas.ts:152`）を再利用

#### 1.4 Route 登録

**`apps/api/src/routes/admin/auth.ts`**

- `router.patch('/profile', requireAdminAuth(), profileController.updateProfile)`
- `router.put('/password', requireAdminAuth(), profileController.changePassword)`

### Phase 2: Frontend API クライアント

#### 2.1 HTTP メソッド追加

**`apps/admin/src/lib/api.ts`** の `api` オブジェクトに `patch` と `put` を追加

#### 2.2 プロフィールAPI追加

**`apps/admin/src/lib/api.ts`** に `adminProfileApi` セクション追加:

- `updateProfile({ name })` → `PATCH /admin/auth/profile`
- `changePassword({ currentPassword, newPassword })` → `PUT /admin/auth/password`
- `setup2FA()` → `POST /admin/auth/2fa/setup`（既存エンドポイント）
- `enable2FA(code)` → `POST /admin/auth/2fa/enable`（既存エンドポイント）
- `disable2FA(password)` → `POST /admin/auth/2fa/disable`（既存エンドポイント）

### Phase 3: Frontend ストア・フック

#### 3.1 Auth ストア更新

**`apps/admin/src/stores/admin-auth.store.ts`**

- `updateAdmin(admin: AdminUser)` アクション追加 → `set({ admin })`

#### 3.2 useAdminAuth フック更新

**`apps/admin/src/hooks/useAdminAuth.ts`**

- `updateAdmin` をエクスポートに追加

#### 3.3 プロフィールフック新規作成

**新規: `apps/admin/src/hooks/useProfile.ts`**

- `useUpdateProfile()` - 名前更新 mutation、成功時にストア更新
- `useChangePassword()` - パスワード変更 mutation
- `useSetup2FA()` - 2FAセットアップ mutation
- `useEnable2FA()` - 2FA有効化 mutation、成功時に `totpEnabled: true` でストア更新
- `useDisable2FA()` - 2FA無効化 mutation、成功時に `totpEnabled: false` でストア更新

### Phase 4: Frontend プロフィールページ

#### 4.1 ページコンポーネント

**新規: `apps/admin/src/pages/Profile.tsx`**

3セクション構成（既存のカードパターン `bg-background-secondary border border-border rounded-lg p-6` を踏襲）:

1. **基本情報** - 名前編集フォーム + 保存ボタン
2. **パスワード変更** - 現在のパスワード / 新しいパスワード / 確認入力 + 変更ボタン
3. **二要素認証** - 2FA無効時: セットアップボタン → QRコード表示 → コード入力 → 有効化 / 2FA有効時: ステータス表示 + 無効化ボタン（パスワード確認）

#### 4.2 ルート登録

**`apps/admin/src/App.tsx`**

- `<Route path="/profile" element={<Profile />} />` を認証必須ルートグループに追加

#### 4.3 ヘッダーにリンク追加

**`apps/admin/src/components/layout/AdminHeader.tsx`**

- 名前表示 + アバターを `<Link to="/profile">` でラップ
- アバターの文字を `admin?.name?.charAt(0).toUpperCase() ?? 'A'` に動的化

### Phase 5: テスト

- `apps/api/src/controllers/admin/__tests__/profile.controller.test.ts`
- `apps/api/src/services/admin/__tests__/admin-auth-profile.test.ts`

## 変更ファイル一覧

| ファイル | 変更種別 |
|---------|---------|
| `apps/api/src/repositories/admin-user.repository.ts` | 編集 |
| `apps/api/src/services/admin/admin-auth.service.ts` | 編集 |
| `apps/api/src/controllers/admin/profile.controller.ts` | **新規** |
| `apps/api/src/routes/admin/auth.ts` | 編集 |
| `apps/admin/src/lib/api.ts` | 編集 |
| `apps/admin/src/stores/admin-auth.store.ts` | 編集 |
| `apps/admin/src/hooks/useAdminAuth.ts` | 編集 |
| `apps/admin/src/hooks/useProfile.ts` | **新規** |
| `apps/admin/src/pages/Profile.tsx` | **新規** |
| `apps/admin/src/App.tsx` | 編集 |
| `apps/admin/src/components/layout/AdminHeader.tsx` | 編集 |

## 再利用する既存リソース

- `changePasswordSchema` - `packages/shared/src/validators/schemas.ts:152`
- `passwordSchema` - `packages/shared/src/validators/schemas.ts:103`
- `extractClientInfo` - `apps/api/src/middleware/session.middleware.ts`
- `AdminAuditLogService` - `apps/api/src/services/admin/admin-audit-log.service.ts`
- 2FAエンドポイント（setup/enable/disable）- 既存のまま利用

## 検証方法

1. `docker compose exec dev pnpm build` でビルド成功を確認
2. `docker compose exec dev pnpm test` でテスト通過を確認
3. admin画面にログイン → ヘッダーの名前/アバタークリック → `/profile` に遷移
4. 名前変更 → 保存 → ヘッダーの名前表示が即座に更新されることを確認
5. パスワード変更 → 誤ったパスワードでエラー表示 → 正しいパスワードで成功
6. 2FAセットアップ → QRコード表示 → コード入力 → 有効化 → ステータス反映
7. 2FA無効化 → パスワード確認 → 無効化 → ステータス反映
