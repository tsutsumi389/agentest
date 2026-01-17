import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  projectsApi,
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
 * URLパラメータとReact Queryキャッシュからプロジェクト情報を判定する
 *
 * 対象ルート:
 * - /projects/:projectId -> URLから直接取得
 * - /projects/:projectId/settings -> URLから直接取得
 * - /test-suites/:testSuiteId -> キャッシュからtestSuite.projectIdを取得
 * - /executions/:executionId -> キャッシュからexecution.testSuite.projectIdを取得
 */
export function useCurrentProject(): UseCurrentProjectResult {
  const params = useParams<{
    projectId?: string;
    testSuiteId?: string;
    executionId?: string;
  }>();
  const queryClient = useQueryClient();

  // URLパスからprojectIdを解決
  const resolvedProjectId = (() => {
    // /projects/:projectId または /projects/:projectId/settings
    if (params.projectId) {
      return params.projectId;
    }

    // /test-suites/:testSuiteId -> キャッシュからprojectIdを取得
    if (params.testSuiteId) {
      const cached = queryClient.getQueryData<{ testSuite: TestSuite }>([
        'test-suite',
        params.testSuiteId,
      ]);
      return cached?.testSuite?.projectId;
    }

    // /executions/:executionId -> キャッシュからprojectIdを取得
    if (params.executionId) {
      const cached = queryClient.getQueryData<{
        execution: ExecutionWithDetails;
      }>(['execution', params.executionId, 'details']);
      return cached?.execution?.testSuite?.projectId;
    }

    return undefined;
  })();

  // プロジェクト情報を取得（キャッシュから取得されることが多い）
  const { data, isLoading } = useQuery({
    queryKey: ['project', resolvedProjectId],
    queryFn: () => projectsApi.getById(resolvedProjectId!),
    enabled: !!resolvedProjectId,
    staleTime: 5 * 60 * 1000, // 5分間はfreshとみなす
  });

  if (!resolvedProjectId || !data?.project) {
    return { project: null, isLoading: !!resolvedProjectId && isLoading };
  }

  return {
    project: {
      id: data.project.id,
      name: data.project.name,
    },
    isLoading: false,
  };
}
