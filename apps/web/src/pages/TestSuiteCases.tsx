import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { testSuitesApi, projectsApi, labelsApi, type TestCase, type TestSuite, type ProjectMemberRole, type ReviewCommentWithReplies, type Label, type Execution } from '../lib/api';
import { formatDateTime, formatRelativeTime } from '../lib/date';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useAuth } from '../hooks/useAuth';
import { useCurrentProject } from '../hooks/useCurrentProject';
import { usePageSidebar } from '../components/Layout';
import { useTestSuiteRealtime } from '../hooks/useTestSuiteRealtime';
import { useTestCaseRealtime } from '../hooks/useTestCaseRealtime';
import { toast } from '../stores/toast';
import { TestSuiteHeader, type TabType, type TestCaseTabType } from '../components/test-suite/TestSuiteHeader';
import { TestCaseSidebar, type TestCaseFilter } from '../components/test-suite/TestCaseSidebar';
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
import { ReviewSessionProvider, useReviewSession } from '../contexts/ReviewSessionContext';
import { CommentableField } from '../components/review/CommentableField';
import { MarkdownPreview } from '../components/common/markdown/MarkdownPreview';
import { LabelSelector } from '../components/label/LabelSelector';

/**
 * テストスイート統合ページ
 * サイドバー（テストケース一覧）は常に表示し、メインエリアでタブとテストケース詳細を切り替える
 */
