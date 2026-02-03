import { describe, it, expect } from 'vitest';
import { getInvitationUrl } from '../url';

describe('url', () => {
  describe('getInvitationUrl', () => {
    it('招待URLを生成する', () => {
      const result = getInvitationUrl('abc123');
      expect(result).toBe('http://localhost:3000/invitations/abc123');
    });

    it('トークンに特殊文字を含む場合も生成する', () => {
      const result = getInvitationUrl('token-with-dashes');
      expect(result).toContain('/invitations/token-with-dashes');
    });
  });
});
