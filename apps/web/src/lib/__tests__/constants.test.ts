import { describe, it, expect } from 'vitest';
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  TARGET_FIELD_LABELS,
  VERDICT_OPTIONS,
} from '../constants';

describe('constants', () => {
  describe('PRIORITY_COLORS', () => {
    it('全優先度の色が定義されている', () => {
      expect(PRIORITY_COLORS.CRITICAL).toBeDefined();
      expect(PRIORITY_COLORS.HIGH).toBeDefined();
      expect(PRIORITY_COLORS.MEDIUM).toBeDefined();
      expect(PRIORITY_COLORS.LOW).toBeDefined();
    });
  });

  describe('PRIORITY_LABELS', () => {
    it('全優先度のラベルが定義されている', () => {
      expect(PRIORITY_LABELS.CRITICAL).toBe('緊急');
      expect(PRIORITY_LABELS.HIGH).toBe('高');
      expect(PRIORITY_LABELS.MEDIUM).toBe('中');
      expect(PRIORITY_LABELS.LOW).toBe('低');
    });
  });

  describe('STATUS_COLORS', () => {
    it('全ステータスの色が定義されている', () => {
      expect(STATUS_COLORS.DRAFT).toBeDefined();
      expect(STATUS_COLORS.ACTIVE).toBeDefined();
      expect(STATUS_COLORS.ARCHIVED).toBeDefined();
    });
  });

  describe('STATUS_LABELS', () => {
    it('全ステータスのラベルが定義されている', () => {
      expect(STATUS_LABELS.DRAFT).toBe('下書き');
      expect(STATUS_LABELS.ACTIVE).toBe('アクティブ');
      expect(STATUS_LABELS.ARCHIVED).toBe('アーカイブ');
    });
  });

  describe('TARGET_FIELD_LABELS', () => {
    it('レビューターゲットフィールドのラベルが定義されている', () => {
      expect(TARGET_FIELD_LABELS.TITLE).toBe('全体');
      expect(TARGET_FIELD_LABELS.DESCRIPTION).toBe('説明');
      expect(TARGET_FIELD_LABELS.PRECONDITION).toBe('前提条件');
      expect(TARGET_FIELD_LABELS.STEP).toBe('ステップ');
      expect(TARGET_FIELD_LABELS.EXPECTED_RESULT).toBe('期待結果');
    });
  });

  describe('VERDICT_OPTIONS', () => {
    it('3つの評価オプションが定義されている', () => {
      expect(VERDICT_OPTIONS).toHaveLength(3);
    });

    it('承認オプションが含まれる', () => {
      const approved = VERDICT_OPTIONS.find((o) => o.value === 'APPROVED');
      expect(approved).toBeDefined();
      expect(approved?.label).toBe('承認');
    });

    it('要修正オプションが含まれる', () => {
      const changes = VERDICT_OPTIONS.find((o) => o.value === 'CHANGES_REQUESTED');
      expect(changes).toBeDefined();
      expect(changes?.label).toBe('要修正');
    });

    it('コメントのみオプションが含まれる', () => {
      const comment = VERDICT_OPTIONS.find((o) => o.value === 'COMMENT_ONLY');
      expect(comment).toBeDefined();
      expect(comment?.label).toBe('コメントのみ');
    });
  });
});
