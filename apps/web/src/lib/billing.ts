/**
 * 課金関連の定数とユーティリティ
 */

import type { BillingCycle } from './api';

// ============================================
// プラン料金定数
// ============================================

/**
 * 個人PROプランの料金（単位: 円）
 */
export const PRO_PLAN_PRICES = {
  MONTHLY: 980,   // 月額980円
  YEARLY: 9800,   // 年額9,800円
} as const;

/**
 * 組織TEAMプランの料金（単位: 円/人）
 */
export const TEAM_PLAN_PRICES = {
  MONTHLY: 1200,  // 月額1,200円/人
  YEARLY: 12000,  // 年額12,000円/人（月額の10ヶ月分、2ヶ月分お得）
} as const;

// ============================================
// フォーマットユーティリティ
// ============================================

/**
 * 金額をフォーマット（日本円）
 * @param price 金額
 * @param currency 通貨コード（デフォルト: JPY）
 * @returns フォーマットされた金額文字列（例: ¥1,200）
 */
export function formatPrice(price: number, currency = 'JPY'): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
  }).format(price);
}

/**
 * 日付を日本語形式でフォーマット（年月日、長形式）
 * 課金画面用: "2024年1月15日"
 * @param dateString ISO形式の日付文字列
 * @returns フォーマットされた日付文字列
 */
export function formatBillingDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * 日付をコンパクト形式でフォーマット
 * 請求書テーブル用: "2024/01/15"
 * @param dateString ISO形式の日付文字列
 * @returns フォーマットされた日付文字列
 */
export function formatInvoiceDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * カード有効期限をフォーマット
 * @param month 有効期限（月）
 * @param year 有効期限（年）
 * @returns フォーマットされた有効期限（例: 01/25）
 */
export function formatCardExpiry(month: number | null, year: number | null): string {
  if (!month || !year) return '-';
  return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
}

/**
 * カードブランドのラベルを取得
 * @param brand カードブランド（visa, mastercard, etc.）
 * @returns 表示用ラベル（VISA, MC, AMEX, JCB, CARD）
 */
export function getCardBrandLabel(brand: string | null): string {
  switch (brand?.toLowerCase()) {
    case 'visa':
      return 'VISA';
    case 'mastercard':
      return 'MC';
    case 'amex':
      return 'AMEX';
    case 'jcb':
      return 'JCB';
    default:
      return 'CARD';
  }
}

// ============================================
// 計算ユーティリティ
// ============================================

/**
 * TEAMプランの年額プランでの節約額を計算
 * @param memberCount メンバー数
 * @returns 年間節約額（円）
 */
export function calculateYearlySavings(memberCount: number): number {
  const monthlyTotal = TEAM_PLAN_PRICES.MONTHLY * memberCount * 12;
  const yearlyTotal = TEAM_PLAN_PRICES.YEARLY * memberCount;
  return monthlyTotal - yearlyTotal;
}

/**
 * TEAMプランの合計金額を計算
 * @param billingCycle 請求サイクル
 * @param memberCount メンバー数
 * @returns 合計金額（円）
 */
export function calculateTeamPlanTotal(billingCycle: BillingCycle, memberCount: number): number {
  return TEAM_PLAN_PRICES[billingCycle] * memberCount;
}
