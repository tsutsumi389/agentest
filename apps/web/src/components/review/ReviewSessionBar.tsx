import { useState } from 'react';
import { FileEdit, MessageSquare, Send, X, Loader2 } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { useReviewSession } from '../../contexts/ReviewSessionContext';
import { toast } from '../../stores/toast';
import { ReviewSubmitModal } from './ReviewSubmitModal';

/**
 * レビューセッションバーコンポーネント
 * レビュー中に画面下部に固定表示されるバー
 */
export function ReviewSessionBar() {
  const { currentReview, isReviewing, isLoading, cancelReview } = useReviewSession();

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // レビュー中でない場合は表示しない
  if (!isReviewing || !currentReview) {
    return null;
  }

  const commentCount = currentReview.comments?.length || 0;

  // キャンセル処理
  const handleCancel = async () => {
    if (!window.confirm('レビューをキャンセルしますか？\n下書きと全てのコメントが削除されます。')) {
      return;
    }

    setIsCanceling(true);
    try {
      await cancelReview();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('レビューのキャンセルに失敗しました');
      }
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <>
      {/* バー本体 */}
      <div className="fixed bottom-0 left-0 right-0 z-sticky bg-background border-t border-border shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* 左側: ステータス情報 */}
            <div className="flex items-center gap-4">
              {/* レビュー中アイコン */}
              <div className="flex items-center gap-2 text-warning">
                <FileEdit className="w-5 h-5" />
                <span className="font-medium text-sm">レビュー中</span>
              </div>

              {/* コメント数 */}
              <div className="flex items-center gap-1.5 text-foreground-muted">
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm">{commentCount}件のコメント</span>
              </div>
            </div>

            {/* 右側: アクションボタン */}
            <div className="flex items-center gap-2">
              {/* キャンセルボタン */}
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading || isCanceling}
                className="btn btn-ghost text-sm"
              >
                {isCanceling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                キャンセル
              </button>

              {/* 提出ボタン */}
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(true)}
                disabled={isLoading || isCanceling}
                className="btn btn-primary text-sm"
              >
                <Send className="w-4 h-4" />
                レビューを提出
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 提出モーダル */}
      <ReviewSubmitModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        commentCount={commentCount}
      />
    </>
  );
}
