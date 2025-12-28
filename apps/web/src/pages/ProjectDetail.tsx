import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderKanban,
  Plus,
  FileText,
  Play,
  MoreHorizontal,
  ChevronLeft,
  Settings,
} from 'lucide-react';
import { projectsApi, testSuitesApi, type TestSuite } from '../lib/api';

/**
 * プロジェクト詳細ページ
 */
export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // プロジェクト情報を取得
  const { data: projectData, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(projectId!),
    enabled: !!projectId,
  });

  // テストスイート一覧を取得
  const { data: suitesData, isLoading: isLoadingSuites } = useQuery({
    queryKey: ['project-test-suites', projectId],
    queryFn: () => projectsApi.getTestSuites(projectId!),
    enabled: !!projectId,
  });

  const project = projectData?.project;
  const testSuites = suitesData?.testSuites || [];

  if (isLoadingProject) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">読み込み中...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">プロジェクトが見つかりません</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          プロジェクト一覧
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent-subtle flex items-center justify-center">
              <FolderKanban className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              <p className="text-foreground-muted">
                {project.description || '説明なし'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/projects/${projectId}/settings`}
              className="btn btn-ghost"
            >
              <Settings className="w-4 h-4" />
              設定
            </Link>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4" />
              テストスイート
            </button>
          </div>
        </div>
      </div>

      {/* テストスイート一覧 */}
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">テストスイート</h2>
        </div>

        {isLoadingSuites ? (
          <div className="p-8 text-center text-foreground-muted">
            読み込み中...
          </div>
        ) : testSuites.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
            <p className="text-foreground-muted mb-4">
              テストスイートがありません
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4" />
              テストスイートを作成
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {testSuites.map((suite) => (
              <TestSuiteRow key={suite.id} suite={suite} />
            ))}
          </div>
        )}
      </div>

      {/* 作成モーダル */}
      {isCreateModalOpen && projectId && (
        <CreateTestSuiteModal
          projectId={projectId}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * テストスイート行
 */
function TestSuiteRow({ suite }: { suite: TestSuite }) {
  const statusColors = {
    DRAFT: 'badge-warning',
    ACTIVE: 'badge-success',
    ARCHIVED: 'badge',
  };

  const statusLabels = {
    DRAFT: '下書き',
    ACTIVE: '有効',
    ARCHIVED: 'アーカイブ',
  };

  return (
    <Link
      to={`/test-suites/${suite.id}`}
      className="flex items-center justify-between p-4 hover:bg-background-tertiary transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded bg-background-tertiary flex items-center justify-center">
          <FileText className="w-5 h-5 text-foreground-muted" />
        </div>
        <div>
          <p className="font-medium text-foreground">{suite.name}</p>
          <p className="text-sm text-foreground-muted">
            {suite._count?.testCases || 0} テストケース
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`badge ${statusColors[suite.status]}`}>
          {statusLabels[suite.status]}
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            // 実行開始
          }}
          className="btn btn-ghost p-2"
        >
          <Play className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            // メニュー表示
          }}
          className="btn btn-ghost p-2"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </Link>
  );
}

/**
 * テストスイート作成モーダル
 */
function CreateTestSuiteModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: { projectId: string; name: string; description?: string }) =>
      testSuitesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-test-suites', projectId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      projectId,
      name,
      description: description || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          新規テストスイート
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              スイート名 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="例: ログイン機能テスト"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              説明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[80px]"
              placeholder="テストスイートの説明を入力..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name || createMutation.isPending}
            >
              {createMutation.isPending ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
