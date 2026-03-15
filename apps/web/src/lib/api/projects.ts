import { api } from './client.js';
import type {
  Project,
  ProjectMember,
  ProjectEnvironment,
  ProjectHistory,
  TestSuite,
  TestSuiteSearchParams,
  TestSuiteSuggestion,
  CreateEnvironmentRequest,
  UpdateEnvironmentRequest,
} from './types.js';
import type { ProjectDashboardStats } from '@agentest/shared';

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
  getDashboard: (projectId: string, params?: { environmentId?: string; labelIds?: string[] }) => {
    const query = new URLSearchParams();
    if (params?.environmentId) query.set('environmentId', params.environmentId);
    if (params?.labelIds?.length) query.set('labelIds', params.labelIds.join(','));
    const queryString = query.toString();
    return api.get<{ dashboard: ProjectDashboardStats }>(
      `/api/projects/${projectId}/dashboard${queryString ? `?${queryString}` : ''}`
    );
  },

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
    api.patch<{ environment: ProjectEnvironment }>(
      `/api/projects/${projectId}/environments/${environmentId}`,
      data
    ),
  deleteEnvironment: (projectId: string, environmentId: string) =>
    api.delete<void>(`/api/projects/${projectId}/environments/${environmentId}`),
  reorderEnvironments: (projectId: string, environmentIds: string[]) =>
    api.post<{ environments: ProjectEnvironment[] }>(
      `/api/projects/${projectId}/environments/reorder`,
      { environmentIds }
    ),

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
    if (params?.labelIds?.length) query.set('labelIds', params.labelIds.join(','));
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

  // テストスイートサジェスト（@メンション用）
  suggestTestSuites: (projectId: string, params?: { q?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const queryString = query.toString();
    return api.get<{ suggestions: TestSuiteSuggestion[] }>(
      `/api/projects/${projectId}/suggestions/test-suites${queryString ? `?${queryString}` : ''}`
    );
  },
};
