import { Navigate, useParams, useSearchParams } from 'react-router';

/**
 * プロジェクト設定ページ（リダイレクト専用）
 * 設定タブはProjectDetailPageに統合されたため、このページはリダイレクトのみを行う
 */
export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'general';

  // ProjectDetailPageの設定タブにリダイレクト
  return <Navigate to={`/projects/${projectId}?tab=settings&section=${tab}`} replace />;
}
