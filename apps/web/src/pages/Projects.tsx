import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { FolderKanban, Plus, Search, MoreHorizontal, Filter, User, Building2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useOrganizationStore } from '../stores/organization';
import { usersApi, projectsApi, type ProjectWithRole } from '../lib/api';

/** 組織フィルターの選択肢 */
type OrganizationFilter = 'all' | 'personal' | string;

/**
 * プロジェクト一覧ページ
 */
export function ProjectsPage() {
  const { user } = useAuthStore();
  const { organizations } = useOrganizationStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState<OrganizationFilter>('all');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // APIに渡すorganizationIdを計算
  const apiOrganizationId = useMemo(() => {
    if (organizationFilter === 'all') return undefined;
    if (organizationFilter === 'personal') return null;
    return organizationFilter;
  }, [organizationFilter]);

  // プロジェクト一覧を取得
  const { data, isLoading } = useQuery({
    queryKey: ['user-projects', user?.id, apiOrganizationId, includeDeleted],
    queryFn: () => usersApi.getProjects(user!.id, {
      organizationId: apiOrganizationId,
      includeDeleted,
    }),
    enabled: !!user?.id,
  });

  // クライアントサイドで名前検索フィルターを適用
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
            <option value="all">すべて</option>
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
        <div className={`w-10 h-10 rounded flex items-center justify-center ${isDeleted ? 'bg-background-muted' : 'bg-accent-subtle'}`}>
          <FolderKanban className={`w-5 h-5 ${isDeleted ? 'text-foreground-subtle' : 'text-accent'}`} />
        </div>
        {!isDeleted && (
          <button
            onClick={(e) => {
              e.preventDefault();
              // メニューを表示
            }}
            className="p-1 text-foreground-subtle hover:text-foreground-muted"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
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

/** プロジェクトの所有者タイプ */
type OwnerType = 'personal' | 'organization';

/**
 * プロジェクト作成モーダル
 */
function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { organizations } = useOrganizationStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerType, setOwnerType] = useState<OwnerType>('personal');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');

  // 組織がある場合は最初の組織を選択
  const hasOrganizations = organizations.length > 0;

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; organizationId?: string }) =>
      projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-projects'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const organizationId = ownerType === 'organization' ? selectedOrganizationId : undefined;
    createMutation.mutate({
      name,
      description: description || undefined,
      organizationId,
    });
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          新規プロジェクト
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 所有者選択 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              所有者 <span className="text-danger">*</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOwnerType('personal')}
                className={`flex-1 p-3 rounded border flex items-center justify-center gap-2 transition-colors ${
                  ownerType === 'personal'
                    ? 'border-accent bg-accent-subtle text-accent'
                    : 'border-border-default text-foreground-muted hover:border-foreground-subtle'
                }`}
              >
                <User className="w-4 h-4" />
                <span>個人</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOwnerType('organization');
                  // 組織が選択されていなければ最初の組織を選択
                  if (!selectedOrganizationId && hasOrganizations) {
                    setSelectedOrganizationId(organizations[0].organization.id);
                  }
                }}
                disabled={!hasOrganizations}
                className={`flex-1 p-3 rounded border flex items-center justify-center gap-2 transition-colors ${
                  ownerType === 'organization'
                    ? 'border-accent bg-accent-subtle text-accent'
                    : 'border-border-default text-foreground-muted hover:border-foreground-subtle'
                } ${!hasOrganizations ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Building2 className="w-4 h-4" />
                <span>組織</span>
              </button>
            </div>
            {!hasOrganizations && (
              <p className="text-xs text-foreground-subtle mt-1">
                組織に所属していません
              </p>
            )}
          </div>

          {/* 組織選択ドロップダウン */}
          {ownerType === 'organization' && hasOrganizations && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                組織を選択 <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
                <select
                  value={selectedOrganizationId}
                  onChange={(e) => setSelectedOrganizationId(e.target.value)}
                  className="input pl-10 pr-8 appearance-none"
                  required
                >
                  <option value="" disabled>
                    組織を選択してください
                  </option>
                  {organizations.map(({ organization, role }) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name} ({role === 'OWNER' ? 'オーナー' : role === 'ADMIN' ? '管理者' : 'メンバー'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

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
              disabled={
                !name ||
                (ownerType === 'organization' && !selectedOrganizationId) ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
