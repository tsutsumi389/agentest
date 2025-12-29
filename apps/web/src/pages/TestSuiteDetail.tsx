import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Plus,
  Play,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  MoreHorizontal,
  History,
  Settings,
} from 'lucide-react';
import { testSuitesApi, testCasesApi, projectsApi, ApiError, type TestCase, type TestSuite, type ProjectMemberRole } from '../lib/api';
import { toast } from '../stores/toast';
import { useAuth } from '../hooks/useAuth';
import { PreconditionList } from '../components/test-suite/PreconditionList';
import { TestSuiteHistoryList } from '../components/test-suite/TestSuiteHistoryList';
import { DeleteTestSuiteSection } from '../components/test-suite/DeleteTestSuiteSection';

/**
 * タブ定義
 */
type TabType = 'overview' | 'history' | 'settings';

const TABS: { id: TabType; label: string; icon: typeof FileText }[] = [
  { id: 'overview', label: '概要', icon: FileText },
  { id: 'history', label: '履歴', icon: History },
  { id: 'settings', label: '設定', icon: Settings },
];

/**
 * テストスイート詳細ページ
 */
export function TestSuiteDetailPage() {
  const { testSuiteId } = useParams<{ testSuiteId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // 現在のタブ
  const currentTab = (searchParams.get('tab') as TabType) || 'overview';

  // タブ変更ハンドラ
  const handleTabChange = (tab: TabType) => {
    setSearchParams({ tab });
  };

  // テストスイート情報を取得
  const { data: suiteData, isLoading: isLoadingSuite } = useQuery({
    queryKey: ['test-suite', testSuiteId],
    queryFn: () => testSuitesApi.getById(testSuiteId!),
    enabled: !!testSuiteId,
  });

  const suite = suiteData?.testSuite;

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

  // 実行履歴を取得
  const { data: executionsData } = useQuery({
    queryKey: ['test-suite-executions', testSuiteId],
    queryFn: () => testSuitesApi.getExecutions(testSuiteId!, { limit: 5 }),
    enabled: !!testSuiteId,
  });

  // 実行開始
  const startExecutionMutation = useMutation({
    mutationFn: () => testSuitesApi.startExecution(testSuiteId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suite-executions', testSuiteId] });
    },
  });

  const testCases = casesData?.testCases || [];
  const executions = executionsData?.executions || [];

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

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <Link
          to={`/projects/${suite.projectId}`}
          className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          プロジェクトに戻る
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-background-tertiary flex items-center justify-center">
              <FileText className="w-6 h-6 text-foreground-muted" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{suite.name}</h1>
              <p className="text-foreground-muted">
                {suite.description || '説明なし'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn btn-secondary"
            >
              <Plus className="w-4 h-4" />
              テストケース
            </button>
            <button
              onClick={() => startExecutionMutation.mutate()}
              disabled={startExecutionMutation.isPending || testCases.length === 0}
              className="btn btn-primary"
            >
              <Play className="w-4 h-4" />
              実行開始
            </button>
          </div>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-4" aria-label="タブ">
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
      {currentTab === 'overview' && (
        <OverviewTab
          testSuiteId={testSuiteId}
          currentRole={currentRole}
          testCases={testCases}
          isLoadingCases={isLoadingCases}
          executions={executions}
          onCreateClick={() => setIsCreateModalOpen(true)}
        />
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

      {/* 作成モーダル */}
      {isCreateModalOpen && testSuiteId && (
        <CreateTestCaseModal
          testSuiteId={testSuiteId}
          onClose={() => setIsCreateModalOpen(false)}
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
  currentRole: 'OWNER' | ProjectMemberRole | undefined;
  testCases: TestCase[];
  isLoadingCases: boolean;
  executions: { id: string; status: string; startedAt: string }[];
  onCreateClick: () => void;
}

function OverviewTab({
  testSuiteId,
  currentRole,
  testCases,
  isLoadingCases,
  executions,
  onCreateClick,
}: OverviewTabProps) {
  return (
    <>
      {/* 前提条件セクション */}
      <PreconditionList testSuiteId={testSuiteId} currentRole={currentRole} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* テストケース一覧 */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-foreground">
                テストケース ({testCases.length})
              </h2>
            </div>

            {isLoadingCases ? (
              <div className="p-8 text-center text-foreground-muted">
                読み込み中...
              </div>
            ) : testCases.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
                <p className="text-foreground-muted mb-4">
                  テストケースがありません
                </p>
                <button
                  onClick={onCreateClick}
                  className="btn btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  テストケースを作成
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {testCases.map((testCase) => (
                  <TestCaseRow key={testCase.id} testCase={testCase} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 実行履歴 */}
        <div>
          <div className="card">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-foreground">実行履歴</h2>
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
      </div>
    </>
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

/**
 * テストケース行
 */
function TestCaseRow({ testCase }: { testCase: TestCase }) {
  const priorityColors = {
    CRITICAL: 'text-danger',
    HIGH: 'text-warning',
    MEDIUM: 'text-accent',
    LOW: 'text-foreground-muted',
  };

  const priorityLabels = {
    CRITICAL: '緊急',
    HIGH: '高',
    MEDIUM: '中',
    LOW: '低',
  };

  return (
    <div className="flex items-center justify-between p-4 hover:bg-background-tertiary transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-background-tertiary flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-foreground-subtle" />
        </div>
        <div>
          <p className="font-medium text-foreground">{testCase.title}</p>
          <p className="text-sm text-foreground-muted truncate max-w-md">
            {testCase.description || '説明なし'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`text-xs font-medium ${priorityColors[testCase.priority]}`}>
          {priorityLabels[testCase.priority]}
        </span>
        <button className="btn btn-ghost p-2">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * テストケース作成モーダル
 */
function CreateTestCaseModal({
  testSuiteId,
  onClose,
}: {
  testSuiteId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');

  const createMutation = useMutation({
    mutationFn: (data: { testSuiteId: string; title: string; description?: string; priority: string }) =>
      testCasesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
      toast.success('テストケースを作成しました');
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('テストケースの作成に失敗しました');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      testSuiteId,
      title,
      description: description || undefined,
      priority,
    });
  };

  // 背景クリックで閉じる
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          新規テストケース
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              タイトル <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="例: ログインフォームの表示確認"
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
              placeholder="テストケースの説明を入力..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              優先度
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="input"
            >
              <option value="CRITICAL">緊急</option>
              <option value="HIGH">高</option>
              <option value="MEDIUM">中</option>
              <option value="LOW">低</option>
            </select>
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
              disabled={!title || createMutation.isPending}
            >
              {createMutation.isPending ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
