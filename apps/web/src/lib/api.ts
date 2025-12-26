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
interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

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

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};

// ============================================
// API型定義
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  plan: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  organization?: { id: string; name: string; slug: string } | null;
  owner?: { id: string; name: string; avatarUrl: string | null } | null;
  _count?: { testSuites: number };
}

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  _count?: { testCases: number; preconditions: number };
}

export interface TestCase {
  id: string;
  testSuiteId: string;
  title: string;
  description: string | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Execution {
  id: string;
  testSuiteId: string;
  environmentId: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';
  startedAt: string;
  completedAt: string | null;
  executedByUser?: { id: string; name: string; avatarUrl: string | null };
  environment?: { id: string; name: string; slug: string };
}

// ============================================
// 認証API
// ============================================

export const authApi = {
  me: () => api.get<{ user: User }>('/api/auth/me'),
  refresh: () => api.post<{ accessToken: string; refreshToken: string }>('/api/auth/refresh'),
  logout: () => api.post<{ message: string }>('/api/auth/logout'),
};

// ============================================
// ユーザーAPI
// ============================================

export interface UpdateUserRequest {
  name?: string;
  avatarUrl?: string | null;
}

export const usersApi = {
  getOrganizations: (userId: string) =>
    api.get<{ organizations: Array<{ organization: Organization; role: string }> }>(`/api/users/${userId}/organizations`),
  getProjects: (userId: string) => api.get<{ projects: Project[] }>(`/api/users/${userId}/projects`),
  update: (userId: string, data: UpdateUserRequest) =>
    api.put<{ data: User }>(`/api/users/${userId}`, data),
};

// ============================================
// プロジェクトAPI
// ============================================

export const projectsApi = {
  create: (data: { name: string; description?: string; organizationId?: string }) =>
    api.post<{ project: Project }>('/api/projects', data),
  getById: (projectId: string) => api.get<{ project: Project }>(`/api/projects/${projectId}`),
  update: (projectId: string, data: { name?: string; description?: string }) =>
    api.patch<{ project: Project }>(`/api/projects/${projectId}`, data),
  delete: (projectId: string) => api.delete<void>(`/api/projects/${projectId}`),
  getTestSuites: (projectId: string) =>
    api.get<{ testSuites: TestSuite[] }>(`/api/projects/${projectId}/test-suites`),
};

// ============================================
// テストスイートAPI
// ============================================

export const testSuitesApi = {
  create: (data: { projectId: string; name: string; description?: string }) =>
    api.post<{ testSuite: TestSuite }>('/api/test-suites', data),
  getById: (testSuiteId: string) => api.get<{ testSuite: TestSuite }>(`/api/test-suites/${testSuiteId}`),
  update: (testSuiteId: string, data: { name?: string; description?: string; status?: string }) =>
    api.patch<{ testSuite: TestSuite }>(`/api/test-suites/${testSuiteId}`, data),
  delete: (testSuiteId: string) => api.delete<void>(`/api/test-suites/${testSuiteId}`),
  getTestCases: (testSuiteId: string) =>
    api.get<{ testCases: TestCase[] }>(`/api/test-suites/${testSuiteId}/test-cases`),
  getExecutions: (testSuiteId: string, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryString = query.toString();
    return api.get<{ executions: Execution[] }>(
      `/api/test-suites/${testSuiteId}/executions${queryString ? `?${queryString}` : ''}`
    );
  },
  startExecution: (testSuiteId: string, data?: { environmentId?: string }) =>
    api.post<{ execution: Execution }>(`/api/test-suites/${testSuiteId}/executions`, data),
};

// ============================================
// テストケースAPI
// ============================================

export const testCasesApi = {
  create: (data: { testSuiteId: string; title: string; description?: string; priority?: string }) =>
    api.post<{ testCase: TestCase }>('/api/test-cases', data),
  getById: (testCaseId: string) => api.get<{ testCase: TestCase }>(`/api/test-cases/${testCaseId}`),
  update: (testCaseId: string, data: { title?: string; description?: string; priority?: string; status?: string }) =>
    api.patch<{ testCase: TestCase }>(`/api/test-cases/${testCaseId}`, data),
  delete: (testCaseId: string) => api.delete<void>(`/api/test-cases/${testCaseId}`),
};

// ============================================
// 実行API
// ============================================

export const executionsApi = {
  getById: (executionId: string) => api.get<{ execution: Execution }>(`/api/executions/${executionId}`),
  abort: (executionId: string) => api.post<{ execution: Execution }>(`/api/executions/${executionId}/abort`),
  complete: (executionId: string) => api.post<{ execution: Execution }>(`/api/executions/${executionId}/complete`),
};
