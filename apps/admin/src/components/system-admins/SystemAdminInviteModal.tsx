import { useState } from 'react';
import { X } from 'lucide-react';
import type { SystemAdminRole } from '@agentest/shared/types';

interface SystemAdminInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { email: string; name: string; role: SystemAdminRole }) => Promise<void>;
  isLoading?: boolean;
}

const roleOptions: { value: SystemAdminRole; label: string; description: string }[] = [
  { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN', description: '全機能にアクセス可能' },
  { value: 'ADMIN', label: 'ADMIN', description: '一般管理機能にアクセス可能' },
  { value: 'VIEWER', label: 'VIEWER', description: '閲覧のみ' },
];

/**
 * システム管理者招待モーダル
 */
export function SystemAdminInviteModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: SystemAdminInviteModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<SystemAdminRole>('ADMIN');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !name) {
      setError('メールアドレスと名前は必須です');
      return;
    }

    try {
      await onSubmit({ email, name, role });
      // 成功したらフォームをリセット
      setEmail('');
      setName('');
      setRole('ADMIN');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待に失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">管理者を招待</h2>
          <button
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-error bg-error/10 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              メールアドレス <span className="text-error">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="admin@example.com"
              required
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-foreground">
              名前 <span className="text-error">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="管理者太郎"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              ロール <span className="text-error">*</span>
            </label>
            <div className="space-y-2">
              {roleOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    role === option.value
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:border-foreground-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={(e) => setRole(e.target.value as SystemAdminRole)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-foreground">{option.label}</div>
                    <div className="text-sm text-foreground-muted">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isLoading}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? '処理中...' : '招待する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
