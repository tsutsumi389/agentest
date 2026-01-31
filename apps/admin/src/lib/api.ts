/**
 * 管理者向けAPIクライアント
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ============================================
// 型定義
// ============================================

/** 管理者ロール */
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

/** 管理者ユーザー */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  totpEnabled: boolean;
}

/** ログインレスポンス */
export interface LoginResponse {
  admin: AdminUser;
  expiresAt: string;
}

/** 2FA検証レスポンス */
export interface Verify2FAResponse {
  admin: AdminUser;
}

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

  /** アカウントロック状態かどうか */
  get isLocked(): boolean {
    return this.code === 'ACCOUNT_LOCKED';
  }

  /** レート制限かどうか */
  get isRateLimited(): boolean {
    return this.code === 'RATE_LIMITED' || this.statusCode === 429;
  }
}

// ============================================
// リクエストヘルパー
// ============================================

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * APIリクエストを実行
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
  const response = await fetch(url, config);

  // レスポンスボディを取得
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const data = isJson ? await response.json() : null;

  // エラーレスポンスの場合
  if (!response.ok) {
    // JSONレスポンスでない場合やerrorフィールドがない場合のデフォルト値
    const errorData = data && typeof data === 'object' && 'error' in data
      ? data.error
      : {};
    const code = typeof errorData?.code === 'string' ? errorData.code : 'UNKNOWN_ERROR';
    const message = typeof errorData?.message === 'string' ? errorData.message : 'リクエストに失敗しました';
    const details = errorData?.details as Record<string, string[]> | undefined;

    throw new ApiError(response.status, code, message, details);
  }

  return data as T;
}

/**
 * APIクライアントインスタンス
 */
const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),
};

// ============================================
// 管理者認証API
// ============================================

export const adminAuthApi = {
  /**
   * ログイン
   */
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/admin/auth/login', { email, password }),

  /**
   * ログアウト
   */
  logout: () =>
    api.post<{ message: string }>('/admin/auth/logout'),

  /**
   * 現在の管理者情報を取得
   */
  me: () =>
    api.get<{ admin: AdminUser }>('/admin/auth/me'),

  /**
   * 2FA検証
   */
  verify2FA: (code: string) =>
    api.post<Verify2FAResponse>('/admin/auth/2fa/verify', { code }),

  /**
   * セッション延長
   */
  refresh: () =>
    api.post<{ expiresAt: string }>('/admin/auth/refresh'),
};

// ============================================
// 管理者ダッシュボードAPI
// ============================================

import type {
  AdminDashboardStats,
  AdminUserListResponse,
  AdminUserSearchParams,
  AdminUserDetailResponse,
  AdminOrganizationListResponse,
  AdminOrganizationSearchParams,
  AdminOrganizationDetailResponse,
} from '@agentest/shared';

export const adminDashboardApi = {
  /**
   * ダッシュボード統計を取得
   */
  getStats: () =>
    api.get<AdminDashboardStats>('/admin/dashboard'),
};

// ============================================
// 検索パラメータ共通ヘルパー
// ============================================

/**
 * 検索パラメータの共通インターフェース
 */
interface SearchParams {
  q?: string;
  plan?: string[];
  status?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 検索パラメータをクエリ文字列に変換
 */
function toSearchQueryString(params: SearchParams): string {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set('q', params.q);
  if (params.plan && params.plan.length > 0) {
    searchParams.set('plan', params.plan.join(','));
  }
  if (params.status) searchParams.set('status', params.status);
  if (params.createdFrom) searchParams.set('createdFrom', params.createdFrom);
  if (params.createdTo) searchParams.set('createdTo', params.createdTo);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

// ============================================
// 管理者ユーザー一覧API
// ============================================

export const adminUsersApi = {
  /**
   * ユーザー一覧を取得
   */
  list: (params: AdminUserSearchParams = {}) =>
    api.get<AdminUserListResponse>(`/admin/users${toSearchQueryString(params)}`),

  /**
   * ユーザー詳細を取得
   */
  getById: (userId: string) =>
    api.get<AdminUserDetailResponse>(`/admin/users/${userId}`),
};

// ============================================
// 管理者組織一覧API
// ============================================

export const adminOrganizationsApi = {
  /**
   * 組織一覧を取得
   */
  list: (params: AdminOrganizationSearchParams = {}) =>
    api.get<AdminOrganizationListResponse>(`/admin/organizations${toSearchQueryString(params)}`),

  /**
   * 組織詳細を取得
   */
  getById: (organizationId: string) =>
    api.get<AdminOrganizationDetailResponse>(`/admin/organizations/${organizationId}`),
};
