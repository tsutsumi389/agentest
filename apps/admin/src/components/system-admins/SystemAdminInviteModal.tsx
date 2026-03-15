import { useState, useEffect, useRef, useCallback } from 'react';
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
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLInputElement>(null);

  // ESCキーで閉じる
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading]
  );

  // フォーカストラップ
  const handleTabKey = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keydown', handleTabKey);
      // モーダルが開いたら最初の入力フィールドにフォーカス
      firstFocusableRef.current?.focus();
      // 背景スクロールを無効化
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleTabKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown, handleTabKey]);

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

  // 背景クリックで閉じる
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id="invite-modal-title" className="text-lg font-semibold text-foreground">
            管理者を招待
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground"
            aria-label="閉じる"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-error bg-error/10 rounded-lg" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              メールアドレス <span className="text-error">*</span>
            </label>
            <input
              ref={firstFocusableRef}
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
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? '処理中...' : '招待する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
