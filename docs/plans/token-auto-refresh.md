# アクセストークン自動リフレッシュ機能の実装

## 概要
アクセストークン（15分）が期限切れになった際、リフレッシュトークン（7日）を使用して自動的に新しいトークンを取得し、元のリクエストを再試行する機能を実装する。

## 現状の問題
- フロントエンドの`api.ts`は401エラーを受け取ると即座に`ApiError`をスローする
- `authApi.refresh()`は定義されているが、401発生時に呼び出されていない
- 結果、アクセストークン期限切れ後は再ログインが必要になっている

## 変更方針
- `apps/web/src/lib/api.ts`に401エラー時の自動リフレッシュ＆リトライ機構を追加
- リフレッシュ中の重複リクエストを防ぐためのキューイング機構を実装
- リフレッシュ失敗時はログアウト処理を実行

---

## 実装ステップ

### Step 1: api.tsにトークンリフレッシュ機構を追加

**apps/web/src/lib/api.ts**

#### 1a. リフレッシュ状態管理用の変数を追加

```typescript
// リフレッシュ処理の状態管理
let isRefreshing = false;
let refreshSubscribers: Array<() => void> = [];

// リフレッシュ完了を待つPromiseを返す
function subscribeToRefresh(): Promise<void> {
  return new Promise((resolve) => {
    refreshSubscribers.push(resolve);
  });
}

// リフレッシュ完了時に全ての待機中リクエストを再開
function onRefreshComplete(): void {
  refreshSubscribers.forEach((callback) => callback());
  refreshSubscribers = [];
}
```

#### 1b. リフレッシュ実行関数を追加

```typescript
// トークンリフレッシュを実行
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
```

#### 1c. request関数を修正して401時の自動リフレッシュを追加

```typescript
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, ...rest } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config: RequestInit = {
    ...rest,
    headers,
    credentials: 'include',
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  let response = await fetch(url, config);

  // 401エラー時の自動リフレッシュ処理
  if (response.status === 401) {
    // リフレッシュエンドポイント自体の401は除外
    if (endpoint.includes('/auth/refresh')) {
      throw new ApiError(401, 'SESSION_EXPIRED', 'セッションが期限切れです。再ログインしてください。');
    }

    // 既にリフレッシュ中なら完了を待つ
    if (isRefreshing) {
      await subscribeToRefresh();
      // リフレッシュ完了後にリクエストを再試行
      response = await fetch(url, config);
    } else {
      // リフレッシュを開始
      isRefreshing = true;

      try {
        const refreshSuccess = await refreshAccessToken();

        if (refreshSuccess) {
          onRefreshComplete();
          // リフレッシュ成功後にリクエストを再試行
          response = await fetch(url, config);
        } else {
          // リフレッシュ失敗 - セッション期限切れ
          onRefreshComplete();
          // ログアウト処理（クッキーのクリア）
          await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          }).catch(() => {});

          // 認証ストアをリセット（window.locationでリダイレクト）
          window.location.href = '/login?expired=true';
          throw new ApiError(401, 'SESSION_EXPIRED', 'セッションが期限切れです。再ログインしてください。');
        }
      } finally {
        isRefreshing = false;
      }
    }
  }

  let data: ApiResponse<T> | null = null;
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    const error = data?.error || {};
    throw new ApiError(
      response.status,
      error.code || 'UNKNOWN_ERROR',
      error.message || 'リクエストに失敗しました',
      error.details
    );
  }

  return data as T;
}
```

---

### Step 2: React Queryの401リトライを無効化

**apps/web/src/main.tsx**

401エラーはトークンリフレッシュで処理されるため、React Queryのリトライ対象から除外する。

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: (failureCount, error) => {
        // 401エラーはリトライしない（トークンリフレッシュで処理済み）
        if (error instanceof ApiError && error.status === 401) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});
```

**注意**: `ApiError`をインポートする必要がある。

```typescript
import { ApiError } from './lib/api';
```

---

### Step 3: ApiErrorクラスのエクスポート確認

**apps/web/src/lib/api.ts**

`ApiError`クラスがエクスポートされていることを確認。されていなければ追加。

```typescript
export class ApiError extends Error {
  // ...
}
```

---

### Step 4: ログインページでexpiredパラメータを処理（オプション）

**apps/web/src/pages/Login.tsx**（または該当するログインページ）

セッション期限切れ時のメッセージ表示を追加。

```typescript
// URLパラメータからexpiredを取得
const [searchParams] = useSearchParams();
const isExpired = searchParams.get('expired') === 'true';

// 表示
{isExpired && (
  <div className="text-warning mb-4">
    セッションが期限切れになりました。再度ログインしてください。
  </div>
)}
```

---

## 重要ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/lib/api.ts` | 401時の自動リフレッシュ＆リトライ機構を追加 |
| `apps/web/src/main.tsx` | React Queryの401リトライを無効化、ApiErrorインポート |
| `apps/web/src/pages/Login.tsx` | （オプション）期限切れメッセージ表示 |

---

## シーケンス図

```
リクエスト → 401エラー
              ↓
         リフレッシュ中？
           ↓ No          ↓ Yes
      リフレッシュ開始   完了を待つ
           ↓                ↓
      成功？              リトライ
      ↓ Yes    ↓ No
   リトライ   ログアウト＆リダイレクト
```

---

## 注意事項

1. **リフレッシュエンドポイントの除外**
   - `/auth/refresh`自体の401はリフレッシュ対象外（無限ループ防止）

2. **並行リクエストの処理**
   - 複数のリクエストが同時に401を受けた場合、リフレッシュは1回だけ実行
   - 他のリクエストはリフレッシュ完了を待ってからリトライ

3. **リフレッシュ失敗時の処理**
   - ログアウトAPIを呼び出してクッキーをクリア
   - ログインページにリダイレクト（`?expired=true`パラメータ付き）

4. **テスト時の考慮**
   - `window.location.href`へのリダイレクトはテスト時にモックが必要

---

## テスト観点

1. **正常系**
   - アクセストークン期限切れ後、リフレッシュが成功し元のリクエストが成功する
   - 複数の同時リクエストでリフレッシュが1回だけ実行される

2. **異常系**
   - リフレッシュトークンも期限切れの場合、ログインページにリダイレクトされる
   - リフレッシュエンドポイント自体が失敗した場合の処理

3. **境界条件**
   - アクセストークン期限切れ直前のリクエスト
   - リフレッシュ中に新しいリクエストが発生した場合
