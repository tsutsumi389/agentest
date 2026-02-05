import type { APIRequestContext } from '@playwright/test';

/**
 * E2Eテスト用APIクライアント
 * APIに直接リクエストを送信してテストデータの作成・削除を行う
 */
export class TestApiClient {
  constructor(
    private request: APIRequestContext,
    private baseUrl: string,
  ) {}

  // プロジェクト操作
  async createProject(data: { name: string; description?: string; organizationId: string }) {
    const response = await this.request.post(`${this.baseUrl}/api/projects`, {
      data,
    });
    return response.json();
  }

  async deleteProject(projectId: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/projects/${projectId}`);
    return response;
  }

  // テストスイート操作
  async createTestSuite(data: { name: string; description?: string; projectId: string }) {
    const response = await this.request.post(`${this.baseUrl}/api/test-suites`, { data });
    return response.json();
  }

  async getTestSuite(testSuiteId: string) {
    const response = await this.request.get(`${this.baseUrl}/api/test-suites/${testSuiteId}`);
    return response.json();
  }

  async deleteTestSuite(projectId: string, testSuiteId: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/test-suites/${testSuiteId}`);
    return response;
  }

  async getTestSuiteExecutions(testSuiteId: string, options?: { limit?: number }) {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await this.request.get(
      `${this.baseUrl}/api/test-suites/${testSuiteId}/executions${query}`,
    );
    return response.json();
  }

  // テストケース操作
  async createTestCase(data: {
    title: string;
    description?: string;
    priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    testSuiteId: string;
    projectId: string;
  }) {
    const response = await this.request.post(`${this.baseUrl}/api/test-cases`, { data });
    return response.json();
  }

  async getTestCase(testCaseId: string) {
    const response = await this.request.get(`${this.baseUrl}/api/test-cases/${testCaseId}`);
    return response.json();
  }

  async updateTestCase(
    testCaseId: string,
    data: { title?: string; description?: string; priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' },
  ) {
    const response = await this.request.patch(`${this.baseUrl}/api/test-cases/${testCaseId}`, {
      data,
    });
    return response.json();
  }

  async deleteTestCase(projectId: string, testSuiteId: string, testCaseId: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/test-cases/${testCaseId}`);
    return response;
  }

  async restoreTestCase(testCaseId: string) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/restore`,
    );
    return response.json();
  }

  async copyTestCase(testCaseId: string, data?: { targetTestSuiteId?: string }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/copy`,
      { data },
    );
    return response.json();
  }

  async reorderTestCases(testSuiteId: string, testCaseIds: string[]) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-suites/${testSuiteId}/test-cases/reorder`,
      { data: { testCaseIds } },
    );
    return response.json();
  }

  // 前提条件操作
  async addPrecondition(testCaseId: string, data: { content: string }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/preconditions`,
      { data },
    );
    return response.json();
  }

  async updatePrecondition(testCaseId: string, preconditionId: string, data: { content: string }) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/test-cases/${testCaseId}/preconditions/${preconditionId}`,
      { data },
    );
    return response.json();
  }

  async deletePrecondition(testCaseId: string, preconditionId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/test-cases/${testCaseId}/preconditions/${preconditionId}`,
    );
    return response;
  }

  async reorderPreconditions(testCaseId: string, preconditionIds: string[]) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/preconditions/reorder`,
      { data: { preconditionIds } },
    );
    return response.json();
  }

  // ステップ操作
  async addStep(testCaseId: string, data: { content: string }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/steps`,
      { data },
    );
    return response.json();
  }

  async updateStep(testCaseId: string, stepId: string, data: { content: string }) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/test-cases/${testCaseId}/steps/${stepId}`,
      { data },
    );
    return response.json();
  }

  async deleteStep(testCaseId: string, stepId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/test-cases/${testCaseId}/steps/${stepId}`,
    );
    return response;
  }

  async reorderSteps(testCaseId: string, stepIds: string[]) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/steps/reorder`,
      { data: { stepIds } },
    );
    return response.json();
  }

  // 期待結果操作
  async addExpectedResult(testCaseId: string, data: { content: string }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/expected-results`,
      { data },
    );
    return response.json();
  }

  async updateExpectedResult(testCaseId: string, expectedResultId: string, data: { content: string }) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/test-cases/${testCaseId}/expected-results/${expectedResultId}`,
      { data },
    );
    return response.json();
  }

  async deleteExpectedResult(testCaseId: string, expectedResultId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/test-cases/${testCaseId}/expected-results/${expectedResultId}`,
    );
    return response;
  }

  async reorderExpectedResults(testCaseId: string, expectedResultIds: string[]) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/expected-results/reorder`,
      { data: { expectedResultIds } },
    );
    return response.json();
  }

  // 実行操作
  async startExecution(testSuiteId: string, data?: { environmentId?: string }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-suites/${testSuiteId}/executions`,
      { data: data || {} },
    );
    return response.json();
  }

  async getExecution(executionId: string) {
    const response = await this.request.get(`${this.baseUrl}/api/executions/${executionId}`);
    return response.json();
  }

  async getExecutionWithDetails(executionId: string) {
    const response = await this.request.get(
      `${this.baseUrl}/api/executions/${executionId}/details`,
    );
    return response.json();
  }

  async updatePreconditionResult(
    executionId: string,
    resultId: string,
    data: { status: string; note?: string },
  ) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/executions/${executionId}/preconditions/${resultId}`,
      { data },
    );
    return response.json();
  }

  async updateStepResult(
    executionId: string,
    resultId: string,
    data: { status: string; note?: string },
  ) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/executions/${executionId}/steps/${resultId}`,
      { data },
    );
    return response.json();
  }

  async updateExpectedResultResult(
    executionId: string,
    resultId: string,
    data: { status: string; note?: string },
  ) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/executions/${executionId}/expected-results/${resultId}`,
      { data },
    );
    return response.json();
  }

  async uploadEvidence(executionId: string, expectedResultId: string, filePath: string) {
    const response = await this.request.post(
      `${this.baseUrl}/api/executions/${executionId}/expected-results/${expectedResultId}/evidences`,
      {
        multipart: {
          file: {
            name: 'test-evidence.png',
            mimeType: 'image/png',
            buffer: Buffer.from('fake-image-data'),
          },
        },
      },
    );
    return response.json();
  }

  async deleteEvidence(executionId: string, evidenceId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/executions/${executionId}/evidences/${evidenceId}`,
    );
    return response;
  }

  async getEvidenceDownloadUrl(executionId: string, evidenceId: string) {
    const response = await this.request.get(
      `${this.baseUrl}/api/executions/${executionId}/evidences/${evidenceId}/download-url`,
    );
    return response.json();
  }

  // 編集ロック操作
  async getLockStatus(targetType: 'SUITE' | 'CASE', targetId: string) {
    const response = await this.request.get(
      `${this.baseUrl}/api/locks?targetType=${targetType}&targetId=${targetId}`,
    );
    return response.json();
  }

  async acquireLock(data: { targetType: 'SUITE' | 'CASE'; targetId: string }) {
    const response = await this.request.post(`${this.baseUrl}/api/locks`, { data });
    return response.json();
  }

  async releaseLock(lockId: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/locks/${lockId}`);
    return response;
  }

  async heartbeatLock(lockId: string) {
    const response = await this.request.patch(`${this.baseUrl}/api/locks/${lockId}/heartbeat`);
    return response.json();
  }
}
