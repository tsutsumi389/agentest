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
  billingEmail: string | null;
  plan: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  // 組織一覧取得時にメンバー数が含まれる
  _count?: {
    members: number;
  };
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

// 招待詳細取得用の型（トークンベース）
export interface InvitationDetail {
  id: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  expiresAt: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  organization: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
  };
  invitedBy: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface AuditLog {
  id: string;
  organizationId: string | null;
  userId: string | null;
  category: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  } | null;
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

/** プロジェクトメンバーのロール */
export type ProjectMemberRole = 'ADMIN' | 'WRITE' | 'READ';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'OWNER' | ProjectMemberRole;
  addedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  _count?: { testCases: number; preconditions: number };
}

/** テストスイート前提条件 */
export interface Precondition {
  id: string;
  testSuiteId: string;
  content: string;
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

/** テストスイート変更タイプ */
export type TestSuiteChangeType = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';

/** テストスイート履歴 */
export interface TestSuiteHistory {
  id: string;
  testSuiteId: string;
  changeType: TestSuiteChangeType;
  snapshot: Record<string, unknown>;
  changeReason: string | null;
  createdAt: string;
  changedBy: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

/** テストスイート検索パラメータ */
export interface TestSuiteSearchParams {
  q?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdBy?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

/** プロジェクト履歴の変更タイプ */
export type ProjectChangeType = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';

/** プロジェクト履歴 */
export interface ProjectHistory {
  id: string;
  projectId: string;
  changeType: ProjectChangeType;
  snapshot: Record<string, unknown>;
  changeReason: string | null;
  createdAt: string;
  changedBy: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

/** プロジェクト環境 */
export interface ProjectEnvironment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  baseUrl: string | null;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** 環境作成リクエスト */
export interface CreateEnvironmentRequest {
  name: string;
  slug: string;
  baseUrl?: string | null;
  description?: string | null;
  isDefault?: boolean;
}

/** 環境更新リクエスト */
export interface UpdateEnvironmentRequest {
  name?: string;
  slug?: string;
  baseUrl?: string | null;
  description?: string | null;
  isDefault?: boolean;
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

/** プロジェクト検索オプション */
export interface GetProjectsOptions {
  q?: string;
  organizationId?: string | null;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

/** 拡張プロジェクト型（削除日時とロールを含む） */
export interface ProjectWithRole extends Project {
  deletedAt?: string | null;
  role?: 'OWNER' | 'ADMIN' | 'WRITE' | 'READ';
}

export const usersApi = {
  getOrganizations: (userId: string, options?: { includeDeleted?: boolean }) => {
    const query = new URLSearchParams();
    if (options?.includeDeleted) query.set('includeDeleted', 'true');
    const queryString = query.toString();
    return api.get<{ organizations: Array<{ organization: Organization; role: string }> }>(
      `/api/users/${userId}/organizations${queryString ? `?${queryString}` : ''}`
    );
  },
  getProjects: (userId: string, options?: GetProjectsOptions) => {
    const query = new URLSearchParams();
    if (options?.q) query.set('q', options.q);
    // organizationIdがnullの場合は個人プロジェクトのみ、undefinedの場合はフィルタなし
    if (options?.organizationId !== undefined) {
      query.set('organizationId', options.organizationId === null ? 'personal' : options.organizationId);
    }
    if (options?.includeDeleted) query.set('includeDeleted', 'true');
    if (options?.limit) query.set('limit', String(options.limit));
    if (options?.offset) query.set('offset', String(options.offset));
    const queryString = query.toString();
    return api.get<{ projects: ProjectWithRole[] }>(
      `/api/users/${userId}/projects${queryString ? `?${queryString}` : ''}`
    );
  },
  update: (userId: string, data: UpdateUserRequest) =>
    api.patch<{ user: User }>(`/api/users/${userId}`, data),
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

  // メンバー管理
  getMembers: (projectId: string) =>
    api.get<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`),
  addMember: (projectId: string, data: { email: string; role: 'ADMIN' | 'WRITE' | 'READ' }) =>
    api.post<{ member: ProjectMember }>(`/api/projects/${projectId}/members`, data),
  updateMemberRole: (projectId: string, userId: string, role: 'ADMIN' | 'WRITE' | 'READ') =>
    api.patch<{ member: ProjectMember }>(`/api/projects/${projectId}/members/${userId}`, { role }),
  removeMember: (projectId: string, userId: string) =>
    api.delete<void>(`/api/projects/${projectId}/members/${userId}`),

  // 環境管理
  getEnvironments: (projectId: string) =>
    api.get<{ environments: ProjectEnvironment[] }>(`/api/projects/${projectId}/environments`),
  createEnvironment: (projectId: string, data: CreateEnvironmentRequest) =>
    api.post<{ environment: ProjectEnvironment }>(`/api/projects/${projectId}/environments`, data),
  updateEnvironment: (projectId: string, environmentId: string, data: UpdateEnvironmentRequest) =>
    api.patch<{ environment: ProjectEnvironment }>(`/api/projects/${projectId}/environments/${environmentId}`, data),
  deleteEnvironment: (projectId: string, environmentId: string) =>
    api.delete<void>(`/api/projects/${projectId}/environments/${environmentId}`),
  reorderEnvironments: (projectId: string, environmentIds: string[]) =>
    api.post<{ environments: ProjectEnvironment[] }>(`/api/projects/${projectId}/environments/reorder`, { environmentIds }),

  // 履歴管理
  getHistories: (projectId: string, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const queryString = query.toString();
    return api.get<{ histories: ProjectHistory[]; total: number }>(
      `/api/projects/${projectId}/histories${queryString ? `?${queryString}` : ''}`
    );
  },

  // 復元
  restore: (projectId: string) =>
    api.post<{ project: Project }>(`/api/projects/${projectId}/restore`),

  // テストスイート検索
  searchTestSuites: (projectId: string, params?: TestSuiteSearchParams) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.status) query.set('status', params.status);
    if (params?.createdBy) query.set('createdBy', params.createdBy);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params?.includeDeleted) query.set('includeDeleted', 'true');
    const queryString = query.toString();
    return api.get<{ testSuites: TestSuite[]; total: number; limit: number; offset: number }>(
      `/api/projects/${projectId}/test-suites${queryString ? `?${queryString}` : ''}`
    );
  },
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

  // 前提条件管理
  getPreconditions: (testSuiteId: string) =>
    api.get<{ preconditions: Precondition[] }>(`/api/test-suites/${testSuiteId}/preconditions`),
  addPrecondition: (testSuiteId: string, data: { content: string; orderKey?: string }) =>
    api.post<{ precondition: Precondition }>(`/api/test-suites/${testSuiteId}/preconditions`, data),
  updatePrecondition: (testSuiteId: string, preconditionId: string, data: { content: string }) =>
    api.patch<{ precondition: Precondition }>(`/api/test-suites/${testSuiteId}/preconditions/${preconditionId}`, data),
  deletePrecondition: (testSuiteId: string, preconditionId: string) =>
    api.delete<void>(`/api/test-suites/${testSuiteId}/preconditions/${preconditionId}`),
  reorderPreconditions: (testSuiteId: string, preconditionIds: string[]) =>
    api.post<{ preconditions: Precondition[] }>(`/api/test-suites/${testSuiteId}/preconditions/reorder`, { preconditionIds }),

  // 履歴管理
  getHistories: (testSuiteId: string, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const queryString = query.toString();
    return api.get<{ histories: TestSuiteHistory[]; total: number }>(
      `/api/test-suites/${testSuiteId}/histories${queryString ? `?${queryString}` : ''}`
    );
  },

  // 復元
  restore: (testSuiteId: string) =>
    api.post<{ testSuite: TestSuite }>(`/api/test-suites/${testSuiteId}/restore`),
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

// ============================================
// セッションAPI
// ============================================

export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface RevokeSessionsResult {
  success: boolean;
  revokedCount: number;
}

export const sessionsApi = {
  // セッション一覧を取得
  list: () => api.get<{ data: Session[] }>('/api/sessions'),
  // セッション数を取得
  count: () => api.get<{ data: { count: number } }>('/api/sessions/count'),
  // 特定のセッションを終了
  revoke: (sessionId: string) =>
    api.delete<{ data: { success: boolean } }>(`/api/sessions/${sessionId}`),
  // 他の全セッションを終了
  revokeOthers: () => api.delete<{ data: RevokeSessionsResult }>('/api/sessions'),
};

// ============================================
// OAuth連携アカウントAPI
// ============================================

export interface Account {
  id: string;
  provider: 'github' | 'google';
  providerAccountId: string;
  createdAt: string;
  updatedAt: string;
}

export const accountsApi = {
  // 連携一覧を取得
  list: (userId: string) => api.get<{ data: Account[] }>(`/api/users/${userId}/accounts`),
  // 連携を解除
  unlink: (userId: string, provider: string) =>
    api.delete<{ data: { success: boolean } }>(`/api/users/${userId}/accounts/${provider}`),
  // OAuth連携開始URL（フロントエンドでリダイレクト用）
  getLinkUrl: (provider: 'github' | 'google') => {
    // window.location.href でリダイレクトするため、APIサーバーのフルURLが必要
    const apiUrl = import.meta.env.VITE_API_URL || '';
    return `${apiUrl}/api/auth/${provider}/link`;
  },
};

// ============================================
// 組織API
// ============================================

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string | null;
  billingEmail?: string | null;
}

export interface InviteMemberRequest {
  email: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface AuditLogQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const organizationsApi = {
  // 組織を作成
  create: (data: CreateOrganizationRequest) =>
    api.post<{ organization: Organization }>('/api/organizations', data),

  // 組織詳細を取得
  getById: (organizationId: string) =>
    api.get<{ organization: Organization }>(`/api/organizations/${organizationId}`),

  // 組織を更新
  update: (organizationId: string, data: UpdateOrganizationRequest) =>
    api.patch<{ organization: Organization }>(`/api/organizations/${organizationId}`, data),

  // 組織を削除
  delete: (organizationId: string) =>
    api.delete<void>(`/api/organizations/${organizationId}`),

  // メンバー一覧を取得
  getMembers: (organizationId: string) =>
    api.get<{ members: OrganizationMember[] }>(`/api/organizations/${organizationId}/members`),

  // メンバーを招待
  invite: (organizationId: string, data: InviteMemberRequest) =>
    api.post<{ invitation: OrganizationInvitation }>(`/api/organizations/${organizationId}/invitations`, data),

  // 保留中の招待一覧を取得
  getInvitations: (organizationId: string) =>
    api.get<{ invitations: OrganizationInvitation[] }>(`/api/organizations/${organizationId}/invitations`),

  // 招待を取消
  cancelInvitation: (organizationId: string, invitationId: string) =>
    api.delete<void>(`/api/organizations/${organizationId}/invitations/${invitationId}`),

  // 招待詳細を取得（トークンベース、認証不要）
  getInvitationByToken: (token: string) =>
    api.get<{ invitation: InvitationDetail }>(`/api/organizations/invitations/${token}`),

  // 招待を承諾
  acceptInvitation: (token: string) =>
    api.post<{ member: OrganizationMember }>(`/api/organizations/invitations/${token}/accept`),

  // 招待を辞退
  declineInvitation: (token: string) =>
    api.post<{ invitation: OrganizationInvitation }>(`/api/organizations/invitations/${token}/decline`),

  // メンバーのロールを更新
  updateMemberRole: (organizationId: string, userId: string, role: 'ADMIN' | 'MEMBER') =>
    api.patch<{ member: OrganizationMember }>(`/api/organizations/${organizationId}/members/${userId}`, { role }),

  // メンバーを削除
  removeMember: (organizationId: string, userId: string) =>
    api.delete<void>(`/api/organizations/${organizationId}/members/${userId}`),

  // オーナー権限を移譲
  transferOwnership: (organizationId: string, newOwnerId: string) =>
    api.post<{ member: OrganizationMember }>(`/api/organizations/${organizationId}/transfer-ownership`, { newOwnerId }),

  // 監査ログを取得
  getAuditLogs: (organizationId: string, params?: AuditLogQueryParams) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.category) query.set('category', params.category);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const queryString = query.toString();
    return api.get<AuditLogResponse>(
      `/api/organizations/${organizationId}/audit-logs${queryString ? `?${queryString}` : ''}`
    );
  },

  // 組織のプロジェクト一覧を取得
  getProjects: (organizationId: string) =>
    api.get<{ projects: Project[] }>(`/api/organizations/${organizationId}/projects`),

  // 削除済み組織を復元
  restore: (organizationId: string) =>
    api.post<{ organization: Organization }>(`/api/organizations/${organizationId}/restore`),
};
