import { api } from './client.js';
import type {
  TestCase,
  TestCasePrecondition,
  TestCaseStep,
  TestCaseExpectedResult,
  TestCaseWithDetails,
  TestCaseHistoriesGroupedResponse,
} from './types.js';

// ============================================
// テストケースAPI
// ============================================

export const testCasesApi = {
  create: (data: { testSuiteId: string; title: string; description?: string; priority?: string; status?: string }) =>
    api.post<{ testCase: TestCase }>('/api/test-cases', data),
  getById: (testCaseId: string) => api.get<{ testCase: TestCase }>(`/api/test-cases/${testCaseId}`),
  getByIdWithDetails: (testCaseId: string) =>
    api.get<{ testCase: TestCaseWithDetails }>(`/api/test-cases/${testCaseId}`),
  update: (testCaseId: string, data: { title?: string; description?: string; priority?: string; status?: string; groupId?: string }) =>
    api.patch<{ testCase: TestCase }>(`/api/test-cases/${testCaseId}`, data),
  delete: (testCaseId: string) => api.delete<void>(`/api/test-cases/${testCaseId}`),

  // 前提条件管理
  getPreconditions: (testCaseId: string) =>
    api.get<{ preconditions: TestCasePrecondition[] }>(`/api/test-cases/${testCaseId}/preconditions`),
  addPrecondition: (testCaseId: string, data: { content: string; orderKey?: string; groupId?: string }) =>
    api.post<{ precondition: TestCasePrecondition }>(`/api/test-cases/${testCaseId}/preconditions`, data),
  updatePrecondition: (testCaseId: string, preconditionId: string, data: { content: string; groupId?: string }) =>
    api.patch<{ precondition: TestCasePrecondition }>(`/api/test-cases/${testCaseId}/preconditions/${preconditionId}`, data),
  deletePrecondition: (testCaseId: string, preconditionId: string, groupId?: string) =>
    api.delete<void>(`/api/test-cases/${testCaseId}/preconditions/${preconditionId}`, groupId ? { groupId } : undefined),
  reorderPreconditions: (testCaseId: string, preconditionIds: string[], groupId?: string) =>
    api.post<{ preconditions: TestCasePrecondition[] }>(`/api/test-cases/${testCaseId}/preconditions/reorder`, { preconditionIds, groupId }),

  // ステップ管理
  getSteps: (testCaseId: string) =>
    api.get<{ steps: TestCaseStep[] }>(`/api/test-cases/${testCaseId}/steps`),
  addStep: (testCaseId: string, data: { content: string; orderKey?: string; groupId?: string }) =>
    api.post<{ step: TestCaseStep }>(`/api/test-cases/${testCaseId}/steps`, data),
  updateStep: (testCaseId: string, stepId: string, data: { content: string; groupId?: string }) =>
    api.patch<{ step: TestCaseStep }>(`/api/test-cases/${testCaseId}/steps/${stepId}`, data),
  deleteStep: (testCaseId: string, stepId: string, groupId?: string) =>
    api.delete<void>(`/api/test-cases/${testCaseId}/steps/${stepId}`, groupId ? { groupId } : undefined),
  reorderSteps: (testCaseId: string, stepIds: string[], groupId?: string) =>
    api.post<{ steps: TestCaseStep[] }>(`/api/test-cases/${testCaseId}/steps/reorder`, { stepIds, groupId }),

  // 期待結果管理
  getExpectedResults: (testCaseId: string) =>
    api.get<{ expectedResults: TestCaseExpectedResult[] }>(`/api/test-cases/${testCaseId}/expected-results`),
  addExpectedResult: (testCaseId: string, data: { content: string; orderKey?: string; groupId?: string }) =>
    api.post<{ expectedResult: TestCaseExpectedResult }>(`/api/test-cases/${testCaseId}/expected-results`, data),
  updateExpectedResult: (testCaseId: string, expectedResultId: string, data: { content: string; groupId?: string }) =>
    api.patch<{ expectedResult: TestCaseExpectedResult }>(`/api/test-cases/${testCaseId}/expected-results/${expectedResultId}`, data),
  deleteExpectedResult: (testCaseId: string, expectedResultId: string, groupId?: string) =>
    api.delete<void>(`/api/test-cases/${testCaseId}/expected-results/${expectedResultId}`, groupId ? { groupId } : undefined),
  reorderExpectedResults: (testCaseId: string, expectedResultIds: string[], groupId?: string) =>
    api.post<{ expectedResults: TestCaseExpectedResult[] }>(`/api/test-cases/${testCaseId}/expected-results/reorder`, { expectedResultIds, groupId }),

  // 履歴管理（グループ化版）
  getHistories: (testCaseId: string, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const queryString = query.toString();
    return api.get<TestCaseHistoriesGroupedResponse>(
      `/api/test-cases/${testCaseId}/histories${queryString ? `?${queryString}` : ''}`
    );
  },

  // 復元
  restore: (testCaseId: string) =>
    api.post<{ testCase: TestCase }>(`/api/test-cases/${testCaseId}/restore`),

  // コピー
  copy: (testCaseId: string, data?: { title?: string; targetTestSuiteId?: string }) =>
    api.post<{ testCase: TestCase }>(`/api/test-cases/${testCaseId}/copy`, data),
};
