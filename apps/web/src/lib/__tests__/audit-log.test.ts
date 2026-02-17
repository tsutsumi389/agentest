import { describe, it, expect } from 'vitest';
import {
  isAuditLogCategoryKey,
  getAuditLogCategoryInfo,
  formatDetailValue,
  AUDIT_LOG_CATEGORIES,
  UNKNOWN_CATEGORY_INFO,
  EXCLUDED_DETAIL_FIELDS,
  KNOWN_FIELD_LABELS,
} from '../audit-log';

describe('audit-log', () => {
  describe('定数', () => {
    it('全カテゴリが定義されている', () => {
      expect(AUDIT_LOG_CATEGORIES.AUTH).toBeDefined();
      expect(AUDIT_LOG_CATEGORIES.USER).toBeDefined();
      expect(AUDIT_LOG_CATEGORIES.ORGANIZATION).toBeDefined();
      expect(AUDIT_LOG_CATEGORIES.MEMBER).toBeDefined();
      expect(AUDIT_LOG_CATEGORIES.PROJECT).toBeDefined();
      expect(AUDIT_LOG_CATEGORIES.API_TOKEN).toBeDefined();
    });

    it('各カテゴリにlabel, icon, color, bgColorが含まれる', () => {
      for (const cat of Object.values(AUDIT_LOG_CATEGORIES)) {
        expect(cat).toHaveProperty('label');
        expect(cat).toHaveProperty('icon');
        expect(cat).toHaveProperty('color');
        expect(cat).toHaveProperty('bgColor');
      }
    });

    it('除外フィールドが定義されている', () => {
      expect(EXCLUDED_DETAIL_FIELDS.has('id')).toBe(true);
      expect(EXCLUDED_DETAIL_FIELDS.has('userId')).toBe(true);
      expect(EXCLUDED_DETAIL_FIELDS.has('organizationId')).toBe(true);
      expect(EXCLUDED_DETAIL_FIELDS.has('createdAt')).toBe(true);
      expect(EXCLUDED_DETAIL_FIELDS.has('updatedAt')).toBe(true);
    });

    it('既知のフィールドラベルが定義されている', () => {
      expect(KNOWN_FIELD_LABELS.email).toBe('メールアドレス');
      expect(KNOWN_FIELD_LABELS.name).toBe('名前');
      expect(KNOWN_FIELD_LABELS.role).toBe('ロール');
    });
  });

  describe('isAuditLogCategoryKey', () => {
    it('有効なカテゴリキーの場合はtrueを返す', () => {
      expect(isAuditLogCategoryKey('AUTH')).toBe(true);
      expect(isAuditLogCategoryKey('USER')).toBe(true);
      expect(isAuditLogCategoryKey('API_TOKEN')).toBe(true);
    });

    it('無効なカテゴリキーの場合はfalseを返す', () => {
      expect(isAuditLogCategoryKey('INVALID')).toBe(false);
      expect(isAuditLogCategoryKey('')).toBe(false);
    });
  });

  describe('getAuditLogCategoryInfo', () => {
    it('有効なカテゴリの情報を返す', () => {
      const info = getAuditLogCategoryInfo('AUTH');
      expect(info.label).toBe('認証');
    });

    it('無効なカテゴリの場合はカテゴリ名をラベルとして返す', () => {
      const info = getAuditLogCategoryInfo('CUSTOM');
      expect(info.label).toBe('CUSTOM');
      expect(info.icon).toBe(UNKNOWN_CATEGORY_INFO.icon);
    });
  });

  describe('formatDetailValue', () => {
    it('nullの場合はハイフンを返す', () => {
      expect(formatDetailValue(null)).toBe('-');
    });

    it('undefinedの場合はハイフンを返す', () => {
      expect(formatDetailValue(undefined)).toBe('-');
    });

    it('文字列をそのまま返す', () => {
      expect(formatDetailValue('test')).toBe('test');
    });

    it('空文字列の場合はハイフンを返す', () => {
      expect(formatDetailValue('')).toBe('-');
    });

    it('数値を文字列に変換する', () => {
      expect(formatDetailValue(42)).toBe('42');
    });

    it('booleanを文字列に変換する', () => {
      expect(formatDetailValue(true)).toBe('true');
      expect(formatDetailValue(false)).toBe('false');
    });

    it('配列をカンマ区切りの文字列に変換する', () => {
      expect(formatDetailValue(['a', 'b', 'c'])).toBe('a, b, c');
    });

    it('空配列の場合はハイフンを返す', () => {
      expect(formatDetailValue([])).toBe('-');
    });

    it('オブジェクトをJSON文字列に変換する', () => {
      const result = formatDetailValue({ key: 'value' });
      expect(result).toContain('"key"');
      expect(result).toContain('"value"');
    });
  });
});
