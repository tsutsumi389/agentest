import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router';
import {
  FolderKanban,
  Settings,
  Users,
  Server,
  History,
  AlertTriangle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { projectsApi, usersApi, ApiError, type Project, type ProjectWithRole } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { ProjectGeneralSettings } from '../components/project/ProjectGeneralSettings';
import { ProjectMemberList } from '../components/project/ProjectMemberList';
import { EnvironmentList } from '../components/project/EnvironmentList';
import { HistoryList } from '../components/project/HistoryList';
import { DeleteProjectSection } from '../components/project/DeleteProjectSection';

type SettingsTab = 'general' | 'members' | 'environments' | 'history' | 'danger';

/**
 * プロジェクト設定ページ
 */
export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // タブ状態
  const tabParam = searchParams.get('tab') as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    tabParam && ['general', 'members', 'environments', 'history', 'danger'].includes(tabParam)
      ? tabParam
      : 'general'
  );

  // プロジェクトデータ
  const [project, setProject] = useState<Project | null>(null);
  const [deletedAt, setDeletedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 現在のユーザーのロール（オーナーか、メンバーのロール）
  const [currentRole, setCurrentRole] = useState<'OWNER' | 'ADMIN' | 'WRITE' | 'READ' | null>(null);
  // ロール確認中かどうか
  const [isLoadingRole, setIsLoadingRole] = useState(false);

  // プロジェクトデータを取得
  const fetchProject = useCallback(async () => {
    if (!projectId || !user?.id) return;

    setIsLoading(true);
    setError(null);
    setCurrentRole(null);
    setDeletedAt(null);

    try {
      // プロジェクト一覧から取得（deletedAtとroleを含む）
      const projectsResponse = await usersApi.getProjects(user.id, { includeDeleted: true });
      const projectWithRole = projectsResponse.projects.find((p) => p.id === projectId);

      if (projectWithRole) {
        setProject(projectWithRole);
        setDeletedAt(projectWithRole.deletedAt ?? null);

        // ロールの設定（OWNERもprojectWithRole.roleから取得）
        if (projectWithRole.role) {
          setCurrentRole(projectWithRole.role);
        }
      } else {
        // 一覧にない場合は直接取得を試みる
        const response = await projectsApi.getById(projectId);
        setProject(response.project);

        // メンバーのロールを取得（OWNERも含む）
        setIsLoadingRole(true);
        try {
          const membersResponse = await projectsApi.getMembers(projectId);
          const myMembership = membersResponse.members.find((m) => m.userId === user.id);
          if (myMembership) {
            setCurrentRole(myMembership.role);
          }
        } catch {
          // メンバー取得に失敗しても続行（権限なしとして扱う）
        } finally {
          setIsLoadingRole(false);
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          setError('プロジェクトが見つかりません');
        } else if (err.statusCode === 403) {
          setError('このプロジェクトにアクセスする権限がありません');
        } else {
          setError(err.message);
        }
      } else {
        setError('プロジェクトの取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, user?.id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // タブを変更するとURLパラメータも更新
  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    searchParams.set('tab', tab);
    setSearchParams(searchParams, { replace: true });
  };

  // プロジェクト更新後のコールバック
  const handleProjectUpdated = (updated: Project) => {
    setProject(updated);
    // 復元された場合はdeletedAtをリセット
    if ('deletedAt' in updated) {
      setDeletedAt((updated as ProjectWithRole).deletedAt ?? null);
    } else {
      setDeletedAt(null);
    }
  };

  // タブ定義
  const tabs = [
    { id: 'general' as const, label: '一般', icon: Settings },
    { id: 'members' as const, label: 'メンバー', icon: Users },
    { id: 'environments' as const, label: '環境', icon: Server },
    { id: 'history' as const, label: '履歴', icon: History },
    { id: 'danger' as const, label: '危険な操作', icon: AlertTriangle },
  ];

  // 設定ページへのアクセス権限チェック（ADMIN以上）
  const hasPermission = currentRole === 'OWNER' || currentRole === 'ADMIN';

  // ローディング中（プロジェクト取得中 または ロール確認中）
  if (isLoading || isLoadingRole) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-6">
        <div className="card p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {error || 'プロジェクトが見つかりません'}
          </h2>
          <Link to="/projects" className="btn btn-primary">
            プロジェクト一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  // 権限がない場合
  if (!hasPermission) {
    return (
      <div className="space-y-6">
        <div className="card p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            アクセス権限がありません
          </h2>
          <p className="text-foreground-muted mb-4">
            プロジェクト設定にアクセスするには、オーナーまたは管理者権限が必要です。
          </p>
          <Link to={`/projects/${projectId}`} className="btn btn-primary">
            プロジェクトに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="p-2 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
          aria-label="プロジェクトに戻る"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center">
            <FolderKanban className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <p className="text-foreground-muted text-sm">プロジェクト設定</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* タブナビゲーション */}
        <nav className="lg:w-48 flex-shrink-0">
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded transition-colors
                    ${activeTab === tab.id
                      ? 'bg-accent-subtle text-accent'
                      : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                    }
                    ${tab.id === 'danger' ? 'text-danger hover:text-danger' : ''}
                  `}
                >
                  <tab.icon className={`w-4 h-4 ${tab.id === 'danger' && activeTab !== tab.id ? 'text-danger' : ''}`} />
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* コンテンツ */}
        <div className="flex-1">
          {activeTab === 'general' && (
            <ProjectGeneralSettings
              project={project}
              onUpdated={handleProjectUpdated}
            />
          )}
          {activeTab === 'members' && (
            <ProjectMemberList
              project={project}
              currentRole={currentRole ?? undefined}
            />
          )}
          {activeTab === 'environments' && (
            <EnvironmentList
              project={project}
              currentRole={currentRole ?? undefined}
            />
          )}
          {activeTab === 'history' && (
            <HistoryList project={project} />
          )}
          {activeTab === 'danger' && (
            <DeleteProjectSection
              project={project}
              deletedAt={deletedAt}
              onUpdated={handleProjectUpdated}
            />
          )}
        </div>
      </div>
    </div>
  );
}
