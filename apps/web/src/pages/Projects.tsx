import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { FolderKanban, Plus, Search, MoreHorizontal, Trash2 } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { usersApi, projectsApi, type Project } from '../lib/api';

/**
 * プロジェクト一覧ページ
 */
export function ProjectsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // プロジェクト一覧を取得
  const { data, isLoading } = useQuery({
    queryKey: ['user-projects', user?.id],
    queryFn: () => usersApi.getProjects(user!.id),
    enabled: !!user?.id,
  });

  const projects = data?.projects || [];

  // 検索フィルター
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">プロジェクト</h1>
          <p className="text-foreground-muted mt-1">
            テストプロジェクトを管理
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          新規プロジェクト
        </button>
      </div>

      {/* 検索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
        <input
          type="text"
          placeholder="プロジェクトを検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* プロジェクトリスト */}
      {isLoading ? (
        <div className="card p-8 text-center text-foreground-muted">
          読み込み中...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="card p-8 text-center">
          <FolderKanban className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
          <p className="text-foreground-muted mb-4">
            {searchQuery ? 'プロジェクトが見つかりません' : 'プロジェクトがありません'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4" />
              プロジェクトを作成
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* 作成モーダル */}
      {isCreateModalOpen && (
        <CreateProjectModal onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}

/**
 * プロジェクトカード
 */
function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="card card-hover p-4 block"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded bg-accent-muted flex items-center justify-center">
          <FolderKanban className="w-5 h-5 text-accent" />
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            // メニューを表示
          }}
          className="p-1 text-foreground-subtle hover:text-foreground-muted"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <h3 className="font-semibold text-foreground mb-1">{project.name}</h3>
      <p className="text-sm text-foreground-muted truncate-2 mb-3">
        {project.description || '説明なし'}
      </p>

      <div className="flex items-center gap-4 text-sm text-foreground-subtle">
        <span>{project._count?.testSuites || 0} スイート</span>
        {project.organization && (
          <span className="badge badge-accent">{project.organization.name}</span>
        )}
      </div>
    </Link>
  );
}

/**
 * プロジェクト作成モーダル
 */
function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-projects'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, description: description || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          新規プロジェクト
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              プロジェクト名 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="例: Webアプリテスト"
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
              placeholder="プロジェクトの説明を入力..."
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
