import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { FolderKanban, Plus, Search, Filter, User, Building2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useOrganizationStore } from '../stores/organization';
import { usersApi, type ProjectWithRole } from '../lib/api';
import { CreateProjectModal } from '../components/project/CreateProjectModal';

/** 組織フィルターの選択肢 */
type OrganizationFilter = 'personal' | string;

/**
 * プロジェクト一覧ページ
 */
export function ProjectsPage() {
  const { user } = useAuthStore();
  const { organizations } = useOrganizationStore();
  const [searchQuery, setSearchQuery] = useState('');
  const { selectedOrganizationId } = useOrganizationStore();
  const [organizationFilter, setOrganizationFilter] = useState<OrganizationFilter>(
    selectedOrganizationId ?? 'personal'
  );
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // APIに渡すorganizationIdを計算
  const apiOrganizationId = useMemo(() => {
    if (organizationFilter === 'personal') return null;
    return organizationFilter;
  }, [organizationFilter]);

  // プロジェクト一覧を取得
  const { data, isLoading } = useQuery({
    queryKey: ['user-projects', user?.id, apiOrganizationId, includeDeleted],
    queryFn: () =>
      usersApi.getProjects(user!.id, {
        organizationId: apiOrganizationId,
        includeDeleted,
      }),
    enabled: !!user?.id,
  });

  // クライアントサイドで名前検索フィルターを適用
  // 注: APIにはqパラメータがあるが、プロジェクト数が少ない想定のためクライアントサイドで即時フィルタリング。
  // 大量プロジェクト対応が必要な場合はデバウンス付きAPI検索に変更を検討
  const filteredProjects = useMemo(() => {
    const projects = data?.projects || [];
    if (!searchQuery) return projects;
    return projects.filter((project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data?.projects, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">プロジェクト</h1>
          <p className="text-foreground-muted mt-1">テストプロジェクトを管理</p>
        </div>
        <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          新規プロジェクト
        </button>
      </div>

      {/* 検索・フィルター */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 検索 */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
          <input
            type="text"
            placeholder="プロジェクトを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>

        {/* 組織フィルター */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
          <select
            value={organizationFilter}
            onChange={(e) => setOrganizationFilter(e.target.value)}
            className="input pl-10 pr-8 min-w-[160px] appearance-none"
          >
            <option value="personal">個人プロジェクト</option>
            {organizations.map(({ organization }) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </div>

        {/* 削除済み表示切替 */}
        <label className="flex items-center gap-2 px-3 cursor-pointer text-sm text-foreground-muted hover:text-foreground">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
            className="w-4 h-4 rounded border-border-default"
          />
          <Trash2 className="w-4 h-4" />
          <span className="whitespace-nowrap">削除済みを表示</span>
        </label>
      </div>

      {/* プロジェクトリスト */}
      {isLoading ? (
        <div className="card p-8 text-center text-foreground-muted">読み込み中...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="card p-8 text-center">
          <FolderKanban className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
          <p className="text-foreground-muted mb-4">
            {searchQuery ? 'プロジェクトが見つかりません' : 'プロジェクトがありません'}
          </p>
          {!searchQuery && (
            <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
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
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        organizationId={organizationFilter === 'personal' ? undefined : organizationFilter}
      />
    </div>
  );
}

/**
 * プロジェクトカード
 */
function ProjectCard({ project }: { project: ProjectWithRole }) {
  const isDeleted = !!project.deletedAt;

  return (
    <Link
      to={`/projects/${project.id}`}
      className={`card card-hover p-4 block relative ${isDeleted ? 'opacity-50 grayscale' : ''}`}
    >
      {/* 削除済みバッジ */}
      {isDeleted && (
        <div className="absolute top-2 right-2 badge badge-danger flex items-center gap-1">
          <Trash2 className="w-3 h-3" />
          <span>削除済み</span>
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded flex items-center justify-center ${isDeleted ? 'bg-background-muted' : 'bg-accent-subtle'}`}
        >
          <FolderKanban
            className={`w-5 h-5 ${isDeleted ? 'text-foreground-subtle' : 'text-accent'}`}
          />
        </div>
      </div>

      <h3 className="font-semibold text-foreground mb-1">{project.name}</h3>
      <p className="text-sm text-foreground-muted truncate-2 mb-3">
        {project.description || '説明なし'}
      </p>

      <div className="flex items-center gap-4 text-sm text-foreground-subtle flex-wrap">
        <span>{project._count?.testSuites || 0} スイート</span>
        {project.organization ? (
          <span className="badge badge-accent flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {project.organization.name}
          </span>
        ) : (
          <span className="badge badge-default flex items-center gap-1">
            <User className="w-3 h-3" />
            個人
          </span>
        )}
      </div>
    </Link>
  );
}
