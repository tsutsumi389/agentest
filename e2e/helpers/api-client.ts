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
    const response = await this.request.post(`${this.baseUrl}/api/v1/projects`, {
      data,
    });
    return response.json();
  }

  async deleteProject(projectId: string) {
    const response = await this.request.delete(`${this.baseUrl}/api/v1/projects/${projectId}`);
    return response;
  }

  // テストスイート操作
  async createTestSuite(data: { name: string; description?: string; projectId: string }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/v1/projects/${data.projectId}/test-suites`,
      { data },
    );
    return response.json();
  }

  async deleteTestSuite(projectId: string, testSuiteId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/v1/projects/${projectId}/test-suites/${testSuiteId}`,
    );
    return response;
  }

  // テストケース操作
  async createTestCase(data: {
    title: string;
    description?: string;
    testSuiteId: string;
    projectId: string;
  }) {
    const response = await this.request.post(
      `${this.baseUrl}/api/v1/projects/${data.projectId}/test-suites/${data.testSuiteId}/test-cases`,
      { data },
    );
    return response.json();
  }

  async deleteTestCase(projectId: string, testSuiteId: string, testCaseId: string) {
    const response = await this.request.delete(
      `${this.baseUrl}/api/v1/projects/${projectId}/test-suites/${testSuiteId}/test-cases/${testCaseId}`,
    );
    return response;
  }
}
