/**
 * date-utils ユニットテスト
 * タイムゾーン処理の正確性を確認
 */
import { describe, it, expect } from 'vitest';
import {
  getJSTStartOfDay,
  getJSTYesterdayStart,
  getJSTDayOfWeek,
  getJSTDayOfMonth,
  getJSTLastMonday,
  getJSTLastMonthStart,
  getJSTThisMonthStart,
  formatDateStringJST,
} from '../../lib/date-utils.js';

describe('date-utils', () => {
  describe('getJSTStartOfDay', () => {
    it('JSTの0時0分0秒をUTCで返す', () => {
      // JST 2026-01-15 10:00:00 = UTC 2026-01-15 01:00:00
      const input = new Date('2026-01-15T01:00:00.000Z');
      const result = getJSTStartOfDay(input);

      // JST 2026-01-15 00:00:00 = UTC 2026-01-14 15:00:00
      expect(result.toISOString()).toBe('2026-01-14T15:00:00.000Z');
    });

    it('日本時間で日付が変わる境界を正しく処理する', () => {
      // JST 2026-01-15 00:30:00 = UTC 2026-01-14 15:30:00
      const input = new Date('2026-01-14T15:30:00.000Z');
      const result = getJSTStartOfDay(input);

      // JST 2026-01-15 00:00:00 = UTC 2026-01-14 15:00:00
      expect(result.toISOString()).toBe('2026-01-14T15:00:00.000Z');
    });

    it('UTCで23時台（JSTで翌日8時台）を正しく処理する', () => {
      // UTC 2026-01-14 23:00:00 = JST 2026-01-15 08:00:00
      const input = new Date('2026-01-14T23:00:00.000Z');
      const result = getJSTStartOfDay(input);

      // JST 2026-01-15 00:00:00 = UTC 2026-01-14 15:00:00
      expect(result.toISOString()).toBe('2026-01-14T15:00:00.000Z');
    });
  });

  describe('getJSTYesterdayStart', () => {
    it('JSTで前日の0時0分0秒を返す', () => {
      // JST 2026-01-15 10:00:00
      const input = new Date('2026-01-15T01:00:00.000Z');
      const result = getJSTYesterdayStart(input);

      // JST 2026-01-14 00:00:00 = UTC 2026-01-13 15:00:00
      expect(result.toISOString()).toBe('2026-01-13T15:00:00.000Z');
    });
  });

  describe('getJSTDayOfWeek', () => {
    it('月曜日を1として返す', () => {
      // JST 2026-01-19 10:00:00 (月曜日)
      const input = new Date('2026-01-19T01:00:00.000Z');
      expect(getJSTDayOfWeek(input)).toBe(1);
    });

    it('日曜日を0として返す', () => {
      // JST 2026-01-18 10:00:00 (日曜日)
      const input = new Date('2026-01-18T01:00:00.000Z');
      expect(getJSTDayOfWeek(input)).toBe(0);
    });

    it('木曜日を4として返す', () => {
      // JST 2026-01-15 10:00:00 (木曜日)
      const input = new Date('2026-01-15T01:00:00.000Z');
      expect(getJSTDayOfWeek(input)).toBe(4);
    });

    it('UTCで日付が変わる境界でJSTの曜日を返す', () => {
      // UTC 2026-01-18 23:00:00 = JST 2026-01-19 08:00:00 (月曜日)
      const input = new Date('2026-01-18T23:00:00.000Z');
      expect(getJSTDayOfWeek(input)).toBe(1);
    });
  });

  describe('getJSTDayOfMonth', () => {
    it('月の1日を返す', () => {
      // JST 2026-02-01 10:00:00
      const input = new Date('2026-02-01T01:00:00.000Z');
      expect(getJSTDayOfMonth(input)).toBe(1);
    });

    it('月の15日を返す', () => {
      // JST 2026-01-15 10:00:00
      const input = new Date('2026-01-15T01:00:00.000Z');
      expect(getJSTDayOfMonth(input)).toBe(15);
    });

    it('UTCで月が変わる境界でJSTの日付を返す', () => {
      // UTC 2026-01-31 23:00:00 = JST 2026-02-01 08:00:00
      const input = new Date('2026-01-31T23:00:00.000Z');
      expect(getJSTDayOfMonth(input)).toBe(1);
    });
  });

  describe('getJSTLastMonday', () => {
    it('月曜日の場合、その日の0時を返す', () => {
      // JST 2026-01-19 10:00:00 (月曜日)
      const input = new Date('2026-01-19T01:00:00.000Z');
      const result = getJSTLastMonday(input);

      // JST 2026-01-19 00:00:00 = UTC 2026-01-18 15:00:00
      expect(result.toISOString()).toBe('2026-01-18T15:00:00.000Z');
    });

    it('水曜日の場合、2日前の月曜日を返す', () => {
      // JST 2026-01-21 10:00:00 (水曜日)
      const input = new Date('2026-01-21T01:00:00.000Z');
      const result = getJSTLastMonday(input);

      // JST 2026-01-19 00:00:00 = UTC 2026-01-18 15:00:00
      expect(result.toISOString()).toBe('2026-01-18T15:00:00.000Z');
    });

    it('日曜日の場合、6日前の月曜日を返す', () => {
      // JST 2026-01-25 10:00:00 (日曜日)
      const input = new Date('2026-01-25T01:00:00.000Z');
      const result = getJSTLastMonday(input);

      // JST 2026-01-19 00:00:00 = UTC 2026-01-18 15:00:00
      expect(result.toISOString()).toBe('2026-01-18T15:00:00.000Z');
    });

    it('土曜日の場合、5日前の月曜日を返す', () => {
      // JST 2026-01-24 10:00:00 (土曜日)
      const input = new Date('2026-01-24T01:00:00.000Z');
      const result = getJSTLastMonday(input);

      // JST 2026-01-19 00:00:00 = UTC 2026-01-18 15:00:00
      expect(result.toISOString()).toBe('2026-01-18T15:00:00.000Z');
    });
  });

  describe('getJSTLastMonthStart', () => {
    it('2月の場合、1月1日を返す', () => {
      // JST 2026-02-15 10:00:00
      const input = new Date('2026-02-15T01:00:00.000Z');
      const result = getJSTLastMonthStart(input);

      // JST 2026-01-01 00:00:00 = UTC 2025-12-31 15:00:00
      expect(result.toISOString()).toBe('2025-12-31T15:00:00.000Z');
    });

    it('1月の場合、前年12月1日を返す', () => {
      // JST 2026-01-15 10:00:00
      const input = new Date('2026-01-15T01:00:00.000Z');
      const result = getJSTLastMonthStart(input);

      // JST 2025-12-01 00:00:00 = UTC 2025-11-30 15:00:00
      expect(result.toISOString()).toBe('2025-11-30T15:00:00.000Z');
    });
  });

  describe('getJSTThisMonthStart', () => {
    it('当月1日の0時を返す', () => {
      // JST 2026-02-15 10:00:00
      const input = new Date('2026-02-15T01:00:00.000Z');
      const result = getJSTThisMonthStart(input);

      // JST 2026-02-01 00:00:00 = UTC 2026-01-31 15:00:00
      expect(result.toISOString()).toBe('2026-01-31T15:00:00.000Z');
    });

    it('月初でも当月1日の0時を返す', () => {
      // JST 2026-02-01 10:00:00
      const input = new Date('2026-02-01T01:00:00.000Z');
      const result = getJSTThisMonthStart(input);

      // JST 2026-02-01 00:00:00 = UTC 2026-01-31 15:00:00
      expect(result.toISOString()).toBe('2026-01-31T15:00:00.000Z');
    });
  });

  describe('formatDateStringJST', () => {
    it('YYYY-MM-DD形式でJSTの日付を返す', () => {
      // JST 2026-01-15 10:00:00
      const input = new Date('2026-01-15T01:00:00.000Z');
      expect(formatDateStringJST(input)).toBe('2026-01-15');
    });

    it('UTCで前日でもJSTの日付を返す', () => {
      // UTC 2026-01-14 16:00:00 = JST 2026-01-15 01:00:00
      const input = new Date('2026-01-14T16:00:00.000Z');
      expect(formatDateStringJST(input)).toBe('2026-01-15');
    });

    it('月と日を2桁でゼロパディングする', () => {
      // JST 2026-01-05 10:00:00
      const input = new Date('2026-01-05T01:00:00.000Z');
      expect(formatDateStringJST(input)).toBe('2026-01-05');
    });
  });
});
