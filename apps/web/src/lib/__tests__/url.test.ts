import { describe, it, expect } from 'vitest';
import { getInvitationUrl, isSafeRedirect, getSafeRedirect } from '../url';

describe('url', () => {
  describe('getInvitationUrl', () => {
    it('招待URLを生成する', () => {
      const result = getInvitationUrl('abc123');
      expect(result).toBe(`${window.location.origin}/invitations/abc123`);
    });

    it('トークンにハイフンを含む場合も正しく生成する', () => {
      const result = getInvitationUrl('token-with-dashes');
      expect(result).toBe(`${window.location.origin}/invitations/token-with-dashes`);
    });

    it('特殊文字を含むトークンはエンコードされる', () => {
      const result = getInvitationUrl('token/with special&chars');
      expect(result).toBe(
        `${window.location.origin}/invitations/${encodeURIComponent('token/with special&chars')}`
      );
    });

    it('空文字列のトークンでもURLを生成する', () => {
      const result = getInvitationUrl('');
      expect(result).toBe(`${window.location.origin}/invitations/`);
    });
  });

  describe('isSafeRedirect', () => {
    it('内部パスを許可する', () => {
      expect(isSafeRedirect('/dashboard')).toBe(true);
      expect(isSafeRedirect('/projects/123')).toBe(true);
      expect(isSafeRedirect('/oauth/consent?client_id=abc')).toBe(true);
    });

    it('プロトコル相対URLを拒否する', () => {
      expect(isSafeRedirect('//evil.com')).toBe(false);
    });

    it('バックスラッシュによるバイパスを拒否する', () => {
      expect(isSafeRedirect('/\\evil.com')).toBe(false);
    });

    it('外部URLを拒否する', () => {
      expect(isSafeRedirect('https://evil.com')).toBe(false);
      expect(isSafeRedirect('http://evil.com')).toBe(false);
      expect(isSafeRedirect('javascript:alert(1)')).toBe(false);
    });

    it('空文字列を拒否する', () => {
      expect(isSafeRedirect('')).toBe(false);
    });
  });

  describe('getSafeRedirect', () => {
    it('安全な内部パスをそのまま返す', () => {
      expect(getSafeRedirect('/projects/123')).toBe('/projects/123');
      expect(getSafeRedirect('/dashboard')).toBe('/dashboard');
    });

    it('nullの場合はデフォルトのフォールバックを返す', () => {
      expect(getSafeRedirect(null)).toBe('/dashboard');
    });

    it('外部URLの場合はフォールバックを返す', () => {
      expect(getSafeRedirect('https://evil.com')).toBe('/dashboard');
      expect(getSafeRedirect('//evil.com')).toBe('/dashboard');
      expect(getSafeRedirect('/\\evil.com')).toBe('/dashboard');
    });

    it('カスタムフォールバックを指定できる', () => {
      expect(getSafeRedirect(null, '/home')).toBe('/home');
      expect(getSafeRedirect('https://evil.com', '/home')).toBe('/home');
    });
  });
});
