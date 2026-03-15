import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { ApiError } from '../../lib/api';

/**
 * プロフィール設定
 */
export function ProfileSettings() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // ユーザー情報が変更されたら入力値をリセット
  useEffect(() => {
    setName(user?.name || '');
    setValidationError(null);
  }, [user?.name]);

  const hasChanges = name !== user?.name;

  // 入力値を元に戻す
  const handleCancel = () => {
    setName(user?.name || '');
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // バリデーション
    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('表示名を入力してください');
      return;
    }
    if (trimmedName.length > 100) {
      setValidationError('表示名は100文字以内で入力してください');
      return;
    }

    setIsSaving(true);
    try {
      await updateUser({ name: trimmedName });
      toast.success('プロフィールを更新しました');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.name) {
          setValidationError(error.details.name[0]);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('プロフィールの更新に失敗しました');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">プロフィール</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4 mb-6">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center">
              <span className="text-2xl font-medium text-accent">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-medium text-foreground">{user?.name}</p>
            <p className="text-sm text-foreground-muted">{user?.email}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">表示名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setValidationError(null);
            }}
            className={`input max-w-md ${validationError ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
            disabled={isSaving}
          />
          {validationError && <p className="text-xs text-danger mt-1">{validationError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">メールアドレス</label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="input max-w-md bg-background-tertiary"
          />
          <p className="text-xs text-foreground-subtle mt-1">
            メールアドレスはOAuthプロバイダーから取得されています
          </p>
        </div>

        <div className="pt-4 flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={isSaving || !hasChanges}>
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? '保存中...' : '保存'}
          </button>
          {hasChanges && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
              disabled={isSaving}
            >
              キャンセル
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
