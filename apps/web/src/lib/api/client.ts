const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * APIエラー
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * リクエストオプション
 */
export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

// ============================================
// トークンリフレッシュ機構
// ============================================

// リフレッシュ処理の状態管理
let refreshPromise: Promise<boolean> | null = null;

/**
 * トークンリフレッシュを実行（シングルトン）
 * 複数のリクエストが同時に401を受けた場合、1つのリフレッシュ処理を共有する
 */
async function refreshAccessToken(): Promise<boolean> {
  // 既にリフレッシュ中なら既存のPromiseを返す
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    // リフレッシュ完了後に状態をリセット
    refreshPromise = null;
  }
}

/**
 * セッション期限切れ時のリダイレクト処理
 */
async function handleSessionExpired(): Promise<never> {
  // ログアウト処理（クッキーのクリア）
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {
    // ログアウト失敗は無視
  });

  // ログインページにリダイレクト
  window.location.href = '/login?expired=true';

  // リダイレクト後は処理が続かないようにする
  // （実際にはページ遷移で中断されるが、型安全性のため）
  return new Promise(() => {
    // 永遠に解決しないPromiseを返す
  });
}

/**
 * APIクライアント
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders as Record<string, string>,
  };

  const config: RequestInit = {
    ...rest,
    headers,
    credentials: 'include', // クッキーを含める
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  let response = await fetch(url, config);

  // 401エラー時の自動リフレッシュ処理
  if (response.status === 401) {
    // 認証系エンドポイントの401は除外（無限ループ防止・ログイン時のエラーコード伝播）
    if (endpoint.includes('/auth/refresh') || endpoint.includes('/auth/me') || endpoint.includes('/auth/login') || endpoint.includes('/auth/2fa/verify')) {
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');
      const data = isJson ? await response.json() : null;
      const error = data?.error || {};
      throw new ApiError(
        401,
        error.code || 'AUTHENTICATION_ERROR',
        error.message || 'セッションが期限切れです。再ログインしてください。',
        error.details
      );
    }

    // リフレッシュを試みる（複数リクエストが同時に401を受けても1回だけ実行）
    const refreshSuccess = await refreshAccessToken();

    if (refreshSuccess) {
      // リフレッシュ成功後にリクエストを再試行
      response = await fetch(url, config);

      // 再試行後も401なら、セッション期限切れとして処理
      if (response.status === 401) {
        return handleSessionExpired();
      }
    } else {
      // リフレッシュ失敗 - セッション期限切れ
      return handleSessionExpired();
    }
  }

  // レスポンスボディを取得
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const data = isJson ? await response.json() : null;

  // エラーレスポンスの場合
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

/**
 * Blob レスポンス用APIクライアント（トークンリフレッシュ対応）
 */
async function requestBlob(endpoint: string, options: RequestOptions = {}): Promise<Blob> {
  const { body, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    ...customHeaders as Record<string, string>,
  };

  const config: RequestInit = {
    ...rest,
    headers,
    credentials: 'include',
  };

  if (body) {
    config.body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const url = `${API_BASE_URL}${endpoint}`;
  let response = await fetch(url, config);

  // 401エラー時の自動リフレッシュ処理
  if (response.status === 401) {
    const refreshSuccess = await refreshAccessToken();

    if (refreshSuccess) {
      response = await fetch(url, config);

      if (response.status === 401) {
        return handleSessionExpired();
      }
    } else {
      return handleSessionExpired();
    }
  }

  // エラーレスポンスの場合
  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    const data = isJson ? await response.json() : null;
    const error = data?.error || {};
    throw new ApiError(
      response.status,
      error.code || 'UNKNOWN_ERROR',
      error.message || 'リクエストに失敗しました',
      error.details
    );
  }

  return response.blob();
}

/**
 * APIクライアントインスタンス
 */
export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  delete: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE', body }),

  getBlob: (endpoint: string, options?: RequestOptions) =>
    requestBlob(endpoint, { ...options, method: 'GET' }),
};
