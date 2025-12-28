import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Shield, Pencil, Eye } from 'lucide-react';
import { projectsApi, ApiError, type ProjectMember, type ProjectMemberRole } from '../../lib/api';
import { toast } from '../../stores/toast';

interface AddProjectMemberModalProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onMemberAdded: (member: ProjectMember) => void;
}

/**
 * プロジェクトメンバー追加モーダル
 */
export function AddProjectMemberModal({
  isOpen,
  projectId,
  onClose,
  onMemberAdded,
}: AddProjectMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectMemberRole>('READ');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // モーダルを閉じる
  const handleClose = useCallback(() => {
    setEmail('');
    setRole('READ');
    setErrors({});
    onClose();
  }, [onClose]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, handleClose]);

  if (!isOpen) return null;

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'メールアドレスは必須です';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await projectsApi.addMember(projectId, {
        email: email.trim(),
        role,
      });

      toast.success('メンバーを追加しました');
      onMemberAdded(response.member);
      handleClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          setErrors({ email: 'ユーザーが見つかりません' });
        } else if (err.statusCode === 409) {
          setErrors({ email: 'このユーザーは既にメンバーです' });
        } else if (err.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [field, messages] of Object.entries(err.details)) {
            fieldErrors[field] = messages[0];
          }
          setErrors(fieldErrors);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('メンバーの追加に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 背景クリックでモーダルを閉じる
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            メンバーを追加
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* メールアドレス */}
          <div>
            <label htmlFor="member-email" className="block text-sm font-medium text-foreground mb-1">
              メールアドレス <span className="text-danger">*</span>
            </label>
            <input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((prev) => ({ ...prev, email: '' }));
              }}
              className={`input w-full ${errors.email ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
              placeholder="user@example.com"
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="text-xs text-danger mt-1">{errors.email}</p>
            )}
            <p className="text-xs text-foreground-subtle mt-1">
              既存ユーザーのメールアドレスを入力してください
            </p>
          </div>

          {/* ロール選択 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              ロール
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-background-tertiary transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="ADMIN"
                  checked={role === 'ADMIN'}
                  onChange={() => setRole('ADMIN')}
                  className="text-accent"
                  disabled={isSubmitting}
                />
                <Shield className="w-4 h-4 text-accent" />
                <div>
                  <span className="text-sm font-medium text-foreground">管理者</span>
                  <p className="text-xs text-foreground-muted">
                    すべての操作が可能。メンバー管理も可能
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-background-tertiary transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="WRITE"
                  checked={role === 'WRITE'}
                  onChange={() => setRole('WRITE')}
                  className="text-success"
                  disabled={isSubmitting}
                />
                <Pencil className="w-4 h-4 text-success" />
                <div>
                  <span className="text-sm font-medium text-foreground">編集者</span>
                  <p className="text-xs text-foreground-muted">
                    テストケース・実行の編集が可能
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-background-tertiary transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="READ"
                  checked={role === 'READ'}
                  onChange={() => setRole('READ')}
                  className="text-foreground-muted"
                  disabled={isSubmitting}
                />
                <Eye className="w-4 h-4 text-foreground-muted" />
                <div>
                  <span className="text-sm font-medium text-foreground">閲覧者</span>
                  <p className="text-xs text-foreground-muted">
                    閲覧のみ可能
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !email.trim()}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? '追加中...' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
