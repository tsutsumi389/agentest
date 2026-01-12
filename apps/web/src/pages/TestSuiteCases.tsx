import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { testSuitesApi, projectsApi, type TestCase, type TestSuite, type ProjectMemberRole } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { usePageSidebar } from '../components/Layout';
import { toast } from '../stores/toast';
import { TestSuiteHeader, type TabType, type TestCaseTabType } from '../components/test-suite/TestSuiteHeader';
import { TestCaseSidebar } from '../components/test-suite/TestCaseSidebar';
import { TestCaseDetailPanel, useTestCaseDetails } from '../components/test-case/TestCaseDetailPanel';
import { CopyTestCaseModal } from '../components/test-case/CopyTestCaseModal';
import { TestCaseForm } from '../components/test-case/TestCaseForm';
import { TestSuiteForm } from '../components/test-suite/TestSuiteForm';
import { StartExecutionModal } from '../components/execution/StartExecutionModal';
import { PreconditionList } from '../components/test-suite/PreconditionList';
import { TestSuiteHistoryList } from '../components/test-suite/TestSuiteHistoryList';
import { DeleteTestSuiteSection } from '../components/test-suite/DeleteTestSuiteSection';
import { ExecutionHistoryList } from '../components/execution/ExecutionHistoryList';
import { ReviewPanel } from '../components/review/ReviewPanel';
import { ReviewSessionBar } from '../components/review/ReviewSessionBar';
import { ReviewSessionProvider } from '../contexts/ReviewSessionContext';
import { MarkdownPreview } from '../components/common/markdown/MarkdownPreview';

/**
 * テストスイート統合ページ
 * サイドバー（テストケース一覧）は常に表示し、メインエリアでタブとテストケース詳細を切り替える
 */
