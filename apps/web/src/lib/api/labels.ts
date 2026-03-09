import { api } from './client.js';
import type {
  Label,
  CreateLabelRequest,
  UpdateLabelRequest,
} from './types.js';

// ============================================
// ラベルAPI
// ============================================

export const labelsApi = {
  // プロジェクトのラベル一覧を取得
  getByProject: (projectId: string) =>
    api.get<{ labels: Label[] }>(`/api/projects/${projectId}/labels`),

  // ラベルを作成
  create: (projectId: string, data: CreateLabelRequest) =>
    api.post<{ label: Label }>(`/api/projects/${projectId}/labels`, data),

  // ラベルを更新
  update: (projectId: string, labelId: string, data: UpdateLabelRequest) =>
    api.patch<{ label: Label }>(`/api/projects/${projectId}/labels/${labelId}`, data),

  // ラベルを削除
  delete: (projectId: string, labelId: string) =>
    api.delete<void>(`/api/projects/${projectId}/labels/${labelId}`),

  // テストスイートのラベル一覧を取得
  getByTestSuite: (testSuiteId: string) =>
    api.get<{ labels: Label[] }>(`/api/test-suites/${testSuiteId}/labels`),

  // テストスイートのラベルを更新
  updateTestSuiteLabels: (testSuiteId: string, labelIds: string[]) =>
    api.put<{ labels: Label[] }>(`/api/test-suites/${testSuiteId}/labels`, { labelIds }),
};
