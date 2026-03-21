import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderKanban,
  Plus,
  FileText,
  ChevronLeft,
  Settings,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import {
  projectsApi,
  usersApi,
  labelsApi,
  type Project,
  type TestSuite,
  type TestSuiteSearchParams,
  type ProjectMemberRole,
  type Label,
} from '../lib/api';
import { TestSuiteSearchFilter } from '../components/test-suite/TestSuiteSearchFilter';
import { ProgressBar } from '../components/ui/ProgressBar';
import { TestSuiteRowSkeleton } from '../components/test-suite/TestSuiteRowSkeleton';
import { useAuth } from '../hooks/useAuth';
import { ProjectOverviewTab } from '../components/project/ProjectOverviewTab';
import { ProjectSettingsTab, type SettingsSection } from '../components/project/ProjectSettingsTab';
import { useTestSuiteFilterParams, DEFAULT_SEARCH_PARAMS } from '../hooks/useTestSuiteFilterParams';

/**
 * プロジェクト詳細ページ
 */

// タブ型定義
type ProjectTab = 'overview' | 'suites' | 'settings';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const {
    filters: suiteSearchParams,
    setFilters: setSuiteSearchParams,
    currentPage: suiteCurrentPage,
    setPage: handlePageChange,
  } = useTestSuiteFilterParams(urlSearchParams, setUrlSearchParams);
  const queryClient = useQueryClient();

  // URLクエリパラメータからタブ状態を取得
  const currentTab = (urlSearchParams.get('tab') as ProjectTab) || 'overview';
  const settingsSection = (urlSearchParams.get('section') as SettingsSection) || 'general';

  // urlSearchParamsをrefで保持（callbackの不要な再生成を防止）
  const urlSearchParamsRef = useRef(urlSearchParams);
  urlSearchParamsRef.current = urlSearchParams;

  // タブ変更ハンドラ
  const handleTabChange = useCallback(
    (tab: ProjectTab) => {
      const newParams = new URLSearchParams(urlSearchParamsRef.current);
      newParams.set('tab', tab);
      if (tab !== 'settings') {
        newParams.delete('section');
      }
      setUrlSearchParams(newParams);
    },
    [setUrlSearchParams]
  );

  // 設定セクション変更ハンドラ
  const handleSettingsSectionChange = useCallback(
    (section: SettingsSection) => {
      const newParams = new URLSearchParams(urlSearchParamsRef.current);
      newParams.set('section', section);
      setUrlSearchParams(newParams, { replace: true });
    },
    [setUrlSearchParams]
  );

  // プロジェクト情報を取得
  const { data: projectData, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(projectId!),
    enabled: !!projectId,
  });

  // プロジェクトメンバー一覧を取得
  const { data: membersData } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectsApi.getMembers(projectId!),
    enabled: !!projectId,
  });

  // deletedAtを取得するためにプロジェクト一覧から取得
  const { data: userProjectsData } = useQuery({
    queryKey: ['user-projects-for-detail', user?.id, projectId],
    queryFn: () => usersApi.getProjects(user!.id, { includeDeleted: true }),
    enabled: !!user?.id,
  });

  // deletedAtを取得
  const projectWithRole = useMemo(() => {
    if (!userProjectsData?.projects || !projectId) return null;
    return userProjectsData.projects.find((p) => p.id === projectId);
  }, [userProjectsData?.projects, projectId]);

  const deletedAt = projectWithRole?.deletedAt ?? null;

  // テストスイート一覧を検索・フィルタ付きで取得
  const { data: suitesData, isLoading: isLoadingSuites } = useQuery({
    queryKey: ['project-test-suites', projectId, suiteSearchParams],
    queryFn: () => projectsApi.searchTestSuites(projectId!, suiteSearchParams),
    enabled: !!projectId,
  });

  // プロジェクトのラベル一覧を取得
  const { data: labelsData } = useQuery({
    queryKey: ['project-labels', projectId],
    queryFn: () => labelsApi.getByProject(projectId!),
    enabled: !!projectId,
  });

  const project = projectData?.project;
  const testSuites = suitesData?.testSuites || [];
  const totalCount = suitesData?.total;
  const labels = labelsData?.labels || [];

  // 現在のユーザーのロールを判定（OWNERもProjectMemberから取得）
  const currentRole: 'OWNER' | ProjectMemberRole | undefined = useMemo(() => {
    if (!user || !membersData) return undefined;
    const member = membersData.members.find((m) => m.userId === user.id);
    return member?.role;
  }, [user, membersData]);

  // 管理者権限があるか（設定タブ表示・削除済み表示可能）
  const isAdmin = currentRole === 'OWNER' || currentRole === 'ADMIN';

  // 権限なしで設定タブにアクセスした場合は概要タブにリダイレクト
  useEffect(() => {
    if (currentTab === 'settings' && currentRole !== undefined && !isAdmin) {
      handleTabChange('overview');
    }
  }, [currentTab, currentRole, isAdmin, handleTabChange]);

  // プロジェクト更新後のコールバック
  const handleProjectUpdated = useCallback(
    (updated: Project) => {
      queryClient.setQueryData(['project', projectId], { project: updated });
      queryClient.invalidateQueries({
        queryKey: ['user-projects-for-detail', user?.id, projectId],
      });
    },
    [queryClient, projectId, user?.id]
  );

  // タブ定義
  const tabs = [
    { id: 'overview' as const, label: '概要', icon: BarChart3 },
    { id: 'suites' as const, label: 'テストスイート', icon: FileText },
    ...(isAdmin ? [{ id: 'settings' as const, label: '設定', icon: Settings }] : []),
  ];

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
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent-subtle flex items-center justify-center">
              <FolderKanban className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              <p className="text-foreground-muted">{project.description || '説明なし'}</p>
            </div>
          </div>

          {/* テストスイートタブの時のみ作成ボタンを表示 */}
          {currentTab === 'suites' && (
            <Link to={`/test-suites/new?projectId=${projectId!}`} className="btn btn-primary">
              <Plus className="w-4 h-4" />
              テストスイート
            </Link>
          )}
        </div>

        {/* タブナビゲーション */}
        <div className="mt-4 border-b border-border">
          <nav className="-mb-px flex gap-4" aria-label="タブ">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors
                    ${
                      isActive
                        ? 'border-accent text-accent'
                        : 'border-transparent text-foreground-muted hover:text-foreground hover:border-border'
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* タブコンテンツ */}
      {currentTab === 'overview' && <ProjectOverviewTab projectId={projectId!} />}

      {currentTab === 'suites' && (
        <TestSuiteListContent
          testSuites={testSuites}
          isLoadingSuites={isLoadingSuites}
          suiteSearchParams={suiteSearchParams}
          onFiltersChange={setSuiteSearchParams}
          totalCount={totalCount}
          isAdmin={isAdmin}
          labels={labels}
          currentPage={suiteCurrentPage}
          onPageChange={handlePageChange}
          projectId={projectId!}
        />
      )}

      {currentTab === 'settings' && isAdmin && project && (
        <ProjectSettingsTab
          project={project}
          currentRole={currentRole}
          activeSection={settingsSection}
          onSectionChange={handleSettingsSectionChange}
          onProjectUpdated={handleProjectUpdated}
          deletedAt={deletedAt}
        />
      )}
    </div>
  );
}

