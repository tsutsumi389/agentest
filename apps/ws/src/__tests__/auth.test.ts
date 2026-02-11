import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TEST_USER_ID, testUser, testJwtPayload } from './helpers.js';

// モックの設定
vi.mock('@agentest/auth', () => ({
  verifyAccessToken: vi.fn(),
  defaultAuthConfig: {},
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// モジュールインポート
import { verifyAccessToken } from '@agentest/auth';
import { prisma } from '@agentest/db';
import { authenticateToken, parseCookieToken, authenticateFromCookie } from '../auth.js';

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('authenticateToken', () => {
    it('有効なトークンでユーザー情報を返す', async () => {
      vi.mocked(verifyAccessToken).mockReturnValue(testJwtPayload);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        deletedAt: null,
      } as never);

      const result = await authenticateToken('valid-token');

      expect(result).toEqual({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
      });
      expect(verifyAccessToken).toHaveBeenCalledWith('valid-token', expect.anything());
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          deletedAt: true,
        },
      });
    });

    it('トークン検証に失敗した場合はnullを返す', async () => {
      vi.mocked(verifyAccessToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await authenticateToken('invalid-token');

      expect(result).toBeNull();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('ユーザーが見つからない場合はnullを返す', async () => {
      vi.mocked(verifyAccessToken).mockReturnValue(testJwtPayload);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await authenticateToken('valid-token');

      expect(result).toBeNull();
    });

    it('削除済みユーザーの場合はnullを返す', async () => {
      vi.mocked(verifyAccessToken).mockReturnValue(testJwtPayload);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        deletedAt: new Date(), // 削除済み
      } as never);

      const result = await authenticateToken('valid-token');

      expect(result).toBeNull();
    });

    it('avatarUrlがnullのユーザーも正しく返す', async () => {
      vi.mocked(verifyAccessToken).mockReturnValue(testJwtPayload);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: null,
        deletedAt: null,
      } as never);

      const result = await authenticateToken('valid-token');

      expect(result).toEqual({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: null,
      });
    });

    it('データベースエラーの場合はnullを返す', async () => {
      vi.mocked(verifyAccessToken).mockReturnValue(testJwtPayload);
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('DB Error'));

      const result = await authenticateToken('valid-token');

      expect(result).toBeNull();
    });
  });

  describe('parseCookieToken', () => {
    it('Cookieヘッダーからaccess_tokenを抽出する', () => {
      const cookie = 'access_token=my-jwt-token; other_cookie=value';
      expect(parseCookieToken(cookie)).toBe('my-jwt-token');
    });

    it('access_tokenのみの場合も抽出する', () => {
      const cookie = 'access_token=my-jwt-token';
      expect(parseCookieToken(cookie)).toBe('my-jwt-token');
    });

    it('access_tokenが存在しない場合はnullを返す', () => {
      const cookie = 'other_cookie=value; session=abc';
      expect(parseCookieToken(cookie)).toBeNull();
    });

    it('空文字のCookieヘッダーではnullを返す', () => {
      expect(parseCookieToken('')).toBeNull();
    });

    it('undefinedの場合はnullを返す', () => {
      expect(parseCookieToken(undefined)).toBeNull();
    });

    it('access_tokenの値が空の場合はnullを返す', () => {
      const cookie = 'access_token=; other=value';
      expect(parseCookieToken(cookie)).toBeNull();
    });

    it('複数のクッキーの間にaccess_tokenがある場合も抽出する', () => {
      const cookie = 'session=abc; access_token=my-token; theme=dark';
      expect(parseCookieToken(cookie)).toBe('my-token');
    });
  });

  describe('authenticateFromCookie', () => {
    it('有効なクッキーでユーザー情報を返す', async () => {
      vi.mocked(verifyAccessToken).mockReturnValue(testJwtPayload);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        deletedAt: null,
      } as never);

      const result = await authenticateFromCookie('access_token=valid-token');

      expect(result).toEqual({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
      });
      expect(verifyAccessToken).toHaveBeenCalledWith('valid-token', expect.anything());
    });

    it('クッキーにaccess_tokenがない場合はnullを返す', async () => {
      const result = await authenticateFromCookie('session=abc');

      expect(result).toBeNull();
      expect(verifyAccessToken).not.toHaveBeenCalled();
    });

    it('undefinedの場合はnullを返す', async () => {
      const result = await authenticateFromCookie(undefined);

      expect(result).toBeNull();
      expect(verifyAccessToken).not.toHaveBeenCalled();
    });

    it('トークンが無効の場合はnullを返す', async () => {
      vi.mocked(verifyAccessToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await authenticateFromCookie('access_token=invalid-token');

      expect(result).toBeNull();
    });
  });
});
