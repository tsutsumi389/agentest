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
    ],
  },
  PRO: {
    monthlyPrice: 980,
    yearlyPrice: 9800,
    stripePriceId: {
      // 実際のStripe Price IDはバックエンドで環境変数から取得する
      // フロントエンドではプレースホルダーとして使用
      monthly: 'price_pro_monthly',
      yearly: 'price_pro_yearly',
    },
    features: [
      { name: 'プロジェクト数', description: '無制限', included: true },
      { name: 'テストケース数', description: '無制限', included: true },
      { name: 'MCP連携', description: '利用可能', included: true },
      { name: 'チーム機能', description: '利用不可', included: false },
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

// ============================================
// 組織プラン料金設定
// ============================================

/**
 * セルフサービスで契約可能な組織プラン
 * 注: ENTERPRISEプランはDBスキーマに定義されているが、個別営業契約のため
 * セルフサービス料金設定・制限には含めない。ENTERPRISE契約は管理者が直接設定する。
 */
export type OrgPlan = 'NONE' | 'TEAM';

export interface OrgPlanPricing extends PlanPricing {
  /** 1ユーザーあたりの月額単価。課金額は pricePerUser * メンバー数 で計算する */
  pricePerUser: number;
}

/**
 * 組織プラン料金設定
 * 組織プランはユーザー単価制（基本料金なし）。
 * monthlyPrice/yearlyPrice は1ユーザーあたりの単価を表す。
 * 組織全体の課金額は pricePerUser * メンバー数 で算出する。
 */
export const ORG_PLAN_PRICING: Record<OrgPlan, OrgPlanPricing> = {
  NONE: {
    // 契約なしプラン（プロジェクト作成不可）
    monthlyPrice: 0,
    yearlyPrice: 0,
    pricePerUser: 0,
    stripePriceId: {
      monthly: null,
      yearly: null,
    },
    features: [
      { name: 'プロジェクト数', description: '作成不可', included: false },
      { name: 'テストケース数', description: '作成不可', included: false },
      { name: 'MCP連携', description: '利用不可', included: false },
      { name: 'チーム機能', description: '利用不可', included: false },
      { name: 'メンバー管理', description: '利用不可', included: false },
    ],
  },
  TEAM: {
    // 1ユーザーあたりの料金（基本料金なし）
    monthlyPrice: 1200,
    yearlyPrice: 12000,
    pricePerUser: 1200,
    stripePriceId: {
      // 実際のStripe Price IDはバックエンドで環境変数から取得する
      // フロントエンドではプレースホルダーとして使用
      monthly: 'price_team_monthly',
      yearly: 'price_team_yearly',
    },
    features: [
      { name: 'プロジェクト数', description: '無制限', included: true },
      { name: 'テストケース数', description: '無制限', included: true },
      { name: 'MCP連携', description: '利用可能', included: true },
      { name: 'チーム機能', description: '利用可能', included: true },
      { name: 'メンバー管理', description: 'ロールベース', included: true },
    ],
  },
};

/**
 * 組織プランの年額割引額を計算
 */
export function calculateOrgYearlySavings(plan: OrgPlan): number {
  const pricing = ORG_PLAN_PRICING[plan];
  return pricing.monthlyPrice * 12 - pricing.yearlyPrice;
}

/**
 * 組織プランのStripe Price IDを取得
 */
export function getOrgStripePriceId(
  plan: OrgPlan,
  cycle: BillingCycle
): string | null {
  const pricing = ORG_PLAN_PRICING[plan];
  return cycle === 'YEARLY'
    ? pricing.stripePriceId.yearly
    : pricing.stripePriceId.monthly;
}

// ============================================
// プラン制限定数
// ============================================

/**
 * プラン別の機能制限
 */
export interface PlanLimits {
  /** プロジェクト数上限（-1は無制限） */
  maxProjects: number;
  /** テストケース数上限（-1は無制限） */
  maxTestCases: number;
  /** 変更履歴保持日数（-1は無制限） */
  changeHistoryDays: number;
}

/**
 * 個人プランの制限
 */
export const PLAN_LIMITS: Record<PersonalPlan, PlanLimits> = {
  FREE: {
    maxProjects: 1,
    maxTestCases: 100,
    changeHistoryDays: 30,
  },
  PRO: {
    maxProjects: -1,
    maxTestCases: -1,
    changeHistoryDays: -1,
  },
};

/**
 * 組織プランの制限
 */
export const ORG_PLAN_LIMITS: Record<OrgPlan, PlanLimits> = {
  NONE: {
    maxProjects: 0,
    maxTestCases: 0,
    changeHistoryDays: 0,
  },
  TEAM: {
    maxProjects: -1,
    maxTestCases: -1,
    changeHistoryDays: -1,
  },
};
