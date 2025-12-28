import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Trash2, RotateCcw, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { DELETION_GRACE_PERIOD_DAYS } from '@agentest/shared';
import { projectsApi, ApiError, type Project } from '../../lib/api';
import { toast } from '../../stores/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface DeleteProjectSectionProps {
  /** プロジェクト */
  project: Project;
  /** 削除日時（論理削除済みの場合） */
  deletedAt?: string | null;
  /** プロジェクト更新時のコールバック */
  onUpdated?: (project: Project) => void;
}

/**
 * 削除済みプロジェクトの残り日数を計算
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
 * プロジェクト削除・復元セクション
 */
export function DeleteProjectSection({ project, deletedAt, onUpdated }: DeleteProjectSectionProps) {
  const navigate = useNavigate();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const isDeleted = !!deletedAt;
  const remainingDays = deletedAt ? getRemainingDays(deletedAt) : null;

  // プロジェクト削除
  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await projectsApi.delete(project.id);
      toast.success('プロジェクトを削除しました');
      navigate('/projects');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('プロジェクトの削除に失敗しました');
      }
      setIsDeleting(false);
      setIsConfirmOpen(false);
    }
  };

  // プロジェクト復元
  const handleRestore = async () => {
    setIsRestoring(true);

    try {
      const response = await projectsApi.restore(project.id);
      toast.success('プロジェクトを復元しました');
      onUpdated?.(response.project);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('プロジェクトの復元に失敗しました');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // 削除済みプロジェクトの場合
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
                このプロジェクトは削除予定です
              </h3>
              <p className="text-foreground-muted text-sm mb-4">
                {remainingDays === 0
                  ? '本日中に完全に削除されます。復元する場合は今すぐ操作してください。'
                  : `あと${remainingDays}日で完全に削除されます。復元する場合は期限内に操作してください。`}
              </p>
              <p className="text-foreground-subtle text-sm">
                完全に削除されると、すべてのテストスイート、テストケース、実行履歴が失われ、復元できなくなります。
              </p>
            </div>
          </div>
        </div>

        {/* 復元セクション */}
        <div className="card p-6 border-success">
          <h3 className="text-lg font-semibold text-success mb-2">プロジェクトを復元</h3>
          <p className="text-foreground-muted text-sm mb-4">
            このプロジェクトを復元すると、削除前の状態に戻ります。
            すべてのテストスイート、テストケース、実行履歴が復元されます。
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
            {isRestoring ? '復元中...' : 'プロジェクトを復元'}
          </button>
        </div>
      </div>
    );
  }

  // 通常のプロジェクトの場合
  return (
    <div className="space-y-6">
      <div className="card p-6 border-danger">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-danger" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-danger mb-2">
              プロジェクトを削除
            </h3>
            <p className="text-foreground-muted text-sm mb-4">
              プロジェクトを削除すると、{DELETION_GRACE_PERIOD_DAYS}日間の猶予期間後に完全に削除されます。
              猶予期間中は復元することができます。
            </p>
            <ul className="text-foreground-subtle text-sm mb-4 space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                すべてのテストスイートが削除されます
              </li>
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
                プロジェクトメンバーは全員アクセスできなくなります
              </li>
            </ul>
            <button
              className="btn btn-danger flex items-center gap-2"
              onClick={() => setIsConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              プロジェクトを削除
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="プロジェクトを削除"
        message={`本当に「${project.name}」を削除しますか？${DELETION_GRACE_PERIOD_DAYS}日間の猶予期間後に完全に削除されます。猶予期間中は復元することができます。`}
        confirmLabel="削除する"
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={isDeleting}
        isDanger
      />
    </div>
  );
}
