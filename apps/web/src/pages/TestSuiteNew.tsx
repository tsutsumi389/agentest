import { useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../lib/api';
import { TestSuiteForm } from '../components/test-suite/TestSuiteForm';
import { Breadcrumb } from '../components/ui/Breadcrumb';

/**
 * テストスイート新規作成ページ
 * /test-suites/new?projectId=xxx で表示
 */
export function TestSuiteNewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('projectId');

  // プロジェクト情報を取得（パンくずリスト用、キャッシュ済みなら即表示）
  // enabled で projectId の存在を保証しているため、queryFn 内では non-null
  const { data: projectData, error: projectError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(projectId as string),
    enabled: !!projectId,
  });

  const project = projectData?.project;

  // 作成成功時のコールバック
  const handleSave = useCallback(
    (createdTestSuiteId?: string) => {
      if (createdTestSuiteId) {
        navigate(`/test-suites/${createdTestSuiteId}`);
      }
    },
    [navigate]
  );

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
      <Breadcrumb
        showHome={false}
        items={[
          { label: project?.name || '読み込み中...', href: `/projects/${projectId}?tab=suites` },
          { label: '新規テストスイート作成' },
        ]}
      />

      {/* フォーム */}
      <div className="card max-w-2xl mx-auto">
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
