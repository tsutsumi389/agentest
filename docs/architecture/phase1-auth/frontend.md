# フロントエンド詳細設計

## 概要

認証基盤のフロントエンド実装は、React 19 + React Router 7 + Zustand を使用。Cookie ベースの認証と OAuth フローを実装している。

```
┌─────────────────────────────────────────────────────────────┐
│  Pages (React Router)                                       │
│  - ページコンポーネント                                       │
│  - ルーティング                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Components                                                 │
│  - UI コンポーネント                                         │
│  - レイアウト                                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Hooks / Stores (Zustand)                                   │
│  - 状態管理                                                 │
│  - 副作用                                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  API Client                                                 │
│  - HTTP リクエスト                                          │
│  - エラーハンドリング                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. ページコンポーネント

### Login.tsx

**ファイル:** `apps/web/src/pages/Login.tsx`

**責務:** OAuth ログインページ

**State:**
```typescript
{
  isAuthenticated: boolean  // ストアから取得
  isLoading: boolean        // ストアから取得
}
```

**機能:**
- 既にログイン済みの場合はダッシュボードへリダイレクト
- GitHub / Google OAuth ログインボタン

**OAuth フロー開始:**
```typescript
// GitHub ログイン
window.location.href = `${VITE_API_URL}/api/auth/github`

// Google ログイン
window.location.href = `${VITE_API_URL}/api/auth/google`
```

**UI 構造:**
```
センタードフルスクリーン
├─ ロゴ表示（Flask アイコン + "Agentest" テキスト）
├─ ログインカード
│  ├─ "ログイン" タイトル
│  ├─ GitHub ボタン
│  ├─ Google ボタン
│  └─ 利用規約/プライバシーポリシーリンク
└─ フッター（著作権表記）
```

---

### AuthCallback.tsx

**ファイル:** `apps/web/src/pages/AuthCallback.tsx`

**責務:** OAuth コールバック処理

**機能:**
- OAuth 認証後のコールバック処理
- `initialize()` で認証状態を再取得
- ダッシュボードへのリダイレクト
- ローディング画面を表示

**処理フロー:**
```
1. ページマウント
2. useAuthStore.initialize() 実行
3. Cookie からトークンを読み取り /api/auth/me を呼び出し
4. 成功: /dashboard へリダイレクト
5. 失敗: /login へリダイレクト
```

**UI:**
```
フルスクリーン中央
├─ スピナーアニメーション
└─ "認証中..." メッセージ
```

---

### Settings.tsx

**ファイル:** `apps/web/src/pages/Settings.tsx`

**責務:** 設定ページ（プロフィール・通知・セキュリティ・API トークン）

**State:**
```typescript
{
  activeTab: 'profile' | 'notifications' | 'security' | 'api-tokens'
  searchParams: URLSearchParams
}
```

**タブ構成:**
| タブ | コンポーネント | 説明 |
|-----|---------------|------|
| profile | ProfileSettings | プロフィール設定 |
| notifications | NotificationSettings | 通知設定（未実装） |
| security | SecuritySettings | セキュリティ設定 |
| api-tokens | ApiTokenSettings | API トークン設定（未実装） |

**OAuth 連携結果検出:**
```typescript
// URL パラメータで検出
?link=success  // 連携成功
?link=error&message=xxx  // 連携失敗
```

---

## 2. Settings 内部コンポーネント

### ProfileSettings

**責務:** プロフィール編集

**State:**
```typescript
{
  name: string              // 入力値
  isSaving: boolean         // 送信中フラグ
  validationError: string | null  // バリデーションエラー
  hasChanges: boolean       // 変更有無判定
}
```

**バリデーション:**
- 空文字列チェック
- 最大100文字

**API 呼び出し:**
```typescript
await updateUser({ name: trimmedName })
// → PATCH /api/users/{userId}
```

**UI 構造:**
```
プロフィールカード
├─ ユーザー情報表示（アバター + 名前 + メール）
├─ 表示名入力フィールド
│  ├─ ラベル
│  ├─ テキスト入力
│  └─ エラーメッセージ
├─ メール表示フィールド（disabled）
└─ アクションボタン（保存/キャンセル）
```

---

### SecuritySettings

**責務:** セキュリティ設定（OAuth 連携・セッション管理）

**State:**
```typescript
{
  sessions: Session[]
  accounts: Account[]
  isLoadingSessions: boolean
  isLoadingAccounts: boolean
  revokingSessionId: string | null
  isRevokingAll: boolean
  unlinkingProvider: string | null
  confirmDialog: {
    type: 'session' | 'all-sessions' | 'unlink'
    sessionId?: string
    provider?: string
  } | null
}
```

**サポートプロバイダー:**
```typescript
const OAUTH_PROVIDERS = [
  { id: 'github', name: 'GitHub', icon: Github },
  { id: 'google', name: 'Google', icon: GoogleIcon }
]
```

**API 呼び出し:**
```typescript
// OAuth 連携
await accountsApi.list(userId)           // GET /api/users/{userId}/accounts
await accountsApi.unlink(userId, provider)  // DELETE /api/users/{userId}/accounts/{provider}
accountsApi.getLinkUrl(provider)         // /api/auth/{provider}/link

