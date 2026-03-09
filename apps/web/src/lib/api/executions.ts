import { api, ApiError } from './client.js';
import type {
  Execution,
  ExecutionWithDetails,
  ExecutionPreconditionResult,
  ExecutionStepResult,
  ExecutionExpectedResult,
  ExecutionEvidence,
  UpdatePreconditionResultRequest,
  UpdateStepResultRequest,
  UpdateExpectedResultRequest,
} from './types.js';

// ============================================
// 実行API
// ============================================

export const executionsApi = {
  getById: (executionId: string) => api.get<{ execution: Execution }>(`/api/executions/${executionId}`),
  getByIdWithDetails: (executionId: string) =>
    api.get<{ execution: ExecutionWithDetails }>(`/api/executions/${executionId}/details`),

  // 結果更新
  updatePreconditionResult: (executionId: string, resultId: string, data: UpdatePreconditionResultRequest) =>
    api.patch<{ result: ExecutionPreconditionResult }>(
      `/api/executions/${executionId}/preconditions/${resultId}`,
      data
    ),
  updateStepResult: (executionId: string, resultId: string, data: UpdateStepResultRequest) =>
    api.patch<{ result: ExecutionStepResult }>(
      `/api/executions/${executionId}/steps/${resultId}`,
      data
    ),
  updateExpectedResult: (executionId: string, resultId: string, data: UpdateExpectedResultRequest) =>
    api.patch<{ result: ExecutionExpectedResult }>(
      `/api/executions/${executionId}/expected-results/${resultId}`,
      data
    ),

  // エビデンス管理
  uploadEvidence: async (
    executionId: string,
    expectedResultId: string,
    file: File,
    description?: string
  ): Promise<{ evidence: ExecutionEvidence }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
    const url = `${API_BASE_URL}/api/executions/${executionId}/expected-results/${expectedResultId}/evidences`;

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');
      const data = isJson ? await response.json() : null;
      const error = data?.error || {};
      throw new ApiError(
        response.status,
        error.code || 'UNKNOWN_ERROR',
        error.message || 'エビデンスのアップロードに失敗しました',
        error.details
      );
    }

    return response.json();
  },

  deleteEvidence: (executionId: string, evidenceId: string) =>
    api.delete<void>(`/api/executions/${executionId}/evidences/${evidenceId}`),

  getEvidenceDownloadUrl: (executionId: string, evidenceId: string) =>
    api.get<{ downloadUrl: string }>(`/api/executions/${executionId}/evidences/${evidenceId}/download-url`),
};
