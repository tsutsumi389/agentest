import { api } from './client.js';
import type {
  TestSuite,
  TestCase,
  Precondition,
  Execution,
  ExecutionSearchParams,
  ExecutionSearchResponse,
  TestSuiteHistoriesGroupedResponse,
  TestCaseSuggestion,
} from './types.js';

// ============================================
// テストスイートAPI
// ============================================

export const testSuitesApi = {
  create: (data: { projectId: string; name: string; description?: string; status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' }) =>
    api.post<{ testSuite: TestSuite }>('/api/test-suites', data),
  getById: (testSuiteId: string) => api.get<{ testSuite: TestSuite }>(`/api/test-suites/${testSuiteId}`),
  update: (testSuiteId: string, data: { name?: string; description?: string; status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'; groupId?: string }) =>
    api.patch<{ testSuite: TestSuite }>(`/api/test-suites/${testSuiteId}`, data),
  delete: (testSuiteId: string, options?: { groupId?: string }) =>
    api.delete<void>(`/api/test-suites/${testSuiteId}`, options),
  getTestCases: (testSuiteId: string, params?: { status?: string; includeDeleted?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.includeDeleted) query.set('includeDeleted', 'true');
    const queryString = query.toString();
    return api.get<{ testCases: TestCase[]; total: number }>(
      `/api/test-suites/${testSuiteId}/test-cases${queryString ? `?${queryString}` : ''}`
    );
  },
  getExecutions: (testSuiteId: string, params?: ExecutionSearchParams) => {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.environmentId) query.set('environmentId', params.environmentId);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
    const queryString = query.toString();
    return api.get<ExecutionSearchResponse>(
      `/api/test-suites/${testSuiteId}/executions${queryString ? `?${queryString}` : ''}`
    );
  },
  startExecution: (testSuiteId: string, data?: { environmentId?: string }) =>
    api.post<{ execution: Execution }>(`/api/test-suites/${testSuiteId}/executions`, data),

  // 前提条件管理
  getPreconditions: (testSuiteId: string) =>
    api.get<{ preconditions: Precondition[] }>(`/api/test-suites/${testSuiteId}/preconditions`),
  addPrecondition: (testSuiteId: string, data: { content: string; orderKey?: string; groupId?: string }) =>
    api.post<{ precondition: Precondition }>(`/api/test-suites/${testSuiteId}/preconditions`, data),
  updatePrecondition: (testSuiteId: string, preconditionId: string, data: { content: string; groupId?: string }) =>
    api.patch<{ precondition: Precondition }>(`/api/test-suites/${testSuiteId}/preconditions/${preconditionId}`, data),
  deletePrecondition: (testSuiteId: string, preconditionId: string, options?: { groupId?: string }) =>
    api.delete<void>(`/api/test-suites/${testSuiteId}/preconditions/${preconditionId}`, options),
  reorderPreconditions: (testSuiteId: string, preconditionIds: string[], options?: { groupId?: string }) =>
    api.post<{ preconditions: Precondition[] }>(`/api/test-suites/${testSuiteId}/preconditions/reorder`, { preconditionIds, ...options }),

  // 履歴管理（グループ化版）
  getHistories: (testSuiteId: string, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const queryString = query.toString();
    return api.get<TestSuiteHistoriesGroupedResponse>(
      `/api/test-suites/${testSuiteId}/histories${queryString ? `?${queryString}` : ''}`
    );
  },

  // 復元
  restore: (testSuiteId: string, options?: { groupId?: string }) =>
    api.post<{ testSuite: TestSuite }>(`/api/test-suites/${testSuiteId}/restore`, options),

  // テストケースサジェスト（@メンション用）
  suggestTestCases: (testSuiteId: string, params?: { q?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const queryString = query.toString();
    return api.get<{ suggestions: TestCaseSuggestion[] }>(
      `/api/test-suites/${testSuiteId}/suggestions/test-cases${queryString ? `?${queryString}` : ''}`
    );
  },

  // テストケース並び替え
  reorderTestCases: (testSuiteId: string, testCaseIds: string[], options?: { groupId?: string }) =>
    api.post<{ testCases: TestCase[] }>(`/api/test-suites/${testSuiteId}/test-cases/reorder`, { testCaseIds, ...options }),
};
