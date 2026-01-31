import { CreditCard, Mail } from 'lucide-react';
import type { AdminOrganizationSubscription } from '@agentest/shared';
import { formatDate } from '../../lib/date-utils';

interface OrganizationSubscriptionSectionProps {
  subscription: AdminOrganizationSubscription | null;
  billingEmail: string | null;
}

/**
 * プラン名の日本語ラベル
 */
const PLAN_LABELS: Record<AdminOrganizationSubscription['plan'], string> = {
  FREE: 'フリー',
  PRO: 'プロ',
  TEAM: 'チーム',
  ENTERPRISE: 'エンタープライズ',
};

/**
 * ステータスバッジ
 */
function StatusBadge({ status }: { status: AdminOrganizationSubscription['status'] }) {
  const styles = {
    ACTIVE: 'bg-success/20 text-success',
    PAST_DUE: 'bg-error/20 text-error',
    CANCELED: 'bg-foreground-muted/20 text-foreground-muted',
    TRIALING: 'bg-accent-muted text-accent',
  };

  const labels = {
    ACTIVE: 'アクティブ',
    PAST_DUE: '支払い遅延',
    CANCELED: 'キャンセル済み',
    TRIALING: 'トライアル',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

/**
 * サブスクリプションセクション
 */
export function OrganizationSubscriptionSection({
  subscription,
  billingEmail,
}: OrganizationSubscriptionSectionProps) {
  return (
    <div className="bg-background-secondary border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">サブスクリプション</h2>
      </div>
      {!subscription ? (
        <div className="px-4 py-8 text-center text-foreground-muted">
          サブスクリプション情報はありません
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* プラン・ステータス */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-foreground-muted" />
              </div>
              <div>
                <p className="font-medium text-foreground">{PLAN_LABELS[subscription.plan]}</p>
                <p className="text-sm text-foreground-muted">
                  {subscription.billingCycle === 'MONTHLY' ? '月額' : '年額'}プラン
                </p>
              </div>
            </div>
            <StatusBadge status={subscription.status} />
          </div>

          {/* 請求先メール */}
          {billingEmail && (
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
                <Mail className="w-5 h-5 text-foreground-muted" />
              </div>
              <div>
                <p className="text-sm text-foreground-muted">請求先メール</p>
                <p className="text-sm text-foreground">{billingEmail}</p>
              </div>
            </div>
          )}

          {/* 詳細情報 */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-sm text-foreground-muted">現在の期間</p>
              <p className="text-sm text-foreground">
                {formatDate(subscription.currentPeriodStart)} 〜{' '}
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
            <div>
              <p className="text-sm text-foreground-muted">自動更新</p>
              <p className="text-sm text-foreground">
                {subscription.cancelAtPeriodEnd ? (
                  <span className="text-warning">期間終了時にキャンセル予定</span>
                ) : (
                  '有効'
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
