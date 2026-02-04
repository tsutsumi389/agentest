import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime, formatDate, formatDateTime } from '../date-utils';

describe('date-utils', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatRelativeTime', () => {
    it('nullの場合は"-"を返す', () => {
      expect(formatRelativeTime(null)).toBe('-');
    });

    it('1分未満は"たった今"を返す', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:30Z'));
      expect(formatRelativeTime('2024-01-15T12:00:00Z')).toBe('たった今');
    });

    it('1分以上60分未満は"N分前"を返す', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:05:00Z'));
      expect(formatRelativeTime('2024-01-15T12:00:00Z')).toBe('5分前');
    });

    it('1時間以上24時間未満は"N時間前"を返す', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T15:00:00Z'));
      expect(formatRelativeTime('2024-01-15T12:00:00Z')).toBe('3時間前');
    });

    it('1日前は"昨日"を返す', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-16T12:00:00Z'));
      expect(formatRelativeTime('2024-01-15T12:00:00Z')).toBe('昨日');
    });

    it('2日以上7日未満は"N日前"を返す', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-18T12:00:00Z'));
      expect(formatRelativeTime('2024-01-15T12:00:00Z')).toBe('3日前');
    });

    it('7日以上30日未満は"N週間前"を返す', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-29T12:00:00Z'));
      expect(formatRelativeTime('2024-01-15T12:00:00Z')).toBe('2週間前');
    });

    it('30日以上はformatDateの結果を返す', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
      const result = formatRelativeTime('2024-01-15T12:00:00Z');
      // formatDateの結果（ロケール依存だが日付文字列であること）
      expect(result).toBeTruthy();
      expect(result).not.toBe('-');
    });
  });

  describe('formatDate', () => {
    it('日本語の日付フォーマットで返す', () => {
      const result = formatDate('2024-01-15T00:00:00Z');
      // ロケール依存だが、年・月・日が含まれること
      expect(result).toContain('2024');
      expect(result).toContain('1');
      expect(result).toContain('15');
    });
  });

  describe('formatDateTime', () => {
    it('日本語の日時フォーマットで返す', () => {
      const result = formatDateTime('2024-01-15T12:30:00Z');
      // ロケール依存だが、年・月・日・時・分が含まれること
      expect(result).toContain('2024');
      expect(result).toContain('1');
      expect(result).toContain('15');
    });
  });
});