export function TestSuiteCasesPage() {
  const { testSuiteId } = useParams<{ testSuiteId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { project } = useCurrentProject();
  const { setSidebarContent } = usePageSidebar();
  const navigate = useNavigate();
  const [isStartExecutionModalOpen, setIsStartExecutionModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isTestCaseEditMode, setIsTestCaseEditMode] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<TestCaseFilter>('active');

  // URLクエリパラメータから作成モードを取得
  const isCreateMode = searchParams.get('mode') === 'create';

  // URLクエリパラメータから選択状態を取得
  const selectedTestCaseId = searchParams.get('testCase');

  // URLクエリパラメータからタブを取得
  const currentTab = (searchParams.get('tab') as TabType) || 'overview';

  // URLクエリパラメータからテストケースタブを取得
  const testCaseTab = (searchParams.get('testCaseTab') as TestCaseTabType) || 'overview';

  // WebSocketリアルタイム更新を有効化
  useTestSuiteRealtime(testSuiteId);
  useTestCaseRealtime(selectedTestCaseId ?? undefined);

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

  // 概要表示ハンドラ（テストケース選択を解除して概要タブを表示）
  const handleShowOverview = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('testCase');
    newParams.delete('testCaseTab');
    newParams.delete('mode');
    newParams.set('tab', 'overview');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // テストスイート情報を取得
  const { data: suiteData, isLoading: isLoadingSuite } = useQuery({
    queryKey: ['test-suite', testSuiteId],
    queryFn: () => testSuitesApi.getById(testSuiteId!),
    enabled: !!testSuiteId,
  });

  const suite = suiteData?.testSuite;

  // 前提条件を取得（編集モード用）
  // PreconditionList.tsx と同じクエリキー・データ形式を使用
  const { data: preconditionsData } = useQuery({
    queryKey: ['test-suite-preconditions', testSuiteId],
    queryFn: async () => {
      const response = await testSuitesApi.getPreconditions(testSuiteId!);
      const items = response?.preconditions ?? [];
      return items.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
    },
    enabled: !!testSuiteId,
  });

  const preconditions = Array.isArray(preconditionsData) ? preconditionsData : [];

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

  // フィルタに応じたAPI パラメータ
  const filterParams = (() => {
    switch (sidebarFilter) {
      case 'active': return { status: 'ACTIVE' };
      case 'draft': return { status: 'DRAFT' };
      case 'archived': return { status: 'ARCHIVED' };
      case 'deleted': return { includeDeleted: true };
    }
  })();

  // テストケース一覧を取得（フィルタ対応）
  const { data: casesData, isLoading: isLoadingCases } = useQuery({
    queryKey: ['test-suite-cases', testSuiteId, sidebarFilter],
    queryFn: () => testSuitesApi.getTestCases(testSuiteId!, filterParams),
    enabled: !!testSuiteId,
  });

  // フィルタ変更ハンドラ
  const handleSidebarFilterChange = useCallback((filter: TestCaseFilter) => {
    setSidebarFilter(filter);
  }, []);

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

  // テストスイートのラベルを取得
  const { data: labelsData } = useQuery({
    queryKey: ['test-suite-labels', testSuiteId],
    queryFn: () => labelsApi.getByTestSuite(testSuiteId!),
    enabled: !!testSuiteId,
  });

  const suiteLabels = labelsData?.labels || [];

  // 実行開始（環境なしの直接実行用）
  const startExecutionMutation = useMutation({
    mutationFn: () => testSuitesApi.startExecution(testSuiteId!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['test-suite-executions', testSuiteId] });
      navigate(`/executions/${data.execution.id}`);
    },
  });

  // ゴミ箱フィルタ: includeDeleted=trueで削除済みを含むすべてを取得し、
  // クライアント側でdeletedAt != nullのみに絞り込む
  // （バックエンドAPIはincludeDeletedフラグのみ対応し、削除済みのみを返す機能がないため）
  // useMemoで安定化: .filter()は毎レンダーで新しい配列参照を生成するため、
  // useEffectの依存配列で無限ループを引き起こす
  const testCases = useMemo(() => {
    if (sidebarFilter === 'deleted') {
      return (casesData?.testCases || []).filter(tc => tc.deletedAt != null);
    }
    return casesData?.testCases || [];
  }, [casesData?.testCases, sidebarFilter]);
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
    queryClient.setQueryData(['test-suite-cases', testSuiteId, sidebarFilter], { testCases: reorderedTestCases });
  }, [queryClient, testSuiteId, sidebarFilter]);

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
        isOverviewMode={!selectedTestCaseId && !isCreateMode}
        onOverviewClick={handleShowOverview}
        activeFilter={sidebarFilter}
        onFilterChange={handleSidebarFilterChange}
      />
    );

    return () => setSidebarContent(null);
  }, [testSuiteId, testCases, selectedTestCaseId, currentRole, isLoadingCases, setSidebarContent, handleTestCasesReordered, handleSelectTestCase, handleStartCreateMode, isCreateMode, handleShowOverview, sidebarFilter, handleSidebarFilterChange]);

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
        {/* 編集フォーム */}
        <div className="flex-1 overflow-hidden p-4">
          <div className="card h-full overflow-hidden">
            <TestSuiteForm
              mode="edit"
              projectId={suite.projectId}
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
        {/* ヘッダー（作成・編集モード時は非表示） */}
        {!isCreateMode && !isTestCaseEditMode && (
          <TestSuiteHeader
            testSuite={suite}
            testCaseCount={testCases.length}
            currentRole={currentRole}
            onStartExecution={handleStartExecution}
            onEdit={() => setIsEditMode(true)}
            isExecutionPending={startExecutionMutation.isPending}
            currentTab={currentTab}
            onTabChange={handleTabChange}
            hasSelectedTestCase={!!selectedTestCaseId}
            isCreateMode={isCreateMode}
            // テストケース選択時のprops
            selectedTestCase={selectedTestCaseInfo}
            testCaseTab={testCaseTab}
            onTestCaseTabChange={handleTestCaseTabChange}
            onEditTestCase={() => setIsTestCaseEditMode(true)}
            onCopyTestCase={() => setIsCopyModalOpen(true)}
            // ラベル
            labels={suiteLabels}
            // パンくずリスト用プロジェクト情報
            projectId={project?.id}
            projectName={project?.name}
          />
        )}

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
              {/* タブコンテンツ */}
              <div className="flex-1 overflow-y-auto">
                {currentTab === 'overview' && (
                  <OverviewTab
                    testSuiteId={testSuiteId}
                    description={suite.description}
                    executions={executions}
                    currentRole={currentRole}
                  />
                )}

                {currentTab === 'executions' && (
                  <ExecutionHistoryList testSuiteId={testSuiteId!} projectId={suite.projectId} />
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
                    onLabelsUpdated={() => {
                      queryClient.invalidateQueries({ queryKey: ['test-suite-labels', testSuiteId] });
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
  description: string | null;
  executions: Execution[];
  currentRole: 'OWNER' | ProjectMemberRole | undefined;
}

export function OverviewTab({
  testSuiteId,
  description,
  executions,
  currentRole,
}: OverviewTabProps) {
  // ReviewSessionからコメントを取得
  const { currentReview, refreshReview } = useReviewSession();

  // 表示するコメント（レビュー中は現在のセッション）
  const displayComments: ReviewCommentWithReplies[] = currentReview?.comments || [];

  // 編集権限の判定（WRITE以上）
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';

  return (
    <div className="space-y-6">
      {/* 説明セクション（コメント可能） */}
      <CommentableField
        targetType="SUITE"
        targetId={testSuiteId}
        targetField="DESCRIPTION"
        fieldContent={description || undefined}
        comments={displayComments}
        canEdit={canEdit}
        onCommentAdded={refreshReview}
      >
        <div className="card">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">説明</h2>
          </div>
          {description ? (
            <div className="p-4">
              <MarkdownPreview content={description} />
            </div>
          ) : (
            <div className="p-4 text-center text-foreground-muted">
              説明なし
            </div>
          )}
        </div>
      </CommentableField>

      {/* 前提条件セクション */}
      <PreconditionList
        testSuiteId={testSuiteId}
        canEdit={canEdit}
        comments={displayComments}
        onCommentAdded={refreshReview}
      />

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
            {executions.map((execution) => {
              // judgmentCountsから値を取得
              const counts = execution.judgmentCounts || { PASS: 0, FAIL: 0, PENDING: 0, SKIPPED: 0 };
              const total = counts.PASS + counts.FAIL + counts.PENDING + counts.SKIPPED;
              const completedTotal = counts.PASS + counts.FAIL + counts.SKIPPED;
              const passRate = completedTotal > 0 ? Math.round((counts.PASS / completedTotal) * 100) : 0;

              return (
                <Link
                  key={execution.id}
                  to={`/executions/${execution.id}`}
                  className="block p-4 hover:bg-background-tertiary transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-foreground-muted shrink-0" />
                    <span
                      className="text-sm text-foreground shrink-0"
                      title={formatDateTime(execution.createdAt)}
                    >
                      {formatRelativeTime(execution.createdAt)}
                    </span>

                    {/* 環境名バッジ */}
                    {execution.environment && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-background-tertiary text-foreground-muted shrink-0">
                        {execution.environment.name}
                      </span>
                    )}

                    {/* プログレスバー + 合格率ラベル */}
                    {execution.judgmentCounts && total > 0 && (
                      <div className="flex items-center gap-2 flex-1 min-w-0 max-w-48">
                        <div className="flex-1 min-w-0">
                          <ProgressBar
                            passed={counts.PASS}
                            failed={counts.FAIL}
                            skipped={counts.SKIPPED}
                            total={total}
                            size="sm"
                          />
                        </div>
                        {completedTotal > 0 && (
                          <span className="text-xs text-foreground-muted font-code shrink-0" data-testid="pass-rate-label">
                            {counts.PASS}/{completedTotal} ({passRate}%)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
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
  onLabelsUpdated?: () => void;
}

function SettingsTab({ testSuite, currentRole, onUpdated, onLabelsUpdated }: SettingsTabProps) {
  const queryClient = useQueryClient();
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [initialLabelIds, setInitialLabelIds] = useState<string[]>([]);

  // ADMIN権限があるかどうか
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN';
  const canEditLabels = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';

  // プロジェクトのラベル一覧を取得
  const { data: projectLabelsData, isLoading: isLoadingProjectLabels } = useQuery({
    queryKey: ['project-labels', testSuite.projectId],
    queryFn: () => labelsApi.getByProject(testSuite.projectId),
  });

  // テストスイートに付与されているラベル一覧を取得
  const { data: suiteLabelsData, isLoading: isLoadingSuiteLabels } = useQuery({
    queryKey: ['test-suite-labels', testSuite.id],
    queryFn: () => labelsApi.getByTestSuite(testSuite.id),
  });

  // 初期値を設定
  useEffect(() => {
    if (suiteLabelsData) {
      const ids = suiteLabelsData.labels.map((l: Label) => l.id);
      setSelectedLabelIds(ids);
      setInitialLabelIds(ids);
    }
  }, [suiteLabelsData]);

  // ラベル更新mutation
  const updateLabelsMutation = useMutation({
    mutationFn: (labelIds: string[]) => labelsApi.updateTestSuiteLabels(testSuite.id, labelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suite-labels', testSuite.id] });
      setInitialLabelIds(selectedLabelIds);
      toast.success('ラベルを更新しました');
      onLabelsUpdated?.();
    },
    onError: (error) => {
      console.error('テストスイートラベル更新エラー:', error);
      toast.error('ラベルの更新に失敗しました');
    },
  });

  const projectLabels = projectLabelsData?.labels || [];
  const isLoading = isLoadingProjectLabels || isLoadingSuiteLabels;

  // 変更があるかどうか
  const hasChanges =
    selectedLabelIds.length !== initialLabelIds.length ||
    selectedLabelIds.some((id) => !initialLabelIds.includes(id));

  // 保存処理
  const handleSave = () => {
    updateLabelsMutation.mutate(selectedLabelIds);
  };

  return (
    <div className="space-y-6">
      {/* ラベルセクション */}
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">ラベル</h2>
          <p className="text-sm text-foreground-muted mt-1">
            このテストスイートに付与するラベルを選択してください
          </p>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="text-sm text-foreground-muted">読み込み中...</div>
          ) : projectLabels.length === 0 ? (
            <div className="text-sm text-foreground-muted">
              プロジェクトにラベルが登録されていません。
              プロジェクト設定からラベルを作成してください。
            </div>
          ) : (
            <div className="space-y-4">
              <LabelSelector
                availableLabels={projectLabels}
                selectedLabelIds={selectedLabelIds}
                onChange={setSelectedLabelIds}
                disabled={!canEditLabels}
                placeholder="ラベルを選択..."
              />
              {canEditLabels && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasChanges || updateLabelsMutation.isPending}
                  className="px-4 py-2 text-sm bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateLabelsMutation.isPending ? '保存中...' : '保存'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 危険な操作セクション */}
      <DeleteTestSuiteSection
        testSuite={testSuite}
        projectId={testSuite.projectId}
        onUpdated={onUpdated}
        canEdit={canEdit}
      />
    </div>
  );
}
