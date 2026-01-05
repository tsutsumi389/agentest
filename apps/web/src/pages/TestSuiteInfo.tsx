import { useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Play,
  History,
  Settings,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  Pencil,
} from 'lucide-react';
import { testSuitesApi, projectsApi, type TestSuite, type ProjectMemberRole } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { TestSuiteHeader } from '../components/test-suite/TestSuiteHeader';
import { PreconditionList } from '../components/test-suite/PreconditionList';
import { TestSuiteHistoryList } from '../components/test-suite/TestSuiteHistoryList';
import { DeleteTestSuiteSection } from '../components/test-suite/DeleteTestSuiteSection';
import { StartExecutionModal } from '../components/execution/StartExecutionModal';
import { ExecutionHistoryList } from '../components/execution/ExecutionHistoryList';
import { ReviewCommentList } from '../components/review/ReviewCommentList';
import { TestSuiteForm } from '../components/test-suite/TestSuiteForm';

/**
 * タブ定義
 */
type TabType = 'overview' | 'executions' | 'review' | 'history' | 'settings';

const TABS: { id: TabType; label: string; icon: typeof FileText }[] = [
  { id: 'overview', label: '概要', icon: FileText },
  { id: 'executions', label: '実行履歴', icon: Play },
  { id: 'review', label: 'レビュー', icon: MessageSquare },
  { id: 'history', label: '変更履歴', icon: History },
  { id: 'settings', label: '設定', icon: Settings },
];

/**
 * テストスイート詳細情報ページ
 * タブナビゲーションで概要/実行履歴/レビュー/変更履歴/設定を表示
 */
