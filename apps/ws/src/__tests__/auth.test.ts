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
import { authenticateToken, extractTokenFromUrl } from '../auth.js';

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('extractTokenFromUrl', () => {
    it('URLからトークンを抽出できる', () => {
      const url = '/?token=abc123';
      const result = extractTokenFromUrl(url);
      expect(result).toBe('abc123');
    });

    it('完全なURLからトークンを抽出できる', () => {
      const url = 'ws://localhost:3002/?token=xyz789';
      const result = extractTokenFromUrl(url);
      expect(result).toBe('xyz789');
    });

    it('トークンがない場合はnullを返す', () => {
      const url = '/';
      const result = extractTokenFromUrl(url);
      expect(result).toBeNull();
    });

    it('空のURLでもエラーにならない', () => {
      const result = extractTokenFromUrl('');
      expect(result).toBeNull();
    });

    it('複数のクエリパラメータからtokenを抽出できる', () => {
      const url = '/?foo=bar&token=mytoken&baz=qux';
      const result = extractTokenFromUrl(url);
      expect(result).toBe('mytoken');
    });

    it('不正なURLでもエラーにならない', () => {
      // URLパースでエラーになるケースをテスト
      // new URL()は相対URLでもbaseがあれば動作するため、
      // この関数はほとんどのケースで動作する
      const result = extractTokenFromUrl('invalid-url');
      expect(result).toBeNull();
    });
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
});
