import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  projectsApi,
  testSuitesApi,
  executionsApi,
  type TestSuite,
  type ExecutionWithDetails,
} from '../lib/api';

interface CurrentProject {
  id: string;
  name: string;
}

interface UseCurrentProjectResult {
  project: CurrentProject | null;
  isLoading: boolean;
}

/**
 * 現在のプロジェクトを取得するフック
 * URLパラメータからプロジェクト情報を判定する
 *
 * 対象ルート:
 * - /projects/:projectId -> URLから直接取得
 * - /projects/:projectId/settings -> URLから直接取得
 * - /test-suites/:testSuiteId -> テストスイートAPIからprojectIdを取得
 * - /executions/:executionId -> 実行APIからtestSuite.projectIdを取得
 */
export function useCurrentProject(): UseCurrentProjectResult {
  const params = useParams<{
    projectId?: string;
    testSuiteId?: string;
    executionId?: string;
  }>();
  const queryClient = useQueryClient();

  // キャッシュからprojectIdを取得（即座に利用可能な場合）
  const cachedProjectId = (() => {
    if (params.projectId) {
      return params.projectId;
    }

    if (params.testSuiteId) {
      const cached = queryClient.getQueryData<{ testSuite: TestSuite }>([
        'test-suite',
        params.testSuiteId,
      ]);
      return cached?.testSuite?.projectId;
    }

    if (params.executionId) {
      const cached = queryClient.getQueryData<{
        execution: ExecutionWithDetails;
      }>(['execution', params.executionId, 'details']);
      return cached?.execution?.testSuite?.projectId;
    }

    return undefined;
  })();

  // テストスイートからprojectIdを取得（キャッシュミス時）
  const { data: testSuiteData, isLoading: isLoadingTestSuite } = useQuery({
    queryKey: ['test-suite', params.testSuiteId],
    queryFn: () => testSuitesApi.getById(params.testSuiteId!),
    enabled: !!params.testSuiteId && !cachedProjectId,
    staleTime: 5 * 60 * 1000,
  });

  // 実行からprojectIdを取得（キャッシュミス時）
  const { data: executionData, isLoading: isLoadingExecution } = useQuery({
    queryKey: ['execution', params.executionId, 'details'],
    queryFn: () => executionsApi.getByIdWithDetails(params.executionId!),
    enabled: !!params.executionId && !cachedProjectId,
    staleTime: 5 * 60 * 1000,
  });

  // 最終的なprojectIdを決定
  const resolvedProjectId = (() => {
    // URLから直接取得できる場合
    if (params.projectId) {
      return params.projectId;
    }

    // キャッシュから取得できた場合
    if (cachedProjectId) {
      return cachedProjectId;
    }

    // APIから取得した場合
    if (params.testSuiteId && testSuiteData?.testSuite?.projectId) {
      return testSuiteData.testSuite.projectId;
    }

    if (params.executionId && executionData?.execution?.testSuite?.projectId) {
      return executionData.execution.testSuite.projectId;
    }

    return undefined;
  })();

  // プロジェクト情報を取得
  const { data: projectData, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project', resolvedProjectId],
    queryFn: () => projectsApi.getById(resolvedProjectId!),
    enabled: !!resolvedProjectId,
    staleTime: 5 * 60 * 1000,
  });

  // ローディング状態を統合
  const isLoading =
    (!!params.testSuiteId && !cachedProjectId && isLoadingTestSuite) ||
    (!!params.executionId && !cachedProjectId && isLoadingExecution) ||
    (!!resolvedProjectId && isLoadingProject);

  if (!resolvedProjectId || !projectData?.project) {
    return { project: null, isLoading };
  }

  return {
    project: {
      id: projectData.project.id,
      name: projectData.project.name,
    },
    isLoading: false,
  };
}