export function TestSuiteInfoPage() {
  const { testSuiteId } = useParams<{ testSuiteId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isStartExecutionModalOpen, setIsStartExecutionModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // 現在のタブ
  const currentTab = (searchParams.get('tab') as TabType) || 'overview';

  // タブ変更ハンドラ
  const handleTabChange = (tab: TabType) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  // テストスイート情報を取得
  const { data: suiteData, isLoading: isLoadingSuite } = useQuery({
    queryKey: ['test-suite', testSuiteId],
    queryFn: () => testSuitesApi.getById(testSuiteId!),
    enabled: !!testSuiteId,
  });

  const suite = suiteData?.testSuite;

  // プロジェクト情報を取得
  const { data: projectData } = useQuery({
    queryKey: ['project', suite?.projectId],
    queryFn: () => projectsApi.getById(suite!.projectId),
    enabled: !!suite?.projectId,
  });

  const project = projectData?.project;

  // 前提条件を取得
  const { data: preconditionsData } = useQuery({
    queryKey: ['test-suite-preconditions', testSuiteId],
    queryFn: () => testSuitesApi.getPreconditions(testSuiteId!),
    enabled: !!testSuiteId,
  });

  const preconditions = preconditionsData?.preconditions || [];

  // プロジェクトメンバー情報を取得して権限を判定
  const { data: membersData } = useQuery({
    queryKey: ['project-members', suite?.projectId],
    queryFn: () => projectsApi.getMembers(suite!.projectId),
    enabled: !!suite?.projectId,
  });

  // 現在のユーザーのロールを判定
  const currentRole: 'OWNER' | ProjectMemberRole | undefined = (() => {
    if (!user || !membersData) return undefined;
    const member = membersData.members.find((m) => m.userId === user.id);
    return member?.role;
  })();

  // テストケース一覧を取得（件数表示用）
  const { data: casesData } = useQuery({
    queryKey: ['test-suite-cases', testSuiteId],
    queryFn: () => testSuitesApi.getTestCases(testSuiteId!),
    enabled: !!testSuiteId,
  });

  // 実行履歴を取得（概要タブ用）
  const { data: executionsData } = useQuery({
    queryKey: ['test-suite-executions', testSuiteId],
    queryFn: () => testSuitesApi.getExecutions(testSuiteId!, { limit: 5 }),
    enabled: !!testSuiteId,
  });

  // 環境一覧を事前取得（モーダル表示判定用）
  const { data: environmentsData } = useQuery({
    queryKey: ['project-environments', suite?.projectId],
    queryFn: () => projectsApi.getEnvironments(suite!.projectId),
    enabled: !!suite?.projectId,
  });

  const environments = environmentsData?.environments || [];

  // 実行開始（環境なしの直接実行用）
  const startExecutionMutation = useMutation({
    mutationFn: () => testSuitesApi.startExecution(testSuiteId!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['test-suite-executions', testSuiteId] });
      navigate(`/executions/${data.execution.id}`);
    },
  });

  const testCases = casesData?.testCases || [];
  const executions = executionsData?.executions || [];

  // 実行開始ボタンのクリックハンドラ
  const handleStartExecution = useCallback(() => {
    if (environments.length === 0) {
      // 環境なし: 直接実行開始
      startExecutionMutation.mutate();
    } else {
      // 環境あり: モーダル表示
      setIsStartExecutionModalOpen(true);
    }
  }, [environments.length, startExecutionMutation]);

  // テストケース作成（テストケースページに遷移）
  const handleCreateTestCase = useCallback(() => {
    navigate(`/test-suites/${testSuiteId}?mode=create`);
  }, [navigate, testSuiteId]);

  if (isLoadingSuite) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">読み込み中...</div>
      </div>
    );
  }

  if (!testSuiteId || !suite) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted">テストスイートが見つかりません</div>
      </div>
    );
  }

  // 編集モード時: TestSuiteFormを表示
  if (isEditMode) {
    // 前提条件をorderKeyでソート
    const sortedPreconditions = [...preconditions].sort((a, b) => a.orderKey.localeCompare(b.orderKey));

    return (
      <div className="h-full flex flex-col">
        <TestSuiteHeader
          testSuite={suite}
          project={project}
          testCaseCount={testCases.length}
          currentRole={currentRole}
          onStartExecution={handleStartExecution}
          onCreateTestCase={handleCreateTestCase}
          isExecutionPending={startExecutionMutation.isPending}
        />

        {/* 編集フォーム */}
        <div className="flex-1 overflow-hidden p-4">
          <div className="card h-full overflow-hidden">
            <TestSuiteForm
              mode="edit"
              testSuite={suite}
              preconditions={sortedPreconditions}
              onSave={() => {
                setIsEditMode(false);
                queryClient.invalidateQueries({ queryKey: ['test-suite', testSuiteId] });
                queryClient.invalidateQueries({ queryKey: ['test-suite-preconditions', testSuiteId] });
              }}
              onCancel={() => setIsEditMode(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  // 編集権限チェック
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <TestSuiteHeader
        testSuite={suite}
        project={project}
        testCaseCount={testCases.length}
        currentRole={currentRole}
        onStartExecution={handleStartExecution}
        onCreateTestCase={handleCreateTestCase}
        isExecutionPending={startExecutionMutation.isPending}
      />

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="h-full flex flex-col">
          {/* 説明 */}
          <div className="mb-4 flex items-start justify-between">
            <p className="text-foreground-muted">
              {suite.description || '説明なし'}
            </p>
            {canEdit && (
              <button
                onClick={() => setIsEditMode(true)}
                className="btn btn-secondary btn-sm ml-4 flex-shrink-0"
              >
                <Pencil className="w-4 h-4" />
                編集
              </button>
            )}
          </div>

          {/* サブタブナビゲーション */}
          <div className="border-b border-border mb-4">
            <nav className="-mb-px flex gap-4" aria-label="サブタブ">
              {TABS.map((tab) => {
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

          {/* タブコンテンツ */}
          <div className="flex-1 overflow-y-auto">
            {currentTab === 'overview' && (
              <OverviewTab
                testSuiteId={testSuiteId}
                executions={executions}
              />
            )}

            {currentTab === 'executions' && (
              <ExecutionHistoryList testSuiteId={testSuiteId!} />
            )}

            {currentTab === 'review' && user && (
              <div className="card p-4">
                <ReviewCommentList
                  targetType="SUITE"
                  targetId={testSuiteId}
                  currentUserId={user.id}
                  currentRole={currentRole}
                />
              </div>
            )}

            {currentTab === 'history' && (
              <TestSuiteHistoryList testSuite={suite} />
            )}

            {currentTab === 'settings' && (
              <SettingsTab
                testSuite={suite}
                currentRole={currentRole}
                onUpdated={(updated) => {
                  queryClient.setQueryData(['test-suite', testSuiteId], { testSuite: updated });
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* 実行開始モーダル */}
      {isStartExecutionModalOpen && suite && (
        <StartExecutionModal
          isOpen={isStartExecutionModalOpen}
          testSuiteId={testSuiteId!}
          projectId={suite.projectId}
          suiteName={suite.name}
          testCaseCount={testCases.length}
          preconditionCount={suite._count?.preconditions || 0}
          onClose={() => setIsStartExecutionModalOpen(false)}
          onStarted={(execution) => {
            queryClient.invalidateQueries({ queryKey: ['test-suite-executions', testSuiteId] });
            navigate(`/executions/${execution.id}`);
          }}
        />
      )}
    </div>
  );
}

/**
 * 概要タブ
 */
interface OverviewTabProps {
  testSuiteId: string;
  executions: { id: string; status: string; startedAt: string }[];
}

function OverviewTab({
  testSuiteId,
  executions,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* 前提条件セクション */}
      <PreconditionList testSuiteId={testSuiteId} />

      {/* 実行履歴 */}
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">最近の実行履歴</h2>
        </div>

        {executions.length === 0 ? (
          <div className="p-6 text-center text-foreground-muted">
            実行履歴がありません
          </div>
        ) : (
          <div className="divide-y divide-border">
            {executions.map((execution) => (
              <Link
                key={execution.id}
                to={`/executions/${execution.id}`}
                className="block p-4 hover:bg-background-tertiary transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  {execution.status === 'COMPLETED' && (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  )}
                  {execution.status === 'IN_PROGRESS' && (
                    <Clock className="w-4 h-4 text-warning" />
                  )}
                  {execution.status === 'ABORTED' && (
                    <AlertCircle className="w-4 h-4 text-danger" />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {execution.status === 'COMPLETED' && '完了'}
                    {execution.status === 'IN_PROGRESS' && '実行中'}
                    {execution.status === 'ABORTED' && '中断'}
                  </span>
                </div>
                <p className="text-xs text-foreground-muted">
                  {new Date(execution.startedAt).toLocaleString('ja-JP')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 設定タブ
 */
interface SettingsTabProps {
  testSuite: TestSuite;
  currentRole: 'OWNER' | ProjectMemberRole | undefined;
  onUpdated?: (testSuite: TestSuite) => void;
}

function SettingsTab({ testSuite, currentRole, onUpdated }: SettingsTabProps) {
  // ADMIN権限があるかどうか
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN';

  return (
    <DeleteTestSuiteSection
      testSuite={testSuite}
      projectId={testSuite.projectId}
      onUpdated={onUpdated}
      canEdit={canEdit}
    />
  );
}
