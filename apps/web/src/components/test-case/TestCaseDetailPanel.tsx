import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Loader2,
  FileText,
  History,
  Settings,
  AlertTriangle,
  Pencil,
  Check,
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
  currentRole,
  onClose,
  onUpdated,
  onDeleted,
}: TestCaseDetailPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('overview');
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

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

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <EditableTitle
              testCase={testCase}
              canEdit={canEdit}
              onUpdated={handleUpdated}
            />
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
            canEdit={canEdit}
            onUpdated={handleUpdated}
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
 * 編集可能タイトル
 */
function EditableTitle({
  testCase,
  canEdit,
  onUpdated,
}: {
  testCase: TestCase;
  canEdit: boolean;
  onUpdated: (testCase: TestCase) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(testCase.title);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 編集モード開始時にフォーカス
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  // タイトルの同期
  useEffect(() => {
    setTitle(testCase.title);
  }, [testCase.title]);

  const handleSave = async () => {
    if (!title.trim() || title === testCase.title) {
      setTitle(testCase.title);
      setIsEditing(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await testCasesApi.update(testCase.id, { title: title.trim() });
      onUpdated(response.testCase);
      setIsEditing(false);
      toast.success('タイトルを更新しました');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('タイトルの更新に失敗しました');
      }
      setTitle(testCase.title);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setTitle(testCase.title);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="input text-lg font-semibold flex-1"
          disabled={isSubmitting}
        />
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin text-foreground-muted" />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <h2 className="text-lg font-semibold text-foreground truncate">
        {testCase.title}
      </h2>
      {canEdit && (
        <button
          onClick={() => setIsEditing(true)}
          className="p-1 text-foreground-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="タイトルを編集"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * 概要タブ
 */
function OverviewTab({
  testCase,
  currentRole,
  canEdit,
  onUpdated,
}: {
  testCase: TestCaseWithDetails;
  currentRole?: 'OWNER' | ProjectMemberRole;
  canEdit: boolean;
  onUpdated: (testCase: TestCase) => void;
}) {
  return (
    <div className="space-y-6">
      {/* 説明 */}
      <EditableDescription
        testCase={testCase}
        canEdit={canEdit}
        onUpdated={onUpdated}
      />

      {/* 基本情報 */}
      <BasicInfoSection
        testCase={testCase}
        canEdit={canEdit}
        onUpdated={onUpdated}
      />

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

/**
 * 編集可能説明
 */
function EditableDescription({
  testCase,
  canEdit,
  onUpdated,
}: {
  testCase: TestCase;
  canEdit: boolean;
  onUpdated: (testCase: TestCase) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(testCase.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setDescription(testCase.description || '');
  }, [testCase.description]);

  const handleSave = async () => {
    const newDescription = description.trim() || null;
    if (newDescription === testCase.description) {
      setIsEditing(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await testCasesApi.update(testCase.id, { description: newDescription || '' });
      onUpdated(response.testCase);
      setIsEditing(false);
      toast.success('説明を更新しました');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('説明の更新に失敗しました');
      }
      setDescription(testCase.description || '');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">説明</h3>
        <textarea
          ref={textareaRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input w-full resize-none"
          rows={3}
          placeholder="テストケースの説明を入力..."
          disabled={isSubmitting}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="btn btn-primary btn-sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            保存
          </button>
          <button
            onClick={() => {
              setDescription(testCase.description || '');
              setIsEditing(false);
            }}
            className="btn btn-secondary btn-sm"
            disabled={isSubmitting}
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 group">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">説明</h3>
        {canEdit && (
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-foreground-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="説明を編集"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>
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
  );
}

/**
 * 基本情報セクション
 */
function BasicInfoSection({
  testCase,
  canEdit,
  onUpdated,
}: {
  testCase: TestCase;
  canEdit: boolean;
  onUpdated: (testCase: TestCase) => void;
}) {
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdatePriority = async (priority: string) => {
    if (priority === testCase.priority) {
      setIsEditingPriority(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await testCasesApi.update(testCase.id, { priority });
      onUpdated(response.testCase);
      setIsEditingPriority(false);
      toast.success('優先度を更新しました');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('優先度の更新に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (status === testCase.status) {
      setIsEditingStatus(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await testCasesApi.update(testCase.id, { status });
      onUpdated(response.testCase);
      setIsEditingStatus(false);
      toast.success('ステータスを更新しました');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('ステータスの更新に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 優先度 */}
      <div className="space-y-2 group">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">優先度</h3>
          {canEdit && !isEditingPriority && (
            <button
              onClick={() => setIsEditingPriority(true)}
              className="p-1 text-foreground-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="優先度を編集"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
        {isEditingPriority ? (
          <select
            value={testCase.priority}
            onChange={(e) => handleUpdatePriority(e.target.value)}
            onBlur={() => setIsEditingPriority(false)}
            className="input text-sm"
            disabled={isSubmitting}
            autoFocus
          >
            <option value="CRITICAL">緊急</option>
            <option value="HIGH">高</option>
            <option value="MEDIUM">中</option>
            <option value="LOW">低</option>
          </select>
        ) : (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[testCase.priority]}`}>
            {PRIORITY_LABELS[testCase.priority]}
          </span>
        )}
      </div>

      {/* ステータス */}
      <div className="space-y-2 group">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">ステータス</h3>
          {canEdit && !isEditingStatus && (
            <button
              onClick={() => setIsEditingStatus(true)}
              className="p-1 text-foreground-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="ステータスを編集"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
        {isEditingStatus ? (
          <select
            value={testCase.status}
            onChange={(e) => handleUpdateStatus(e.target.value)}
            onBlur={() => setIsEditingStatus(false)}
            className="input text-sm"
            disabled={isSubmitting}
            autoFocus
          >
            <option value="DRAFT">下書き</option>
            <option value="ACTIVE">アクティブ</option>
            <option value="ARCHIVED">アーカイブ</option>
          </select>
        ) : (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[testCase.status]}`}>
            {STATUS_LABELS[testCase.status]}
          </span>
        )}
      </div>
    </div>
  );
}
