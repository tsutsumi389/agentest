import type { APIRequestContext } from '@playwright/test';

// E2Eテスト用の共通ヘッダー（レートリミットをバイパス）
const E2E_HEADERS = {
  'X-E2E-Test': 'true',
};

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
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async deleteProject(projectId: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/projects/${projectId}`, {
      headers: E2E_HEADERS,
    });
    return response;
  }

  // テストスイート操作
  async createTestSuite(data: { name: string; description?: string; projectId: string }) {
    const response = await this.request.post(`${this.baseUrl}/api/test-suites`, {
      data,
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async getTestSuite(testSuiteId: string) {
    const response = await this.request.get(`${this.baseUrl}/api/test-suites/${testSuiteId}`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async deleteTestSuite(projectId: string, testSuiteId: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/test-suites/${testSuiteId}`, {
      headers: E2E_HEADERS,
    });
    return response;
  }

  async getTestSuiteExecutions(testSuiteId: string, options?: { limit?: number }) {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await this.request.get(
      `${this.baseUrl}/api/test-suites/${testSuiteId}/executions${query}`,
      { headers: E2E_HEADERS },
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
    const response = await this.request.post(`${this.baseUrl}/api/test-cases`, {
      data,
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async getTestCase(testCaseId: string) {
    const response = await this.request.get(`${this.baseUrl}/api/test-cases/${testCaseId}`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async updateTestCase(
    testCaseId: string,
    data: { title?: string; description?: string; priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' },
  ) {
    const response = await this.request.patch(`${this.baseUrl}/api/test-cases/${testCaseId}`, {
      data,
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async deleteTestCase(projectId: string, testSuiteId: string, testCaseId: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/test-cases/${testCaseId}`, {
      headers: E2E_HEADERS,
    });
    return response;
  }

  async restoreTestCase(testCaseId: string) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/restore`,
      { headers: E2E_HEADERS },
    );
    return response.json();
  }

  async copyTestCase(testCaseId: string, data?: { targetTestSuiteId?: string }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/copy`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async reorderTestCases(testSuiteId: string, testCaseIds: string[]) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-suites/${testSuiteId}/test-cases/reorder`,
      { data: { testCaseIds }, headers: E2E_HEADERS },
    );
    return response.json();
  }

  // 前提条件操作
  async addPrecondition(testCaseId: string, data: { content: string }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/preconditions`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async updatePrecondition(testCaseId: string, preconditionId: string, data: { content: string }) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/test-cases/${testCaseId}/preconditions/${preconditionId}`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async deletePrecondition(testCaseId: string, preconditionId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/test-cases/${testCaseId}/preconditions/${preconditionId}`,
      { headers: E2E_HEADERS },
    );
    return response;
  }

  async reorderPreconditions(testCaseId: string, preconditionIds: string[]) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/preconditions/reorder`,
      { data: { preconditionIds }, headers: E2E_HEADERS },
    );
    return response.json();
  }

  // ステップ操作
  async addStep(testCaseId: string, data: { content: string }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/steps`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async updateStep(testCaseId: string, stepId: string, data: { content: string }) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/test-cases/${testCaseId}/steps/${stepId}`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async deleteStep(testCaseId: string, stepId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/test-cases/${testCaseId}/steps/${stepId}`,
      { headers: E2E_HEADERS },
    );
    return response;
  }

  async reorderSteps(testCaseId: string, stepIds: string[]) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/steps/reorder`,
      { data: { stepIds }, headers: E2E_HEADERS },
    );
    return response.json();
  }

  // 期待結果操作
  async addExpectedResult(testCaseId: string, data: { content: string }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/expected-results`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async updateExpectedResult(testCaseId: string, expectedResultId: string, data: { content: string }) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/test-cases/${testCaseId}/expected-results/${expectedResultId}`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async deleteExpectedResult(testCaseId: string, expectedResultId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/test-cases/${testCaseId}/expected-results/${expectedResultId}`,
      { headers: E2E_HEADERS },
    );
    return response;
  }

  async reorderExpectedResults(testCaseId: string, expectedResultIds: string[]) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-cases/${testCaseId}/expected-results/reorder`,
      { data: { expectedResultIds }, headers: E2E_HEADERS },
    );
    return response.json();
  }

  // 実行操作
  async startExecution(testSuiteId: string, data?: { environmentId?: string }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-suites/${testSuiteId}/executions`,
      { data: data || {}, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async getExecution(executionId: string) {
    const response = await this.request.get(`${this.baseUrl}/api/executions/${executionId}`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async getExecutionWithDetails(executionId: string) {
    const response = await this.request.get(
      `${this.baseUrl}/api/executions/${executionId}/details`,
      { headers: E2E_HEADERS },
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
      { data, headers: E2E_HEADERS },
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
      { data, headers: E2E_HEADERS },
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
      { data, headers: E2E_HEADERS },
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
        headers: E2E_HEADERS,
      },
    );
    return response.json();
  }

  async deleteEvidence(executionId: string, evidenceId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/executions/${executionId}/evidences/${evidenceId}`,
      { headers: E2E_HEADERS },
    );
    return response;
  }

  async getEvidenceDownloadUrl(executionId: string, evidenceId: string) {
    const response = await this.request.get(
      `${this.baseUrl}/api/executions/${executionId}/evidences/${evidenceId}/download-url`,
      { headers: E2E_HEADERS },
    );
    return response.json();
  }

  // 編集ロック操作
  async getLockStatus(targetType: 'SUITE' | 'CASE', targetId: string) {
    const response = await this.request.get(
      `${this.baseUrl}/api/locks?targetType=${targetType}&targetId=${targetId}`,
      { headers: E2E_HEADERS },
    );
    return response.json();
  }

  async acquireLock(data: { targetType: 'SUITE' | 'CASE'; targetId: string }) {
    const response = await this.request.post(`${this.baseUrl}/api/locks`, {
      data,
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async releaseLock(lockId: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/locks/${lockId}`, {
      headers: E2E_HEADERS,
    });
    return response;
  }

  async heartbeatLock(lockId: string) {
    const response = await this.request.patch(`${this.baseUrl}/api/locks/${lockId}/heartbeat`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  // =====================
  // 組織管理
  // =====================

  async createOrganization(data: { name: string; description?: string }) {
    const response = await this.request.post(`${this.baseUrl}/api/organizations`, {
      data,
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async getOrganization(organizationId: string) {
    const response = await this.request.get(`${this.baseUrl}/api/organizations/${organizationId}`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async updateOrganization(
    organizationId: string,
    data: { name?: string; description?: string | null; billingEmail?: string | null },
  ) {
    const response = await this.request.patch(`${this.baseUrl}/api/organizations/${organizationId}`, {
      data,
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async deleteOrganization(organizationId: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/organizations/${organizationId}`, {
      headers: E2E_HEADERS,
    });
    return response;
  }

  async restoreOrganization(organizationId: string) {
    const response = await this.request.post(
      `${this.baseUrl}/api/organizations/${organizationId}/restore`,
      { headers: E2E_HEADERS },
    );
    return response.json();
  }

  // 組織メンバー管理
  async getOrganizationMembers(organizationId: string) {
    const response = await this.request.get(
      `${this.baseUrl}/api/organizations/${organizationId}/members`,
      { headers: E2E_HEADERS },
    );
    return response.json();
  }

  async updateMemberRole(organizationId: string, memberId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
    const response = await this.request.patch(
      `${this.baseUrl}/api/organizations/${organizationId}/members/${memberId}`,
      { data: { role }, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async removeMember(organizationId: string, memberId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/organizations/${organizationId}/members/${memberId}`,
      { headers: E2E_HEADERS },
    );
    return response;
  }

  // 招待管理
  async inviteMember(organizationId: string, data: { email: string; role: 'ADMIN' | 'MEMBER' }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/organizations/${organizationId}/invitations`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async getInvitations(organizationId: string) {
    const response = await this.request.get(
      `${this.baseUrl}/api/organizations/${organizationId}/invitations`,
      { headers: E2E_HEADERS },
    );
    return response.json();
  }

  async resendInvitation(organizationId: string, invitationId: string) {
    const response = await this.request.post(
      `${this.baseUrl}/api/organizations/${organizationId}/invitations/${invitationId}/resend`,
      { headers: E2E_HEADERS },
    );
    return response.json();
  }

  async cancelInvitation(organizationId: string, invitationId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/organizations/${organizationId}/invitations/${invitationId}`,
      { headers: E2E_HEADERS },
    );
    return response;
  }

  // 監査ログ
  async getAuditLogs(organizationId: string, params?: { limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await this.request.get(
      `${this.baseUrl}/api/organizations/${organizationId}/audit-logs${query}`,
      { headers: E2E_HEADERS },
    );
    return response.json();
  }

  // =====================
  // ユーザー設定
  // =====================

  async getUserProfile() {
    const response = await this.request.get(`${this.baseUrl}/api/users/me`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async updateUserProfile(data: { name?: string }) {
    const response = await this.request.patch(`${this.baseUrl}/api/users/me`, {
      data,
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  // セッション管理
  async getSessions() {
    const response = await this.request.get(`${this.baseUrl}/api/sessions`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async revokeSession(sessionId: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/sessions/${sessionId}`, {
      headers: E2E_HEADERS,
    });
    return response;
  }

  async revokeOtherSessions() {
    const response = await this.request.delete(`${this.baseUrl}/api/sessions`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  // APIトークン管理
  async createApiToken(data: { name: string; expiresInDays?: number }) {
    const response = await this.request.post(`${this.baseUrl}/api/api-tokens`, {
      data,
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async getApiTokens() {
    const response = await this.request.get(`${this.baseUrl}/api/api-tokens`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async revokeApiToken(tokenId: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/api-tokens/${tokenId}`, {
      headers: E2E_HEADERS,
    });
    return response;
  }

  // =====================
  // プロジェクト設定
  // =====================

  async updateProject(projectId: string, data: { name?: string; description?: string | null }) {
    const response = await this.request.patch(`${this.baseUrl}/api/projects/${projectId}`, {
      data,
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  // 環境管理
  async createEnvironment(projectId: string, data: { name: string; description?: string }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/projects/${projectId}/environments`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async getEnvironments(projectId: string) {
    const response = await this.request.get(
      `${this.baseUrl}/api/projects/${projectId}/environments`,
      { headers: E2E_HEADERS },
    );
    return response.json();
  }

  async updateEnvironment(
    projectId: string,
    environmentId: string,
    data: { name?: string; description?: string | null },
  ) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/projects/${projectId}/environments/${environmentId}`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async deleteEnvironment(projectId: string, environmentId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/projects/${projectId}/environments/${environmentId}`,
      { headers: E2E_HEADERS },
    );
    return response;
  }

  // ラベル管理
  async createLabel(projectId: string, data: { name: string; color: string; description?: string | null }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/projects/${projectId}/labels`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async getLabels(projectId: string) {
    const response = await this.request.get(`${this.baseUrl}/api/projects/${projectId}/labels`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async updateLabel(
    projectId: string,
    labelId: string,
    data: { name?: string; color?: string; description?: string | null },
  ) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/projects/${projectId}/labels/${labelId}`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }

  async deleteLabel(projectId: string, labelId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/projects/${projectId}/labels/${labelId}`,
      { headers: E2E_HEADERS },
    );
    return response;
  }

  // 削除済みテストスイートの復元
  async restoreTestSuite(testSuiteId: string) {
    const response = await this.request.post(
      `${this.baseUrl}/api/test-suites/${testSuiteId}/restore`,
      { headers: E2E_HEADERS },
    );
    return response.json();
  }

  async getDeletedTestSuites(projectId: string) {
    const response = await this.request.get(
      `${this.baseUrl}/api/projects/${projectId}/test-suites?deleted=true`,
      { headers: E2E_HEADERS },
    );
    return response.json();
  }

  // =====================
  // 通知
  // =====================

  async getNotifications(params?: { limit?: number; offset?: number; unreadOnly?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.unreadOnly) searchParams.set('unreadOnly', 'true');
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await this.request.get(`${this.baseUrl}/api/notifications${query}`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async markNotificationAsRead(notificationId: string) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/notifications/${notificationId}/read`,
      { headers: E2E_HEADERS },
    );
    return response.json();
  }

  async markAllNotificationsAsRead() {
    const response = await this.request.post(`${this.baseUrl}/api/notifications/read-all`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async deleteNotification(notificationId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/notifications/${notificationId}`,
      { headers: E2E_HEADERS },
    );
    return response;
  }

  // 通知設定
  async getNotificationPreferences() {
    const response = await this.request.get(`${this.baseUrl}/api/notifications/preferences`, {
      headers: E2E_HEADERS,
    });
    return response.json();
  }

  async updateNotificationPreference(
    type: string,
    data: { emailEnabled?: boolean; inAppEnabled?: boolean },
  ) {
    const response = await this.request.patch(
      `${this.baseUrl}/api/notifications/preferences/${type}`,
      { data, headers: E2E_HEADERS },
    );
    return response.json();
  }
}