// セッション管理
await sessionsApi.list()                 // GET /api/sessions
await sessionsApi.revoke(sessionId)      // DELETE /api/sessions/{sessionId}
await sessionsApi.revokeOthers()         // DELETE /api/sessions
```

**ビジネスルール:**
- 最低1つの OAuth 連携を保持（複数連携時のみ解除可能）

---

### SessionItem

**責務:** セッション一覧の個別項目

**Props:**
```typescript
{
  session: Session
  onRevoke: (sessionId: string) => void
  isRevoking: boolean
}
```

**UserAgent 解析:**
```typescript
parseUserAgent(userAgent) → { deviceType, browser, os }

// デバイスタイプ
'desktop' | 'tablet' | 'mobile'

// ブラウザ
'Edge' | 'Chrome' | 'Firefox' | 'Safari' | 'Unknown'

// OS
'Windows' | 'macOS' | 'Linux' | 'Android' | 'iOS' | 'Unknown'
```

**相対時間フォーマット:**
```typescript
formatRelativeTime(date) →
  "たった今" | "5分前" | "2時間前" | "3日前" | "2024年1月1日"
```

**UI 構造:**
```
セッションアイテム（ボーダー付きカード）
├─ アイコン + デバイス情報
│  ├─ デバイスアイコン（色分け）
│  ├─ ブラウザ + OS テキスト
│  ├─ 現在のセッションバッジ
│  └─ IP + 最終アクティブ時刻
└─ ログアウトボタン（現在のセッション以外のみ）
```

---

### ConfirmDialog

**責務:** 確認ダイアログ

**Props:**
```typescript
{
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}
```

**UI 構造:**
```
固定オーバーレイ
├─ 背景（黒50%透過）
└─ ダイアログボックス
   ├─ ヘッダー
   │  ├─ 警告アイコン（黄色背景）
   │  ├─ タイトル + メッセージ
   │  └─ 閉じるボタン
   └─ フッター
      ├─ キャンセルボタン
      └─ 確定ボタン（危険色）
```

---

## 3. 認証ストア

### auth.ts

**ファイル:** `apps/web/src/stores/auth.ts`

**責務:** 認証状態管理

**State:**
```typescript
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}
```

**Actions:**
```typescript
{
  initialize(): Promise<void>       // 初期化（/api/auth/me）
  logout(): Promise<void>           // ログアウト
  setUser(user: User): void         // ユーザー設定
  updateUser(data: UpdateUserRequest): Promise<void>  // ユーザー情報更新
  clearError(): void                // エラークリア
}
```

### initialize

**処理フロー:**
```
1. isLoading = true
2. authApi.me() を呼び出し
3. 成功:
   - user = レスポンス.user
   - isAuthenticated = true
4. 失敗:
   - user = null
   - isAuthenticated = false
   - error = null（サイレント）
5. isLoading = false
```

### logout

**処理フロー:**
```
1. authApi.logout() を呼び出し
2. WebSocket 接続を切断
3. ストアをリセット
   - user = null
   - isAuthenticated = false
   - error = null
```

### updateUser

**処理フロー:**
```
1. 現在のユーザー ID を取得
2. usersApi.update(userId, data) を呼び出し
3. 成功: user = レスポンス.data
4. 失敗: ApiError をスロー
```

---

## 4. 認証フック

### useAuth

**ファイル:** `apps/web/src/hooks/useAuth.ts`

**責務:** 認証状態へのアクセス + 初期化

**戻り値:**
```typescript
{
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  logout: () => Promise<void>
  clearError: () => void
}
```

**動作:**
- マウント時に `initialize()` を自動実行

### useRequireAuth

**責務:** 認証必須コンポーネント向け

**動作:**
- 未認証の場合は `{ user: null, isLoading: false }` を返す
- ルート側でリダイレクト処理

---

## 5. API クライアント

### api.ts

**ファイル:** `apps/web/src/lib/api.ts`

**責務:** RESTful API への統一インターフェース

### ApiError クラス

```typescript
class ApiError extends Error {
  statusCode: number
  code: string
  details?: Record<string, string[]>  // バリデーション詳細
}
```

### request 関数

```typescript
async function request<T>(
  endpoint: string,
  options?: {
    body?: unknown
    headers?: Record<string, string>
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  }
): Promise<T>
```

**設定:**
- `Content-Type: application/json`
- `credentials: 'include'`（Cookie を送信）
- エラーレスポンス時は `ApiError` をスロー

### authApi

```typescript
authApi.me(): Promise<{ user: User }>
authApi.refresh(): Promise<{ accessToken: string; refreshToken: string }>
authApi.logout(): Promise<{ message: string }>
```

### usersApi

```typescript
usersApi.update(
  userId: string,
  data: UpdateUserRequest
): Promise<{ data: User }>

