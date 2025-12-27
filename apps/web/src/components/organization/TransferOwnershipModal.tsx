import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, ArrowRight, AlertTriangle, Crown } from 'lucide-react';
import { organizationsApi, ApiError, type Organization, type OrganizationMember } from '../../lib/api';
import { toast } from '../../stores/toast';

interface TransferOwnershipModalProps {
  /** モーダルが開いているかどうか */
  isOpen: boolean;
  /** 組織情報 */
  organization: Organization;
  /** 現在のユーザーID */
  currentUserId: string;
  /** モーダルを閉じる */
  onClose: () => void;
  /** 移譲成功時のコールバック */
  onSuccess?: () => void;
}

/**
 * オーナー権限移譲モーダル
 *
 * 2つの画面状態を持つ:
 * 1. メンバー選択: 新しいオーナーを選択
 * 2. 確認: 組織名を入力して確認
 */
export function TransferOwnershipModal({
  isOpen,
  organization,
  currentUserId,
  onClose,
  onSuccess,
}: TransferOwnershipModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);

  // メンバー一覧
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // 選択状態
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);
  const [confirmationStep, setConfirmationStep] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  // UI状態
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォームをリセットする
  const resetForm = useCallback(() => {
    setSelectedMember(null);
    setConfirmationStep(false);
    setConfirmInput('');
    setError(null);
  }, []);

  // メンバー一覧を取得
  const fetchMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    setError(null);

    try {
      const response = await organizationsApi.getMembers(organization.id);
      // 自分自身を除外したメンバー一覧
      setMembers(response.members.filter((m) => m.userId !== currentUserId));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('メンバー一覧の取得に失敗しました');
      }
    } finally {
      setIsLoadingMembers(false);
    }
  }, [organization.id, currentUserId]);

  // モーダルが開いたらメンバー一覧を取得
  useEffect(() => {
    if (isOpen) {
      resetForm();
      fetchMembers();
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, resetForm, fetchMembers]);

  // 確認ステップに進んだらフォーカス
  useEffect(() => {
    if (confirmationStep && confirmInputRef.current) {
      confirmInputRef.current.focus();
    }
  }, [confirmationStep]);

  // キーボードイベントハンドラー
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || !modalRef.current) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // フォーカストラップ
      if (e.key === 'Tab') {
        const focusableSelector = [
          'button:not([disabled])',
          'input:not([disabled])',
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
    },
    [isOpen, onClose]
  );

  // キーボードイベントリスナー
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  // メンバー選択
  const handleSelectMember = (member: OrganizationMember) => {
    setSelectedMember(member);
  };

  // 確認ステップへ進む
  const handleProceedToConfirm = () => {
    if (selectedMember) {
      setConfirmationStep(true);
    }
  };

  // 戻る
  const handleBack = () => {
    setConfirmationStep(false);
    setConfirmInput('');
    setError(null);
  };

  // 移譲を実行
  const handleTransfer = async () => {
    if (!selectedMember || confirmInput !== organization.name) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await organizationsApi.transferOwnership(organization.id, selectedMember.userId);
      toast.success(`${selectedMember.user.name} にオーナー権限を移譲しました`);
      onSuccess?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('オーナー権限の移譲に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 確認入力が一致するか
  const isConfirmValid = confirmInput === organization.name;

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-ownership-title"
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
            <div className="p-2 rounded-lg bg-warning/10">
              <Crown className="w-5 h-5 text-warning" aria-hidden="true" />
            </div>
            <h2 id="transfer-ownership-title" className="text-lg font-semibold text-foreground">
              オーナー権限の移譲
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

        {/* コンテンツ */}
        <div className="px-6 py-4">
          {/* エラー表示 */}
          {error && (
            <div className="mb-4 p-3 text-sm text-danger bg-danger-subtle border border-danger/20 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {!confirmationStep ? (
            // メンバー選択画面
            <>
              <p className="text-sm text-foreground-muted mb-4">
                新しいオーナーを選択してください。移譲後、あなたは管理者権限になります。
              </p>

              {isLoadingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
                </div>
              ) : members.length === 0 ? (
                <div className="py-8 text-center text-foreground-muted">
                  <p>移譲可能なメンバーがいません</p>
                  <p className="text-sm mt-1">他のメンバーを招待してください</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {members.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleSelectMember(member)}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left
                        ${
                          selectedMember?.id === member.id
                            ? 'border-accent bg-accent-subtle'
                            : 'border-border hover:border-foreground-subtle hover:bg-background-tertiary'
                        }
                      `}
                    >
                      {/* アバター */}
                      {member.user.avatarUrl ? (
                        <img
                          src={member.user.avatarUrl}
                          alt=""
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center text-foreground-muted font-medium">
                          {member.user.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* 情報 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.user.name}
                        </p>
                        <p className="text-xs text-foreground-muted truncate">
                          {member.user.email}
                        </p>
                      </div>

                      {/* ロールバッジ */}
                      <span className="text-xs px-2 py-0.5 rounded bg-background-tertiary text-foreground-muted">
                        {member.role === 'ADMIN' ? '管理者' : 'メンバー'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            // 確認画面
            <>
              <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground mb-1">この操作は取り消せません</p>
                    <p className="text-foreground-muted">
                      オーナー権限を移譲すると、あなたは管理者権限になります。
                      組織の削除やオーナー移譲は新しいオーナーのみが実行できます。
                    </p>
                  </div>
                </div>
              </div>

              {/* 移譲先の確認 */}
              <div className="mb-4 p-3 bg-background-tertiary rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-foreground-muted">移譲先:</span>
                  <div className="flex items-center gap-2">
                    {selectedMember?.user.avatarUrl ? (
                      <img
                        src={selectedMember.user.avatarUrl}
                        alt=""
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-background-secondary flex items-center justify-center text-xs text-foreground-muted">
                        {selectedMember?.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-foreground">{selectedMember?.user.name}</span>
                  </div>
                </div>
              </div>

              {/* 確認入力 */}
              <div>
                <label htmlFor="confirm-org-name" className="block text-sm font-medium text-foreground mb-1.5">
                  確認のため組織名を入力してください
                </label>
                <input
                  ref={confirmInputRef}
                  id="confirm-org-name"
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={organization.name}
                  className="input w-full"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-foreground-muted">
                  「<span className="font-mono text-foreground">{organization.name}</span>」と入力
                </p>
              </div>
            </>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          {!confirmationStep ? (
            <>
              <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleProceedToConfirm}
                className="btn btn-secondary"
                disabled={!selectedMember || isLoadingMembers}
              >
                次へ
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={handleBack} className="btn btn-secondary" disabled={isSubmitting}>
                戻る
              </button>
              <button
                type="button"
                onClick={handleTransfer}
                className="btn btn-warning"
                disabled={!isConfirmValid || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    移譲中...
                  </>
                ) : (
                  'オーナー権限を移譲'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
