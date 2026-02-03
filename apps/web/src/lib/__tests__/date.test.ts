import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatDateTimeCompact,
  formatDuration,
  formatRelativeTime,
  formatRelativeTimeOrDefault,
} from '../date';

describe('date', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDate', () => {
    it('日付を日本語形式でフォーマットする', () => {
      const result = formatDate('2024-01-15T00:00:00.000Z');
      // ja-JPロケール（環境によりフォーマットが異なるため部分一致で検証）
      expect(result).toContain('2024');
      expect(result).toContain('15');
    });
  });

  describe('formatDateTime', () => {
    it('日時を日本語形式でフォーマットする', () => {
      const result = formatDateTime('2024-01-15T14:30:00.000Z');
      expect(result).toContain('2024');
      expect(result).toContain('15');
    });
  });

  describe('formatDateTimeCompact', () => {
    it('日時をコンパクト形式でフォーマットする', () => {
      // UTCの2024-01-15T05:30:00ZはJST 2024-01-15 14:30
      const result = formatDateTimeCompact('2024-01-15T05:30:00.000Z');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });

  describe('formatDuration', () => {
    it('時間・分・秒を含む差分をフォーマットする', () => {
      const result = formatDuration(
        '2024-01-15T10:00:00Z',
        '2024-01-15T11:23:45Z'
      );
      expect(result).toBe('1時間23分45秒');
    });

    it('分・秒のみの差分をフォーマットする', () => {
      const result = formatDuration(
        '2024-01-15T10:00:00Z',
        '2024-01-15T10:05:30Z'
      );
      expect(result).toBe('5分30秒');
    });

    it('秒のみの差分をフォーマットする', () => {
      const result = formatDuration(
        '2024-01-15T10:00:00Z',
        '2024-01-15T10:00:45Z'
      );
      expect(result).toBe('45秒');
    });

    it('負の差分の場合は---を返す', () => {
      const result = formatDuration(
        '2024-01-15T11:00:00Z',
        '2024-01-15T10:00:00Z'
      );
      expect(result).toBe('---');
    });

    it('同じ時刻の場合は0秒を返す', () => {
      const result = formatDuration(
        '2024-01-15T10:00:00Z',
        '2024-01-15T10:00:00Z'
      );
      expect(result).toBe('0秒');
    });
  });

  describe('formatRelativeTime', () => {
    it('60秒未満の場合は「たった今」を返す', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:00:30Z'));
      const result = formatRelativeTime('2024-01-15T10:00:00Z');
      expect(result).toBe('たった今');
    });

    it('60分未満の場合は「N分前」を返す', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:05:00Z'));
      const result = formatRelativeTime('2024-01-15T10:00:00Z');
      expect(result).toBe('5分前');
    });

    it('24時間未満の場合は「N時間前」を返す', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T13:00:00Z'));
      const result = formatRelativeTime('2024-01-15T10:00:00Z');
      expect(result).toBe('3時間前');
    });

    it('7日未満の場合は「N日前」を返す', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-17T10:00:00Z'));
      const result = formatRelativeTime('2024-01-15T10:00:00Z');
      expect(result).toBe('2日前');
    });

    it('7日以上の場合は日付をフォーマットする', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-25T10:00:00Z'));
      const result = formatRelativeTime('2024-01-15T10:00:00Z');
      expect(result).toContain('2024');
      expect(result).toContain('15');
    });
  });

  describe('formatRelativeTimeOrDefault', () => {
    it('nullの場合はデフォルト値を返す', () => {
      expect(formatRelativeTimeOrDefault(null)).toBe('--');
    });

    it('undefinedの場合はデフォルト値を返す', () => {
      expect(formatRelativeTimeOrDefault(undefined)).toBe('--');
    });

    it('カスタムデフォルト値を返す', () => {
      expect(formatRelativeTimeOrDefault(null, 'N/A')).toBe('N/A');
    });

    it('文字列の日付を処理する', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:05:00Z'));
      const result = formatRelativeTimeOrDefault('2024-01-15T10:00:00Z');
      expect(result).toBe('5分前');
    });

    it('Dateオブジェクトを処理する', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:05:00Z'));
      const result = formatRelativeTimeOrDefault(new Date('2024-01-15T10:00:00Z'));
      expect(result).toBe('5分前');
    });
  });
});
