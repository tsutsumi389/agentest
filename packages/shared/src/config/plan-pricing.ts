/**
 * プラン料金設定
 * 個人ユーザー向けFREE/PROプランの料金を定義
 */

import type { BillingCycle } from '../types/enums.js';

export type PersonalPlan = 'FREE' | 'PRO';

export interface PlanFeature {
  name: string;
  description: string;
  included: boolean;
}

export interface PlanPricing {
  monthlyPrice: number;
  yearlyPrice: number;
  stripePriceId: {
    monthly: string | null;
    yearly: string | null;
  };
  features: PlanFeature[];
}

/**
 * 個人プラン料金設定
 */
export const PERSONAL_PLAN_PRICING: Record<PersonalPlan, PlanPricing> = {
  FREE: {
    monthlyPrice: 0,
    yearlyPrice: 0,
    stripePriceId: {
      monthly: null,
      yearly: null,
    },
    features: [
      { name: 'プロジェクト数', description: '1プロジェクト', included: true },
      { name: 'テストケース数', description: '100件まで', included: true },
      { name: 'MCP連携', description: '利用可能', included: true },
      { name: 'チーム機能', description: '利用不可', included: false },
      { name: '優先サポート', description: '利用不可', included: false },
    ],
  },
  PRO: {
    monthlyPrice: 980,
    yearlyPrice: 9800,
    stripePriceId: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly',
    },
    features: [
      { name: 'プロジェクト数', description: '無制限', included: true },
      { name: 'テストケース数', description: '無制限', included: true },
      { name: 'MCP連携', description: '利用可能', included: true },
      { name: 'チーム機能', description: '利用不可', included: false },
      { name: '優先サポート', description: 'メールサポート', included: true },
    ],
  },
};

/**
 * 年額プランの割引額を計算
 */
export function calculateYearlySavings(plan: PersonalPlan): number {
  const pricing = PERSONAL_PLAN_PRICING[plan];
  return pricing.monthlyPrice * 12 - pricing.yearlyPrice;
}

/**
 * 月額換算価格を取得
 */
export function getMonthlyEquivalent(
  plan: PersonalPlan,
  cycle: BillingCycle
): number {
  const pricing = PERSONAL_PLAN_PRICING[plan];
  if (cycle === 'YEARLY') {
    return Math.round(pricing.yearlyPrice / 12);
  }
  return pricing.monthlyPrice;
}

/**
 * Stripe Price IDを取得
 */
export function getStripePriceId(
  plan: PersonalPlan,
  cycle: BillingCycle
): string | null {
  const pricing = PERSONAL_PLAN_PRICING[plan];
  return cycle === 'YEARLY'
    ? pricing.stripePriceId.yearly
    : pricing.stripePriceId.monthly;
}
