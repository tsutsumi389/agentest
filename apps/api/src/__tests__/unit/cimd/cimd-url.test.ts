import { describe, it, expect } from 'vitest';
import { isCimdClientId, validateCimdUrl, CimdUrlError } from '../../../services/cimd/cimd-url.js';

describe('CIMD URL', () => {
  describe('isCimdClientId', () => {
    it('UUID形式はCIMDではない (DCR経路)', () => {
      expect(isCimdClientId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    });

    it('https URLはCIMD候補', () => {
      expect(isCimdClientId('https://example.com/.well-known/oauth-client/abc')).toBe(true);
    });

    it('http URLはCIMDではない (httpsのみ)', () => {
      expect(isCimdClientId('http://example.com/client')).toBe(false);
    });

    it('空文字や非URL文字列はCIMDではない', () => {
      expect(isCimdClientId('')).toBe(false);
      expect(isCimdClientId('not-a-url')).toBe(false);
    });
  });

  describe('validateCimdUrl', () => {
    it('正常なhttps URLを受け入れる', () => {
      expect(() => validateCimdUrl('https://example.com/client/abc')).not.toThrow();
      const url = validateCimdUrl('https://example.com/client/abc');
      expect(url.href).toBe('https://example.com/client/abc');
    });

    it('http スキームは拒否', () => {
      expect(() => validateCimdUrl('http://example.com/client')).toThrow(CimdUrlError);
    });

    it('fragmentが含まれる場合は拒否', () => {
      expect(() => validateCimdUrl('https://example.com/client#frag')).toThrow(CimdUrlError);
    });

    it('userinfo (username/password) が含まれる場合は拒否', () => {
      expect(() => validateCimdUrl('https://user:pass@example.com/client')).toThrow(CimdUrlError);
      expect(() => validateCimdUrl('https://user@example.com/client')).toThrow(CimdUrlError);
    });

    it('pathnameが空 ("/") の場合は拒否 (識別子がない)', () => {
      expect(() => validateCimdUrl('https://example.com/')).toThrow(CimdUrlError);
      expect(() => validateCimdUrl('https://example.com')).toThrow(CimdUrlError);
    });

    it('クエリ文字列はパス相当として受け入れる (識別子の一部になり得る)', () => {
      expect(() => validateCimdUrl('https://example.com/client?id=abc')).not.toThrow();
    });

    it('不正なURL文字列は拒否', () => {
      expect(() => validateCimdUrl('not-a-url')).toThrow(CimdUrlError);
      expect(() => validateCimdUrl('')).toThrow(CimdUrlError);
    });
  });
});
