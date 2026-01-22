# Step 0-6: 管理者ログイン画面（Frontend）実装計画

## 概要

管理者向けログイン画面をReact 19 + React Router 7 + Zustand + TailwindCSSで実装する。Terminal/CLI風のミニマルなダークテーマで、エラー表示・ロック状態・2FA対応を含む。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                        App.tsx (Router)                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │   /login        │  │   /2fa           │  │   /* (認証必須)│  │
│  │   LoginPage     │  │   TwoFactorAuth  │  │   AuthGuard   │  │
│  └────────┬────────┘  └────────┬─────────┘  └───────┬───────┘  │
│           │                    │                    │          │
│           └────────────────────┴────────────────────┘          │
│                                │                               │
│                                ▼                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              adminAuthStore (Zustand)                    │   │
│  │  - admin / isAuthenticated / isLoading / requires2FA     │   │
│  └───────────────────────────┬─────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    lib/api.ts                            │   │
│  │  - adminAuthApi.login / logout / me / verify2FA          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 作成・変更ファイル

### 新規作成（8ファイル）

| ファイル | 説明 |
|---------|------|
| `apps/admin/src/lib/api.ts` | APIクライアント（fetchラッパー、エラークラス） |
| `apps/admin/src/stores/admin-auth.store.ts` | Zustand認証ストア |
| `apps/admin/src/hooks/useAdminAuth.ts` | 認証フック |
| `apps/admin/src/components/auth/LoginForm.tsx` | ログインフォーム |
| `apps/admin/src/components/auth/TwoFactorForm.tsx` | 2FAフォーム（6桁入力） |
| `apps/admin/src/components/layout/AuthGuard.tsx` | 認証ガード |
| `apps/admin/src/pages/auth/Login.tsx` | ログインページ |
| `apps/admin/src/pages/auth/TwoFactorAuth.tsx` | 2FAページ |

### 変更（1ファイル）

| ファイル | 変更内容 |
|---------|----------|
| `apps/admin/src/App.tsx` | ルーティング追加、認証初期化 |

## 実装詳細

### 1. `lib/api.ts` - APIクライアント

```typescript
// 型定義
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  totpEnabled: boolean;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>
  ) { ... }
}

// API関数
export const adminAuthApi = {
  login: (email, password) => POST /admin/auth/login,
  logout: () => POST /admin/auth/logout,
  me: () => GET /admin/auth/me,
  verify2FA: (code) => POST /admin/auth/2fa/verify,
};
```

### 2. `stores/admin-auth.store.ts` - 認証ストア

```typescript
interface AdminAuthState {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requires2FA: boolean;
  error: ApiError | null;

  initialize: () => Promise<void>;  // アプリ起動時に認証状態確認
  login: (email, password) => Promise<void>;
  verify2FA: (code) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}
```

### 3. `components/auth/LoginForm.tsx` - ログインフォーム

- メールアドレス入力（Mailアイコン）
- パスワード入力（Lockアイコン）
- エラーメッセージ表示（通常エラー: 赤、ロック状態: 黄）
- ローディング状態のボタン
- CLI風装飾: `$ admin --login --secure`

### 4. `components/auth/TwoFactorForm.tsx` - 2FAフォーム

- 6桁の数字入力（個別入力欄）
- 自動フォーカス移動
- ペースト対応（6桁一括入力）
- 6桁揃ったら自動送信
- キャンセルボタン（ログアウト）

### 5. `components/layout/AuthGuard.tsx` - 認証ガード

```typescript
// 未認証 → /login にリダイレクト
// requires2FA → /2fa にリダイレクト
// 認証済み → children を表示
```

### 6. `App.tsx` - ルーティング

```typescript
<Routes>
  {/* 認証不要 */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/2fa" element={<TwoFactorAuthPage />} />

  {/* 認証必須 */}
  <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

## 認証フロー

```
初期状態 (isLoading=true)
    │
    ▼ initialize() → GET /admin/auth/me
    │
    ├─ 成功 → 認証済み → / (Dashboard)
    │
    └─ 失敗 → 未認証 → /login
                │
                ▼ submit → POST /admin/auth/login
                │
                ├─ 成功 & totpEnabled=false → 認証完了 → /
                │
                ├─ 成功 & totpEnabled=true → requires2FA=true → /2fa
                │                                │
                │                                ▼ submit → POST /admin/auth/2fa/verify
                │                                │
                │                                ├─ 成功 → 認証完了 → /
                │                                └─ 失敗 → エラー表示、再入力
                │
                └─ 失敗 → エラー表示
                         - 認証エラー: 「メールアドレスまたはパスワードが正しくありません」
                         - ロック状態: 「アカウントがロックされています」（黄色表示）
```

## エラーハンドリング

| 状況 | 表示 |
|------|------|
| メール/パスワード不一致 | 「メールアドレスまたはパスワードが正しくありません」（赤） |
| アカウントロック | 「アカウントがロックされています。しばらく経ってから再度お試しください」+「30分後に再度お試しください」（黄） |
| 2FAコード不正 | 「認証コードが正しくありません」（赤）、入力クリア |
| レート制限 | 「リクエストが多すぎます。しばらく待ってから再試行してください」（赤） |

## 実装順序

1. **Phase 1: 基盤**
   - `lib/api.ts`
   - `stores/admin-auth.store.ts`
   - `hooks/useAdminAuth.ts`

2. **Phase 2: UIコンポーネント**
   - `components/auth/LoginForm.tsx`
   - `components/auth/TwoFactorForm.tsx`

3. **Phase 3: ページ**
   - `pages/auth/Login.tsx`
   - `pages/auth/TwoFactorAuth.tsx`

4. **Phase 4: 統合**
   - `components/layout/AuthGuard.tsx`
   - `App.tsx` 変更

## 検証方法

### 手動テスト

```bash
# 開発サーバー起動
cd docker && docker compose up

# http://localhost:5174/login でログイン画面表示
```

1. **正常ログイン**: admin@example.com でログイン → ダッシュボードへリダイレクト
2. **2FA有効時**: ログイン後 → /2fa に遷移 → 6桁入力 → ダッシュボード
3. **認証エラー**: 誤ったパスワード → エラーメッセージ表示
4. **ロック状態**: 5回失敗 → 黄色でロックメッセージ表示
5. **AuthGuard**: 未認証で / アクセス → /login にリダイレクト

### ユニットテスト（オプション）

- `admin-auth.store.ts`: 各アクションの状態遷移
- `LoginForm.tsx`: バリデーション、エラー表示
- `TwoFactorForm.tsx`: 6桁入力、自動送信

## 参考ファイル

- `apps/web/src/lib/api.ts` - APIクライアント実装パターン
- `apps/web/src/stores/auth.ts` - 認証ストア実装パターン
- `apps/web/src/pages/Login.tsx` - ログインページUI
- `apps/api/src/controllers/admin/auth.controller.ts` - バックエンドAPI仕様
