import { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { DELETION_GRACE_PERIOD_DAYS } from '@agentest/shared';
import { testCasesApi, ApiError, type TestCase } from '../../lib/api';
import { toast } from '../../stores/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface DeleteTestCaseSectionProps {
  /** テストケース */
  testCase: TestCase;
  /** テストケース更新時のコールバック */
  onUpdated?: (testCase: TestCase) => void;
  /** 削除後のコールバック */
  onDeleted?: () => void;
  /** 編集権限があるか */
  canEdit?: boolean;
}

/**
 * 削除済みテストケースの残り日数を計算
 */
function getRemainingDays(deletedAt: string): number {
  const deletionDate = new Date(deletedAt);
  const permanentDeletionDate = new Date(deletionDate);
  permanentDeletionDate.setDate(permanentDeletionDate.getDate() + DELETION_GRACE_PERIOD_DAYS);

  const now = new Date();
  const remainingMs = permanentDeletionDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
}

/**
 * テストケース削除・復元セクション
 */
export function DeleteTestCaseSection({
  testCase,
  onUpdated,
  onDeleted,
  canEdit = false,
}: DeleteTestCaseSectionProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const isDeleted = !!testCase.deletedAt;
  const remainingDays = testCase.deletedAt ? getRemainingDays(testCase.deletedAt) : null;

  // テストケース削除
  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await testCasesApi.delete(testCase.id);
      toast.success('テストケースを削除しました');
      onDeleted?.();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('テストケースの削除に失敗しました');
      }
      setIsDeleting(false);
      setIsConfirmOpen(false);
    }
  };

  // テストケース復元
  const handleRestore = async () => {
    setIsRestoring(true);

    try {
      const response = await testCasesApi.restore(testCase.id);
      toast.success('テストケースを復元しました');
      onUpdated?.(response.testCase);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('テストケースの復元に失敗しました');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // 権限がない場合
  if (!canEdit) {
    return (
      <div className="text-center py-8">
        <p className="text-foreground-muted text-sm">
          テストケースの削除には編集権限が必要です
        </p>
      </div>
    );
  }

  // 削除済みテストケースの場合
  if (isDeleted) {
    return (
      <div className="space-y-4">
        {/* 削除予定通知 */}
        <div className="p-4 rounded-lg border border-warning bg-warning/5">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-warning mb-1">
                このテストケースは削除予定です
              </h4>
              <p className="text-foreground-muted text-xs">
                {remainingDays === 0
                  ? '本日中に完全に削除されます。復元する場合は今すぐ操作してください。'
                  : `あと${remainingDays}日で完全に削除されます。`}
              </p>
            </div>
          </div>
        </div>

        {/* 復元セクション */}
        <div className="p-4 rounded-lg border border-success">
          <h4 className="text-sm font-semibold text-success mb-2">テストケースを復元</h4>
          <p className="text-foreground-muted text-xs mb-3">
            このテストケースを復元すると、削除前の状態に戻ります。
          </p>
          <button
            className="btn btn-success btn-sm flex items-center gap-2"
            onClick={handleRestore}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            {isRestoring ? '復元中...' : 'テストケースを復元'}
          </button>
        </div>
      </div>
    );
  }

  // 通常のテストケースの場合
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-danger">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-danger mb-1">
              テストケースを削除
            </h4>
            <p className="text-foreground-muted text-xs mb-3">
              テストケースを削除すると、{DELETION_GRACE_PERIOD_DAYS}日間の猶予期間後に完全に削除されます。
              猶予期間中は復元することができます。
            </p>
            <ul className="text-foreground-subtle text-xs mb-3 space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-danger" />
                すべての前提条件が削除されます
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-danger" />
                すべてのテスト手順が削除されます
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-danger" />
                すべての期待結果が削除されます
              </li>
            </ul>
            <button
              className="btn btn-danger btn-sm flex items-center gap-2"
              onClick={() => setIsConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              テストケースを削除
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="テストケースを削除"
        message={`本当に「${testCase.title}」を削除しますか？${DELETION_GRACE_PERIOD_DAYS}日間の猶予期間後に完全に削除されます。猶予期間中は復元することができます。`}
        confirmLabel="削除する"
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={isDeleting}
        isDanger
      />
    </div>
  );
}
