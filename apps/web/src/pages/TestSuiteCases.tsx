import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testSuitesApi, projectsApi, type TestCase, type ProjectMemberRole } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { usePageSidebar } from '../components/Layout';
import { TestSuiteHeader } from '../components/test-suite/TestSuiteHeader';
import { TestCaseSidebar } from '../components/test-suite/TestCaseSidebar';
import { TestCaseDetailPanel } from '../components/test-case/TestCaseDetailPanel';
import { TestCaseForm } from '../components/test-case/TestCaseForm';
import { TestSuiteForm } from '../components/test-suite/TestSuiteForm';
import { StartExecutionModal } from '../components/execution/StartExecutionModal';

/**
 * テストケース一覧ページ
 * テストスイートのテストケースを表示・編集する
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

  // URLクエリパラメータから作成モードを取得
  const isCreateMode = searchParams.get('mode') === 'create';

  // URLクエリパラメータから選択状態を取得
  const selectedTestCaseId = searchParams.get('testCase');

  // テストケース選択ハンドラ（URLを更新）
  const handleSelectTestCase = useCallback((testCaseId: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    // 作成モードを解除
    newParams.delete('mode');
    if (testCaseId) {
      newParams.set('testCase', testCaseId);
    } else {
      newParams.delete('testCase');
    }
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // 作成モード開始ハンドラ
  const handleStartCreateMode = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('mode', 'create');
    newParams.delete('testCase');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // 作成モード終了ハンドラ
  const handleExitCreateMode = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('mode');
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
      />

      {/* メインコンテンツ（テストケース表示領域） */}
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
              }}
              onDeleted={() => {
                handleSelectTestCase(null);
                queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
              }}
            />
          </div>
        ) : (
          // テストケース未選択時: ガイドメッセージを表示
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-foreground-muted">
              <p className="text-lg mb-2">テストケースを選択してください</p>
              <p className="text-sm">
                左のサイドバーからテストケースを選択するか、
                <br />
                「テストケース」ボタンをクリックして新規作成できます
              </p>
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
    </div>
  );
}
