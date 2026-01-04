import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Loader2,
  FileText,
  History,
  Settings,
  AlertTriangle,
  Pencil,
  Copy,
  MessageSquare,
} from 'lucide-react';
import {
  testCasesApi,
  ApiError,
  type TestCase,
  type TestCaseWithDetails,
  type ProjectMemberRole,
} from '../../lib/api';
import { toast } from '../../stores/toast';
import { useAuth } from '../../hooks/useAuth';
import { TestCasePreconditionList } from './TestCasePreconditionList';
import { TestCaseStepList } from './TestCaseStepList';
import { TestCaseExpectedResultList } from './TestCaseExpectedResultList';
import { TestCaseHistoryList } from './TestCaseHistoryList';
import { DeleteTestCaseSection } from './DeleteTestCaseSection';
import { CopyTestCaseModal } from './CopyTestCaseModal';
import { ReviewCommentList } from '../review/ReviewCommentList';
import { TestCaseForm } from './TestCaseForm';

/**
 * タブ定義
 */
type TabType = 'overview' | 'review' | 'history' | 'settings';

const TABS: { id: TabType; label: string; icon: typeof FileText }[] = [
  { id: 'overview', label: '概要', icon: FileText },
  { id: 'review', label: 'レビュー', icon: MessageSquare },
  { id: 'history', label: '履歴', icon: History },
  { id: 'settings', label: '設定', icon: Settings },
];

/**
 * 優先度バッジの色
 */
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-danger text-white',
  HIGH: 'bg-warning text-white',
  MEDIUM: 'bg-accent text-white',
  LOW: 'bg-foreground-muted text-white',
};

/**
 * 優先度のラベル
 */
const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: '緊急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

/**
 * ステータスバッジの色
 */
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-foreground-muted/20 text-foreground-muted',
  ACTIVE: 'bg-success/20 text-success',
  ARCHIVED: 'bg-warning/20 text-warning',
};

/**
 * ステータスのラベル
 */
const STATUS_LABELS: Record<string, string> = {
  DRAFT: '下書き',
  ACTIVE: 'アクティブ',
  ARCHIVED: 'アーカイブ',
};

interface TestCaseDetailPanelProps {
  /** テストケースID */
  testCaseId: string;
  /** テストスイートID（キャッシュ用） */
  testSuiteId: string;
  /** プロジェクトID（編集フォーム用） */
  projectId: string;
  /** 現在のユーザーのロール */
  currentRole?: 'OWNER' | ProjectMemberRole;
  /** 閉じるハンドラ */
  onClose: () => void;
  /** 更新時のコールバック */
  onUpdated?: (testCase: TestCase) => void;
  /** 削除時のコールバック */
  onDeleted?: () => void;
}

/**
 * テストケース詳細パネル
 */
