import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mail, Loader2, Copy, Check, Link } from 'lucide-react';
import { organizationsApi, ApiError, type OrganizationInvitation } from '../../lib/api';
import { toast } from '../../stores/toast';
import { getInvitationUrl } from '../../lib/url';

interface InviteMemberModalProps {
  /** モーダルが開いているかどうか */
  isOpen: boolean;
  /** 組織ID */
  organizationId: string;
  /** モーダルを閉じる */
  onClose: () => void;
  /** 招待成功時のコールバック */
  onSuccess?: (invitation: OrganizationInvitation) => void;
}

/**
 * メンバー招待モーダル
 *
 * 2つの画面状態を持つ:
 * 1. 招待フォーム: メールアドレスとロールを入力
 * 2. 招待完了: 招待リンクを表示してコピー可能
 */
export function InviteMemberModal({
  isOpen,
  organizationId,
  onClose,
  onSuccess,
}: InviteMemberModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // フォーム状態
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');

  // UI状態
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 招待完了状態
  const [createdInvitation, setCreatedInvitation] = useState<OrganizationInvitation | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // フォームをリセットする
  const resetForm = useCallback(() => {
    setEmail('');
    setRole('MEMBER');
    setErrors({});
    setCreatedInvitation(null);
    setEmailSent(false);
    setIsCopied(false);
  }, []);

  // モーダルが開いたらフォームをリセットしてフォーカス
  useEffect(() => {
    if (isOpen) {
      resetForm();
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        emailInputRef.current?.focus();
      });
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, resetForm]);

  // キーボードイベントハンドラー（フォーカストラップ + ESCキー）
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen || !modalRef.current) return;

    // ESCキーでモーダルを閉じる
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    // フォーカストラップ
    if (e.key === 'Tab') {
      const focusableSelector = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(focusableSelector);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }
  }, [isOpen, onClose]);

  // キーボードイベントリスナー
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

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

  // 送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await organizationsApi.invite(organizationId, {
        email: email.trim(),
        role,
      });

      // 招待完了画面に遷移
      setCreatedInvitation(response.invitation);
      setEmailSent(response.emailSent);
      onSuccess?.(response.invitation);
      toast.success('招待を送信しました');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [field, messages] of Object.entries(err.details)) {
            fieldErrors[field] = messages[0];
          }
          setErrors(fieldErrors);
        } else if (err.code === 'CONFLICT') {
          setErrors({ email: 'このメールアドレスは既に招待済みまたはメンバーです' });
        } else {
          setErrors({ general: err.message });
        }
      } else {
        setErrors({ general: '招待の送信に失敗しました' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // コピー状態のリセット（クリーンアップ付き）
  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  // 招待リンクをコピー
  const handleCopyLink = async () => {
    if (!createdInvitation) return;

    const url = getInvitationUrl(createdInvitation.token);
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      toast.success('招待リンクをコピーしました');
    } catch {
      toast.error('コピーに失敗しました');
    }
  };

  // 新しい招待を作成
  const handleCreateAnother = () => {
    resetForm();
    requestAnimationFrame(() => {
      emailInputRef.current?.focus();
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-member-title"
    >
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* モーダル */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-background-secondary border border-border rounded-xl shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-background-tertiary">
              {createdInvitation ? (
                emailSent ? (
                  <Mail className="w-5 h-5 text-foreground-muted" aria-hidden="true" />
                ) : (
                  <Link className="w-5 h-5 text-foreground-muted" aria-hidden="true" />
                )
              ) : (
                <Mail className="w-5 h-5 text-foreground-muted" aria-hidden="true" />
              )}
            </div>
            <h2 id="invite-member-title" className="text-lg font-semibold text-foreground">
              {createdInvitation
                ? emailSent ? '招待メール送信完了' : '招待リンク'
                : 'メンバーを招待'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded-md transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdInvitation ? (
          // 招待完了画面
          <div className="px-6 py-6">
            <div className="mb-4">
              <p className="text-sm text-foreground-muted mb-2">
                <strong>{createdInvitation.email}</strong> に招待を送信しました。
              </p>
              <p className="text-sm text-foreground-muted">
                {emailSent
                  ? '招待メールを送信しました。以下のリンクからも招待を受け入れることができます。'
                  : '該当するアカウントが見つからないため、メール送信は行われません。以下のリンクを共有してください。'}
              </p>
            </div>

            {/* 招待リンク */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                招待リンク
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={getInvitationUrl(createdInvitation.token)}
                  readOnly
                  className="input w-full font-mono text-xs bg-background-tertiary"
                />
                <button
                  onClick={handleCopyLink}
                  className="btn btn-secondary flex-shrink-0"
                  aria-label="リンクをコピー"
                >
                  {isCopied ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* 招待情報 */}
            <div className="text-sm text-foreground-muted space-y-1 mb-6">
              <p>
                ロール: <span className="text-foreground">{role === 'ADMIN' ? '管理者' : 'メンバー'}</span>
              </p>
              <p>
                有効期限: <span className="text-foreground">7日間</span>
              </p>
            </div>

            {/* アクションボタン */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCreateAnother}
                className="btn btn-secondary"
              >
                別のメンバーを招待
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-primary"
              >
                閉じる
              </button>
            </div>
          </div>
        ) : (
          // 招待フォーム
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 space-y-4">
              {/* 全般エラー */}
              {errors.general && (
                <div className="p-3 text-sm text-danger bg-danger-subtle border border-danger/20 rounded-lg">
                  {errors.general}
                </div>
              )}

              {/* メールアドレス */}
              <div>
                <label htmlFor="invite-email" className="block text-sm font-medium text-foreground mb-1.5">
                  メールアドレス <span className="text-danger">*</span>
                </label>
                <input
                  ref={emailInputRef}
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="member@example.com"
                  className={`input w-full ${errors.email ? 'border-danger focus:border-danger' : ''}`}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'invite-email-error' : undefined}
                />
                {errors.email && (
                  <p id="invite-email-error" className="mt-1 text-sm text-danger">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* ロール選択 */}
              <div>
                <label htmlFor="invite-role" className="block text-sm font-medium text-foreground mb-1.5">
                  ロール
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}
                  className="input w-full"
                  disabled={isSubmitting}
                >
                  <option value="MEMBER">メンバー</option>
                  <option value="ADMIN">管理者</option>
                </select>
                <p className="mt-1 text-xs text-foreground-muted">
                  {role === 'ADMIN'
                    ? '管理者はメンバーの追加・削除、設定の変更ができます'
                    : 'メンバーはプロジェクトへのアクセスと基本操作ができます'}
                </p>
              </div>
            </div>

            {/* フッター */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    送信中...
                  </>
                ) : (
                  '招待を送信'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