export function TestSuiteCasesPage() {
  const { testSuiteId } = useParams<{ testSuiteId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { setSidebarContent } = usePageSidebar();
  const navigate = useNavigate();
  const [isStartExecutionModalOpen, setIsStartExecutionModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isTestCaseEditMode, setIsTestCaseEditMode] = useState(false);

  // URLクエリパラメータから作成モードを取得
  const isCreateMode = searchParams.get('mode') === 'create';

  // URLクエリパラメータから選択状態を取得
  const selectedTestCaseId = searchParams.get('testCase');

  // URLクエリパラメータからタブを取得
  const currentTab = (searchParams.get('tab') as TabType) || 'overview';

  // URLクエリパラメータからテストケースタブを取得
  const testCaseTab = (searchParams.get('testCaseTab') as TestCaseTabType) || 'overview';

  // タブ変更ハンドラ
  const handleTabChange = useCallback((tab: TabType) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    // タブ切り替え時はテストケース選択を解除
    newParams.delete('testCase');
    newParams.delete('testCaseTab');
    newParams.delete('mode');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // テストケースタブ変更ハンドラ
  const handleTestCaseTabChange = useCallback((tab: TestCaseTabType) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('testCaseTab', tab);
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // テストケース選択ハンドラ（URLを更新）
  const handleSelectTestCase = useCallback((testCaseId: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    // 作成モードを解除
    newParams.delete('mode');
    if (testCaseId) {
      newParams.set('testCase', testCaseId);
      // 新しいテストケース選択時はタブをリセット
      newParams.delete('testCaseTab');
    } else {
      newParams.delete('testCase');
      newParams.delete('testCaseTab');
    }
    // テストケース編集モードもリセット
    setIsTestCaseEditMode(false);
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // 作成モード開始ハンドラ
  const handleStartCreateMode = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('mode', 'create');
    newParams.delete('testCase');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // 作成モード終了ハンドラ（作成されたテストケースIDがあればそれを選択）
  const handleExitCreateMode = useCallback((createdTestCaseId?: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('mode');
    if (createdTestCaseId) {
      newParams.set('testCase', createdTestCaseId);
    }
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

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

  // 前提条件を取得（編集モード用）
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

  // テストケース一覧を取得
  const { data: casesData, isLoading: isLoadingCases } = useQuery({
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

  // 選択中のテストケースの詳細情報を取得
  const { data: selectedTestCaseData } = useTestCaseDetails(selectedTestCaseId);
  const selectedTestCaseDetail = selectedTestCaseData?.testCase;

  // TestSuiteHeaderに渡すテストケース情報
  const selectedTestCaseInfo = selectedTestCaseDetail ? {
    id: selectedTestCaseDetail.id,
    title: selectedTestCaseDetail.title,
    priority: selectedTestCaseDetail.priority,
    status: selectedTestCaseDetail.status,
    deletedAt: selectedTestCaseDetail.deletedAt,
  } : undefined;

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

  // テストケース並び替え後の更新ハンドラ
  const handleTestCasesReordered = useCallback((reorderedTestCases: TestCase[]) => {
    queryClient.setQueryData(['test-suite-cases', testSuiteId], { testCases: reorderedTestCases });
  }, [queryClient, testSuiteId]);

  // サイドバーにテストケース一覧を表示
  useEffect(() => {
    if (!testSuiteId) return;

    setSidebarContent(
      <TestCaseSidebar
        testSuiteId={testSuiteId}
        testCases={testCases}
        selectedTestCaseId={selectedTestCaseId}
        onSelect={handleSelectTestCase}
        onCreateClick={handleStartCreateMode}
        currentRole={currentRole}
        isLoading={isLoadingCases}
        onTestCasesReordered={handleTestCasesReordered}
        isCreateMode={isCreateMode}
      />
    );

    return () => setSidebarContent(null);
  }, [testSuiteId, testCases, selectedTestCaseId, currentRole, isLoadingCases, setSidebarContent, handleTestCasesReordered, handleSelectTestCase, handleStartCreateMode, isCreateMode]);

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
          onCreateTestCase={handleStartCreateMode}
          isExecutionPending={startExecutionMutation.isPending}
          currentTab={currentTab}
          onTabChange={handleTabChange}
          hasSelectedTestCase={!!selectedTestCaseId}
          isCreateMode={isCreateMode}
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

  return (
    <ReviewSessionProvider>
      <div className="h-full flex flex-col">
        {/* ヘッダー */}
        <TestSuiteHeader
          testSuite={suite}
          project={project}
          testCaseCount={testCases.length}
          currentRole={currentRole}
          onStartExecution={handleStartExecution}
          onCreateTestCase={handleStartCreateMode}
          onEdit={() => setIsEditMode(true)}
          isExecutionPending={startExecutionMutation.isPending}
          currentTab={currentTab}
          onTabChange={handleTabChange}
          hasSelectedTestCase={!!selectedTestCaseId || isCreateMode}
          isCreateMode={isCreateMode}
          // テストケース選択時のprops
          selectedTestCase={selectedTestCaseInfo}
          testCaseTab={testCaseTab}
          onTestCaseTabChange={handleTestCaseTabChange}
          onEditTestCase={() => setIsTestCaseEditMode(true)}
          onCopyTestCase={() => setIsCopyModalOpen(true)}
          onCloseTestCase={() => handleSelectTestCase(null)}
        />

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-hidden p-4">
        {isCreateMode ? (
          // 作成モード時: 作成フォームを表示
          <div className="card h-full overflow-hidden">
            <TestCaseForm
              mode="create"
              testSuiteId={testSuiteId}
              projectId={suite.projectId}
              onSave={handleExitCreateMode}
              onCancel={handleExitCreateMode}
            />
          </div>
        ) : selectedTestCaseId ? (
          // テストケース選択時: 詳細パネルを表示
          <div className="card h-full overflow-hidden">
            <TestCaseDetailPanel
              testCaseId={selectedTestCaseId}
              testSuiteId={testSuiteId}
              projectId={suite.projectId}
              currentRole={currentRole}
              onClose={() => handleSelectTestCase(null)}
              onUpdated={() => {
                queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
                queryClient.invalidateQueries({ queryKey: ['test-case-details', selectedTestCaseId] });
              }}
              onDeleted={() => {
                handleSelectTestCase(null);
                queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
              }}
              currentTab={testCaseTab}
              isEditMode={isTestCaseEditMode}
              onEditModeChange={setIsTestCaseEditMode}
            />
          </div>
        ) : (
          // タブコンテンツを表示
          <div className="h-full flex flex-col">
            {/* 説明 */}
            <div className="mb-4">
              {suite.description ? (
                <MarkdownPreview content={suite.description} className="text-foreground-muted" />
              ) : (
                <p className="text-foreground-muted">説明なし</p>
              )}
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

              {currentTab === 'review' && (
                <ReviewPanel testSuiteId={testSuiteId} />
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
        )}
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

      {/* テストケースコピーモーダル */}
      {isCopyModalOpen && selectedTestCaseDetail && (
        <CopyTestCaseModal
          isOpen={isCopyModalOpen}
          testCase={selectedTestCaseDetail}
          testSuiteId={testSuiteId!}
          onClose={() => setIsCopyModalOpen(false)}
          onCopied={() => {
            queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
            toast.success('テストケースをコピーしました');
            setIsCopyModalOpen(false);
          }}
        />
      )}

      {/* レビューセッションバー（レビュー中に画面下部に表示） */}
      <ReviewSessionBar />
    </div>
    </ReviewSessionProvider>
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
