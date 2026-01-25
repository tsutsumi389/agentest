/**
 * 現在のプラン表示カード
 */

import { useState, useEffect } from 'react';
import { Loader2, Crown, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';
import {
  ApiError,
  subscriptionApi,
  type Subscription,
  type PersonalPlan,
} from '../../lib/api';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { PlanChangeModal } from './PlanChangeModal';

/**
 * 日付をフォーマット
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * プラン表示名を取得
 */
function getPlanDisplayName(plan: PersonalPlan): string {
  switch (plan) {
    case 'FREE':
      return 'FREE';
    case 'PRO':
      return 'PRO';
    default:
      return plan;
  }
}

export function CurrentPlanCard() {
  const { user } = useAuthStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  // サブスクリプション取得
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user?.id) return;

      try {
        const response = await subscriptionApi.get(user.id);
        setSubscription(response.subscription);
      } catch (error) {
        if (error instanceof ApiError) {
          console.error('サブスクリプション取得エラー:', error.message);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, [user?.id]);

  // ダウングレード予約（PRO→FREE）
  const handleCancelSubscription = async () => {
    if (!user?.id) return;

    setIsCancelling(true);
    try {
      const response = await subscriptionApi.cancel(user.id);
      setSubscription(response.subscription);
      toast.success('ダウングレードを予約しました');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('ダウングレード予約に失敗しました');
      }
    } finally {
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  };

  // ダウングレード予約キャンセル
  const handleReactivateSubscription = async () => {
    if (!user?.id) return;

    setIsReactivating(true);
    try {
      const response = await subscriptionApi.reactivate(user.id);
      setSubscription(response.subscription);
      toast.success('プランを継続します');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('プラン継続に失敗しました');
      }
    } finally {
      setIsReactivating(false);
    }
  };

  // アップグレード完了時
  const handleUpgradeComplete = (newSubscription: Subscription) => {
    setSubscription(newSubscription);
    setShowPlanChangeModal(false);
    toast.success('PROプランにアップグレードしました');
  };

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  // 現在のプラン（サブスクリプションがなければFREE）
  const currentPlan: PersonalPlan = subscription?.plan || 'FREE';
  const isPro = currentPlan === 'PRO';
  const isCancelScheduled = subscription?.cancelAtPeriodEnd;

  return (
    <>
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">現在のプラン</h2>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* プランアイコン */}
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                isPro ? 'bg-accent text-white' : 'bg-background-tertiary text-foreground-muted'
              }`}
            >
              <Crown className="w-6 h-6" />
            </div>

            {/* プラン情報 */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-foreground">
                  {getPlanDisplayName(currentPlan)}
                </span>
                {isPro && subscription && (
                  <span className="badge badge-accent text-xs">
                    {subscription.billingCycle === 'YEARLY' ? '年額' : '月額'}
                  </span>
                )}
                {isCancelScheduled && (
                  <span className="badge badge-warning text-xs">解約予定</span>
                )}
              </div>

              {isPro && subscription && (
                <p className="text-sm text-foreground-muted mt-1">
                  {isCancelScheduled ? (
                    <>
                      <AlertTriangle className="w-4 h-4 inline mr-1 text-warning" />
                      {formatDate(subscription.currentPeriodEnd)} に解約されます
                    </>
                  ) : (
                    <>次回更新日: {formatDate(subscription.currentPeriodEnd)}</>
                  )}
                </p>
              )}

              {!isPro && (
                <p className="text-sm text-foreground-muted mt-1">
                  PROにアップグレードして全機能を利用しましょう
                </p>
              )}
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center gap-2">
            {!isPro && (
              <button
                className="btn btn-primary"
                onClick={() => setShowPlanChangeModal(true)}
              >
                アップグレード
              </button>
            )}

            {isPro && !isCancelScheduled && (
              <button
                className="btn btn-ghost text-foreground-muted hover:text-danger"
                onClick={() => setShowCancelDialog(true)}
                disabled={isCancelling}
              >
                {isCancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                解約する
              </button>
            )}

            {isPro && isCancelScheduled && (
              <button
                className="btn btn-primary"
                onClick={handleReactivateSubscription}
                disabled={isReactivating}
              >
                {isReactivating && <Loader2 className="w-4 h-4 animate-spin" />}
                プランを継続する
              </button>
            )}
          </div>
        </div>

        {/* プラン比較（FREEプラン時のみ） */}
        {!isPro && (
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-sm font-medium text-foreground mb-3">PROプランの特典</h3>
            <ul className="space-y-2 text-sm text-foreground-muted">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                プロジェクト数: 無制限
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                テストケース数: 無制限
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                優先メールサポート
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* プラン変更モーダル */}
      {showPlanChangeModal && (
        <PlanChangeModal
          onClose={() => setShowPlanChangeModal(false)}
          onComplete={handleUpgradeComplete}
        />
      )}

      {/* 解約確認ダイアログ */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        title="PROプランを解約"
        message="現在の課金期間終了後にFREEプランにダウングレードされます。解約後も課金期間終了まではPROプランの機能をご利用いただけます。"
        confirmLabel="解約する"
        onConfirm={handleCancelSubscription}
        onCancel={() => setShowCancelDialog(false)}
        isLoading={isCancelling}
        isDanger
      />
    </>
  );
}
