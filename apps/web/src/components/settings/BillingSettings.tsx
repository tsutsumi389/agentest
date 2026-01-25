/**
 * 課金設定コンポーネント
 * 現在のプラン、支払い方法の管理を行う
 */

import { CurrentPlanCard } from '../billing/CurrentPlanCard';
import { PaymentMethodsCard } from '../billing/PaymentMethodsCard';

export function BillingSettings() {
  return (
    <div className="space-y-6">
      {/* 現在のプラン */}
      <CurrentPlanCard />

      {/* 支払い方法 */}
      <PaymentMethodsCard />
    </div>
  );
}
