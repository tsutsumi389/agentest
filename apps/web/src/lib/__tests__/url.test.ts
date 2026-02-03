import { describe, it, expect } from 'vitest';
import { getInvitationUrl } from '../url';

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
});
