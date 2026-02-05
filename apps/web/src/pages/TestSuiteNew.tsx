import { useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { projectsApi } from '../lib/api';
import { TestSuiteForm } from '../components/test-suite/TestSuiteForm';

/**
 * テストスイート新規作成ページ
 * /test-suites/new?projectId=xxx で表示
 */
export function TestSuiteNewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('projectId');

  // プロジェクト情報を取得（パンくずリスト用、キャッシュ済みなら即表示）
  const { data: projectData, error: projectError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(projectId!),
    enabled: !!projectId,
  });

  const project = projectData?.project;

  // 作成成功時のコールバック
  const handleSave = useCallback((createdTestSuiteId?: string) => {
    if (createdTestSuiteId) {
      navigate(`/test-suites/${createdTestSuiteId}`);
    }
  }, [navigate]);

  // キャンセル時のコールバック
  const handleCancel = useCallback(() => {
    navigate(`/projects/${projectId}?tab=suites`);
  }, [navigate, projectId]);

  // projectId未指定時のエラー表示
  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">プロジェクトが指定されていません</div>
      </div>
    );
  }

  // プロジェクト読み込みエラー時の表示
  if (projectError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">プロジェクトの読み込みに失敗しました</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* パンくずリスト */}
      <nav className="flex items-center gap-1 text-sm text-foreground-muted">
        <Link to={`/projects/${projectId}?tab=suites`} className="hover:text-foreground transition-colors">
          {project?.name || '読み込み中...'}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground">新規テストスイート作成</span>
      </nav>

      {/* フォーム */}
      <div className="card min-h-[500px] max-h-[calc(100vh-200px)] overflow-hidden">
        <TestSuiteForm
          mode="create"
          projectId={projectId}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
