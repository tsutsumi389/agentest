import { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { ApiError, reviewsApi, type ReviewVerdict } from '../../lib/api';
import { toast } from '../../stores/toast';
import { VERDICT_OPTIONS } from '../../lib/constants';

/**
 * アイコン名からアイコンコンポーネントを取得するマップ
 */
const VERDICT_ICONS = {
  CheckCircle,
  AlertTriangle,
  MessageSquare,
} as const;

interface ReviewVerdictEditModalProps {
  /** モーダルの表示状態 */
  isOpen: boolean;
  /** 閉じる際のコールバック */
  onClose: () => void;
  /** レビューID */
  reviewId: string;
  /** 現在の評価 */
  currentVerdict: ReviewVerdict;
  /** 変更成功後のコールバック */
  onSuccess: () => void;
}

/**
 * レビュー評価変更モーダルコンポーネント
 * 提出済みレビューの評価を変更する
 */
export function ReviewVerdictEditModal({
  isOpen,
  onClose,
  reviewId,
  currentVerdict,
  onSuccess,
}: ReviewVerdictEditModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [selectedVerdict, setSelectedVerdict] = useState<ReviewVerdict>(currentVerdict);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // モーダルが開いた時に現在の評価を初期値として設定
  useEffect(() => {
    if (isOpen) {
      setSelectedVerdict(currentVerdict);
    }
  }, [isOpen, currentVerdict]);

  // ESCキーでモーダルを閉じる + フォーカストラップ + 背景スクロール無効化
  useEffect(() => {
    if (!isOpen) return;

    // 背景スクロールを無効化
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // フォーカスをモーダルに移動
    closeButtonRef.current?.focus();

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isSubmitting, onClose]);

  // 変更処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 評価が変更されていない場合は何もしない
    if (selectedVerdict === currentVerdict) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      await reviewsApi.updateVerdict(reviewId, selectedVerdict);
      toast.success('評価を変更しました');
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('評価の変更に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={!isSubmitting ? onClose : undefined} />

      {/* モーダル */}
      <div
        ref={modalRef}
        className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verdict-edit-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="verdict-edit-modal-title" className="text-lg font-semibold text-foreground">
            評価を変更
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors disabled:opacity-50"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 評価選択 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              評価を選択 <span className="text-danger">*</span>
            </label>
            <div className="space-y-2" role="radiogroup" aria-label="レビュー評価">
              {VERDICT_OPTIONS.map((option) => {
                const Icon = VERDICT_ICONS[option.iconName];
                const isSelected = selectedVerdict === option.value;

                return (
                  <label
                    key={option.value}
                    className={`
                      flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                      ${
                        isSelected
                          ? option.className
                          : 'border-border hover:border-foreground-muted'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="verdict"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => setSelectedVerdict(option.value)}
                      className="sr-only"
                      disabled={isSubmitting}
                    />
                    <Icon
                      className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isSelected ? '' : 'text-foreground-muted'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${isSelected ? '' : 'text-foreground'}`}>
                        {option.label}
                      </div>
                      <div
                        className={`text-xs mt-0.5 ${isSelected ? 'opacity-80' : 'text-foreground-muted'}`}
                      >
                        {option.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-ghost"
            >
              キャンセル
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  変更中...
                </>
              ) : (
                '変更する'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