/**
 * テストスイート一覧コンテンツ
 */
interface TestSuiteListContentProps {
  testSuites: TestSuite[];
  isLoadingSuites: boolean;
  suiteSearchParams: TestSuiteSearchParams;
  onFiltersChange: (filters: TestSuiteSearchParams) => void;
  totalCount: number | undefined;
  isAdmin: boolean;
  labels: Label[];
  currentPage: number;
  onPageChange: (page: number) => void;
  projectId: string;
}

function TestSuiteListContent({
  testSuites,
  isLoadingSuites,
  suiteSearchParams,
  onFiltersChange,
  totalCount,
  isAdmin,
  labels,
  currentPage,
  onPageChange,
  projectId,
}: TestSuiteListContentProps) {
  // ページネーション値を導出
  const limit = suiteSearchParams.limit || DEFAULT_SEARCH_PARAMS.limit!;
  const offset = suiteSearchParams.offset || 0;
  const totalPages = totalCount ? Math.ceil(totalCount / limit) : 1;

  // フィルター適用状態を判定
  const hasActiveFilters = !!(
    suiteSearchParams.q ||
    suiteSearchParams.labelIds?.length ||
    suiteSearchParams.status !== DEFAULT_SEARCH_PARAMS.status
  );
  const hasAnyFilters = hasActiveFilters || !!suiteSearchParams.includeDeleted;

  // ページ番号配列を事前計算
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const added = new Set<number>();
      pages.push(1);
      added.add(1);
      if (currentPage > 3) {
        pages.push('ellipsis');
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!added.has(i)) {
          pages.push(i);
          added.add(i);
        }
      }
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }
      if (!added.has(totalPages)) {
        pages.push(totalPages);
      }
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="card">
      <div className="p-4 border-b border-border space-y-4">
        <h2 className="font-semibold text-foreground">テストスイート</h2>
        <TestSuiteSearchFilter
          filters={suiteSearchParams}
          onFiltersChange={onFiltersChange}
          totalCount={totalCount}
          isAdmin={isAdmin}
          labels={labels}
        />
      </div>

      {isLoadingSuites ? (
        <TestSuiteRowSkeleton count={5} />
      ) : testSuites.length === 0 ? (
        <div className="p-8 text-center">
          <FileText className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
          <p className="text-foreground-muted mb-4">
            {hasAnyFilters
              ? '条件に一致するテストスイートがありません'
              : 'テストスイートがありません'}
          </p>
          {!hasActiveFilters && (
            <Link to={`/test-suites/new?projectId=${projectId}`} className="btn btn-primary">
              <Plus className="w-4 h-4" />
              テストスイートを作成
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {testSuites.map((suite) => (
              <TestSuiteRow key={suite.id} suite={suite} />
            ))}
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-border flex items-center justify-between">
              <div className="text-sm text-foreground-muted">
                {totalCount}件中 {offset + 1}〜{Math.min(offset + limit, totalCount || 0)}件を表示
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="btn btn-ghost p-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="前のページ"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {pageNumbers.map((page, index) =>
                  page === 'ellipsis' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-foreground-muted">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => onPageChange(page)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        currentPage === page
                          ? 'bg-accent text-background'
                          : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                      }`}
                      aria-label={`${page}ページ目`}
                      aria-current={currentPage === page ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="btn btn-ghost p-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="次のページ"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 判定結果カウントの表示設定
 */
const judgmentDisplayConfig = {
  PASS: { label: '成功', className: 'text-success' },
  FAIL: { label: '失敗', className: 'text-danger' },
  PENDING: { label: '未判定', className: 'text-foreground-muted' },
  SKIPPED: { label: 'スキップ', className: 'text-warning' },
} as const;

// 表示順（成功 → 失敗 → 未判定 → スキップ）
const judgmentDisplayOrder: Array<keyof typeof judgmentDisplayConfig> = [
  'PASS',
  'FAIL',
  'PENDING',
  'SKIPPED',
];

// ステータス表示設定（ACTIVEは非表示）
const statusConfig: Record<'DRAFT' | 'ARCHIVED', { className: string; label: string }> = {
  DRAFT: { className: 'badge-warning', label: '下書き' },
  ARCHIVED: { className: 'badge', label: 'アーカイブ' },
};

/**
 * テストスイート行
 */
function TestSuiteRow({ suite }: { suite: TestSuite }) {
  const isDeleted = !!suite.deletedAt;

  return (
    <Link
      to={`/test-suites/${suite.id}`}
      className={`flex items-center justify-between p-4 hover:bg-background-tertiary transition-colors ${
        isDeleted ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded bg-background-tertiary flex items-center justify-center">
          <FileText
            className={`w-5 h-5 ${isDeleted ? 'text-foreground-subtle' : 'text-foreground-muted'}`}
          />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={`font-medium ${isDeleted ? 'text-foreground-muted line-through' : 'text-foreground'}`}
            >
              {suite.name}
            </p>
            {isDeleted && <span className="badge badge-danger">削除済み</span>}
            {/* ラベル表示 */}
            {!isDeleted && suite.labels && suite.labels.length > 0 && (
              <div className="flex items-center gap-1">
                {suite.labels.map((label) => (
                  <span
                    key={label.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${label.color}20`,
                      color: label.color,
                      border: `1px solid ${label.color}40`,
                    }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-foreground-muted">
            <span>{suite._count?.testCases || 0} テストケース</span>
            {/* 最終実行結果表示 */}
            {!isDeleted && suite.lastExecution && (
              <LastExecutionSummary execution={suite.lastExecution} />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* ステータスバッジ（DRAFT/ARCHIVEDのみ表示、ACTIVEは非表示） */}
        {!isDeleted && suite.status !== 'ACTIVE' && (
          <span className={`badge ${statusConfig[suite.status].className}`}>
            {statusConfig[suite.status].label}
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * 最終実行結果のサマリー表示
 */
function LastExecutionSummary({
  execution,
}: {
  execution: NonNullable<TestSuite['lastExecution']>;
}) {
  const { environment, judgmentCounts } = execution;
  const total =
    judgmentCounts.PASS + judgmentCounts.FAIL + judgmentCounts.PENDING + judgmentCounts.SKIPPED;
  const completedTotal = judgmentCounts.PASS + judgmentCounts.FAIL + judgmentCounts.SKIPPED;
  const passRate =
    completedTotal > 0 ? Math.round((judgmentCounts.PASS / completedTotal) * 100) : 0;

  return (
    <>
      <span className="text-foreground-subtle">•</span>
      <span className="flex items-center gap-2">
        {environment && <span className="text-foreground-muted">{environment.name}</span>}
        <span className="w-24">
          <ProgressBar
            passed={judgmentCounts.PASS}
            failed={judgmentCounts.FAIL}
            skipped={judgmentCounts.SKIPPED}
            total={total}
            size="sm"
          />
        </span>
        <span className="text-foreground-muted text-xs font-medium">{passRate}%</span>
        {judgmentDisplayOrder.map((status) => {
          const count = judgmentCounts[status];
          if (count === 0) return null;
          const config = judgmentDisplayConfig[status];
          return (
            <span key={status} className={config.className}>
              {count}
              {config.label}
            </span>
          );
        })}
      </span>
    </>
  );
}
