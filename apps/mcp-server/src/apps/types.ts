/**
 * MCP Apps共通の型定義
 */

/**
 * テストスイート
 */
export interface TestSuite {
  id: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  projectId: string;
  project: {
    id: string;
    name: string;
  };
  createdByUser: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  _count: {
    testCases: number;
    preconditions: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * テストスイート検索レスポンス
 */
export interface SearchTestSuiteResponse {
  testSuites: TestSuite[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
