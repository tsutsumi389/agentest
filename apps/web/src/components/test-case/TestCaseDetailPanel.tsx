import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import {
  testCasesApi,
  ApiError,
  type TestCase,
  type TestCaseWithDetails,
  type ProjectMemberRole,
} from '../../lib/api';
import { hasWritePermission } from '../../lib/permissions';
import { useReviewSession } from '../../contexts/ReviewSessionContext';
import { TestCaseItemList } from './TestCaseItemList';
import { TestCaseHistoryList } from './TestCaseHistoryList';
import { DeleteTestCaseSection } from './DeleteTestCaseSection';
import { CommentableField } from '../review/CommentableField';
import { TestCaseForm } from './TestCaseForm';
import { type TestCaseTabType } from '../test-suite/TestSuiteHeader';
import { MarkdownPreview } from '../common/markdown';
import type { ReviewCommentWithReplies } from '../../lib/api';

// TestCaseTabTypeをTabTypeとしてもエクスポート（後方互換性のため）
export type TabType = TestCaseTabType;

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
  /** 現在のタブ（親から受け取る） */
  currentTab?: TabType;
  /** 編集モード状態 */
  isEditMode?: boolean;
  /** 編集モード終了ハンドラ */
  onEditModeChange?: (isEdit: boolean) => void;
}

/**
 * テストケース詳細パネル
 * ヘッダーとタブナビゲーションは親コンポーネント（TestSuiteHeader）で表示
 * このコンポーネントはタブコンテンツのみを表示する
 */
export function TestCaseDetailPanel({
  testCaseId,
  testSuiteId,
  projectId,
  currentRole,
  onClose,
  onUpdated,
  onDeleted,
  currentTab = 'overview',
  isEditMode = false,
  onEditModeChange,
}: TestCaseDetailPanelProps) {
  const queryClient = useQueryClient();

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
  const canEdit = hasWritePermission(currentRole);

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
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  if (error || !testCase) {
    return (
      <div className="flex flex-col h-full">
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
          onEditModeChange?.(false);
          queryClient.invalidateQueries({ queryKey: ['test-case-details', testCaseId] });
          queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
        }}
        onCancel={() => onEditModeChange?.(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* タブコンテンツ */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentTab === 'overview' && <OverviewTab testCase={testCase} canEdit={canEdit} />}

        {currentTab === 'history' && <TestCaseHistoryList testCase={testCase} />}

        {currentTab === 'settings' && (
          <DeleteTestCaseSection
            testCase={testCase}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}

/**
 * テストケース情報を取得するフック（親コンポーネントで使用）
 */
export function useTestCaseDetails(testCaseId: string | null) {
  return useQuery({
    queryKey: ['test-case-details', testCaseId],
    queryFn: () => testCasesApi.getByIdWithDetails(testCaseId!),
    enabled: !!testCaseId,
  });
}

/**
 * 概要タブ（表示のみ）
 */
function OverviewTab({ testCase, canEdit }: { testCase: TestCaseWithDetails; canEdit: boolean }) {
  const { currentReview, refreshReview } = useReviewSession();

  // 現在のレビューセッションからコメントを取得
  const comments: ReviewCommentWithReplies[] = currentReview?.comments || [];

  // コメント追加時のコールバック
  const handleCommentAdded = () => {
    refreshReview();
  };

  return (
    <div className="space-y-6">
      {/* 説明 */}
      <CommentableField
        targetType="CASE"
        targetId={testCase.id}
        targetField="DESCRIPTION"
        fieldContent={testCase.description || undefined}
        comments={comments}
        canEdit={canEdit}
        onCommentAdded={handleCommentAdded}
      >
        <div className="card">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">説明</h2>
          </div>
          {testCase.description ? (
            <div className="p-4">
              <MarkdownPreview content={testCase.description} />
            </div>
          ) : (
            <div className="p-4 text-center text-foreground-muted">説明なし</div>
          )}
        </div>
      </CommentableField>

      {/* 前提条件 */}
      <TestCaseItemList
        type="precondition"
        testCaseId={testCase.id}
        initialItems={testCase.preconditions}
        comments={comments}
        canEdit={canEdit}
        onCommentAdded={handleCommentAdded}
      />

      {/* テスト手順 */}
      <TestCaseItemList
        type="step"
        testCaseId={testCase.id}
        initialItems={testCase.steps}
        comments={comments}
        canEdit={canEdit}
        onCommentAdded={handleCommentAdded}
      />

      {/* 期待結果 */}
      <TestCaseItemList
        type="expectedResult"
        testCaseId={testCase.id}
        initialItems={testCase.expectedResults}
        comments={comments}
        canEdit={canEdit}
        onCommentAdded={handleCommentAdded}
      />
    </div>
  );
}
