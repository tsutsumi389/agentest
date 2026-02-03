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

    it('特殊文字を含むトークンをそのまま埋め込む', () => {
      const result = getInvitationUrl('token/with%20special&chars');
      expect(result).toBe(`${window.location.origin}/invitations/token/with%20special&chars`);
    });
  });
});
