import { describe, it, expect } from 'vitest';
import {
  preconditionResultStatusConfig,
  preconditionResultStatusOptions,
  stepResultStatusConfig,
  stepResultStatusOptions,
  expectedResultStatusConfig,
  expectedResultStatusOptions,
  getPreconditionStatusConfig,
  getStepStatusConfig,
  getExpectedStatusConfig,
} from '../execution-status';

describe('execution-status', () => {
  describe('preconditionResultStatusConfig', () => {
    it('全ステータスが定義されている', () => {
      expect(preconditionResultStatusConfig.UNCHECKED).toBeDefined();
      expect(preconditionResultStatusConfig.MET).toBeDefined();
      expect(preconditionResultStatusConfig.NOT_MET).toBeDefined();
    });

    it('各ステータスにicon, colorClass, bgClass, labelが含まれる', () => {
      for (const config of Object.values(preconditionResultStatusConfig)) {
        expect(config).toHaveProperty('icon');
        expect(config).toHaveProperty('colorClass');
        expect(config).toHaveProperty('bgClass');
        expect(config).toHaveProperty('label');
      }
    });

    it('ラベルが正しい', () => {
      expect(preconditionResultStatusConfig.UNCHECKED.label).toBe('未確認');
      expect(preconditionResultStatusConfig.MET.label).toBe('満たす');
      expect(preconditionResultStatusConfig.NOT_MET.label).toBe('満たさない');
    });
  });

  describe('preconditionResultStatusOptions', () => {
    it('3つの選択肢がある', () => {
      expect(preconditionResultStatusOptions).toHaveLength(3);
    });
  });

  describe('stepResultStatusConfig', () => {
    it('全ステータスが定義されている', () => {
      expect(stepResultStatusConfig.PENDING).toBeDefined();
      expect(stepResultStatusConfig.DONE).toBeDefined();
      expect(stepResultStatusConfig.SKIPPED).toBeDefined();
    });

    it('ラベルが正しい', () => {
      expect(stepResultStatusConfig.PENDING.label).toBe('未実行');
      expect(stepResultStatusConfig.DONE.label).toBe('完了');
      expect(stepResultStatusConfig.SKIPPED.label).toBe('スキップ');
    });
  });

  describe('stepResultStatusOptions', () => {
    it('3つの選択肢がある', () => {
      expect(stepResultStatusOptions).toHaveLength(3);
    });
  });

  describe('expectedResultStatusConfig', () => {
    it('全ステータスが定義されている', () => {
      expect(expectedResultStatusConfig.PENDING).toBeDefined();
      expect(expectedResultStatusConfig.PASS).toBeDefined();
      expect(expectedResultStatusConfig.FAIL).toBeDefined();
      expect(expectedResultStatusConfig.SKIPPED).toBeDefined();
    });

    it('ラベルが正しい', () => {
      expect(expectedResultStatusConfig.PENDING.label).toBe('未判定');
      expect(expectedResultStatusConfig.PASS.label).toBe('成功');
      expect(expectedResultStatusConfig.FAIL.label).toBe('失敗');
      expect(expectedResultStatusConfig.SKIPPED.label).toBe('スキップ');
    });
  });

  describe('expectedResultStatusOptions', () => {
    it('4つの選択肢がある', () => {
      expect(expectedResultStatusOptions).toHaveLength(4);
    });
  });

  describe('getPreconditionStatusConfig', () => {
    it('ステータスに対応する設定を返す', () => {
      const config = getPreconditionStatusConfig('MET');
      expect(config.label).toBe('満たす');
      expect(config.icon).toBeDefined();
    });
  });

  describe('getStepStatusConfig', () => {
    it('ステータスに対応する設定を返す', () => {
      const config = getStepStatusConfig('DONE');
      expect(config.label).toBe('完了');
      expect(config.icon).toBeDefined();
    });
  });

  describe('getExpectedStatusConfig', () => {
    it('ステータスに対応する設定を返す', () => {
      const config = getExpectedStatusConfig('PASS');
      expect(config.label).toBe('成功');
      expect(config.icon).toBeDefined();
    });
  });
});
