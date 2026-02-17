import { describe, it, expect } from 'vitest';
import { CATEGORY_LABELS } from '../audit-log-utils';

describe('audit-log-utils', () => {
  describe('CATEGORY_LABELS', () => {
    it('全カテゴリのラベルが定義されている', () => {
      expect(CATEGORY_LABELS.AUTH).toBe('認証');
      expect(CATEGORY_LABELS.USER).toBe('ユーザー');
      expect(CATEGORY_LABELS.ORGANIZATION).toBe('組織');
      expect(CATEGORY_LABELS.MEMBER).toBe('メンバー');
      expect(CATEGORY_LABELS.PROJECT).toBe('プロジェクト');
      expect(CATEGORY_LABELS.API_TOKEN).toBe('APIトークン');
    });

    it('6つのカテゴリが存在する', () => {
      expect(Object.keys(CATEGORY_LABELS)).toHaveLength(6);
    });
  });
});
