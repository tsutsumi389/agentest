import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Trash2, RotateCcw, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { DELETION_GRACE_PERIOD_DAYS } from '@agentest/shared';
import { testSuitesApi, ApiError, type TestSuite } from '../../lib/api';
import { toast } from '../../stores/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface DeleteTestSuiteSectionProps {
  /** テストスイート */
  testSuite: TestSuite;
  /** プロジェクトID（削除後の遷移先） */
  projectId: string;
  /** テストスイート更新時のコールバック */
  onUpdated?: (testSuite: TestSuite) => void;
  /** 編集権限があるか */
  canEdit?: boolean;
}

/**
 * 削除済みテストスイートの残り日数を計算
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
 * テストスイート削除・復元セクション
 */
export function DeleteTestSuiteSection({
  testSuite,
  projectId,
  onUpdated,
  canEdit = false,
}: DeleteTestSuiteSectionProps) {
  const navigate = useNavigate();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const isDeleted = !!testSuite.deletedAt;
  const remainingDays = testSuite.deletedAt ? getRemainingDays(testSuite.deletedAt) : null;

  // テストスイート削除
  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await testSuitesApi.delete(testSuite.id);
      toast.success('テストスイートを削除しました');
      navigate(`/projects/${projectId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('テストスイートの削除に失敗しました');
      }
      setIsDeleting(false);
      setIsConfirmOpen(false);
    }
  };

  // テストスイート復元
  const handleRestore = async () => {
    setIsRestoring(true);

    try {
      const response = await testSuitesApi.restore(testSuite.id);
      toast.success('テストスイートを復元しました');
      onUpdated?.(response.testSuite);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('テストスイートの復元に失敗しました');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // 権限がない場合
  if (!canEdit) {
    return (
      <div className="card p-6">
        <div className="text-center py-8">
          <p className="text-foreground-muted">テストスイートの削除には管理者権限が必要です</p>
        </div>
      </div>
    );
  }

  // 削除済みテストスイートの場合
  if (isDeleted) {
    return (
      <div className="space-y-6">
        {/* 削除予定通知 */}
        <div className="card p-6 border-warning bg-warning/5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Clock className="w-6 h-6 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-warning mb-2">
                このテストスイートは削除予定です
              </h3>
              <p className="text-foreground-muted text-sm mb-4">
                {remainingDays === 0
                  ? '本日中に完全に削除されます。復元する場合は今すぐ操作してください。'
                  : `あと${remainingDays}日で完全に削除されます。復元する場合は期限内に操作してください。`}
              </p>
              <p className="text-foreground-subtle text-sm">
                完全に削除されると、すべてのテストケース、実行履歴、前提条件が失われ、復元できなくなります。
              </p>
            </div>
          </div>
        </div>

        {/* 復元セクション */}
        <div className="card p-6 border-success">
          <h3 className="text-lg font-semibold text-success mb-2">テストスイートを復元</h3>
          <p className="text-foreground-muted text-sm mb-4">
            このテストスイートを復元すると、削除前の状態に戻ります。
            すべてのテストケース、実行履歴、前提条件が復元されます。
          </p>
          <button
            className="btn btn-success flex items-center gap-2"
            onClick={handleRestore}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            {isRestoring ? '復元中...' : 'テストスイートを復元'}
          </button>
        </div>
      </div>
    );
  }

  // 通常のテストスイートの場合
  return (
    <div className="space-y-6">
      <div className="card p-6 border-danger">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-danger" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-danger mb-2">テストスイートを削除</h3>
            <p className="text-foreground-muted text-sm mb-4">
              テストスイートを削除すると、{DELETION_GRACE_PERIOD_DAYS}
              日間の猶予期間後に完全に削除されます。 猶予期間中は復元することができます。
            </p>
            <ul className="text-foreground-subtle text-sm mb-4 space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                すべてのテストケースが削除されます
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                すべての実行履歴が削除されます
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                すべての前提条件が削除されます
              </li>
            </ul>
            <button
              className="btn btn-danger flex items-center gap-2"
              onClick={() => setIsConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              テストスイートを削除
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="テストスイートを削除"
        message={`本当に「${testSuite.name}」を削除しますか？${DELETION_GRACE_PERIOD_DAYS}日間の猶予期間後に完全に削除されます。猶予期間中は復元することができます。`}
        confirmLabel="削除する"
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={isDeleting}
        isDanger
      />
    </div>
  );
}