export function TestCaseDetailPanel({
  testCaseId,
  testSuiteId,
  projectId,
  currentRole,
  onClose,
  onUpdated,
  onDeleted,
}: TestCaseDetailPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('overview');
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // テストケース詳細を取得
  const {
    data: testCaseData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['test-case-details', testCaseId],
    queryFn: () => testCasesApi.getByIdWithDetails(testCaseId),
    enabled: !!testCaseId,
  });

  const testCase = testCaseData?.testCase;

  // 権限チェック
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';

  // 更新時のハンドラ
  const handleUpdated = (updatedTestCase: TestCase) => {
    queryClient.invalidateQueries({ queryKey: ['test-case-details', testCaseId] });
    queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
    onUpdated?.(updatedTestCase);
  };

  // 削除時のハンドラ
  const handleDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
    onDeleted?.();
  };

  // キーボードショートカット（ESCで閉じる）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="h-6 w-48 bg-background-tertiary rounded animate-pulse" />
          <button
            onClick={onClose}
            className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  if (error || !testCase) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">エラー</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <AlertTriangle className="w-12 h-12 text-danger mb-4" />
          <p className="text-danger mb-4">
            {error instanceof ApiError ? error.message : 'テストケースの取得に失敗しました'}
          </p>
          <button className="btn btn-primary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    );
  }

  // 編集モード時はTestCaseFormを表示
  if (isEditMode) {
    return (
      <TestCaseForm
        mode="edit"
        testSuiteId={testSuiteId}
        projectId={projectId}
        testCase={testCase}
        onSave={() => {
          setIsEditMode(false);
          queryClient.invalidateQueries({ queryKey: ['test-case-details', testCaseId] });
          queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
        }}
        onCancel={() => setIsEditMode(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {testCase.title}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[testCase.priority]}`}>
                {PRIORITY_LABELS[testCase.priority]}
              </span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[testCase.status]}`}>
                {STATUS_LABELS[testCase.status]}
              </span>
              {testCase.deletedAt && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-danger/20 text-danger">
                  削除予定
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canEdit && (
              <button
                onClick={() => setIsEditMode(true)}
                className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
                aria-label="編集"
                title="編集"
              >
                <Pencil className="w-5 h-5" />
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setIsCopyModalOpen(true)}
                className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
                aria-label="テストケースをコピー"
                title="テストケースをコピー"
              >
                <Copy className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="mt-4 -mb-4">
          <nav className="flex gap-4" aria-label="タブ">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`
                    flex items-center gap-1.5 px-1 py-2 text-sm font-medium border-b-2 transition-colors
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
      <div className="flex-1 overflow-y-auto p-4">
        {currentTab === 'overview' && (
          <OverviewTab
            testCase={testCase}
            currentRole={currentRole}
          />
        )}

        {currentTab === 'review' && user && (
          <ReviewCommentList
            targetType="CASE"
            targetId={testCaseId}
            currentUserId={user.id}
            currentRole={currentRole}
          />
        )}

        {currentTab === 'history' && (
          <TestCaseHistoryList testCase={testCase} />
        )}

        {currentTab === 'settings' && (
          <DeleteTestCaseSection
            testCase={testCase}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
            canEdit={canEdit}
          />
        )}
      </div>

      {/* コピーモーダル */}
      <CopyTestCaseModal
        isOpen={isCopyModalOpen}
        testCase={testCase}
        testSuiteId={testSuiteId}
        onClose={() => setIsCopyModalOpen(false)}
        onCopied={() => {
          queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
          toast.success('テストケースをコピーしました');
          setIsCopyModalOpen(false);
        }}
      />
    </div>
  );
}

/**
 * 概要タブ（表示のみ）
 */
function OverviewTab({
  testCase,
  currentRole,
}: {
  testCase: TestCaseWithDetails;
  currentRole?: 'OWNER' | ProjectMemberRole;
}) {
  return (
    <div className="space-y-6">
      {/* 説明 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">説明</h3>
        {testCase.description ? (
          <p className="text-sm text-foreground-muted whitespace-pre-wrap">
            {testCase.description}
          </p>
        ) : (
          <p className="text-sm text-foreground-subtle italic">
            説明なし
          </p>
        )}
      </div>

      {/* 基本情報 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 優先度 */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">優先度</h3>
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[testCase.priority]}`}>
            {PRIORITY_LABELS[testCase.priority]}
          </span>
        </div>

        {/* ステータス */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">ステータス</h3>
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[testCase.status]}`}>
            {STATUS_LABELS[testCase.status]}
          </span>
        </div>
      </div>

      {/* 前提条件 */}
      <TestCasePreconditionList
        testCaseId={testCase.id}
        initialPreconditions={testCase.preconditions}
        currentRole={currentRole}
      />

      {/* テスト手順 */}
      <TestCaseStepList
        testCaseId={testCase.id}
        initialSteps={testCase.steps}
        currentRole={currentRole}
      />

      {/* 期待結果 */}
      <TestCaseExpectedResultList
        testCaseId={testCase.id}
        initialExpectedResults={testCase.expectedResults}
        currentRole={currentRole}
      />
    </div>
  );
}
