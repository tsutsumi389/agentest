import { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { ApiError, type ReviewVerdict } from '../../lib/api';
import { useReviewSession } from '../../contexts/ReviewSessionContext';
import { toast } from '../../stores/toast';

/**
 * 評価オプションの設定
 */
const VERDICT_OPTIONS: {
  value: ReviewVerdict;
  label: string;
  description: string;
  icon: typeof CheckCircle;
  className: string;
}[] = [
  {
    value: 'APPROVED',
    label: '承認',
    description: 'このテストスイートを承認します',
    icon: CheckCircle,
    className: 'border-success text-success bg-success-subtle',
  },
  {
    value: 'CHANGES_REQUESTED',
    label: '要修正',
    description: '修正が必要な箇所があります',
    icon: AlertTriangle,
    className: 'border-warning text-warning bg-warning-subtle',
  },
  {
    value: 'COMMENT_ONLY',
    label: 'コメントのみ',
    description: '承認・修正依頼なしでコメントを残します',
    icon: MessageSquare,
    className: 'border-foreground-muted text-foreground-muted bg-background-tertiary',
  },
];

interface ReviewSubmitModalProps {
  /** モーダルの表示状態 */
  isOpen: boolean;
  /** 閉じる際のコールバック */
  onClose: () => void;
  /** コメント数 */
  commentCount: number;
}

/**
 * レビュー提出モーダルコンポーネント
 * 評価を選択してレビューを提出する
 */
export function ReviewSubmitModal({
  isOpen,
  onClose,
  commentCount,
}: ReviewSubmitModalProps) {
  const { submitReview, isLoading } = useReviewSession();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [selectedVerdict, setSelectedVerdict] = useState<ReviewVerdict | null>(null);
  const [summary, setSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // モーダルが開いた時に状態をリセット
  useEffect(() => {
    if (isOpen) {
      setSelectedVerdict(null);
      setSummary('');
    }
  }, [isOpen]);

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
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

  // 提出処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVerdict) {
      toast.error('評価を選択してください');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitReview(selectedVerdict, summary || undefined);
      toast.success('レビューを提出しました');
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('レビューの提出に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!isSubmitting ? onClose : undefined}
      />

      {/* モーダル */}
      <div
        ref={modalRef}
        className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2
            id="submit-modal-title"
            className="text-lg font-semibold text-foreground"
          >
            レビューを提出
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
          {/* コメント数表示 */}
          <div className="flex items-center gap-2 text-sm text-foreground-muted">
            <MessageSquare className="w-4 h-4" />
            <span>{commentCount}件のコメントを含むレビュー</span>
          </div>

          {/* 評価選択 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              評価を選択 <span className="text-danger">*</span>
            </label>
            <div className="space-y-2" role="radiogroup" aria-label="レビュー評価">
              {VERDICT_OPTIONS.map((option) => {
                const Icon = option.icon;
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
                    <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isSelected ? '' : 'text-foreground-muted'}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${isSelected ? '' : 'text-foreground'}`}>
                        {option.label}
                      </div>
                      <div className={`text-xs mt-0.5 ${isSelected ? 'opacity-80' : 'text-foreground-muted'}`}>
                        {option.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* サマリー入力 */}
          <div className="space-y-2">
            <label
              htmlFor="review-summary"
              className="block text-sm font-medium text-foreground"
            >
              サマリー（任意）
            </label>
            <textarea
              id="review-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="レビューの概要を入力..."
              rows={3}
              disabled={isSubmitting}
              className="input w-full resize-none"
            />
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
            <button
              type="submit"
              disabled={isSubmitting || isLoading || !selectedVerdict}
              className="btn btn-primary"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  提出中...
                </>
              ) : (
                '提出する'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
