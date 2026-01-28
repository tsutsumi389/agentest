/**
 * 課金設定コンポーネント
 * 現在のプラン、支払い方法、請求履歴の管理を行う
 */

import { CurrentPlanCard } from '../billing/CurrentPlanCard';
import { PaymentMethodsCard } from '../billing/PaymentMethodsCard';
import { InvoiceList } from '../billing/InvoiceList';

export function BillingSettings() {
  return (
    <div className="space-y-6">
      {/* 現在のプラン */}
      <CurrentPlanCard />

      {/* 支払い方法 */}
      <PaymentMethodsCard />

      {/* 請求履歴 */}
      <InvoiceList />
    </div>
  );
}