// UpdateUserRequest
{
  name?: string
  avatarUrl?: string | null
}
```

### sessionsApi

```typescript
// 型定義
interface Session {
  id: string
  userAgent: string | null
  ipAddress: string | null
  lastActiveAt: string        // ISO 8601
  expiresAt: string           // ISO 8601
  createdAt: string           // ISO 8601
  isCurrent: boolean
}

interface RevokeSessionsResult {
  success: boolean
  revokedCount: number
}

// メソッド
sessionsApi.list(): Promise<{ data: Session[] }>
sessionsApi.count(): Promise<{ data: { count: number } }>
sessionsApi.revoke(sessionId: string): Promise<{ data: { success: boolean } }>
sessionsApi.revokeOthers(): Promise<{ data: RevokeSessionsResult }>
```

### accountsApi

```typescript
// 型定義
interface Account {
  id: string
  provider: 'github' | 'google'
  providerAccountId: string
  createdAt: string
  updatedAt: string
}

// メソッド
accountsApi.list(userId: string): Promise<{ data: Account[] }>
accountsApi.unlink(
  userId: string,
  provider: string
): Promise<{ data: { success: boolean } }>
accountsApi.getLinkUrl(provider: 'github' | 'google'): string
```

---

## 6. 共通コンポーネント

### Layout.tsx

**ファイル:** `apps/web/src/components/Layout.tsx`

**責務:** アプリケーションレイアウト

**構造:**
```
Layout（Flexbox）
├─ Sidebar（固定/モバイル時は絶対位置）
│  ├─ ロゴ + タイトル
│  ├─ ナビゲーションメニュー
│  │  ├─ Dashboard
│  │  ├─ Projects
│  │  └─ Settings
│  └─ ユーザーメニュー
│     ├─ アバター + 名前/メール
│     └─ ログアウトボタン
├─ モバイルヘッダー（ハンバーガーボタン）
├─ メインコンテンツエリア（Outlet）
└─ ToastContainer
```

**レスポンシブ対応:**
- デスクトップ: 固定サイドバー（w-64）
- モバイル: スライドイン（z-50）+ オーバーレイ

---

### Toast.tsx

**ファイル:** `apps/web/src/components/Toast.tsx`

**責務:** トースト通知

**トーストストア（Zustand）:**
```typescript
interface Toast {
  id: string          // UUID
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

// Actions
addToast(type, message): void  // UUID 自動生成、5秒後に自動削除
removeToast(id): void

// ヘルパー関数
toast.success(message)
toast.error(message)
toast.info(message)
toast.warning(message)
```

**カラーマッピング:**
| タイプ | 背景 | ボーダー | テキスト |
|--------|------|---------|---------|
| success | bg-success/10 | border-success | text-success |
| error | bg-danger/10 | border-danger | text-danger |
| info | bg-accent/10 | border-accent | text-accent |
| warning | bg-warning/10 | border-warning | text-warning |

**ToastContainer:**
- 固定位置（右下）
- 複数のトーストを積み重ね表示
- `position: fixed, bottom-4, right-4, z-50`

---

### ErrorBoundary.tsx

**ファイル:** `apps/web/src/components/ErrorBoundary.tsx`

**責務:** エラーキャッチ + エラー画面表示

**機能:**
- React コンポーネント階層のエラーをキャッチ
- コンソールに詳細ログ出力
- ユーザーにわかりやすいエラー画面を表示

**UI 構造:**
```
フルスクリーン中央
├─ エラーアイコン（赤背景）
├─ "エラーが発生しました" タイトル
├─ メッセージ
├─ エラー詳細（details 要素で折りたたみ）
└─ アクションボタン
   ├─ 再試行（setState でリセット）
   └─ ページを再読み込み
```

---

## 7. ルーティング

### App.tsx

**ファイル:** `apps/web/src/App.tsx`

**ルート構成:**
```
パブリック
├─ /login                    (LoginPage)
└─ /auth/callback            (AuthCallbackPage)

保護されたルート（ProtectedRoute で囲む）
└─ /
   ├─ /dashboard            (DashboardPage)
   ├─ /projects             (ProjectsPage)
   ├─ /projects/:projectId  (ProjectDetailPage)
   ├─ /test-suites/:testSuiteId  (TestSuiteDetailPage)
   ├─ /executions/:executionId   (ExecutionPage)
   └─ /settings             (SettingsPage)

404
└─ * (404 表示)
```

### ProtectedRoute

**責務:** 認証必須ルートの保護

**動作:**
- ローディング中: 「読み込み中...」を表示
- 未認証: `/login` へリダイレクト
- 認証済み: 子コンポーネントをレンダリング

---

## 8. 認証フロー詳細

### 初期化フロー

```
App マウント
    │
    ▼
useAuthStore.initialize() 実行
    │
    ▼
authApi.me() で現在ユーザーを取得
    │
    ├─ 成功 ─────────────────────────────┐
    │  ユーザー情報をストアに保存         │
    │  isAuthenticated = true            │
    │  保護されたルートへアクセス可能      │
    │                                    │
    └─ 失敗 ─────────────────────────────┐
       ストアをリセット                   │
       isAuthenticated = false            │
       /login へリダイレクト              │
```

### ログインフロー

```
LoginPage
    │
    ▼
GitHub/Google ボタンクリック
    │
    ▼
window.location.href = /api/auth/{provider}
    │
    ▼
OAuth 認証サーバー（バックエンド）で処理
    │
    ▼
/auth/callback へリダイレクト
    │
    ▼
AuthCallbackPage で initialize() 実行
    │
    ▼
ユーザー情報を取得して /dashboard へリダイレクト
```

### プロフィール更新フロー

```
ProfileSettings で名前を入力
    │
    ▼
送信ボタンクリック
    │
    ▼
バリデーション実行
├─ 空チェック
└─ 文字数制限（100文字）
    │
    ▼
updateUser({ name }) 呼び出し
    │
    ▼
PATCH /api/users/{userId} 実行
    │
    ├─ 成功 ──────────────────────┐
    │  ストア更新                  │
    │  トースト表示（成功）         │
    │                             │
    └─ 失敗 ──────────────────────┐
       ApiError から詳細を抽出      │
       インラインエラー表示         │
```

### セッション管理フロー

```
SecuritySettings マウント
    │
    ▼
sessionsApi.list() で全セッション取得
    │
    ▼
各セッションの UserAgent を解析
デバイス情報取得
    │
    ▼
ユーザー操作
├─ 個別ログアウト
│      │
│      ▼
│  sessionsApi.revoke(sessionId)
│      │
│      ▼
│  セッション一覧から削除
│  トースト表示
│
├─ 全部ログアウト
│      │
│      ▼
│  sessionsApi.revokeOthers()
│      │
│      ▼
│  現在以外を一覧から削除
│  トースト表示
│
└─ 確認ダイアログ表示
```

### OAuth 連携管理フロー

```
SecuritySettings マウント
    │
    ▼
accountsApi.list(userId) で連携済みプロバイダー取得
    │
    ▼
各プロバイダーの接続状態を表示
    │
    ▼
ユーザー操作
├─ 連携追加
│      │
│      ▼
│  window.location.href = accountsApi.getLinkUrl(provider)
│      │
│      ▼
│  OAuth 認証フロー
│      │
│      ▼
│  Settings?link=success へリダイレクト
│      │
│      ▼
│  URL パラメータを検出してトースト表示
│
└─ 連携解除
       │
       ▼
   確認ダイアログ表示
       │
       ▼
   accountsApi.unlink()
       │
       ▼
   連携一覧から削除
   トースト表示
```

---

## 9. デザインシステム

### テーマカラー変数

```css
/* 前景色 */
--foreground
--foreground-muted
--foreground-subtle

/* 背景色 */
--background
--background-secondary
--background-tertiary

/* ボーダー */
--border

/* アクセント */
--accent
--accent-muted

/* ステータス */
--success
--success-muted
--danger
--danger-muted
--warning
--warning-muted
```

### ボタンクラス

| クラス | 用途 |
|--------|------|
| `btn btn-primary` | メインアクション |
| `btn btn-secondary` | セカンダリアクション |
| `btn btn-ghost` | テキストのみ |
| `btn btn-danger` | 危険操作 |
| `btn-sm` / `btn-lg` | サイズ調整 |

### 入力フィールド

```css
/* 通常 */
.input {
  /* 基本スタイル */
}

/* エラー時 */
.input-error {
  border-color: var(--danger);
}

/* 無効時 */
.input:disabled {
  background-color: var(--background-tertiary);
}
```

### カード

```css
.card {
  border: 1px solid var(--border);
  background-color: var(--background-secondary);
  border-radius: 0.5rem;
}
```

### バッジ

| クラス | 用途 |
|--------|------|
| `badge badge-success` | 成功状態 |
| `badge badge-warning` | 警告状態 |
| `badge badge-danger` | エラー状態 |
| `badge badge-accent` | アクセント |

---

## 10. 環境変数

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `VITE_API_URL` | Yes | - | API サーバー URL |
