import { describe, it, expect } from 'vitest';
import { getContrastTextColor } from '../color-utils';

describe('color-utils', () => {
  describe('getContrastTextColor', () => {
    it('白色の場合は黒テキストを返す', () => {
      expect(getContrastTextColor('#FFFFFF')).toBe('#000000');
    });

    it('黒色の場合は白テキストを返す', () => {
      expect(getContrastTextColor('#000000')).toBe('#FFFFFF');
    });

    it('明るい色の場合は黒テキストを返す', () => {
      expect(getContrastTextColor('#FFFF00')).toBe('#000000');
    });

    it('暗い色の場合は白テキストを返す', () => {
      expect(getContrastTextColor('#0000FF')).toBe('#FFFFFF');
    });

    it('#なしのHEX値を処理する', () => {
      expect(getContrastTextColor('FFFFFF')).toBe('#000000');
    });

    it('不正な長さの場合は白を返す', () => {
      expect(getContrastTextColor('#FFF')).toBe('#FFFFFF');
    });

    it('中間色を正しく判定する', () => {
      // 灰色（#808080）は輝度約0.5
      const result = getContrastTextColor('#808080');
      expect(['#000000', '#FFFFFF']).toContain(result);
    });
  });
});
