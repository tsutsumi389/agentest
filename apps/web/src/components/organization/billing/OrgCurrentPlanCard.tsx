/**
 * 組織の現在のプラン表示カード
 */

import { useState, useEffect } from 'react';
import { Loader2, Users, AlertTriangle } from 'lucide-react';
import { toast } from '../../../stores/toast';
import {
  ApiError,
  orgBillingApi,
  type OrgSubscription,
  type OrgPlan,
} from '../../../lib/api';
import {
  TEAM_PLAN_PRICES,
  formatPrice,
  formatBillingDate,
} from '../../../lib/billing';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { OrgPlanChangeModal } from './OrgPlanChangeModal';

interface OrgCurrentPlanCardProps {
  organizationId: string;
  memberCount: number;
}

/**
 * プラン表示名を取得
 */
function getPlanDisplayName(plan: OrgPlan | null): string {
  if (!plan) return 'FREE';
  switch (plan) {
    case 'TEAM':
      return 'TEAM';
    case 'ENTERPRISE':
      return 'ENTERPRISE';
    default:
      return plan;
  }
}

export function OrgCurrentPlanCard({ organizationId, memberCount }: OrgCurrentPlanCardProps) {
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  // サブスクリプション取得
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await orgBillingApi.getSubscription(organizationId);
        setSubscription(response.subscription);
      } catch {
        // エラー時はサブスクリプションなし（FREE状態）として扱う
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, [organizationId]);

  // サブスクリプションキャンセル
  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      const response = await orgBillingApi.cancelSubscription(organizationId);
      setSubscription(response.subscription);
      toast.success('プランの解約を予約しました');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('解約予約に失敗しました');
      }
    } finally {
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  };

  // 解約予約キャンセル
  const handleReactivateSubscription = async () => {
    setIsReactivating(true);
    try {
      const response = await orgBillingApi.reactivateSubscription(organizationId);
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
  const handleUpgradeComplete = (newSubscription: OrgSubscription) => {
    setSubscription(newSubscription);
    setShowPlanChangeModal(false);
    toast.success('TEAMプランにアップグレードしました');
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
  const currentPlan = subscription?.plan || null;
  const isTeam = currentPlan === 'TEAM';
  const isCancelScheduled = subscription?.cancelAtPeriodEnd;

  // TEAMプラン料金計算
  const billingCycle = subscription?.billingCycle || 'MONTHLY';
  const unitPrice = TEAM_PLAN_PRICES[billingCycle];
  const quantity = subscription?.quantity || memberCount;
  const totalPrice = unitPrice * quantity;

  return (
    <>
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">現在のプラン</h2>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* プランアイコン */}
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                isTeam ? 'bg-accent text-white' : 'bg-background-tertiary text-foreground-muted'
              }`}
            >
              <Users className="w-6 h-6" />
            </div>

            {/* プラン情報 */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-foreground">
                  {getPlanDisplayName(currentPlan)}
                </span>
                {isTeam && subscription && (
                  <span className="badge badge-accent text-xs">
                    {subscription.billingCycle === 'YEARLY' ? '年額' : '月額'}
                  </span>
                )}
                {isCancelScheduled && (
                  <span className="badge badge-warning text-xs">解約予定</span>
                )}
              </div>

              {isTeam && subscription && (
                <>
                  {/* 料金詳細 */}
                  <p className="text-sm text-foreground-muted mt-1">
                    {formatPrice(unitPrice)}/人 × {quantity}人 = {formatPrice(totalPrice)}/{billingCycle === 'YEARLY' ? '年' : '月'}
                  </p>

                  {/* 次回更新日または解約日 */}
                  <p className="text-sm text-foreground-muted mt-1">
                    {isCancelScheduled ? (
                      <>
                        <AlertTriangle className="w-4 h-4 inline mr-1 text-warning" />
                        {formatBillingDate(subscription.currentPeriodEnd)} に解約されます
                      </>
                    ) : (
                      <>次回更新日: {formatBillingDate(subscription.currentPeriodEnd)}</>
                    )}
                  </p>
                </>
              )}

              {!isTeam && (
                <p className="text-sm text-foreground-muted mt-1">
                  TEAMプランにアップグレードしてチーム機能を活用しましょう
                </p>
              )}
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center gap-2">
            {!isTeam && (
              <button
                className="btn btn-primary"
                onClick={() => setShowPlanChangeModal(true)}
              >
                アップグレード
              </button>
            )}

            {isTeam && !isCancelScheduled && (
              <button
                className="btn btn-ghost text-foreground-muted hover:text-danger"
                onClick={() => setShowCancelDialog(true)}
                disabled={isCancelling}
              >
                {isCancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                解約する
              </button>
            )}

            {isTeam && isCancelScheduled && (
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
        {!isTeam && (
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-sm font-medium text-foreground mb-3">TEAMプランの特典</h3>
            <ul className="space-y-2 text-sm text-foreground-muted">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                組織メンバー数: 無制限
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                組織プロジェクト数: 無制限
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                高度なアクセス制御
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                監査ログ機能
              </li>
            </ul>
            <p className="text-xs text-foreground-subtle mt-3">
              月額 {formatPrice(TEAM_PLAN_PRICES.MONTHLY)}/人 または 年額 {formatPrice(TEAM_PLAN_PRICES.YEARLY)}/人
            </p>
          </div>
        )}
      </div>

      {/* プラン変更モーダル */}
      {showPlanChangeModal && (
        <OrgPlanChangeModal
          organizationId={organizationId}
          memberCount={memberCount}
          onClose={() => setShowPlanChangeModal(false)}
          onComplete={handleUpgradeComplete}
        />
      )}

      {/* 解約確認ダイアログ */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        title="TEAMプランを解約"
        message="現在の課金期間終了後にFREEプランにダウングレードされます。解約後も課金期間終了まではTEAMプランの機能をご利用いただけます。"
        confirmLabel="解約する"
        onConfirm={handleCancelSubscription}
        onCancel={() => setShowCancelDialog(false)}
        isLoading={isCancelling}
        isDanger
      />
    </>
  );
}
