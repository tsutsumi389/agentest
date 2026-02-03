import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  formatBillingDate,
  formatInvoiceDate,
  formatCardExpiry,
  getCardBrandLabel,
  calculateYearlySavings,
  calculateTeamPlanTotal,
  PRO_PLAN_PRICES,
  TEAM_PLAN_PRICES,
} from '../billing';

describe('billing', () => {
  describe('定数', () => {
    it('PROプランの料金が定義されている', () => {
      expect(PRO_PLAN_PRICES.MONTHLY).toBe(980);
      expect(PRO_PLAN_PRICES.YEARLY).toBe(9800);
    });

    it('TEAMプランの料金が定義されている', () => {
      expect(TEAM_PLAN_PRICES.MONTHLY).toBe(1200);
      expect(TEAM_PLAN_PRICES.YEARLY).toBe(12000);
    });
  });

  describe('formatPrice', () => {
    it('日本円でフォーマットする', () => {
      const result = formatPrice(1200);
      expect(result).toContain('1,200');
    });

    it('0円をフォーマットする', () => {
      const result = formatPrice(0);
      expect(result).toContain('0');
    });
  });

  describe('formatBillingDate', () => {
    it('日付を日本語長形式でフォーマットする', () => {
      const result = formatBillingDate('2024-01-15T00:00:00Z');
      expect(result).toContain('2024');
      expect(result).toContain('15');
    });
  });

  describe('formatInvoiceDate', () => {
    it('日付をコンパクト形式でフォーマットする', () => {
      const result = formatInvoiceDate('2024-01-15T00:00:00Z');
      expect(result).toContain('2024');
    });
  });

  describe('formatCardExpiry', () => {
    it('有効期限をフォーマットする', () => {
      expect(formatCardExpiry(1, 2025)).toBe('01/25');
    });

    it('2桁月を正しくフォーマットする', () => {
      expect(formatCardExpiry(12, 2026)).toBe('12/26');
    });

    it('月がnullの場合はハイフンを返す', () => {
      expect(formatCardExpiry(null, 2025)).toBe('-');
    });

    it('年がnullの場合はハイフンを返す', () => {
      expect(formatCardExpiry(1, null)).toBe('-');
    });

    it('両方nullの場合はハイフンを返す', () => {
      expect(formatCardExpiry(null, null)).toBe('-');
    });
  });

  describe('getCardBrandLabel', () => {
    it('visaをVISAに変換する', () => {
      expect(getCardBrandLabel('visa')).toBe('VISA');
    });

    it('mastercardをMCに変換する', () => {
      expect(getCardBrandLabel('mastercard')).toBe('MC');
    });

    it('amexをAMEXに変換する', () => {
      expect(getCardBrandLabel('amex')).toBe('AMEX');
    });

    it('jcbをJCBに変換する', () => {
      expect(getCardBrandLabel('jcb')).toBe('JCB');
    });

    it('大文字でも変換する', () => {
      expect(getCardBrandLabel('VISA')).toBe('VISA');
    });

    it('不明なブランドはCARDを返す', () => {
      expect(getCardBrandLabel('unknown')).toBe('CARD');
    });

    it('nullの場合はCARDを返す', () => {
      expect(getCardBrandLabel(null)).toBe('CARD');
    });
  });

  describe('calculateYearlySavings', () => {
    it('1人の場合の年間節約額を計算する', () => {
      // 月額: 1200 * 1 * 12 = 14400
      // 年額: 12000 * 1 = 12000
      // 節約: 14400 - 12000 = 2400
      expect(calculateYearlySavings(1)).toBe(2400);
    });

    it('5人の場合の年間節約額を計算する', () => {
      // 月額: 1200 * 5 * 12 = 72000
      // 年額: 12000 * 5 = 60000
      // 節約: 72000 - 60000 = 12000
      expect(calculateYearlySavings(5)).toBe(12000);
    });

    it('0人の場合は0を返す', () => {
      expect(calculateYearlySavings(0)).toBe(0);
    });
  });

  describe('calculateTeamPlanTotal', () => {
    it('月額プランの合計を計算する', () => {
      expect(calculateTeamPlanTotal('MONTHLY', 5)).toBe(6000);
    });

    it('年額プランの合計を計算する', () => {
      expect(calculateTeamPlanTotal('YEARLY', 5)).toBe(60000);
    });

    it('1人の月額プランを計算する', () => {
      expect(calculateTeamPlanTotal('MONTHLY', 1)).toBe(1200);
    });
  });
});
